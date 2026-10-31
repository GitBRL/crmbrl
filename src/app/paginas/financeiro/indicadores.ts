import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarMoeda, formatarMoedaAbreviada, paraNumero } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Grafico } from '../../ui/grafico/grafico';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { montarGrafico } from '../bi/bi.graficos';
import type { LinhaBi, TabelaBi } from '../bi/bi.tipos';
import { FinanceiroApi } from './financeiro.api';
import {
  type FaixaInadimplencia,
  ROTULO_FAIXA,
  ROTULO_NIVEL_RISCO,
  rotuloDoMes,
  VARIANTE_NIVEL_RISCO,
} from './financeiro.tipos';

const COLUNAS_MRR: readonly ColunaTabela[] = [
  { id: 'mes', rotulo: 'Mês', noCartao: 'titulo' },
  { id: 'novo', rotulo: 'Novo', alinhar: 'fim' },
  { id: 'expansao', rotulo: 'Expansão', alinhar: 'fim' },
  { id: 'contracao', rotulo: 'Contração', alinhar: 'fim' },
  { id: 'churn', rotulo: 'Cancelamentos', alinhar: 'fim' },
  { id: 'mrr', rotulo: 'Receita mensal', alinhar: 'fim' },
];
const COLUNAS_PR: readonly ColunaTabela[] = [
  { id: 'mes', rotulo: 'Mês', noCartao: 'titulo' },
  { id: 'previsto', rotulo: 'Previsto', alinhar: 'fim' },
  { id: 'realizado', rotulo: 'Recebido', alinhar: 'fim' },
  { id: 'emAberto', rotulo: 'Em aberto', alinhar: 'fim' },
  { id: 'taxa', rotulo: 'Realização', alinhar: 'fim' },
];
const COLUNAS_RISCO: readonly ColunaTabela[] = [
  { id: 'cliente', rotulo: 'Cliente', noCartao: 'titulo' },
  { id: 'nivel', rotulo: 'Risco' },
  { id: 'motivos', rotulo: 'Por quê' },
];

/**
 * Indicadores financeiros (`/financeiro/indicadores`): receita mensal (MRR) com novo, expansão,
 * contração e cancelamentos, inadimplência por faixa de atraso, previsto × recebido e os clientes
 * com maior risco de cancelamento. Cada gráfico vem com a tabela dos mesmos números.
 */
/** Os números do financeiro no formato de tabela do BI, para usar o mesmo componente de gráfico. */
function tabelaDoGrafico(titulo: string, linhas: readonly LinhaBi[]): TabelaBi {
  return { chave: 'financeiro', titulo, dica: '', colunas: [], linhas };
}

@Component({
  selector: 'app-indicadores',
  imports: [
    Grafico,
    RouterLink,
    Botao,
    Cartao,
    CelulaTabela,
    EstadoVazio,
    Esqueleto,
    Indicador,
    Legenda,
    Selo,
    Tabela,
  ],
  template: `
    <p class="frase">
      Como está a receita recorrente, quanto está atrasado e quanto do previsto realmente entrou.
    </p>

    @if (erroGeral(); as falha) {
      <app-estado-vazio
        [variante]="falha.ehSemPermissao ? 'sem-acesso' : 'erro'"
        [falha]="falha"
        [titulo]="
          falha.ehSemPermissao
            ? 'Você não tem acesso aos indicadores'
            : 'Não conseguimos carregar os indicadores'
        "
        [texto]="falha.resumo"
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
    } @else if (!resumo.hasValue() || !mrr.hasValue()) {
      <div class="carregando" aria-busy="true">
        <p class="visualmente-oculto" role="status">Carregando os indicadores…</p>
        <app-esqueleto altura="6rem" />
        <app-esqueleto altura="14rem" />
      </div>
    } @else {
      @let r = resumo.value();
      <section class="cartoes" aria-label="Números de agora">
        <app-indicador
          legenda="Receita mensal (MRR)"
          prefixo="R$"
          casas="1.0-0"
          tamanho="sm"
          [valor]="numero(r.mrr.mrr)"
          dica="Soma do que os contratos ativos rendem por mês. É o MRR."
        />
        <app-indicador
          legenda="Contratos na receita"
          dica="Contratos ativos e suspensos: os que compõem a receita mensal."
          tamanho="sm"
          casas="1.0-0"
          [valor]="r.mrr.contratos"
        />
        <app-indicador
          legenda="Em atraso"
          prefixo="R$"
          casas="1.0-0"
          tamanho="sm"
          [valor]="numero(r.inadimplencia.valor)"
          dica="Parcelas vencidas e não pagas, de todos os clientes."
        />
        <app-indicador
          legenda="Taxa de inadimplência"
          unidade="%"
          tamanho="sm"
          [valor]="numero(r.taxaDeInadimplencia)"
          dica="Quanto do valor a receber já passou do vencimento."
        />
        <app-indicador
          legenda="Recebido do previsto no mês"
          unidade="%"
          tamanho="sm"
          [valor]="numero(r.previstoRealizado.taxaDeRealizacao)"
        />
      </section>

      <app-cartao
        titulo="Receita mensal"
        complemento="· últimos meses"
        dica="Altura de cada coluna: a receita mensal ao fim do mês. Abaixo, o que entrou e saiu em cada mês."
      >
        <app-grafico
          class="grafico"
          rotulo="Receita mensal por mês"
          [opcao]="graficoMrr().opcao"
          altura="14rem"
        />
        <app-tabela
          rotulo="Movimentos da receita mensal"
          densa
          [colunas]="colunasMrr"
          [linhas]="mesesMrrInversos()"
        >
          <ng-template appCelula="mes" [appCelulaDe]="mesesMrrInversos()" let-m>{{
            rotuloMes(m.mes)
          }}</ng-template>
          <ng-template appCelula="novo" [appCelulaDe]="mesesMrrInversos()" let-m
            ><span class="numero">{{ moeda(m.novo) }}</span></ng-template
          >
          <ng-template appCelula="expansao" [appCelulaDe]="mesesMrrInversos()" let-m
            ><span class="numero">{{ moeda(m.expansao) }}</span></ng-template
          >
          <ng-template appCelula="contracao" [appCelulaDe]="mesesMrrInversos()" let-m
            ><span class="numero">{{ moeda(m.contracao) }}</span></ng-template
          >
          <ng-template appCelula="churn" [appCelulaDe]="mesesMrrInversos()" let-m
            ><span class="numero">{{ moeda(m.churn) }}</span></ng-template
          >
          <ng-template appCelula="mrr" [appCelulaDe]="mesesMrrInversos()" let-m
            ><strong class="numero">{{ moeda(m.mrr) }}</strong></ng-template
          >
        </app-tabela>
      </app-cartao>

      <div class="duas">
        <app-cartao
          titulo="Atraso por faixa"
          dica="Quanto está atrasado, separado pelos dias desde o vencimento. Quanto mais antigo, mais difícil de receber."
        >
          @if (inad.hasValue()) {
            <app-grafico
              class="grafico"
              rotulo="Valor em atraso por faixa"
              [opcao]="graficoFaixas().opcao"
              altura="12rem"
            />
            <ul class="faixas" [attr.aria-label]="'Valor em atraso por faixa'">
              @for (f of inad.value().faixas; track f.faixa; let i = $index) {
                <li class="faixa">
                  <span class="faixa__rotulo">{{ rotuloFaixa[f.faixa] }}</span>
                  <span class="faixa__valor numero">{{ moeda(f.valor) }}</span>
                  <span class="nota faixa__nota">{{ resumoFaixa(f) }}</span>
                </li>
              }
            </ul>
            <p class="nota">
              Total: {{ moeda(inad.value().total.valor) }} em
              {{ inad.value().total.quantidade }} parcelas de
              {{ inad.value().total.clientes }} clientes.
              <a routerLink="/financeiro/parcelas">Ver as parcelas</a>
            </p>
          } @else {
            <app-esqueleto altura="8rem" />
          }
        </app-cartao>

        <app-cartao
          titulo="Clientes com risco de cancelar"
          dica="Os clientes com a maior nota de risco: atraso, satisfação baixa e falta de contato."
        >
          @if (risco.hasValue() && risco.value().length === 0) {
            <app-estado-vazio
              compacto
              titulo="Nenhum cliente em risco"
              texto="Ninguém com risco médio ou alto agora."
            />
          } @else if (risco.hasValue()) {
            <app-tabela
              rotulo="Clientes com risco de cancelar"
              densa
              [colunas]="colunasRisco"
              [linhas]="risco.value()"
              [link]="linkDoCliente"
            >
              <ng-template appCelula="cliente" [appCelulaDe]="risco.value()" let-c>
                <span class="nome__titulo">{{ c.contato.nome }}</span>
              </ng-template>
              <ng-template appCelula="nivel" [appCelulaDe]="risco.value()" let-c>
                <app-selo [variante]="varianteNivel[c.nivel]"
                  >{{ rotuloNivel[c.nivel] }} · {{ c.pontuacao }}</app-selo
                >
              </ng-template>
              <ng-template appCelula="motivos" [appCelulaDe]="risco.value()" let-c>
                <span class="nota">{{ motivos(c.fatores) }}</span>
              </ng-template>
            </app-tabela>
          } @else if (risco.error()) {
            <app-estado-vazio compacto variante="erro" titulo="Não conseguimos carregar o risco" />
          } @else {
            <app-esqueleto altura="8rem" />
          }
        </app-cartao>
      </div>

      <app-cartao
        titulo="Previsto × recebido"
        complemento="· por mês"
        dica="Previsto é o que venceu no mês. Recebido é quanto dessas parcelas já foi pago."
      >
        @if (pr.hasValue()) {
          <app-legenda [series]="['Previsto', 'Recebido']" />
          <app-grafico
            class="grafico"
            rotulo="Previsto e recebido por mês"
            [opcao]="graficoPr().opcao"
            altura="14rem"
          />
          <app-tabela
            rotulo="Previsto e recebido por mês"
            densa
            [colunas]="colunasPr"
            [linhas]="mesesPrInversos()"
          >
            <ng-template appCelula="mes" [appCelulaDe]="mesesPrInversos()" let-m>{{
              rotuloMes(m.mes)
            }}</ng-template>
            <ng-template appCelula="previsto" [appCelulaDe]="mesesPrInversos()" let-m
              ><span class="numero">{{ moeda(m.previsto) }}</span></ng-template
            >
            <ng-template appCelula="realizado" [appCelulaDe]="mesesPrInversos()" let-m
              ><span class="numero">{{ moeda(m.realizado) }}</span></ng-template
            >
            <ng-template appCelula="emAberto" [appCelulaDe]="mesesPrInversos()" let-m
              ><span class="numero">{{ moeda(m.emAberto) }}</span></ng-template
            >
            <ng-template appCelula="taxa" [appCelulaDe]="mesesPrInversos()" let-m
              ><span class="numero">{{ taxa(m.taxaDeRealizacao) }}</span></ng-template
            >
          </app-tabela>
        } @else {
          <app-esqueleto altura="10rem" />
        }
      </app-cartao>
    }
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .duas {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--esp-4);
      align-items: start;
    }

    @media (max-width: 999px) {
      .duas {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .grafico {
      margin: 0 0 var(--esp-4);
      min-width: 0;
    }

    .faixas {
      display: grid;
      gap: var(--esp-3);
      margin: 0 0 var(--esp-3);
      padding: 0;
      list-style: none;
    }

    .faixa {
      display: grid;
      grid-template-columns: minmax(6rem, 8rem) auto;
      grid-template-areas:
        'rotulo valor'
        'nota nota';
      align-items: center;
      gap: 2px var(--esp-3);
    }

    .faixa__rotulo {
      grid-area: rotulo;
      font-weight: 600;
    }

    .faixa__valor {
      grid-area: valor;
      text-align: end;
    }

    .faixa__nota {
      grid-area: nota;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Indicadores {
  private readonly api = inject(FinanceiroApi);

  protected readonly icones = { tentar: LucideRefreshCw };
  protected readonly colunasMrr = COLUNAS_MRR;
  protected readonly colunasPr = COLUNAS_PR;
  protected readonly colunasRisco = COLUNAS_RISCO;
  protected readonly rotuloFaixa = ROTULO_FAIXA;
  protected readonly rotuloNivel = ROTULO_NIVEL_RISCO;
  protected readonly varianteNivel = VARIANTE_NIVEL_RISCO;
  protected readonly rotuloMes = rotuloDoMes;
  protected readonly moeda = (v: string | number) => formatarMoeda(v);
  protected readonly numero = (v: string | number | null) => paraNumero(v) ?? 0;
  protected readonly linkDoCliente = (c: { contato: { id: string } }) => [
    '/contatos',
    c.contato.id,
  ];

  protected readonly resumo = resource({ loader: () => this.api.resumoIndicadores() });
  protected readonly mrr = resource({ loader: () => this.api.mrr() });
  protected readonly inad = resource({ loader: () => this.api.inadimplencia() });
  protected readonly pr = resource({ loader: () => this.api.previstoRealizado() });
  protected readonly risco = resource({ loader: () => this.api.clientesEmRisco(8) });

  protected readonly erroGeral = computed(() => {
    const falha = this.resumo.error() ?? this.mrr.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly mesesMrr = computed(() => (this.mrr.hasValue() ? this.mrr.value().meses : []));
  protected readonly mesesMrrInversos = computed(() => [...this.mesesMrr()].reverse());
  protected readonly graficoMrr = computed(() =>
    montarGrafico(
      tabelaDoGrafico(
        'Receita mensal',
        this.mesesMrr().map((m) => ({ mes: m.mes, mrr: paraNumero(m.mrr) ?? 0 })),
      ),
      {
        tipoValor: 'moeda',
        categoria: 'mes',
        series: [{ chave: 'mrr', nome: 'Receita mensal', cor: 0 }],
      },
    ),
  );
  protected readonly graficoPr = computed(() =>
    montarGrafico(
      tabelaDoGrafico(
        'Previsto e recebido',
        (this.pr.hasValue() ? this.pr.value().meses : []).map((m) => ({
          mes: m.mes,
          previsto: paraNumero(m.previsto) ?? 0,
          realizado: paraNumero(m.realizado) ?? 0,
        })),
      ),
      {
        tipoValor: 'moeda',
        categoria: 'mes',
        series: [
          { chave: 'previsto', nome: 'Previsto', cor: 0 },
          { chave: 'realizado', nome: 'Recebido', cor: 1 },
        ],
      },
    ),
  );
  protected readonly graficoFaixas = computed(() =>
    montarGrafico(
      tabelaDoGrafico(
        'Valor em atraso por faixa',
        (this.inad.hasValue() ? this.inad.value().faixas : []).map((f) => ({
          faixa: ROTULO_FAIXA[f.faixa],
          valor: paraNumero(f.valor) ?? 0,
        })),
      ),
      {
        tipoValor: 'moeda',
        categoria: 'faixa',
        series: [{ chave: 'valor', nome: 'Em atraso', cor: 3 }],
        orientacao: 'barras',
      },
    ),
  );
  protected readonly mesesPrInversos = computed(() =>
    this.pr.hasValue() ? [...this.pr.value().meses].reverse() : [],
  );

  protected taxa(valor: number | string | null): string {
    const n = paraNumero(valor);
    return n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  protected resumoFaixa(f: FaixaInadimplencia): string {
    return `${f.quantidade} ${f.quantidade === 1 ? 'parcela' : 'parcelas'} · ${f.clientes} ${f.clientes === 1 ? 'cliente' : 'clientes'}`;
  }

  protected motivos(fatores: readonly { detalhe: string }[]): string {
    return fatores.map((f) => f.detalhe).join(' · ') || '—';
  }

  protected recarregar(): void {
    this.resumo.reload();
    this.mrr.reload();
    this.inad.reload();
    this.pr.reload();
    this.risco.reload();
  }
}
