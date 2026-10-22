import {
  DADOS_POR_PERIODO,
  DESLIGAMENTO,
  ehIdPeriodo,
  gerarSugestoes,
  ORIGENS,
  percentual,
  PERIODOS,
  SERIES_ATENDIMENTO,
  type DadosPeriodo,
} from './dados-exemplo';

const somar = (valores: readonly number[]) => valores.reduce((total, valor) => total + valor, 0);
const porPeriodo = PERIODOS.map(
  (periodo) => [periodo.rotulo, DADOS_POR_PERIODO[periodo.id]] as const,
);

describe('Dados de exemplo do painel', () => {
  it('30 dias traz os números do contrato: 17 %, 12 d e R$ 186 mil', () => {
    expect(PERIODOS.map((periodo) => periodo.rotulo)).toEqual(['7 dias', '30 dias', 'Trimestre']);
    const { jornada } = DADOS_POR_PERIODO['30d'];
    expect(Math.round(jornada.conversaoTotal)).toBe(17);
    expect(jornada.cicloMedioDias).toBe(12);
    expect(jornada.receitaGanha).toBe(186_000);
    expect(ehIdPeriodo('trimestre')).toBe(true);
    expect(ehIdPeriodo('ano')).toBe(false);
    expect(percentual(5, 0)).toBe(0);
  });

  it.each(porPeriodo)('%s: o funil bate entre si, etapa a etapa e origem a origem', (_, dados) => {
    const { etapas } = dados.jornada;
    expect(etapas.map((etapa) => etapa.etapa)).toEqual([
      'Leads',
      'Leads qualificados',
      'Oportunidades',
      'Negócios ganhos',
      'Clientes em onboarding',
    ]);
    expect(etapas.map((etapa) => etapa.area)).toEqual([
      'marketing',
      'marketing',
      'comercial',
      'comercial',
      'cs',
    ]);
    for (const [i, etapa] of etapas.entries()) {
      expect(etapa.series.map((serie) => serie.rotulo)).toEqual([...ORIGENS]);
      expect(somar(etapa.series.map((serie) => serie.valor))).toBe(etapa.total);
      if (i === 0) {
        expect(etapa.queda).toBeNull();
        continue;
      }
      const anterior = etapas[i - 1];
      etapa.series.forEach((serie, j) =>
        expect(serie.valor).toBeLessThanOrEqual(anterior.series[j].valor),
      );
      expect(etapa.queda).toBeCloseTo(((anterior.total - etapa.total) / anterior.total) * 100, 1);
    }
    const [leads, , oportunidades, ganhos] = etapas;
    expect(dados.jornada.conversaoTotal).toBeCloseTo((ganhos.total / leads.total) * 100, 1);
    // Ciclo de venda: do negócio criado no Comercial (MQL) ao ganho.
    expect(dados.jornada.cicloMedioDias).toBe(
      etapas[1].tempoMedioDias + oportunidades.tempoMedioDias,
    );
    expect(dados.indicadores.leads.valor).toBe(leads.total);
    expect(dados.indicadores.taxaGanho.valor).toBeCloseTo(
      (ganhos.total / oportunidades.total) * 100,
      1,
    );
    // O ranking da equipe soma exatamente os negócios ganhos do funil.
    expect(dados.equipe.ganhos).toBe(ganhos.total);
  });

  it.each(porPeriodo)('%s: atendimento e ranking são coerentes', (_, dados) => {
    const { atendimento, equipe } = dados;
    expect(atendimento.canais.map((canal) => canal.canal)).toEqual([
      'WhatsApp',
      'Instagram',
      'Chat do site',
      'E-mail',
    ]);
    for (const canal of atendimento.canais) {
      expect(canal.series.map((serie) => serie.rotulo)).toEqual([...SERIES_ATENDIMENTO]);
      expect(somar(canal.series.map((serie) => serie.valor))).toBe(canal.total);
    }
    expect(atendimento.conversasAbertas).toBe(
      somar(atendimento.canais.map((canal) => canal.emAndamento)),
    );

    const ganhos = equipe.pessoas.map((pessoa) => pessoa.ganhos);
    expect(ganhos).toEqual([...ganhos].sort((a, b) => b - a));
    expect(equipe.pessoas.map((pessoa) => pessoa.posicao)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(equipe.pessoas.map((pessoa) => pessoa.nome)).not.toContain(DESLIGAMENTO.pessoa);
    for (const pessoa of equipe.pessoas) {
      expect(pessoa.percentualMeta).toBe(Math.round((pessoa.ganhos / pessoa.meta) * 100));
      expect(pessoa.rotuloPapel).toMatch(/^(Comercial|Líder Comercial)$/);
    }
  });

  it('o que é "de agora" não muda com o período; o ticket médio fica estável', () => {
    const lista: readonly DadosPeriodo[] = PERIODOS.map((periodo) => DADOS_POR_PERIODO[periodo.id]);
    const iguais = (valor: (dados: DadosPeriodo) => number) => new Set(lista.map(valor)).size === 1;
    expect(iguais((dados) => dados.atendimento.conversasAbertas)).toBe(true);
    expect(iguais((dados) => dados.indicadores.mrr.valor)).toBe(true);
    expect(iguais((dados) => dados.indicadores.healthScore.valor)).toBe(true);
    const tickets = lista.map((dados) => dados.jornada.receitaGanha / dados.equipe.ganhos);
    for (const ticket of tickets) {
      expect(Math.abs(ticket / tickets[1] - 1)).toBeLessThan(0.02);
    }
  });

  it('cada período sabe quantos dias cobre e com o que compara', () => {
    expect(PERIODOS.map((periodo) => [periodo.dias, periodo.rotuloLeads])).toEqual([
      [7, 'Leads em 7 dias'],
      [30, 'Leads em 30 dias'],
      [90, 'Leads no trimestre'],
    ]);
    expect(PERIODOS.map((periodo) => periodo.anterior)).toEqual([
      'os 7 dias anteriores',
      'os 30 dias anteriores',
      'o trimestre anterior',
    ]);
  });

  it('a análise com IA usa os números do período selecionado', () => {
    const [gargalo, origem, atendimento] = gerarSugestoes(DADOS_POR_PERIODO['30d'], 'pt-BR');
    expect(gargalo.metrica).toBe(
      'Queda de 51,4% entre Oportunidades e Negócios ganhos (560 → 272).',
    );
    expect(origem.metrica).toContain('Indicação e outros viram negócio ganho em 24,4%');
    expect(origem.metrica).toContain('(78 de 320)');
    expect(atendimento.metrica).toContain('E-mail é o único canal sem chatbot: 255 conversas');
    expect(atendimento.hipotese).toContain('4,2 min');

    const trimestre = gerarSugestoes(DADOS_POR_PERIODO.trimestre, 'pt-BR');
    expect(trimestre[0].metrica).toContain('(1.530 → 723)');
    // Cada sugestão aponta o módulo onde a ação vai ser feita.
    expect(trimestre.map((sugestao) => sugestao.modulo)).toEqual([
      'automacoes',
      'disparos',
      'atendimento',
    ]);
  });
});
