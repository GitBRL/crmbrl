import { describe, expect, it } from 'vitest';

import type { FiltrosDoIndicador } from './indicadores.tipos';

import {
  destinoDaEtapa,
  destinoDoClique,
  filtrosAtivos,
  filtrosEscolhidos,
  parametrosPadrao,
  reordenarWidgets,
  tabelaDoWidget,
  textoDoValor,
  valorDoWidget,
} from './indicadores.formatos';
import { CATALOGO_DE_TESTE, resultadoNumero, widget } from './indicadores-de-teste';

describe('indicadores.formatos', () => {
  it('R33.1 — escreve o valor conforme a unidade (duração em segundos, moeda abreviada, percentual)', () => {
    expect(textoDoValor('DURACAO', 4420)).toBe('1 h 14 min');
    expect(textoDoValor('PERCENTUAL', 66.67)).toBe('66,7%');
    expect(textoDoValor('NUMERO', 7)).toBe('7');
    expect(textoDoValor('NUMERO', null)).toBe('—');
    expect(textoDoValor('MOEDA', 8000)).toContain('R$');
  });

  it('R33.2 — o número grande leva prefixo e unidade pequenos; sem valor, nada', () => {
    expect(valorDoWidget('PERCENTUAL', 75)).toMatchObject({ valor: 75, unidade: '%' });
    expect(valorDoWidget('DURACAO', 7200)).toMatchObject({ unidade: 'h' });
    expect(valorDoWidget('NUMERO', null)).toBeNull();
  });

  it('R33.2 — série vira tabela de período × valor; ranking e funil ganham colunas próprias', () => {
    const serie = tabelaDoWidget(
      resultadoNumero({
        visualizacao: 'SERIE',
        pontos: [
          { chave: '2026-11-01', rotulo: '01/11', valor: 2 },
          { chave: '2026-11-02', rotulo: '02/11', valor: null },
        ],
      }),
    );
    expect(serie.colunas.map((c) => c.chave)).toEqual(['rotulo', 'valor']);
    expect(serie.linhas).toEqual([
      { rotulo: '01/11', valor: 2 },
      { rotulo: '02/11', valor: null },
    ]);
    const funil = tabelaDoWidget(
      resultadoNumero({
        visualizacao: 'FUNIL',
        linhas: [{ id: 'e1', rotulo: 'Novo', valor: 10, conversao: null, conversaoTotal: null }],
      }),
    );
    expect(funil.colunas.map((c) => c.chave)).toEqual([
      'id',
      'rotulo',
      'valor',
      'conversao',
      'conversaoTotal',
    ]);
    expect(funil.colunas[0].visivel).toBe(false);
  });

  it('R20.8 — o clique das atividades leva à agenda filtrada; o de negócios, ao quadro do setor', () => {
    expect(
      destinoDoClique({
        lista: 'ATIVIDADES',
        filtros: { tipo: ['REUNIAO'], resultadoReuniao: ['NAO_COMPARECEU'] },
      }),
    ).toEqual({
      comandos: ['/atividades'],
      consulta: { escopo: 'TODAS', tipo: 'REUNIAO', resultado: 'NAO_COMPARECEU' },
    });
    expect(
      destinoDoClique({ lista: 'NEGOCIOS', filtros: { status: 'ABERTO', funilId: 'f1' } }),
    ).toEqual({ comandos: ['/funis', 'comercial'], consulta: { funil: 'f1' } });
    expect(destinoDoClique(null)).toBeNull();
    expect(destinoDaEtapa('COMERCIAL', 'f1', 'e1', true)).toEqual({
      comandos: ['/funis', 'comercial'],
      consulta: { etapaId: 'e1' },
    });
    expect(destinoDaEtapa('COMERCIAL', 'f1', null, true)).toBeNull();
  });

  it('R33.8 — reordenar renumera a ordem e ignora movimento inválido', () => {
    const lista = [widget({ id: 'a' }), widget({ id: 'b' }), widget({ id: 'c' })];
    const depois = reordenarWidgets(lista, 0, 2);
    expect(depois.map((w) => [w.id, w.ordem])).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
    ]);
    expect(reordenarWidgets(lista, 1, 1)).toBe(lista);
    expect(reordenarWidgets(lista, 0, 5)).toBe(lista);
  });

  it('R33.3 — conta os filtros ligados além do período', () => {
    expect(filtrosAtivos({ periodo: { tipo: 'HOJE' }, comparar: true })).toBe(0);
    expect(filtrosAtivos({ funilIds: ['f'], origens: ['SITE'], etiquetas: [] })).toBe(2);
  });

  it('R33.1 — parâmetros padrão só dos que valem para a visualização', () => {
    const leads = CATALOGO_DE_TESTE.indicadores[0];
    expect(parametrosPadrao(leads, 'SERIE')).toEqual({ agrupamento: 'DIA' });
    expect(parametrosPadrao(leads, 'NUMERO')).toEqual({});
  });

  it('R33.3 — manda só os filtros que a pessoa mudou em relação ao padrão do painel', () => {
    const padrao: FiltrosDoIndicador = { periodo: { tipo: 'MES_ATUAL' }, funilIds: ['f1'] };
    expect(filtrosEscolhidos({ ...padrao }, padrao)).toEqual({});
    expect(filtrosEscolhidos({ ...padrao, periodo: { tipo: 'ANO' } }, padrao)).toEqual({
      periodo: { tipo: 'ANO' },
    });
    expect(filtrosEscolhidos({ periodo: { tipo: 'MES_ATUAL' } }, padrao)).toEqual({ funilIds: [] });
    expect(filtrosEscolhidos({ pessoaIds: ['p1'] }, null)).toEqual({ pessoaIds: ['p1'] });
  });
});
