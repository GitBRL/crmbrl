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
  viewChild,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SENHA_MAXIMO, SENHA_MINIMO } from '../../nucleo/sessao/perfil';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';
import { ConfiguracoesApi } from './configuracoes.api';
import type { Usuario } from './configuracoes.modelos';
import { primeiroNome } from './hierarquia';
import { gerarSenha } from './textos';

/**
 * Senha temporária (TELAS-FASE1 §6, R2.8): o Admin define uma senha para alguém (que esqueceu
 * a dela, ou sem e-mail para o convite). As sessões da pessoa são encerradas e ela troca a
 * senha no próximo acesso.
 */
@Component({
  selector: 'app-senha-temporaria',
  imports: [Modal, Botao, CampoSenha],
  template: `
    <app-modal
      largura="sm"
      [titulo]="'Senha temporária para ' + primeiro()"
      [aberto]="aberto()"
      (fechado)="fechar()"
    >
      <form class="senha" novalidate [id]="idFormulario" (submit)="definir($event)">
        <p class="senha__frase">
          As sessões abertas de {{ primeiro() }} são encerradas na hora. No próximo acesso, o CRM
          pede que a pessoa crie uma senha nova, que só ela sabe.
        </p>
        <app-campo-senha
          #campo
          rotulo="Senha temporária"
          autocomplete="new-password"
          [dica]="
            'De ' + minimo + ' a ' + maximo + ' caracteres. Passe a senha por um canal seguro.'
          "
          [erro]="mensagemErro()"
          [valor]="senha()"
          (valorChange)="senha.set($event); erroCampo.set(null)"
        />
        <button appBotao type="button" variante="contorno" tamanho="sm" (click)="gerar()">
          Gerar senha forte
        </button>
        @if (erro(); as erro) {
          <p class="senha__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>
      <div modal-rodape class="senha__acoes">
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [attr.form]="idFormulario"
          [carregando]="enviando()"
        >
          Definir senha
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .senha {
      display: grid;
      gap: var(--esp-4);
      justify-items: start;

      app-campo-senha {
        justify-self: stretch;
      }
    }

    .senha__frase {
      color: var(--cor-texto-suave);
    }

    .senha__erro {
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
      font-weight: 500;
    }

    .senha__acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenhaTemporaria {
  /** Para quem; `null` = fechado. */
  readonly usuario = input<Usuario | null>(null);
  readonly definida = output<Usuario>();
  readonly fechado = output<void>();

  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly campo = viewChild<CampoSenha>('campo');

  protected readonly idFormulario = gerarId('senha-temporaria');
  protected readonly minimo = SENHA_MINIMO;
  protected readonly maximo = SENHA_MAXIMO;
  protected readonly senha = signal('');
  protected readonly enviando = signal(false);
  protected readonly tentouEnviar = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroCampo = signal<string | null>(null);

  protected readonly aberto = computed(() => this.usuario() !== null);
  protected readonly primeiro = computed(() => primeiroNome(this.usuario()?.nome ?? ''));
  protected readonly mensagemErro = computed(() => {
    if (this.erroCampo()) {
      return this.erroCampo();
    }
    if (!this.tentouEnviar()) {
      return null;
    }
    const tamanho = this.senha().length;
    if (tamanho === 0) {
      return 'Digite a senha ou use “Gerar senha forte”.';
    }
    if (tamanho < SENHA_MINIMO) {
      return `Use pelo menos ${SENHA_MINIMO} caracteres.`;
    }
    return tamanho > SENHA_MAXIMO ? `Use no máximo ${SENHA_MAXIMO} caracteres.` : null;
  });

  constructor() {
    effect(() => {
      if (this.usuario()) {
        untracked(() => {
          this.senha.set('');
          this.erro.set(null);
          this.erroCampo.set(null);
          this.tentouEnviar.set(false);
          this.enviando.set(false);
        });
      }
    });
  }

  protected fechar(): void {
    this.fechado.emit();
  }

  protected gerar(): void {
    this.senha.set(gerarSenha());
    this.erroCampo.set(null);
    this.campo()?.visivel.set(true);
  }

  protected async definir(evento: Event): Promise<void> {
    evento.preventDefault();
    const usuario = this.usuario();
    if (!usuario || this.enviando()) {
      return;
    }
    this.tentouEnviar.set(true);
    this.erro.set(null);
    if (this.mensagemErro()) {
      this.campo()?.focar();
      return;
    }
    this.enviando.set(true);
    try {
      const atualizado = await this.api.definirSenhaTemporaria(usuario.id, this.senha());
      this.avisos.sucesso(
        `Senha temporária definida para ${atualizado.nome}. A troca é pedida no próximo acesso.`,
      );
      this.definida.emit(atualizado);
      this.fechado.emit();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doCampo = erro.mensagemDoCampo('senha');
      if (doCampo) {
        this.erroCampo.set(doCampo);
        this.campo()?.focar();
      } else {
        this.erro.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
