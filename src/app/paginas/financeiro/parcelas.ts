import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDownload, LucidePlus, LucideRefreshCw, LucideUpload } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarData, formatarMoeda } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { CampoData } from '../../ui/campo-data/campo-data';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Indicador } from '../../ui/indicador/indicador';
import { MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { FinanceiroApi } from './financeiro.api';
import {
  type ConsultaParcelas,
  FAIXAS,
  type FaixaAtraso,
  type Parcela,
  ROTULO_FAIXA,
  ROTULO_STATUS_PARCELA,
  STATUS_PARCELA,
  type StatusParcela,
  VARIANTE_STATUS_PARCELA,
} from './financeiro.tipos';
import { ModalParcela } from './modais-parcela';
import { PainelParcela } from './painel-parcela';
import { ehCarteiraDeCs, ehGestorDaCarteira } from './acesso-financeiro';

const CONSULTA_INICIAL: ConsultaParcelas = {
  pagina: 1,
  porPagina: 20,
  status: [],
  faixa: null,
  contratoId: null,
  vencimentoDe: null,
  vencimentoAte: null,
  comPromessa: false,
  busca: '',
};

const OPCOES_STATUS: readonly OpcaoFiltro[] = STATUS_PARCELA.map((id) => ({
  id,
  rotulo: ROTULO_STATUS_PARCELA[id],
}));
const OPCOES_FAIXA: readonly OpcaoSeletor<FaixaAtraso>[] = FAIXAS.map((valor) => ({
  valor,
  rotulo: ROTULO_FAIXA[valor],
}));

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'titulo', rotulo: 'Título', noCartao: 'titulo' },
  { id: 'cliente', rotulo: 'Cliente' },
  { id: 'vencimento', rotulo: 'Vencimento' },
  { id: 'valor', rotulo: 'Valor', alinhar: 'fim' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'promessa', rotulo: 'Promessa' },
];

/** Parcelas a receber (`/financeiro/parcelas`): filtros, totais, baixa pelo painel e exportação. */
@Component({
  selector: 'app-parcelas',
  imports: [
    RouterLink,
    Alternador,
    Botao,
    CampoBusca,
    CampoData,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    Indicador,
    MenuAcoes,
    ModalParcela,
    PainelParcela,
    Paginacao,
    Seletor,
    Selo,
    Tabela,
  ],
  template: `
    <div class="cabecalho__linha">
      <p class="frase">
        O que os clientes ainda vão pagar. Abra uma parcela para dar baixa, renegociar ou ver as
        mensagens da cobrança.
      </p>
      <div class="cabecalho__acoes">
        @if (podeGerenciar()) {
          <a
            appBotao
            variante="contorno"
            routerLink="/financeiro/parcelas/importar"
            [icone]="icones.importar"
          >
            Importar planilha
          </a>
        }
        <app-menu-acoes
          rotulo="Exportar parcelas"
          texto="Exportar"
          [icone]="icones.baixar"
          [itens]="itensExportar"
          (escolher)="exportar($event.id)"
        />
        @if (podeCriar()) {
          <button
            appBotao
            type="button"
            variante="destaque"
            [icone]="icones.novo"
            (click)="novaAberta.set(true)"
          >
            Nova parcela
          </button>
        }
      </div>
    </div>

    <section class="cartoes" aria-label="Totais com os filtros atuais">
      @for (t of totais(); track t.id) {
        <app-indicador
          [legenda]="t.rotulo"
          [valor]="t.valor"
          prefixo="R$"
          casas="1.0-0"
          tamanho="sm"
          [dica]="t.dica"
        />
      }
    </section>

    <div class="barra">
      <app-campo-busca
        class="barra__busca"
        rotulo="Buscar parcelas"
        placeholder="Número, cliente ou contrato"
        [valor]="buscaDigitada()"
        (valorChange)="buscaDigitada.set($event)"
        (buscar)="mudar({ busca: $event })"
      />
      <app-seletor
        class="barra__campo"
        rotulo="Tempo de atraso"
        placeholder="Qualquer atraso"
        permitirVazio
        [opcoes]="opcoesFaixa"
        [valor]="consulta().faixa"
        (valorChange)="mudar({ faixa: $event })"
      />
      <app-campo-data
        class="barra__campo"
        rotulo="Vence a partir de"
        [valor]="consulta().vencimentoDe"
        (valorChange)="mudar({ vencimentoDe: $event })"
      />
      <app-campo-data
        class="barra__campo"
        rotulo="Vence até"
        [valor]="consulta().vencimentoAte"
        (valorChange)="mudar({ vencimentoAte: $event })"
      />
      <app-alternador
        rotulo="Só com promessa"
        [valor]="consulta().comPromessa"
        (valorChange)="mudar({ comPromessa: $event })"
      />
    </div>

    <app-filtros-pilula
      rotulo="Situação da parcela"
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
            ? 'Você não tem acesso às parcelas'
            : 'Não conseguimos carregar as parcelas'
        "
        [texto]="
          falha.ehSemPermissao ? 'Peça ao líder do seu setor para liberar o acesso.' : falha.resumo
        "
        [codigo]="falha.requisicaoId"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="icones.tentar"
          (click)="recarregar()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (dados.hasValue() && itens().length === 0 && !dados.isLoading()) {
      @if (filtrando()) {
        <app-estado-vazio
          variante="busca"
          titulo="Nenhuma parcela com esses filtros"
          texto="Tire um filtro ou mude a busca para ver mais parcelas."
        >
          <button appBotao type="button" variante="contorno" (click)="limpar()">
            Limpar filtros
          </button>
        </app-estado-vazio>
      } @else {
        <app-estado-vazio
          titulo="Nenhuma parcela ainda"
          texto="As parcelas nascem com os contratos. Você também pode criar uma à mão ou importar uma planilha."
        />
      }
    } @else {
      <app-tabela
        rotulo="Parcelas a receber"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="dados.isLoading() && !dados.hasValue()"
        [linhasEsqueleto]="6"
        clicavel
        (abrir)="abrir($event)"
      >
        <ng-template appCelula="titulo" [appCelulaDe]="itens()" let-p>
          <span class="nome">
            <span class="nome__titulo">{{ p.numero }}</span>
            @if (p.contrato) {
              <span class="nota">{{ p.contrato.codigo }} · {{ p.contrato.produto }}</span>
            } @else if (p.descricao) {
              <span class="nota">{{ p.descricao }}</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="cliente" [appCelulaDe]="itens()" let-p>
          <span class="nome">
            <span class="nome__titulo">{{ p.empresa?.nome ?? p.contato?.nome ?? '—' }}</span>
            @if (p.empresa && p.contato) {
              <span class="nota">{{ p.contato.nome }}</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="vencimento" [appCelulaDe]="itens()" let-p>
          <span class="nome">
            {{ data(p.vencimento) }}
            @if (p.diasEmAtraso > 0 && p.status === 'ATRASADO') {
              <span class="nota">{{ p.diasEmAtraso }} dias em atraso</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="valor" [appCelulaDe]="itens()" let-p>
          <span class="numero">{{ moeda(p.valor) }}</span>
        </ng-template>
        <ng-template appCelula="status" [appCelulaDe]="itens()" let-p>
          <app-selo ponto [variante]="varianteStatus[p.status]">
            {{ rotuloStatus[p.status] }}
          </app-selo>
        </ng-template>
        <ng-template appCelula="promessa" [appCelulaDe]="itens()" let-p>
          @if (p.promessaAte) {
            até {{ data(p.promessaAte) }}
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
      </app-tabela>

      @if (total() > 0) {
        <app-paginacao
          rotulo="Paginação das parcelas"
          [total]="total()"
          [pagina]="consulta().pagina"
          (paginaChange)="mudar({ pagina: $event }, false)"
          [porPagina]="consulta().porPagina"
          (porPaginaChange)="mudar({ porPagina: $event })"
        />
      }
    }

    <app-painel-parcela
      [parcelaId]="aberta()"
      (parcelaIdChange)="fechar($event)"
      (alterada)="recarregar()"
    />
    <app-modal-parcela [(aberto)]="novaAberta" (concluido)="recarregar()" />
  `,
  styleUrl: './financeiro-comum.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parcelas {
  private readonly api = inject(FinanceiroApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);

  protected readonly icones = {
    novo: LucidePlus,
    tentar: LucideRefreshCw,
    importar: LucideUpload,
    baixar: LucideDownload,
  };
  protected readonly colunas = COLUNAS;
  protected readonly opcoesStatus = OPCOES_STATUS;
  protected readonly opcoesFaixa = OPCOES_FAIXA;
  protected readonly rotuloStatus = ROTULO_STATUS_PARCELA;
  protected readonly varianteStatus = VARIANTE_STATUS_PARCELA;
  protected readonly itensExportar = [
    { id: 'xlsx', rotulo: 'Exportar para Excel (.xlsx)' },
    { id: 'csv', rotulo: 'Exportar para CSV' },
  ];
  protected readonly moeda = (v: string) => formatarMoeda(v);
  protected readonly data = (v: string) => formatarData(v);

  protected readonly consulta = signal<ConsultaParcelas>(CONSULTA_INICIAL);
  protected readonly buscaDigitada = signal('');
  protected readonly aberta = signal<string | null>(
    this.rota.snapshot.queryParamMap.get('parcela'),
  );
  protected readonly novaAberta = signal(false);

  protected readonly podeCriar = computed(() => ehCarteiraDeCs(this.sessao.usuario()));
  protected readonly podeGerenciar = computed(() => ehGestorDaCarteira(this.sessao.usuario()));

  protected readonly dados = resource({
    params: () => this.consulta(),
    loader: ({ params }) => this.api.parcelas(params),
  });
  protected readonly totaisApi = resource({
    params: () => {
      const { pagina, porPagina, status, ...filtros } = this.consulta();
      void pagina;
      void porPagina;
      void status;
      return filtros;
    },
    loader: ({ params }) => this.api.totaisDeParcelas({ ...params, status: [] }),
  });

  protected readonly itens = computed<readonly Parcela[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );
  protected readonly total = computed(() => (this.dados.hasValue() ? this.dados.value().total : 0));
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly filtrando = computed(() => {
    const c = this.consulta();
    return (
      c.busca.trim() !== '' ||
      c.status.length > 0 ||
      c.faixa !== null ||
      c.vencimentoDe !== null ||
      c.vencimentoAte !== null ||
      c.comPromessa
    );
  });
  protected readonly resultado = computed(() => {
    if (!this.dados.hasValue()) {
      return '';
    }
    const total = this.total();
    return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'parcela' : 'parcelas'}`;
  });
  protected readonly totais = computed(() => {
    const por = this.totaisApi.hasValue() ? this.totaisApi.value().porStatus : {};
    const soma = (...s: StatusParcela[]) =>
      s.reduce((acc, id) => acc + Number(por[id]?.valor ?? 0), 0);
    return [
      {
        id: 'aberto',
        rotulo: 'A receber',
        valor: soma('ABERTO', 'ATRASADO'),
        dica: 'Parcelas em aberto, vencidas ou não.',
      },
      {
        id: 'atrasado',
        rotulo: 'Em atraso',
        valor: soma('ATRASADO'),
        dica: 'Parcelas já vencidas e ainda não pagas.',
      },
      { id: 'pago', rotulo: 'Recebido', valor: soma('PAGO'), dica: null },
    ];
  });

  constructor() {
    aoReceber('parcela.atualizada', () => this.recarregar());
    // O link da notificação (?parcela=<id>) abre o painel; fechar tira o parâmetro.
    effect(() => {
      const id = this.aberta();
      untracked(() => {
        void this.roteador.navigate([], {
          relativeTo: this.rota,
          queryParams: { parcela: id },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected recarregar(): void {
    this.dados.reload();
    this.totaisApi.reload();
  }

  protected mudar(parcial: Partial<ConsultaParcelas>, voltarAoInicio = true): void {
    this.consulta.update((c) => ({ ...c, ...(voltarAoInicio ? { pagina: 1 } : {}), ...parcial }));
  }

  protected limpar(): void {
    this.buscaDigitada.set('');
    this.consulta.update((c) => ({ ...CONSULTA_INICIAL, porPagina: c.porPagina }));
  }

  protected abrir(parcela: Parcela): void {
    this.aberta.set(parcela.id);
  }

  protected fechar(id: string | null): void {
    this.aberta.set(id);
  }

  protected async exportar(formato: string): Promise<void> {
    try {
      this.avisos.info('Preparando o arquivo…');
      const { pagina, porPagina, ...filtros } = this.consulta();
      void pagina;
      void porPagina;
      const arquivo = await this.api.exportarParcelas(formato === 'csv' ? 'csv' : 'xlsx', filtros);
      const link = document.createElement('a');
      link.href = arquivo.url;
      link.download = arquivo.nome;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }
}
