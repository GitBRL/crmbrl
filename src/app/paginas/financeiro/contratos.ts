import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarMoeda } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { FinanceiroApi } from './financeiro.api';
import {
  type ConsultaContratos,
  type Contrato,
  ROTULO_PERIODICIDADE,
  ROTULO_STATUS_CONTRATO,
  STATUS_CONTRATO,
  type StatusContrato,
  VARIANTE_STATUS_CONTRATO,
} from './financeiro.tipos';

const CONSULTA_INICIAL: ConsultaContratos = { pagina: 1, porPagina: 20, status: [], busca: '' };

const OPCOES_STATUS: readonly OpcaoFiltro[] = STATUS_CONTRATO.map((id) => ({
  id,
  rotulo: ROTULO_STATUS_CONTRATO[id],
}));

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'contrato', rotulo: 'Contrato', noCartao: 'titulo' },
  { id: 'cliente', rotulo: 'Cliente' },
  { id: 'valor', rotulo: 'Valor', alinhar: 'fim' },
  { id: 'mrr', rotulo: 'Receita mensal', alinhar: 'fim' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'renovacao', rotulo: 'Renovação' },
  { id: 'responsavel', rotulo: 'Responsável de CS' },
];

/** Lista de contratos (`/financeiro/contratos`): filtro por situação, busca e paginação. */
@Component({
  selector: 'app-contratos',
  imports: [
    RouterLink,
    Botao,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    Paginacao,
    Selo,
    Tabela,
  ],
  template: `
    <div class="cabecalho__linha">
      <p class="frase">
        Cada contrato reúne o produto vendido, o valor, a periodicidade e as parcelas a receber.
      </p>
      @if (podeCriar()) {
        <a
          appBotao
          variante="destaque"
          routerLink="/financeiro/contratos/novo"
          [icone]="icones.novo"
        >
          Novo contrato
        </a>
      }
    </div>

    <div class="barra">
      <app-campo-busca
        class="barra__busca"
        rotulo="Buscar contratos"
        placeholder="Cliente, produto ou código"
        [valor]="buscaDigitada()"
        (valorChange)="buscaDigitada.set($event)"
        (buscar)="mudar({ busca: $event })"
      />
    </div>

    <app-filtros-pilula
      rotulo="Situação do contrato"
      multipla
      [opcoes]="opcoesStatus"
      [selecionados]="consulta().status"
      (selecionadosChange)="mudar({ status: $any($event) })"
    />

    <p class="resultado" aria-live="polite">{{ resultado() }}</p>

    @if (erro(); as falha) {
      <app-estado-vazio
        [variante]="falha.ehSemPermissao ? 'sem-acesso' : 'erro'"
        [falha]="falha"
        [titulo]="
          falha.ehSemPermissao
            ? 'Você não tem acesso aos contratos'
            : 'Não conseguimos carregar os contratos'
        "
        [texto]="
          falha.ehSemPermissao ? 'Peça ao líder da sua área para liberar o acesso.' : falha.resumo
        "
        [codigo]="falha.requisicaoId"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="icones.tentar"
          (click)="dados.reload()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (dados.hasValue() && itens().length === 0 && !dados.isLoading()) {
      @if (filtrando()) {
        <app-estado-vazio
          variante="busca"
          titulo="Nenhum contrato com esses filtros"
          texto="Tire um filtro ou mude a busca para ver mais contratos."
        >
          <button appBotao type="button" variante="contorno" (click)="limpar()">
            Limpar filtros
          </button>
        </app-estado-vazio>
      } @else {
        <app-estado-vazio
          titulo="Nenhum contrato ainda"
          texto="Quando um negócio for ganho, o CRM sugere criar o contrato. Você também pode criar um à mão."
        >
          @if (podeCriar()) {
            <a
              appBotao
              variante="invertido"
              routerLink="/financeiro/contratos/novo"
              [icone]="icones.novo"
            >
              Criar contrato
            </a>
          }
        </app-estado-vazio>
      }
    } @else {
      <app-tabela
        rotulo="Contratos"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="dados.isLoading() && !dados.hasValue()"
        [linhasEsqueleto]="6"
        [link]="linkDoContrato"
      >
        <ng-template appCelula="contrato" [appCelulaDe]="itens()" let-c>
          <span class="nome">
            <span class="nome__titulo">{{ c.produto }}</span>
            <span class="nota">{{ c.codigo }}</span>
          </span>
        </ng-template>
        <ng-template appCelula="cliente" [appCelulaDe]="itens()" let-c>
          <span class="nome">
            <span class="nome__titulo">{{ c.empresa?.nome ?? c.contato?.nome ?? '—' }}</span>
            @if (c.empresa && c.contato) {
              <span class="nota">{{ c.contato.nome }}</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="valor" [appCelulaDe]="itens()" let-c>
          <span class="nome numero">
            {{ moeda(c.valor) }}
            <span class="nota">{{ periodicidade[c.periodicidade] }}</span>
          </span>
        </ng-template>
        <ng-template appCelula="mrr" [appCelulaDe]="itens()" let-c>
          <span class="numero">{{ moeda(c.mrr) }}</span>
        </ng-template>
        <ng-template appCelula="status" [appCelulaDe]="itens()" let-c>
          <app-selo ponto [variante]="varianteStatus[c.status]">
            {{ rotuloStatus[c.status] }}
          </app-selo>
        </ng-template>
        <ng-template appCelula="renovacao" [appCelulaDe]="itens()" let-c>
          @if (c.renovacaoEm) {
            {{ data(c.renovacaoEm) }}
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
        <ng-template appCelula="responsavel" [appCelulaDe]="itens()" let-c>
          {{ c.responsavelCs?.nome ?? '—' }}
        </ng-template>
      </app-tabela>

      @if (total() > 0) {
        <app-paginacao
          rotulo="Paginação dos contratos"
          [total]="total()"
          [pagina]="consulta().pagina"
          (paginaChange)="mudar({ pagina: $event }, false)"
          [porPagina]="consulta().porPagina"
          (porPaginaChange)="mudar({ porPagina: $event })"
        />
      }
    }
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contratos {
  private readonly api = inject(FinanceiroApi);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = { novo: LucidePlus, tentar: LucideRefreshCw };
  protected readonly colunas = COLUNAS;
  protected readonly opcoesStatus = OPCOES_STATUS;
  protected readonly rotuloStatus = ROTULO_STATUS_CONTRATO;
  protected readonly varianteStatus = VARIANTE_STATUS_CONTRATO;
  protected readonly periodicidade = ROTULO_PERIODICIDADE;
  protected readonly moeda = (v: string) => formatarMoeda(v);
  protected readonly data = (v: string) => formatarData(v);
  protected readonly consulta = signal<ConsultaContratos>(CONSULTA_INICIAL);
  protected readonly buscaDigitada = signal('');
  protected readonly podeCriar = computed(() =>
    this.sessao.temPapel('ADMIN', 'C_LEVEL', 'LIDER_CS', 'CS'),
  );

  protected readonly dados = resource({
    params: () => this.consulta(),
    loader: ({ params }) => this.api.contratos(params),
  });
  protected readonly itens = computed<readonly Contrato[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );
  protected readonly total = computed(() => (this.dados.hasValue() ? this.dados.value().total : 0));
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly filtrando = computed(() => {
    const c = this.consulta();
    return c.busca.trim() !== '' || c.status.length > 0;
  });
  protected readonly resultado = computed(() => {
    if (!this.dados.hasValue()) {
      return '';
    }
    const total = this.total();
    return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'contrato' : 'contratos'}`;
  });
  protected readonly linkDoContrato = (c: Contrato) => ['/financeiro/contratos', c.id];

  constructor() {
    aoReceber('parcela.atualizada', () => this.dados.reload());
  }

  protected mudar(parcial: Partial<ConsultaContratos>, voltarAoInicio = true): void {
    this.consulta.update((c) => ({ ...c, ...(voltarAoInicio ? { pagina: 1 } : {}), ...parcial }));
  }

  protected limpar(): void {
    this.buscaDigitada.set('');
    this.consulta.update((c) => ({ ...CONSULTA_INICIAL, porPagina: c.porPagina }));
  }
}

export type { StatusContrato };
