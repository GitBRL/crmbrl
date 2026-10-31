import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarMoeda, formatarMoedaAbreviada, paraNumero } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
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
@Component({
  selector: 'app-indicadores',
  imports: [
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
          legenda="Contratos ativos"
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
        <figure class="grafico" [attr.aria-label]="descricaoMrr()">
          <div class="colunas" aria-hidden="true">
            @for (m of mesesMrr(); track m.mes) {
              <div class="coluna" [title]="m.mes + ': ' + moeda(m.mrr)">
                <span class="coluna__valor">{{ abreviado(m.mrr) }}</span>
                <span
                  class="coluna__barra coluna__barra--1"
                  [style.height.%]="altura(m.mrr, maxMrr())"
                ></span>
                <span class="coluna__rotulo">{{ rotuloMes(m.mes) }}</span>
              </div>
            }
          </div>
        </figure>
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
            <ul class="faixas" [attr.aria-label]="'Valor em atraso por faixa'">
              @for (f of inad.value().faixas; track f.faixa; let i = $index) {
                <li class="faixa">
                  <span class="faixa__rotulo">{{ rotuloFaixa[f.faixa] }}</span>
                  <span class="faixa__trilho" aria-hidden="true">
                    <span
                      class="faixa__barra"
                      [style.width.%]="altura(f.valor, maxFaixa())"
                      [style.background]="'var(--dado-' + (i + 1) + ')'"
                    ></span>
                  </span>
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
          <figure class="grafico" [attr.aria-label]="descricaoPr()">
            <div class="colunas" aria-hidden="true">
              @for (m of pr.value().meses; track m.mes) {
                <div
                  class="coluna coluna--dupla"
                  [title]="
                    rotuloMes(m.mes) +
                    ': previsto ' +
                    moeda(m.previsto) +
                    ', recebido ' +
                    moeda(m.realizado)
                  "
                >
                  <span class="par">
                    <span
                      class="coluna__barra coluna__barra--1"
                      [style.height.%]="altura(m.previsto, maxPr())"
                    ></span>
                    <span
                      class="coluna__barra coluna__barra--2"
                      [style.height.%]="altura(m.realizado, maxPr())"
                    ></span>
                  </span>
                  <span class="coluna__rotulo">{{ rotuloMes(m.mes) }}</span>
                </div>
              }
            </div>
          </figure>
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

    .colunas {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      align-items: end;
      gap: var(--esp-1);
      height: 11rem;
    }

    .coluna {
      display: grid;
      grid-template-rows: auto 1fr auto;
      justify-items: center;
      height: 100%;
      min-width: 0;
      gap: 2px;
    }

    .coluna__valor {
      color: var(--cor-texto-suave);
      font: var(--fonte-micro);
      white-space: nowrap;
    }

    .coluna__barra {
      align-self: end;
      width: min(100%, 1.75rem);
      min-height: 2px;
      border-radius: 6px 6px 0 0;
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
    }

    .coluna__barra--1 {
      background: var(--dado-1);
    }

    .coluna__barra--2 {
      background: var(--dado-2);
    }

    .coluna__rotulo {
      color: var(--cor-texto-suave);
      font: var(--fonte-micro);
      white-space: nowrap;
    }

    .coluna--dupla {
      grid-template-rows: 1fr auto;
    }

    .par {
      display: flex;
      align-items: end;
      justify-content: center;
      gap: 2px;
      width: 100%;
      height: 100%;
    }

    .par .coluna__barra {
      width: 40%;
      max-width: 1rem;
    }

    @media (max-width: 599px) {
      .coluna__valor {
        display: none;
      }

      .coluna__rotulo {
        font-size: 0.625rem;
      }
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
      grid-template-columns: minmax(6rem, 8rem) minmax(0, 1fr) auto;
      grid-template-areas:
        'rotulo trilho valor'
        'nota nota nota';
      align-items: center;
      gap: 2px var(--esp-3);
    }

    .faixa__rotulo {
      grid-area: rotulo;
      font-weight: 600;
    }

    .faixa__trilho {
      grid-area: trilho;
      height: 0.75rem;
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-3);
      overflow: hidden;
    }

    .faixa__barra {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: var(--raio-pilula);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
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
  protected readonly abreviado = (v: string) => formatarMoedaAbreviada(paraNumero(v) ?? 0, 'pt-BR');
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
  protected readonly maxMrr = computed(() =>
    Math.max(1, ...this.mesesMrr().map((m) => paraNumero(m.mrr) ?? 0)),
  );
  protected readonly maxFaixa = computed(() =>
    Math.max(
      1,
      ...(this.inad.hasValue() ? this.inad.value().faixas : []).map(
        (f) => paraNumero(f.valor) ?? 0,
      ),
    ),
  );
  protected readonly mesesPrInversos = computed(() =>
    this.pr.hasValue() ? [...this.pr.value().meses].reverse() : [],
  );
  protected readonly maxPr = computed(() =>
    Math.max(
      1,
      ...(this.pr.hasValue() ? this.pr.value().meses : []).flatMap((m) => [
        paraNumero(m.previsto) ?? 0,
        paraNumero(m.realizado) ?? 0,
      ]),
    ),
  );

  protected readonly descricaoMrr = computed(() => {
    const meses = this.mesesMrr();
    if (meses.length === 0) {
      return 'Sem dados de receita mensal.';
    }
    const ultimo = meses[meses.length - 1];
    return `Receita mensal de ${rotuloDoMes(meses[0].mes)} a ${rotuloDoMes(ultimo.mes)}; no último mês, ${formatarMoeda(ultimo.mrr)}.`;
  });
  protected readonly descricaoPr = computed(() => {
    const meses = this.pr.hasValue() ? this.pr.value().meses : [];
    return meses.length === 0
      ? 'Sem dados de previsto e recebido.'
      : `Previsto e recebido de ${rotuloDoMes(meses[0].mes)} a ${rotuloDoMes(meses[meses.length - 1].mes)}; os valores estão na tabela abaixo.`;
  });

  protected altura(valor: string | number, maximo: number): number {
    const n = paraNumero(valor) ?? 0;
    return Math.max(0, Math.min(100, (n / maximo) * 100));
  }

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
