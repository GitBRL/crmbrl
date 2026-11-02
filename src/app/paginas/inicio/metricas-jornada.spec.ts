import { area, COMERCIAL, CS, MARKETING, metricas } from './metricas-de-teste';
import {
  duracaoCurta,
  montarIndicadores,
  montarJornada,
  percentual,
  type MedidasDaJornada,
} from './metricas-jornada';

const TODAS: MedidasDaJornada = {
  areas: [
    area(MARKETING, metricas('MARKETING', [['Novo lead', 'ABERTA', null]], [16])),
    area(
      COMERCIAL,
      metricas(
        'COMERCIAL',
        [
          ['Novo', 'ABERTA', null],
          ['Ganho', 'GANHO', null],
        ],
        [10, 2],
      ),
    ),
    area(CS),
  ],
  receita: { valor: 14400.5, negocios: 2 },
};

describe('montarJornada', () => {
  it('a jornada inteira: conversão do lead ao ganho, ciclo e receita do Comercial', () => {
    const jornada = montarJornada(TODAS);
    expect(jornada.temDados).toBe(true);
    expect(jornada.areas.map((item) => item.rotulo)).toEqual([
      'Marketing',
      'Comercial',
      'Customer Success',
    ]);
    expect(jornada.conversao).toEqual({
      valor: 15,
      unidade: '%',
      legenda: 'Conversão total do funil',
      dica: 'Negócios ganhos no Comercial em relação aos leads que entraram no Marketing no período: 3 de 20.',
    });
    expect(jornada.ciclo.valor).toBe(12);
    expect(jornada.ciclo.unidade).toBe('d');
    expect(jornada.ciclo.legenda).toBe('Ciclo médio de venda');
    expect(jornada.ciclo.dica).toBe(
      'Tempo médio entre a criação do negócio e “Ganho”, dos 3 que chegaram lá no período.',
    );
    expect(jornada.terceiro).toEqual({
      tipo: 'receita',
      valor: 14400.5,
      unidade: null,
      legenda: 'Receita ganha',
      dica: 'Soma do valor dos 2 negócios ganhos no Comercial no período.',
    });
    expect(jornada.referencia).toBe(20);
  });

  it('cada área: todas as etapas da conversão e os extremos (entrada e ganho)', () => {
    const [marketing, comercial, cs] = montarJornada(TODAS).areas;
    expect(
      marketing.etapas.map((etapa) => [
        etapa.etapa,
        etapa.total,
        etapa.queda,
        etapa.tempoMedioDias,
      ]),
    ).toEqual([
      ['Novo lead', 20, null, 2],
      ['Em contato', 10, 50, 3],
      ['Nutrição', 6, 40, null],
      ['Qualificado (MQL)', 4, 33.3, null],
    ]);
    // Cada barra: quem seguiu até a barra seguinte e quem parou; o ganho é de quem chegou.
    expect(marketing.etapas[0].series).toEqual([
      { rotulo: 'Seguiram adiante', valor: 10 },
      { rotulo: 'Pararam na etapa', valor: 10 },
    ]);
    expect(marketing.etapas[3].series).toEqual([{ rotulo: 'Chegaram', valor: 4 }]);
    expect(marketing.extremos.map((etapa) => [etapa.etapa, etapa.total, etapa.queda])).toEqual([
      ['Novo lead', 20, null],
      ['Qualificado (MQL)', 4, 80],
    ]);
    expect(marketing.extremos[0].series).toEqual([
      { rotulo: 'Seguiram adiante', valor: 4 },
      { rotulo: 'Pararam na etapa', valor: 16 },
    ]);
    expect(marketing.parados).toBe(3);
    expect(marketing.passagem).toBeNull();
    // A passagem só aparece quando a área anterior também está na tela.
    expect(comercial.passagem).toContain('qualificado (MQL)');
    expect(cs.passagem).toContain('Boas-vindas');
    expect(comercial.slug).toBe('comercial');
    expect(cs.etapaGanho).toBe('Renovado');
  });

  it('quem vê uma área só: a taxa da própria área e, sem o Comercial, os parados', () => {
    const comercial = montarJornada({
      areas: [area(COMERCIAL)],
      receita: { valor: 0, negocios: 0 },
    });
    expect(comercial.conversao.legenda).toBe('Taxa de ganho');
    expect(comercial.conversao.valor).toBe(25);
    expect(comercial.conversao.dica).toBe(
      'Negócios criados no período que chegaram a “Ganho”: 3 de 12.',
    );
    expect(comercial.terceiro.dica).toBe('Nenhum negócio ganho no Comercial no período.');
    expect(comercial.areas[0].passagem).toBeNull();

    const marketing = montarJornada({ areas: [area(MARKETING)], receita: null });
    expect(marketing.conversao.legenda).toBe('Taxa de qualificação');
    expect(marketing.ciclo.legenda).toBe('Ciclo até a qualificação');
    expect(marketing.ciclo.valor).toBe(6.5);
    expect(marketing.terceiro).toEqual({
      tipo: 'parados',
      valor: 3,
      unidade: null,
      legenda: 'Negócios parados agora',
      dica: 'Negócios abertos há mais tempo que o prazo-alvo da etapa em que estão.',
    });

    const cs = montarJornada({ areas: [area(CS)], receita: null });
    expect(cs.conversao.legenda).toBe('Taxa de renovação');
    expect(cs.ciclo.legenda).toBe('Ciclo até a renovação');
  });

  it('sem ganhos no período, o ciclo fica sem valor e diz por quê; sem negócios, não há dados', () => {
    const vazio = metricas(
      'COMERCIAL',
      [
        ['Novo', 'ABERTA', null],
        ['Ganho', 'GANHO', null],
      ],
      [0, 0],
      {
        ganhosNoPeriodo: 0,
      },
    );
    const jornada = montarJornada({ areas: [area(vazio)], receita: { valor: 0, negocios: 0 } });
    expect(jornada.temDados).toBe(false);
    expect(jornada.ciclo.valor).toBeNull();
    expect(jornada.ciclo.dica).toBe('Nenhum negócio chegou a “Ganho” no período.');
    expect(jornada.conversao.valor).toBeNull();
    // A queda de uma etapa que ninguém alcançou fica de fora (sem divisão por zero).
    expect(jornada.areas[0].etapas[1].queda).toBeNull();
  });
});

describe('duracaoCurta', () => {
  it('dias com uma casa a partir de um dia; abaixo disso, horas e minutos', () => {
    expect(duracaoCurta(86_400 * 12.34)).toEqual({ valor: 12.3, unidade: 'd' });
    expect(duracaoCurta(86_400)).toEqual({ valor: 1, unidade: 'd' });
    expect(duracaoCurta(5 * 3_600 + 1_200)).toEqual({ valor: 5, unidade: 'h' });
    expect(duracaoCurta(2_221)).toEqual({ valor: 37, unidade: 'min' });
    expect(duracaoCurta(45)).toEqual({ valor: 1, unidade: 'min' });
  });

  it('menos de meio minuto vira "< 1 min", nunca "0 min"', () => {
    expect(duracaoCurta(0)).toEqual({ valor: '< 1', unidade: 'min' });
    expect(duracaoCurta(20)).toEqual({ valor: '< 1', unidade: 'min' });
  });

  it('o ciclo de menos de um dia aparece em horas, não como "0 d"', () => {
    const rapido = metricas(
      'COMERCIAL',
      [
        ['Novo', 'ABERTA', 0],
        ['Ganho', 'GANHO', null],
      ],
      [4, 2],
      {
        cicloDias: 0.1,
        cicloSegundos: 9_000,
      },
    );
    const jornada = montarJornada({ areas: [area(rapido)], receita: null });
    expect(jornada.ciclo.valor).toBe(3);
    expect(jornada.ciclo.unidade).toBe('h');
  });
});

describe('montarIndicadores', () => {
  it('leads e taxa de ganho, com a variação em relação ao período anterior', () => {
    expect(montarIndicadores(TODAS)).toEqual({
      novos: { area: 'MARKETING', valor: 20, variacao: 25 },
      taxaGanho: { valor: 25, variacao: 5, ganhos: 3, criados: 12 },
    });
  });

  it('com uma área só: os negócios novos dela e nenhuma taxa repetida', () => {
    expect(montarIndicadores({ areas: [area(COMERCIAL)], receita: null })).toEqual({
      novos: { area: 'COMERCIAL', valor: 12, variacao: null },
      taxaGanho: null,
    });
    expect(montarIndicadores({ areas: [], receita: null })).toEqual({
      novos: null,
      taxaGanho: null,
    });
  });
});

describe('percentual', () => {
  it('uma casa, e null sem base', () => {
    expect(percentual(1, 3)).toBe(33.3);
    expect(percentual(3, 0)).toBeNull();
  });
});
