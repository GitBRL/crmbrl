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

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import type { Setor } from '../../nucleo/setores/setores';
import { SetoresService } from '../../nucleo/setores/setores.service';
import { Botao } from '../../ui/botao/botao';
import {
  acessosAlterados,
  corpoDosAcessos,
  EditorDeAcessos,
  type LinhaEditavel,
  type PessoaEscolhivel,
  pessoaEscolhivel,
  type SetorEscolhivel,
  linhasDeAcessos,
} from '../../ui/editor-de-acessos/editor-de-acessos';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../ui/modal/modal';
import { ConfiguracoesApi } from './configuracoes.api';
import { SetoresApi } from './setores.api';
import { DICA_ACESSOS_DO_SETOR } from './setores-regras';

/**
 * "Quem mais vê este setor" (R5.11), para Admin, C-level e líderes do setor: setores inteiros e
 * pessoas de fora que ganham acesso aos funis do setor com visibilidade "Todo o setor". A lista
 * enviada substitui a atual. Os erros 400 saem na linha certa e os 422 R5.11 no fim da lista.
 */
@Component({
  selector: 'app-setores-acessos',
  imports: [Botao, EditorDeAcessos, EstadoVazio, Modal],
  template: `
    <app-modal
      [titulo]="'Quem mais vê ' + (setor()?.nome ?? '')"
      [aberto]="setor() !== null"
      largura="lg"
      (fechado)="fechado.emit()"
    >
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
          [aviso]="aviso"
          (buscarPessoas)="carregarPessoas($event)"
          (salvar)="salvar()"
          (descartar)="descartar()"
        />
      }
    </app-modal>
  `,
  styles: `
    .carregando {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetoresAcessos {
  /** O setor cujos acessos aparecem; `null` = fechado. */
  readonly setor = input<Setor | null>(null);
  readonly fechado = output<void>();

  private readonly api = inject(SetoresApi);
  private readonly usuarios = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly setores = inject(SetoresService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly aviso = DICA_ACESSOS_DO_SETOR;

  protected readonly carregado = signal(false);
  protected readonly erroDeLeitura = signal<string | null>(null);
  protected readonly linhas = signal<readonly LinhaEditavel[]>([]);
  private readonly salvas = signal<readonly LinhaEditavel[]>([]);
  private readonly pessoas = signal<readonly PessoaEscolhivel[]>([]);
  private buscaDePessoas = 0;
  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly errosDasLinhas = signal<Readonly<Record<string, string>>>({});

  protected readonly alterado = computed(() => acessosAlterados(this.linhas(), this.salvas()));
  protected readonly setoresEscolhiveis = computed<readonly SetorEscolhivel[]>(() =>
    this.setores
      .ativos()
      .filter((item) => item.chave !== this.setor()?.chave)
      .map((item) => ({ chave: item.chave, nome: item.nome })),
  );
  protected readonly pessoasEscolhiveis = computed<readonly PessoaEscolhivel[]>(() =>
    this.pessoas().filter((pessoa) => pessoa.area !== this.setor()?.chave),
  );

  constructor() {
    void this.setores.carregar();
    effect(() => {
      if (this.setor()) {
        untracked(() => {
          this.carregado.set(false);
          void this.carregarPessoas();
          void this.carregar();
        });
      }
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
    const chave = this.setor()?.chave;
    if (!chave) {
      return;
    }
    this.erroDeLeitura.set(null);
    try {
      const dados = await this.api.acessos(chave);
      const linhas = linhasDeAcessos(dados.acessos);
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
    const chave = this.setor()?.chave;
    if (!chave || this.salvando() || !this.alterado()) {
      return;
    }
    this.salvando.set(true);
    const enviadas = this.linhas();
    try {
      const dados = await this.api.substituirAcessos(chave, corpoDosAcessos(enviadas));
      const linhas = linhasDeAcessos(dados.acessos);
      this.linhas.set(linhas);
      this.salvas.set(linhas);
      this.avisos.sucesso(`Acessos de “${dados.nomeSetor}” salvos.`);
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
