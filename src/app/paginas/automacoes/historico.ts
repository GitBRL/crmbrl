import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { AvisosService } from '../../nucleo/avisos.service';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { AutomacoesApi } from './automacoes.api';
import {
  type Execucao,
  type ExecucaoDetalhe,
  ROTULO_STATUS_EXECUCAO,
  VARIANTE_STATUS_EXECUCAO,
} from './automacoes.tipos';
import { DetalheExecucao } from './detalhe-execucao';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'automacao', rotulo: 'Automação', noCartao: 'titulo' },
  { id: 'contato', rotulo: 'Contato' },
  { id: 'status', rotulo: 'Situação', largura: '9rem' },
  { id: 'quando', rotulo: 'Começou', largura: '10rem' },
  { id: 'passos', rotulo: 'Passos feitos', alinhar: 'fim', largura: '8rem' },
];

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'TODAS', rotulo: 'Todas' },
  { id: 'FALHOU', rotulo: 'Com erro' },
  { id: 'AGUARDANDO', rotulo: 'Esperando' },
  { id: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
  { id: 'CONCLUIDA', rotulo: 'Concluídas' },
  { id: 'CANCELADA', rotulo: 'Canceladas' },
];

/**
 * Histórico de execuções: tudo o que as automações já fizeram, com filtro por situação, os testes
 * à parte e o passo a passo de cada execução num painel (com "Tentar de novo" para as que falharam).
 * Sem `automacaoId` mostra todas as automações; com ele, só a daquela automação.
 */
@Component({
  selector: 'app-historico-automacoes',
  imports: [
    CaixaSelecao,
    CelulaTabela,
    DetalheExecucao,
    EstadoVazio,
    FiltrosPilula,
    Paginacao,
    PainelLateral,
    Selo,
    Tabela,
  ],
  template: `
    <div class="filtros">
      <app-filtros-pilula
        rotulo="Situação da execução"
        [opcoes]="filtros"
        [selecionado]="status()"
        (selecionadoChange)="mudarStatus($event)"
      />
      <app-caixa-selecao
        rotulo="Ver só os testes"
        [valor]="soTestes()"
        (valorChange)="mudarTestes($event)"
      />
    </div>

    @if (erro(); as falha) {
      <app-estado-vazio
        variante="erro"
        titulo="Não foi possível carregar o histórico"
        texto="Tente de novo em instantes."
        [falha]="falha"
      >
        <button type="button" class="link" (click)="carregar()">Tentar de novo</button>
      </app-estado-vazio>
    } @else if (!carregando() && itens().length === 0) {
      <app-estado-vazio
        titulo="Nenhuma execução por aqui"
        [texto]="
          soTestes()
            ? 'Use “Testar” no editor para ver como a automação se comporta.'
            : 'Quando uma automação rodar, o que ela fez aparece nesta lista.'
        "
      />
    } @else {
      <app-tabela
        rotulo="Execuções das automações"
        clicavel
        colunaPrincipal="automacao"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="carregando()"
        (abrir)="abrir($event)"
      >
        <ng-template appCelula="automacao" [appCelulaDe]="itens()" let-e>
          {{ e.automacaoNome }}
          @if (e.teste) {
            <app-selo tamanho="sm" variante="contorno">Teste</app-selo>
          }
        </ng-template>
        <ng-template appCelula="contato" [appCelulaDe]="itens()" let-e>
          {{ e.contato?.nome ?? '—' }}
        </ng-template>
        <ng-template appCelula="status" [appCelulaDe]="itens()" let-e>
          <app-selo tamanho="sm" ponto [variante]="variante(e)">{{ rotulo(e) }}</app-selo>
        </ng-template>
        <ng-template appCelula="quando" [appCelulaDe]="itens()" let-e>
          <time [attr.datetime]="e.iniciadaEm" [title]="dataHora(e.iniciadaEm)">{{
            tempo(e.iniciadaEm)
          }}</time>
        </ng-template>
        <ng-template appCelula="passos" [appCelulaDe]="itens()" let-e>
          {{ e.passosExecutados }}
        </ng-template>
      </app-tabela>
      <app-paginacao
        rotulo="Páginas do histórico"
        [total]="total()"
        [(pagina)]="pagina"
        [porPagina]="20"
        (paginaChange)="carregar()"
      />
    }

    <app-painel-lateral
      largura="lg"
      titulo="Execução"
      complemento="Passo a passo do que a automação fez."
      [(aberto)]="painelAberto"
    >
      @if (detalhe(); as d) {
        <app-detalhe-execucao
          [execucao]="d"
          [ocupado]="ocupado()"
          (reexecutar)="reexecutar($event)"
          (cancelar)="cancelarExecucao($event)"
        />
      } @else if (erroDetalhe(); as falha) {
        <app-estado-vazio
          variante="erro"
          compacto
          titulo="Não foi possível abrir"
          [falha]="falha"
        />
      } @else {
        <p class="carregando" role="status">Carregando…</p>
      }
    </app-painel-lateral>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
      min-width: 0;
    }
    .carregando {
      margin: 0;
      color: var(--cor-texto-suave);
    }
    .link {
      border: 0;
      background: none;
      color: var(--cor-link, inherit);
      text-decoration: underline;
      cursor: pointer;
      font: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricoAutomacoes {
  private readonly api = inject(AutomacoesApi);
  private readonly avisos = inject(AvisosService);

  /** Mostra só as execuções desta automação. */
  readonly automacaoId = input<string | null>(null);

  protected readonly colunas = COLUNAS;
  protected readonly filtros = FILTROS;
  protected readonly status = signal('TODAS');
  protected readonly soTestes = signal(false);
  protected readonly pagina = signal(1);
  protected readonly itens = signal<readonly Execucao[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly painelAberto = signal(false);
  protected readonly detalhe = signal<ExecucaoDetalhe | null>(null);
  protected readonly erroDetalhe = signal<ErroApi | null>(null);
  protected readonly ocupado = signal(false);
  private sequencia = 0;

  constructor() {
    effect(() => {
      this.automacaoId();
      untracked(() => {
        this.pagina.set(1);
        void this.carregar();
      });
    });
  }

  protected variante(e: Execucao) {
    return VARIANTE_STATUS_EXECUCAO[e.status];
  }
  protected rotulo(e: Execucao): string {
    return ROTULO_STATUS_EXECUCAO[e.status];
  }
  protected dataHora(v: string): string {
    return formatarDataHora(v);
  }
  protected tempo(v: string): string {
    return formatarTempoRelativo(v);
  }

  protected mudarStatus(valor: string | null): void {
    this.status.set(valor ?? 'TODAS');
    this.pagina.set(1);
    void this.carregar();
  }

  protected mudarTestes(valor: boolean): void {
    this.soTestes.set(valor);
    this.pagina.set(1);
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const minha = ++this.sequencia;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.api.execucoes({
        ...(this.automacaoId() ? { automacaoId: this.automacaoId() as string } : {}),
        ...(this.status() !== 'TODAS' ? { status: this.status() } : {}),
        ...(this.soTestes() ? { teste: true } : {}),
        pagina: this.pagina(),
        porPagina: 20,
      });
      if (minha !== this.sequencia) return;
      this.itens.set(r.itens);
      this.total.set(r.total);
    } catch (falha) {
      if (minha === this.sequencia) this.erro.set(erroDaApi(falha));
    } finally {
      if (minha === this.sequencia) this.carregando.set(false);
    }
  }

  protected async abrir(e: Execucao): Promise<void> {
    this.detalhe.set(null);
    this.erroDetalhe.set(null);
    this.painelAberto.set(true);
    try {
      this.detalhe.set(await this.api.execucao(e.id));
    } catch (falha) {
      this.erroDetalhe.set(erroDaApi(falha));
    }
  }

  protected async reexecutar(e: ExecucaoDetalhe): Promise<void> {
    await this.agir(() => this.api.reexecutar(e.id), 'A execução foi retomada.');
  }

  protected async cancelarExecucao(e: ExecucaoDetalhe): Promise<void> {
    await this.agir(() => this.api.cancelarExecucao(e.id), 'Execução cancelada.');
  }

  private async agir(acao: () => Promise<ExecucaoDetalhe>, sucesso: string): Promise<void> {
    this.ocupado.set(true);
    try {
      this.detalhe.set(await acao());
      this.avisos.sucesso(sucesso);
      void this.carregar();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.ocupado.set(false);
    }
  }
}
