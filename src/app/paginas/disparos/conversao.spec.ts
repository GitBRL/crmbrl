import { describe, expect, it } from 'vitest';

import type { Segmento } from '../../ui/construtor-segmento/segmento';
import type { JanelaEnvio } from '../../ui/seletor-janela-envio/janela-envio';
import {
  camposDoSegmento,
  descreverSegmento,
  janelaDaApi,
  janelaParaApi,
  segmentoDaApi,
  segmentoParaApi,
} from './conversao';

const segmento = (...condicoes: Segmento['condicoes'][number][]): Segmento => ({
  combinacao: 'todos',
  condicoes,
});

describe('segmentoParaApi', () => {
  it('traduz etiquetas, origem e datas para o formato da API', () => {
    const api = segmentoParaApi(
      segmento(
        { id: '1', campo: 'etiquetas', operador: 'e', valor: 'Cliente' },
        { id: '2', campo: 'etiquetas', operador: 'nao-e', valor: 'VIP' },
        { id: '3', campo: 'origem', operador: 'e', valor: 'SITE' },
        { id: '4', campo: 'ultima_interacao_em', operador: 'ha-mais-de-dias', valor: 30 },
        { id: '5', campo: 'criado_em', operador: 'antes', valor: '2026-01-31' },
        { id: '6', campo: 'responsavel', operador: 'vazio', valor: null },
      ),
    );
    expect(api).toEqual({
      combinacao: 'todas',
      condicoes: [
        { campo: 'etiquetas', operador: 'contem_alguma', valor: ['Cliente'] },
        { campo: 'etiquetas', operador: 'nao_contem', valor: ['VIP'] },
        { campo: 'origem', operador: 'em', valor: ['SITE'] },
        { campo: 'ultima_interacao_em', operador: 'mais_de_dias', valor: 30 },
        { campo: 'criado_em', operador: 'antes', valor: '2026-01-31' },
        { campo: 'responsavel', operador: 'vazio' },
      ],
    });
  });

  it('deixa de fora condições sem valor ou de campos desconhecidos', () => {
    const api = segmentoParaApi(
      segmento(
        { id: '1', campo: 'etiquetas', operador: 'e', valor: null },
        { id: '2', campo: 'cor', operador: 'e', valor: 'azul' },
      ),
    );
    expect(api.condicoes).toEqual([]);
  });

  it('"qualquer" vira combinacao "qualquer"', () => {
    expect(segmentoParaApi({ combinacao: 'qualquer', condicoes: [] }).combinacao).toBe('qualquer');
  });
});

describe('segmentoDaApi', () => {
  it('lê o que o construtor entende e volta ao modelo de tela', () => {
    const { segmento: lido, perdeu } = segmentoDaApi({
      combinacao: 'qualquer',
      condicoes: [
        { campo: 'etiquetas', operador: 'contem_alguma', valor: ['Feira 2026'] },
        { campo: 'criado_em', operador: 'ultimos_dias', valor: 7 },
      ],
    });
    expect(perdeu).toBe(false);
    expect(lido.combinacao).toBe('qualquer');
    expect(
      lido.condicoes.map(({ campo, operador, valor }) => ({ campo, operador, valor })),
    ).toEqual([
      { campo: 'etiquetas', operador: 'e', valor: 'Feira 2026' },
      { campo: 'criado_em', operador: 'ultimos-dias', valor: 7 },
    ]);
  });

  it('avisa quando havia filtros que a tela não mostra', () => {
    const lido = segmentoDaApi({
      condicoes: [
        { campo: 'telefone', operador: 'preenchido' },
        { grupo: { condicoes: [] } },
        { campo: 'etiquetas', operador: 'contem_alguma', valor: ['A', 'B'] },
      ],
    });
    expect(lido.perdeu).toBe(true);
    expect(lido.segmento.condicoes).toHaveLength(1);
  });

  it('segmento vazio ou nulo é "todos os contatos"', () => {
    expect(segmentoDaApi(null).segmento.condicoes).toEqual([]);
    expect(segmentoDaApi(null).perdeu).toBe(false);
  });
});

describe('camposDoSegmento', () => {
  it('só oferece operadores que existem na API', () => {
    const campos = camposDoSegmento(['A'], [{ id: 'u1', nome: 'Ana' }]);
    const data = campos.find((c) => c.id === 'criado_em');
    expect(data?.operadores).not.toContain('vazio');
    expect(campos.find((c) => c.id === 'etiquetas')?.opcoes).toEqual([{ valor: 'A', rotulo: 'A' }]);
  });
});

describe('descreverSegmento', () => {
  it('escreve em português', () => {
    expect(
      descreverSegmento({
        condicoes: [
          { campo: 'etiquetas', operador: 'contem_alguma', valor: ['A', 'B'] },
          { campo: 'ultima_interacao_em', operador: 'mais_de_dias', valor: 30 },
          { campo: 'origem', operador: 'em', valor: ['SITE'] },
        ],
      }),
    ).toEqual(['Etiqueta: A ou B', 'Última conversa: há mais de 30 dias', 'Origem: Site']);
    expect(descreverSegmento(null)).toEqual([]);
  });
});

describe('janela de envio', () => {
  const janela: JanelaEnvio = {
    dias: [1, 2, 3],
    inicio: '08:00',
    fim: '18:00',
    fuso: 'America/Sao_Paulo',
  };

  it('vai e volta sem perder nada', () => {
    const api = janelaParaApi(janela);
    expect(api).toEqual({
      fusoHorario: 'America/Sao_Paulo',
      dias: {
        '1': [{ inicio: '08:00', fim: '18:00' }],
        '2': [{ inicio: '08:00', fim: '18:00' }],
        '3': [{ inicio: '08:00', fim: '18:00' }],
      },
    });
    expect(janelaDaApi(api)).toEqual({ janela, perdeu: false });
  });

  it('nula é "a qualquer hora"', () => {
    expect(janelaDaApi(null)).toBeNull();
    expect(janelaDaApi({ fusoHorario: 'America/Sao_Paulo', dias: {} })).toBeNull();
  });

  it('avisa quando os dias têm horários diferentes', () => {
    const lida = janelaDaApi({
      fusoHorario: 'America/Sao_Paulo',
      dias: { '1': [{ inicio: '08:00', fim: '12:00' }], '2': [{ inicio: '09:00', fim: '12:00' }] },
    });
    expect(lida?.perdeu).toBe(true);
    expect(lida?.janela.inicio).toBe('08:00');
  });
});
