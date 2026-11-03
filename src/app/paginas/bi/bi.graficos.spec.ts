import { describe, expect, it } from 'vitest';

import type { PaletaGrafico } from '../../ui/grafico/paleta';
import { tabela } from './bi-de-teste';
import { montarGrafico } from './bi.graficos';
import { PAINEIS_BI } from './bi.paineis';

const PALETA: PaletaGrafico = {
  dados: ['#c1', '#c2', '#c3', '#c4'],
  texto: '#t',
  textoSuave: '#ts',
  textoFraco: '#tf',
  borda: '#b',
  superficie: '#s',
  flutuante: '#f',
  contornoDado: '#cd',
  erro: '#e',
  familia: 'sans',
};

const FUNIL = tabela(
  'funil',
  'Funil',
  [
    ['etapaId', 'id'],
    ['etapa', 'texto'],
    ['quantidade', 'numero'],
  ],
  [
    { etapaId: 'e1', etapa: 'Novo', quantidade: 9 },
    { etapaId: 'e2', etapa: 'Proposta', quantidade: 4 },
  ],
);

describe('montarGrafico', () => {
  it('barras horizontais: cor do token, id no ponto e frase para leitores de tela', () => {
    const grafico = montarGrafico(FUNIL, {
      categoria: 'etapa',
      tipoValor: 'numero',
      orientacao: 'barras',
      chaveId: 'etapaId',
      series: [{ chave: 'quantidade', nome: 'Negócios', cor: 0 }],
    });
    const opcao = grafico.opcao(PALETA) as any;
    expect(opcao.yAxis.data).toEqual(['Novo', 'Proposta']);
    expect(opcao.series[0].itemStyle.color).toBe('#c1');
    expect(opcao.series[0].itemStyle.borderColor).toBe('#cd');
    expect(opcao.series[0].data).toEqual([
      { value: 9, id: 'e1' },
      { value: 4, id: 'e2' },
    ]);
    expect(opcao.legend).toBeUndefined();
    expect(grafico.vazio).toBe(false);
    expect(grafico.descricao).toContain('Funil. Negócios, 2 itens.');
    expect(grafico.descricao).toContain('Novo: 9');
  });

  it('o mesmo gráfico muda de cor com a paleta (tema)', () => {
    const grafico = montarGrafico(FUNIL, {
      categoria: 'etapa',
      tipoValor: 'numero',
      series: [{ chave: 'quantidade', nome: 'Negócios', cor: 3 }],
    });
    const claro = grafico.opcao({ ...PALETA, dados: ['#a', '#b', '#c', '#claro'] }) as any;
    const escuro = grafico.opcao({ ...PALETA, dados: ['#a', '#b', '#c', '#escuro'] }) as any;
    expect(claro.series[0].itemStyle.color).toBe('#claro');
    expect(escuro.series[0].itemStyle.color).toBe('#escuro');
  });

  it('várias séries: legenda, linha, empilhado e saídas negativas', () => {
    const mrr = tabela(
      'mrrPorMes',
      'MRR',
      [
        ['mes', 'texto'],
        ['novo', 'moeda'],
        ['churn', 'moeda'],
      ],
      [{ mes: '2026-10', novo: 100, churn: 30 }],
    );
    const grafico = montarGrafico(mrr, {
      categoria: 'mes',
      tipoValor: 'moeda',
      series: [
        { chave: 'novo', nome: 'Novo', cor: 0, pilha: 'm' },
        { chave: 'churn', nome: 'Cancelamentos', cor: 3, pilha: 'm', negativa: true },
        { chave: 'novo', nome: 'Linha', cor: 1, tipo: 'linha' },
      ],
    });
    const opcao = grafico.opcao(PALETA) as any;
    expect(opcao.xAxis.data).toEqual(['out/26']);
    expect(opcao.legend).toBeDefined();
    expect(opcao.series[1].data[0].value).toBe(-30);
    expect(opcao.series[1].stack).toBe('m');
    expect(opcao.series[2].type).toBe('line');
  });

  it('sem linhas ou só zeros: marcado como vazio', () => {
    const vazia = tabela(
      'x',
      'X',
      [
        ['dia', 'data'],
        ['n', 'numero'],
      ],
      [{ dia: '2026-10-01', n: 0 }],
    );
    const grafico = montarGrafico(vazia, {
      categoria: 'dia',
      tipoValor: 'numero',
      series: [{ chave: 'n', nome: 'N', cor: 0 }],
    });
    expect(grafico.vazio).toBe(true);
    expect(grafico.descricao).toContain('Sem dados no período');
  });

  it('ligações do painel Atendimento: 24 horas empilhadas e "Sem atendente" sem clique', () => {
    const horas = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      recebidas: hora === 9 ? 5 : 0,
      feitas: hora === 9 ? 2 : 0,
      atendidas: hora === 9 ? 4 : 0,
      perdidas: hora === 9 ? 1 : 0,
    }));
    const porHora = tabela(
      'ligacoesPorHora',
      'Ligações por hora',
      [
        ['hora', 'numero'],
        ['recebidas', 'numero'],
        ['feitas', 'numero'],
        ['atendidas', 'numero'],
        ['perdidas', 'numero'],
      ],
      horas,
    );
    const blocos = PAINEIS_BI.atendimento.blocos;
    const resultado = blocos.find((b) => b.id === 'ligacoesResultadoPorHora')!;
    const grafico = montarGrafico(porHora, resultado.grafico!);
    const opcao = grafico.opcao(PALETA) as any;
    expect(opcao.xAxis.data).toHaveLength(24);
    expect(opcao.xAxis.data[9]).toBe('9h');
    expect(opcao.series.map((s: any) => [s.name, s.stack])).toEqual([
      ['Atendidas', 'resultado'],
      ['Perdidas', 'resultado'],
    ]);
    expect(grafico.vazio).toBe(false);

    const porAtendente = tabela(
      'ligacoesPorAtendente',
      'Ligações por atendente',
      [
        ['id', 'id'],
        ['nome', 'texto'],
        ['atendidas', 'numero'],
        ['perdidas', 'numero'],
      ],
      [
        { id: 'u1', nome: 'Lucas', atendidas: 3, perdidas: 0 },
        { id: null, nome: 'Sem atendente', atendidas: 0, perdidas: 2 },
      ],
    );
    const bloco = blocos.find((b) => b.id === 'ligacoesPorAtendente')!;
    const barras = montarGrafico(porAtendente, bloco.grafico!).opcao(PALETA) as any;
    expect(barras.series[1].data).toEqual([
      { value: 0, id: 'u1' },
      { value: 2, id: null },
    ]);
  });
});
