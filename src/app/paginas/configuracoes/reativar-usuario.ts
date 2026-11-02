import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import type { Papel } from '../../nucleo/papeis';
import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { ConfiguracoesApi } from './configuracoes.api';
import type { Usuario } from './configuracoes.modelos';
import { OPCOES_PAPEL } from './formulario-usuario';
import {
  AJUDA_LIDER,
  explicacaoDoLider,
  liderEsperado,
  primeiroNome,
  semLiderDisponivel,
} from './hierarquia';
import { CandidatosALider } from './lideres';

/**
 * Reativar usuário (TELAS-FASE1 §6, R7.5): exige um líder válido para o papel (o de antes ou
 * um novo) e avisa que o que foi encaminhado no desligamento não volta.
 */
@Component({
  selector: 'app-reativar-usuario',
  imports: [Modal, Botao, Seletor],
  template: `
    <app-modal [titulo]="'Reativar ' + nome()" [aberto]="aberto()" (fechado)="fechar()">
      <form class="reativar" novalidate [id]="idFormulario" (submit)="reativar($event)">
        <p class="reativar__frase">
          {{ primeiro() }} volta a entrar no CRM com a senha de antes. O que foi encaminhado no
          desligamento continua com quem recebeu.
        </p>

        <div class="reativar__par">
          <app-seletor
            rotulo="Papel"
            dica="Mude se a pessoa volta em outra função."
            [opcoes]="opcoesPapel"
            [valor]="papel()"
            (valorChange)="aoMudarPapel($event)"
          />
          @if (liderNecessario()) {
            <app-seletor
              rotulo="Líder"
              [placeholder]="
                lideres.carregando() ? 'Carregando quem pode liderar…' : 'Escolha o líder'
              "
              [ajuda]="ajudaLider"
              [dica]="explicacaoLider()"
              [erro]="erroLider()"
              [opcoes]="opcoesLider()"
              [valor]="liderId()"
              (valorChange)="liderId.set($event); tentouEnviar.set(false)"
            />
          } @else {
            <div class="reativar__sem-lider" role="note">
              <span class="reativar__rotulo">Líder</span>
              <p>{{ explicacaoLider() }}</p>
            </div>
          }
        </div>

        <p class="reativar__nota">
          Se {{ primeiro() }} não lembrar a senha, defina uma senha temporária depois de reativar.
        </p>

        @if (erro(); as erro) {
          <p class="reativar__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>

      <div modal-rodape class="reativar__acoes">
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [attr.form]="idFormulario"
          [carregando]="enviando()"
        >
          Reativar {{ primeiro() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .reativar {
      display: grid;
      gap: var(--esp-5);
    }

    .reativar__frase {
      color: var(--cor-texto-suave);
    }

    .reativar__par {
      display: grid;
      gap: var(--esp-5);
    }

    .reativar__sem-lider {
      display: grid;
      gap: var(--esp-2);
      padding-inline: var(--esp-4);

      p {
        color: var(--cor-texto-suave);
        font: var(--fonte-legenda-lg);
      }
    }

    .reativar__rotulo {
      font: var(--fonte-rotulo);
    }

    .reativar__nota {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda-lg);
    }

    .reativar__erro {
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
      font-weight: 500;
    }

    .reativar__acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReativarUsuario {
  /** Quem será reativado; `null` = fechado. */
  readonly usuario = input<Usuario | null>(null);
  readonly reativado = output<Usuario>();
  readonly fechado = output<void>();

  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);

  protected readonly idFormulario = gerarId('reativar');
  protected readonly opcoesPapel = OPCOES_PAPEL;
  protected readonly ajudaLider = AJUDA_LIDER;
  protected readonly lideres = new CandidatosALider(this.api);
  protected readonly papel = signal<Papel | null>(null);
  protected readonly liderId = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly tentouEnviar = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  /** Erro da API sobre o líder (R1.2/R7.5), mostrado no campo. */
  private readonly erroDoLider = signal<string | null>(null);

  protected readonly aberto = computed(() => this.usuario() !== null);
  protected readonly nome = computed(() => this.usuario()?.nome ?? '');
  protected readonly primeiro = computed(() => primeiroNome(this.nome()));
  protected readonly liderNecessario = computed(() => {
    const papel = this.papel();
    return papel !== null && liderEsperado(papel) !== null;
  });
  protected readonly explicacaoLider = computed(() => explicacaoDoLider(this.papel()));
  protected readonly opcoesLider = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.lideres.candidatos() ?? [])
      .filter((candidato) => candidato.id !== this.usuario()?.id)
      .map((candidato) => ({ valor: candidato.id, rotulo: candidato.nome })),
  );
  protected readonly erroLider = computed(() => {
    const papel = this.papel();
    if (!papel || !this.liderNecessario()) {
      return null;
    }
    if (this.lideres.erro()) {
      return `Não conseguimos carregar quem pode liderar: ${this.lideres.erro()!.resumo}`;
    }
    if (this.lideres.candidatos() !== null && this.opcoesLider().length === 0) {
      return semLiderDisponivel(papel);
    }
    if (this.erroDoLider()) {
      return this.erroDoLider();
    }
    return this.tentouEnviar() && !this.liderId() ? 'Escolha o líder.' : null;
  });

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      if (usuario) {
        untracked(() => this.comecar(usuario));
      }
    });
  }

  protected fechar(): void {
    this.fechado.emit();
  }

  protected aoMudarPapel(papel: Papel | null): void {
    this.papel.set(papel);
    this.erroDoLider.set(null);
    void this.carregarLideres(papel);
  }

  protected async reativar(evento: Event): Promise<void> {
    evento.preventDefault();
    const usuario = this.usuario();
    const papel = this.papel();
    if (!usuario || !papel || this.enviando()) {
      return;
    }
    this.tentouEnviar.set(true);
    this.erro.set(null);
    if (this.liderNecessario() && (!this.liderId() || this.erroLider())) {
      return;
    }
    this.enviando.set(true);
    try {
      const reativado = await this.api.reativar(usuario.id, {
        ...(papel !== usuario.papel ? { papel } : {}),
        liderId: this.liderNecessario() ? this.liderId() : null,
      });
      this.avisos.sucesso(`${reativado.nome} foi reativado(a) e já pode entrar no CRM.`);
      this.reativado.emit(reativado);
      this.fechado.emit();
    } catch (falha) {
      const erro = erroDaApi(falha);
      if ((erro.regra === 'R1.2' || erro.regra === 'R7.5') && this.liderNecessario()) {
        this.erroDoLider.set(erro.resumo);
      } else {
        this.erro.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  private comecar(usuario: Usuario): void {
    this.erro.set(null);
    this.erroDoLider.set(null);
    this.enviando.set(false);
    this.tentouEnviar.set(false);
    this.papel.set(usuario.papel);
    // O líder de antes, se ainda puder liderar; senão, a pessoa escolhe.
    this.liderId.set(usuario.lider?.ativo ? usuario.lider.id : null);
    this.lideres.esquecer();
    this.lideres.reiniciar();
    void this.carregarLideres(usuario.papel);
  }

  private async carregarLideres(papel: Papel | null): Promise<void> {
    const candidatos = await this.lideres.carregar(papel);
    if (candidatos === null) {
      return;
    }
    const opcoes = this.opcoesLider();
    if (!opcoes.some((opcao) => opcao.valor === this.liderId())) {
      this.liderId.set(opcoes.length === 1 ? opcoes[0].valor : null);
    }
  }
}
