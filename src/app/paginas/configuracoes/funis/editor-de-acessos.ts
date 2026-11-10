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
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { SetoresService } from '../../../nucleo/setores/setores.service';
import { Botao } from '../../../ui/botao/botao';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import {
  acessosAlterados,
  corpoDosAcessos,
  EditorDeAcessos as EditorDeAcessosUi,
  linhasDeAcessos,
  type LinhaEditavel,
  pessoaEscolhivel,
  type PessoaEscolhivel,
  type SetorEscolhivel,
} from '../../../ui/editor-de-acessos/editor-de-acessos';
import { ConfiguracoesApi } from '../configuracoes.api';
import { FunisApi } from '../../funis/funis.api';
import type { VisibilidadeFunil } from '../../funis/funis.tipos';

export {
  acessosAlterados,
  comAcesso,
  corpoDosAcessos,
  linhasDeAcessos,
} from '../../../ui/editor-de-acessos/editor-de-acessos';
export type { LinhaEditavel };

const AVISO_RESTRITA =
  'Este funil é restrito: do setor dono só os líderes o veem, e as demais pessoas só entram por esta lista. Os acessos gerais do setor não valem aqui.';

/**
 * Acessos extras de um funil (R5.11), só para quem configura: carrega `GET /funis/:id/acessos`,
 * entrega a lista ao editor genérico (`ui/editor-de-acessos`) e salva com `PUT` (a lista enviada
 * substitui a atual). Mostra os erros 400 por linha e os 422 `R5.11` no fim.
 */
@Component({
  selector: 'app-editor-de-acessos-do-funil',
  imports: [Botao, EditorDeAcessosUi, EstadoVazio],
  template: `
    @if (erroDeLeitura(); as mensagem) {
      <app-estado-vazio
        variante="erro"
        titulo="Não conseguimos carregar os acessos"
        [texto]="mensagem"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="iconeTentar"
          (click)="carregar()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (!carregado()) {
      <p class="carregando" role="status">Carregando os acessos…</p>
    } @else {
      <app-editor-de-acessos
        [(linhas)]="linhas"
        [setores]="setoresEscolhiveis()"
        [pessoas]="pessoasEscolhiveis()"
        [alterado]="alterado()"
        [salvando]="salvando()"
        [erroGeral]="erroGeral()"
        [errosDasLinhas]="errosDasLinhas()"
        [aviso]="restrita() ? avisoRestrita : null"
        (buscarPessoas)="carregarPessoas($event)"
        (salvar)="salvar()"
        (descartar)="descartar()"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .carregando {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorDeAcessos {
  readonly funilId = input.required<string>();
  /** Setor dono do funil: não entra como alvo (R5.11). */
  readonly areaDona = input.required<string>();
  /** Visibilidade que a tela já conhece (muda sem recarregar a lista). */
  readonly visibilidadeDoFunil = input<VisibilidadeFunil | null>(null);
  /** A lista foi salva. */
  readonly salvo = output<void>();

  private readonly api = inject(FunisApi);
  private readonly usuarios = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly setores = inject(SetoresService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly avisoRestrita = AVISO_RESTRITA;

  protected readonly carregado = signal(false);
  protected readonly erroDeLeitura = signal<string | null>(null);
  private readonly visibilidade = signal<VisibilidadeFunil>('SETOR');
  protected readonly linhas = signal<readonly LinhaEditavel[]>([]);
  private readonly salvas = signal<readonly LinhaEditavel[]>([]);
  private readonly pessoas = signal<readonly PessoaEscolhivel[]>([]);
  private buscaDePessoas = 0;
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly errosDasLinhas = signal<Readonly<Record<string, string>>>({});

  protected readonly restrita = computed(
    () => (this.visibilidadeDoFunil() ?? this.visibilidade()) === 'RESTRITA',
  );
  protected readonly alterado = computed(() => acessosAlterados(this.linhas(), this.salvas()));
  protected readonly setoresEscolhiveis = computed<readonly SetorEscolhivel[]>(() =>
    this.setores
      .ativos()
      .filter((setor) => setor.chave !== this.areaDona())
      .map((setor) => ({ chave: setor.chave, nome: setor.nome })),
  );
  protected readonly pessoasEscolhiveis = computed<readonly PessoaEscolhivel[]>(() =>
    this.pessoas(),
  );

  constructor() {
    void this.setores.carregar();
    void this.carregarPessoas();
    effect(() => {
      this.funilId();
      untracked(() => void this.carregar());
    });
    // Mexeu na lista: some o erro da tentativa anterior.
    effect(() => {
      this.linhas();
      untracked(() => {
        this.erroGeral.set(null);
        this.errosDasLinhas.set({});
      });
    });
  }

  protected async carregar(): Promise<void> {
    this.erroDeLeitura.set(null);
    try {
      const dados = await this.api.acessosDoFunil(this.funilId());
      const linhas = linhasDeAcessos(dados.acessos);
      this.visibilidade.set(dados.visibilidade);
      this.linhas.set(linhas);
      this.salvas.set(linhas);
      this.carregado.set(true);
    } catch (falha) {
      this.erroDeLeitura.set(erroDaApi(falha).resumo);
    }
  }

  /** Pessoas ativas de qualquer setor (`GET /usuarios/opcoes`), buscando pelo nome digitado. */
  protected async carregarPessoas(busca = ''): Promise<void> {
    const versao = ++this.buscaDePessoas;
    try {
      const opcoes = await this.usuarios.opcoesDePessoas(busca);
      if (versao === this.buscaDePessoas) {
        this.pessoas.set(opcoes.map(pessoaEscolhivel));
      }
    } catch {
      // Sem a lista de pessoas só dá para escolher setor.
      if (versao === this.buscaDePessoas) {
        this.pessoas.set([]);
      }
    }
  }

  protected descartar(): void {
    this.linhas.set(this.salvas());
  }

  protected async salvar(): Promise<void> {
    if (this.salvando() || !this.alterado()) {
      return;
    }
    this.salvando.set(true);
    const enviadas = this.linhas();
    try {
      const dados = await this.api.substituirAcessos(this.funilId(), corpoDosAcessos(enviadas));
      const linhas = linhasDeAcessos(dados.acessos);
      this.visibilidade.set(dados.visibilidade);
      this.linhas.set(linhas);
      this.salvas.set(linhas);
      this.avisos.sucesso('Acessos do funil salvos.');
      this.salvo.emit();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const porLinha: Record<string, string> = {};
      for (const { campo } of erro.campos) {
        const indice = /^acessos\.(\d+)/.exec(campo)?.[1];
        const linha = indice === undefined ? undefined : enviadas[Number(indice)];
        const mensagem = erro.mensagemDoCampo(campo);
        if (linha && mensagem) {
          porLinha[linha.chave] = mensagem;
        }
      }
      // O efeito acima limpa os erros quando `linhas` muda; aqui `linhas` não mudou.
      this.errosDasLinhas.set(porLinha);
      if (!Object.keys(porLinha).length) {
        this.erroGeral.set(
          erro.regra === 'R5.11' || erro.status === 400 || erro.status === 422
            ? erro.mensagem
            : erro.resumo,
        );
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
