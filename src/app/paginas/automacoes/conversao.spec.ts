import { SEGMENTO_VAZIO, type Segmento } from '../../ui/construtor-segmento/segmento';
import { agendaPadrao } from '../../ui/seletor-agenda/agenda';
import { JANELA_COMERCIAL } from '../../ui/seletor-janela-envio/janela-envio';
import {
  agendaParaConfig,
  configParaAgenda,
  configParaFiltros,
  filtrosParaConfig,
  horarioParaJanela,
  janelaParaHorario,
  marketingPadrao,
  segmentoDaApi,
  segmentoParaApi,
  segmentoTemCondicoes,
} from './conversao';

describe('conversão de segmento', () => {
  it('converte etiqueta e datas para o formato da API', () => {
    const segmento: Segmento = {
      combinacao: 'qualquer',
      condicoes: [
        { id: 'a', campo: 'etiqueta', operador: 'e', valor: 'vip' },
        { id: 'b', campo: 'etiqueta', operador: 'nao-e', valor: 'frio' },
        { id: 'c', campo: 'ultima_interacao_em', operador: 'ha-mais-de-dias', valor: 90 },
        { id: 'd', campo: 'opt_out', operador: 'nao', valor: null },
      ],
    };
    expect(segmentoParaApi(segmento)).toEqual({
      combinacao: 'qualquer',
      condicoes: [
        { campo: 'etiquetas', operador: 'contem_alguma', valor: ['vip'] },
        { campo: 'etiquetas', operador: 'nao_contem', valor: ['frio'] },
        { campo: 'ultima_interacao_em', operador: 'mais_de_dias', valor: 90 },
        { campo: 'opt_out', operador: 'igual', valor: false },
      ],
    });
  });

  it('deixa de fora condições sem valor', () => {
    const r = segmentoParaApi({
      combinacao: 'todos',
      condicoes: [{ id: 'a', campo: 'etiqueta', operador: 'e', valor: null }],
    });
    expect(r).toEqual({ combinacao: 'todas', condicoes: [] });
    expect(segmentoTemCondicoes(r)).toBe(false);
  });

  it('volta da API para a tela e ida e volta preserva o sentido', () => {
    const api = {
      combinacao: 'todas',
      condicoes: [
        { campo: 'origem', operador: 'fora_de', valor: ['SITE'] },
        { campo: 'telefone', operador: 'preenchido' },
        { campo: 'criado_em', operador: 'ultimos_dias', valor: 7 },
      ],
    };
    const { segmento, completo } = segmentoDaApi(api);
    expect(completo).toBe(true);
    expect(segmento.combinacao).toBe('todos');
    expect(segmento.condicoes.map((c) => [c.campo, c.operador, c.valor])).toEqual([
      ['origem', 'nao-e', 'SITE'],
      ['telefone', 'preenchido', null],
      ['criado_em', 'ultimos-dias', 7],
    ]);
    expect(segmentoParaApi(segmento)).toEqual(api);
  });

  it('avisa quando há filtros que a tela não mostra', () => {
    const r = segmentoDaApi({
      condicoes: [
        { campo: 'etiquetas', operador: 'contem_alguma', valor: ['a', 'b'] },
        { campo: 'campos.cidade', operador: 'igual', valor: 'Campinas' },
        { grupo: { condicoes: [] } },
      ],
    });
    expect(r.completo).toBe(false);
    expect(r.segmento.condicoes).toEqual([]);
  });

  it('segmento vazio ou ausente é completo', () => {
    expect(segmentoDaApi(null)).toEqual({ segmento: SEGMENTO_VAZIO, completo: true });
  });
});

describe('conversão de horário', () => {
  it('ida e volta da janela', () => {
    const horario = janelaParaHorario(JANELA_COMERCIAL);
    expect(Object.keys(horario.dias ?? {}).length).toBe(JANELA_COMERCIAL.dias.length);
    expect(horarioParaJanela(horario)).toEqual(JANELA_COMERCIAL);
  });

  it('faixas diferentes por dia não cabem na tela', () => {
    expect(
      horarioParaJanela({
        fusoHorario: 'America/Sao_Paulo',
        dias: {
          '1': [{ inicio: '09:00', fim: '18:00' }],
          '2': [{ inicio: '10:00', fim: '12:00' }],
        },
      }),
    ).toBeNull();
  });
});

describe('conversão do gatilho', () => {
  it('filtros: palavras viram lista, números viram número e vazios somem', () => {
    expect(
      filtrosParaConfig({
        palavras: 'preço, orçamento ,',
        notaMaxima: '2',
        funilId: '',
        origem: 'SITE',
      }),
    ).toEqual({ palavras: ['preço', 'orçamento'], notaMaxima: 2, origem: 'SITE' });
    expect(configParaFiltros({ palavras: ['a', 'b'], notaMaxima: 2 })).toEqual({
      palavras: 'a, b',
      notaMaxima: 2,
    });
  });

  it('recorrência semanal e mensal', () => {
    const semanal = {
      ...agendaPadrao('recorrente'),
      frequencia: 'semanal' as const,
      diasSemana: [1, 3] as const,
      hora: '08:30',
    };
    expect(agendaParaConfig('RECORRENCIA', semanal)).toEqual({
      frequencia: 'semanal',
      hora: '08:30',
      diasDaSemana: [1, 3],
    });
    const mensal = { ...semanal, frequencia: 'mensal' as const, diaMes: 5 };
    expect(agendaParaConfig('RECORRENCIA', mensal)).toEqual({
      frequencia: 'mensal',
      hora: '08:30',
      diaDoMes: 5,
    });
    expect(
      configParaAgenda('RECORRENCIA', { frequencia: 'mensal', hora: '10:00', diaDoMes: 1 }),
    ).toMatchObject({
      modo: 'recorrente',
      frequencia: 'mensal',
      diaMes: 1,
    });
  });

  it('data relativa: antes vira dias negativos', () => {
    const agenda = {
      ...agendaPadrao('relativa'),
      campo: 'contato.campos.renovacao_em',
      quantidade: 30,
      sentido: 'antes' as const,
      hora: '09:00',
    };
    expect(agendaParaConfig('DATA_RELATIVA', agenda)).toEqual({
      campo: 'contato.campos.renovacao_em',
      dias: -30,
      hora: '09:00',
    });
    expect(
      configParaAgenda('DATA_RELATIVA', { campo: 'negocio.ganhoEm', dias: 7, hora: '10:00' }),
    ).toMatchObject({
      sentido: 'depois',
      quantidade: 7,
      campo: 'negocio.ganhoEm',
    });
  });
});

describe('marketingPadrao', () => {
  it('a área de Marketing nasce marcada; as outras e "todas as áreas" não', () => {
    expect(marketingPadrao('MARKETING')).toBe(true);
    expect(marketingPadrao('COMERCIAL')).toBe(false);
    expect(marketingPadrao(null)).toBe(false);
    expect(marketingPadrao(undefined)).toBe(false);
  });
});
