import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

/**
 * Só o que os gráficos do CRM usam (barras, linhas, grade, dica flutuante, legenda e o
 * desenho em SVG): importar `echarts` inteiro estouraria o orçamento do pacote. Este arquivo
 * só é carregado sob demanda, quando o primeiro gráfico aparece (ver `grafico.ts`).
 */
echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

export { echarts };
