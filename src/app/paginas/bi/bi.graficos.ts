import type { EChartsCoreOption } from 'echarts/core';

import type { PaletaGrafico } from '../../ui/grafico/paleta';
import { formatarCelula, formatarDia, formatarMes } from './bi.formatos';
import type { LinhaBi, TabelaBi, TipoColuna } from './bi.tipos';

/**
 * Montagem dos gráficos do BI a partir das tabelas da API: funções puras (tabela → opção do
 * ECharts + frase para leitores de tela), sem acesso ao DOM. As cores vêm da paleta lida dos
 * tokens (`ui/grafico/paleta.ts`), nunca fixas.
 */

export interface SerieDoGrafico {
  /** Coluna da tabela com o valor. */
  readonly chave: string;
  readonly nome: string;
  /** Índice da cor de dado (0 = ciano … 3 = coral). */
  readonly cor: number;
  readonly tipo?: 'barra' | 'linha';
  /** Séries com a mesma pilha se empilham. */
  readonly pilha?: string;
  /** Plota o valor negativo (saídas, como cancelamentos). */
  readonly negativa?: boolean;
}

export interface EspecieGrafico {
  readonly tipoValor: TipoColuna;
  readonly series: readonly SerieDoGrafico[];
  /** Coluna do rótulo (eixo das categorias). */
  readonly categoria: string;
  /** Coluna `id` guardada em cada ponto para o clique. */
  readonly chaveId?: string;
  readonly orientacao?: 'colunas' | 'barras';
}

export interface GraficoMontado {
  readonly opcao: (paleta: PaletaGrafico) => EChartsCoreOption;
  /** Frase para leitores de tela: o que o gráfico mostra, com os maiores valores. */
  readonly descricao: string;
  readonly vazio: boolean;
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

function rotuloCategoria(chave: string, linha: LinhaBi): string {
  const bruto = linha[chave];
  if (bruto === null || bruto === undefined) {
    return '—';
  }
  const texto = String(bruto);
  if (chave === 'dia') {
    return formatarDia(texto, true);
  }
  if (chave === 'mes') {
    return formatarMes(texto);
  }
  if (chave === 'hora') {
    return `${texto}h`;
  }
  return formatarCelula(texto, 'texto', chave);
}

function valorNumerico(linha: LinhaBi, chave: string): number {
  const valor = linha[chave];
  return typeof valor === 'number' ? valor : Number(valor) || 0;
}

/** Barras (verticais ou horizontais) e linhas sobre uma tabela da API. */
export function montarGrafico(tabela: TabelaBi, especie: EspecieGrafico): GraficoMontado {
  const { series, categoria, tipoValor, chaveId } = especie;
  const horizontal = especie.orientacao === 'barras';
  const linhas = tabela.linhas;
  const categorias = linhas.map((linha) => rotuloCategoria(categoria, linha));
  const vazio =
    linhas.length === 0 || series.every((s) => linhas.every((l) => !valorNumerico(l, s.chave)));

  const principal = series[0];
  const maiores = [...linhas]
    .sort((a, b) => valorNumerico(b, principal.chave) - valorNumerico(a, principal.chave))
    .slice(0, 6)
    .map(
      (linha) =>
        `${rotuloCategoria(categoria, linha)}: ${formatarCelula(valorNumerico(linha, principal.chave), tipoValor, principal.chave)}`,
    );
  const descricao =
    `${tabela.titulo}. ${series.map((s) => s.nome).join(' e ')}, ${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'}.` +
    (vazio ? ' Sem dados no período.' : ` Maiores: ${maiores.join('; ')}.`);

  const opcao = (p: PaletaGrafico): EChartsCoreOption => {
    const eixoCategoria = {
      type: 'category' as const,
      data: categorias,
      inverse: horizontal,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.borda } },
      axisLabel: {
        color: p.textoFraco,
        fontSize: 12,
        hideOverlap: true,
        ...(horizontal ? { width: 140, overflow: 'truncate' as const } : {}),
      },
    };
    const eixoValor = {
      type: 'value' as const,
      axisLabel: {
        color: p.textoFraco,
        fontSize: 12,
        formatter: (v: number) => (tipoValor === 'percentual' ? `${v}%` : compacto.format(v)),
      },
      splitLine: { lineStyle: { color: p.borda } },
    };
    return {
      color: [...p.dados],
      grid: { left: 8, right: 16, top: series.length > 1 ? 36 : 12, bottom: 8, containLabel: true },
      legend:
        series.length > 1
          ? {
              top: 0,
              left: 0,
              icon: 'circle',
              itemWidth: 8,
              itemHeight: 8,
              textStyle: { color: p.textoSuave, fontSize: 12 },
            }
          : undefined,
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: p.flutuante,
        borderColor: p.borda,
        textStyle: { color: p.texto, fontSize: 13 },
        axisPointer: { type: 'shadow', shadowStyle: { color: p.borda } },
        valueFormatter: (valor: unknown) =>
          formatarCelula(Math.abs(Number(valor)), tipoValor, principal.chave),
      },
      xAxis: horizontal ? eixoValor : eixoCategoria,
      yAxis: horizontal ? eixoCategoria : eixoValor,
      series: series.map((serie) => {
        const cor = p.dados[serie.cor % 4];
        const dados = linhas.map((linha) => {
          const valor = valorNumerico(linha, serie.chave);
          return {
            value: serie.negativa ? -Math.abs(valor) : valor,
            id: chaveId ? linha[chaveId] : null,
          };
        });
        if (serie.tipo === 'linha') {
          return {
            name: serie.nome,
            type: 'line' as const,
            data: dados,
            smooth: false,
            showSymbol: linhas.length <= 16,
            symbolSize: 6,
            lineStyle: { width: 2.5, color: cor },
            itemStyle: { color: cor, borderColor: p.contornoDado, borderWidth: 1 },
          };
        }
        return {
          name: serie.nome,
          type: 'bar' as const,
          data: dados,
          stack: serie.pilha,
          barMaxWidth: horizontal ? 22 : 36,
          itemStyle: {
            color: cor,
            borderColor: p.contornoDado,
            borderWidth: 1,
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
          emphasis: { focus: 'series' as const },
        };
      }),
    };
  };
  return { opcao, descricao, vazio };
}
