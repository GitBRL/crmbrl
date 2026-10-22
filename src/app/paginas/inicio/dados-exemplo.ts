import { formatNumber } from '@angular/common';

import { ROTULO_PAPEL, type Papel } from '../../nucleo/papeis';
import type { SerieFunil } from '../../ui/barra-funil/barra-funil';

/**
 * Dados FICTÍCIOS dos blocos da Visão geral (/inicio) que dependem de módulos futuros:
 * atendimento (Fase 2), ranking com metas (BI), MRR (Financeiro), health score (CS) e a
 * análise com IA. A jornada e os indicadores de leads e taxa de ganho são reais
 * (`metricas-jornada.ts`); estes números aparecem sempre com o selo "Dados de exemplo".
 *
 * Os números contam o fluxo que o CRM vai ter: o lead chega por webhook (ou formulário,
 * WhatsApp, indicação) no funil de Marketing; quando é qualificado (MQL), vira sozinho um
 * negócio no Comercial; o negócio ganho entra automaticamente no pipeline de CS.
 *
 * Só as contagens brutas são escritas à mão. Totais, quedas, conversão, ciclo, taxa de
 * ganho, conversas abertas e o ranking são calculados aqui, para os números baterem entre
 * si em todos os períodos (o `dados-exemplo.spec.ts` confere).
 */

// ---------------------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------------------

export type IdPeriodo = '7d' | '30d' | 'trimestre';

export interface Periodo {
  readonly id: IdPeriodo;
  /** Rótulo do seletor ("30 dias"). */
  readonly rotulo: string;
  /** Segundo tom dos títulos do palco ("30 dias"). */
  readonly complemento: string;
  /** O período por extenso ("últimos 30 dias"). */
  readonly descricao: string;
  /** A descrição com a preposição, para frases ("dos últimos 30 dias", "do último trimestre"). */
  readonly doPeriodo: string;
  /** Quantos dias o período cobre, contando hoje (o intervalo de datas ao lado do seletor). */
  readonly dias: number;
  /** Legenda do indicador de leads ("Leads em 30 dias"). */
  readonly rotuloLeads: string;
  /** Base das variações ("em relação aos 30 dias anteriores"). */
  readonly comparacao: string;
  /** O período anterior, para as dicas ("A seta compara com os 30 dias anteriores."). */
  readonly anterior: string;
}

export const PERIODOS: readonly Periodo[] = [
  {
    id: '7d',
    rotulo: '7 dias',
    complemento: '7 dias',
    descricao: 'últimos 7 dias',
    doPeriodo: 'dos últimos 7 dias',
    dias: 7,
    rotuloLeads: 'Leads em 7 dias',
    comparacao: 'em relação aos 7 dias anteriores',
    anterior: 'os 7 dias anteriores',
  },
  {
    id: '30d',
    rotulo: '30 dias',
    complemento: '30 dias',
    descricao: 'últimos 30 dias',
    doPeriodo: 'dos últimos 30 dias',
    dias: 30,
    rotuloLeads: 'Leads em 30 dias',
    comparacao: 'em relação aos 30 dias anteriores',
    anterior: 'os 30 dias anteriores',
  },
  {
    id: 'trimestre',
    rotulo: 'Trimestre',
    complemento: 'trimestre',
    descricao: 'último trimestre',
    doPeriodo: 'do último trimestre',
    dias: 90,
    rotuloLeads: 'Leads no trimestre',
    comparacao: 'em relação ao trimestre anterior',
    anterior: 'o trimestre anterior',
  },
];

export const PERIODO_PADRAO: IdPeriodo = '30d';

export function ehIdPeriodo(valor: unknown): valor is IdPeriodo {
  return PERIODOS.some((periodo) => periodo.id === valor);
}

// ---------------------------------------------------------------------------------------
// Tipos do painel
// ---------------------------------------------------------------------------------------

/** Origens do lead, na ordem das cores de dado (ciano, menta, lima). */
export const ORIGENS = ['Site e webhooks', 'WhatsApp', 'Indicação e outros'] as const;

export type AreaFunil = 'marketing' | 'comercial' | 'cs';

export interface AreaDoFunil {
  readonly id: AreaFunil;
  readonly rotulo: string;
  /** Como o negócio chega a esta área sem ninguém cadastrar (dica); `null` na primeira. */
  readonly passagem: string | null;
}

export const AREAS_FUNIL: readonly AreaDoFunil[] = [
  { id: 'marketing', rotulo: 'Marketing', passagem: null },
  {
    id: 'comercial',
    rotulo: 'Comercial',
    passagem:
      'Quando o Marketing marca o lead como qualificado (MQL), o CRM cria sozinho o negócio no funil Comercial e o distribui por rodízio. Na primeira conversa o vendedor confirma o interesse: os confirmados viram Oportunidades; os outros são descartados com o motivo registrado.',
  },
  {
    id: 'cs',
    rotulo: 'Customer Success',
    passagem:
      'O pipeline (funil) de CS acompanha o onboarding, a implantação do cliente. Todo negócio ganho entra sozinho nele, na etapa Boas-vindas — nenhum se perde na passagem. Esta barra conta quem já começou o onboarding; os demais fecharam há poucos dias e ainda estão nas Boas-vindas.',
  },
];

export type IdEtapa = 'leads' | 'qualificados' | 'oportunidades' | 'ganhos' | 'onboarding';

export interface EtapaFunil {
  readonly id: IdEtapa;
  readonly etapa: string;
  readonly area: AreaFunil;
  readonly total: number;
  /** Uma série por origem do lead, na ordem de `ORIGENS`. */
  readonly series: readonly SerieFunil[];
  /** Queda em % em relação à etapa anterior (uma casa); `null` na primeira etapa. */
  readonly queda: number | null;
  /** Tempo médio na etapa, em dias. */
  readonly tempoMedioDias: number;
}

export interface DadosJornada {
  readonly etapas: readonly EtapaFunil[];
  /** Negócios ganhos ÷ leads, em %. */
  readonly conversaoTotal: number;
  /** Do negócio criado no Comercial (lead qualificado) ao ganho, em dias. */
  readonly cicloMedioDias: number;
  /** Soma do valor dos negócios ganhos, em R$. */
  readonly receitaGanha: number;
}

/** Séries do volume por canal, na ordem das cores de dado. */
export const SERIES_ATENDIMENTO = [
  'Resolvidas pelo chatbot',
  'Resolvidas pela equipe',
  'Em andamento',
] as const;

export interface CanalAtendimento {
  readonly canal: string;
  readonly total: number;
  readonly series: readonly SerieFunil[];
  /** Conversas do canal ainda em andamento (a 3ª série). */
  readonly emAndamento: number;
}

export interface DadosAtendimento {
  /** Conversas em andamento agora, somando os canais. */
  readonly conversasAbertas: number;
  readonly primeiraRespostaMin: number;
  readonly variacaoPrimeiraResposta: number;
  readonly slaCumprido: number;
  readonly variacaoSla: number;
  readonly csat: number;
  readonly variacaoCsat: number;
  /** Do maior para o menor volume. */
  readonly canais: readonly CanalAtendimento[];
}

export interface PessoaRanking {
  readonly posicao: number;
  readonly nome: string;
  readonly papel: Papel;
  readonly rotuloPapel: string;
  readonly ganhos: number;
  readonly atividades: number;
  readonly meta: number;
  /** Ganhos ÷ meta, em % inteiro (pode passar de 100). */
  readonly percentualMeta: number;
}

export interface DadosEquipe {
  /** Em ordem de negócios ganhos (empate: quem está mais perto da meta). */
  readonly pessoas: readonly PessoaRanking[];
  readonly ganhos: number;
}

export interface ValorComVariacao {
  readonly valor: number;
  /** Variação em % (ou pontos percentuais, nas taxas) em relação ao período anterior. */
  readonly variacao: number;
}

export interface DadosIndicadores {
  readonly leads: ValorComVariacao;
  /** Negócios ganhos ÷ oportunidades, em %. */
  readonly taxaGanho: ValorComVariacao;
  /** Receita recorrente mensal de hoje, em R$ (a variação compara com o início do período). */
  readonly mrr: ValorComVariacao;
  /** Média de 0 a 100 dos clientes ativos, hoje. */
  readonly healthScore: ValorComVariacao;
}

export interface DadosPeriodo {
  readonly periodo: Periodo;
  readonly jornada: DadosJornada;
  readonly atendimento: DadosAtendimento;
  readonly equipe: DadosEquipe;
  readonly indicadores: DadosIndicadores;
}

// ---------------------------------------------------------------------------------------
// Contagens brutas (as únicas escritas à mão)
// ---------------------------------------------------------------------------------------

/** [Site e webhooks, WhatsApp, Indicação e outros] ou [chatbot, equipe, em andamento]. */
type Trio = readonly [number, number, number];

interface EtapaBruta {
  readonly dias: number;
  readonly origens: Trio;
}

interface PeriodoBruto {
  readonly etapas: Readonly<Record<IdEtapa, EtapaBruta>>;
  readonly receitaGanha: number;
  readonly variacoes: Readonly<Record<keyof DadosIndicadores, number>>;
  readonly atendimento: {
    readonly primeiraRespostaMin: number;
    readonly variacaoPrimeiraResposta: number;
    readonly slaCumprido: number;
    readonly variacaoSla: number;
    readonly csat: number;
    readonly variacaoCsat: number;
    /** Por canal: [resolvidas pelo chatbot, resolvidas pela equipe, em andamento]. */
    readonly canais: Readonly<Record<string, Trio>>;
  };
  /** Por vendedor: [negócios ganhos, atividades concluídas, meta de ganhos]. */
  readonly vendas: Readonly<Record<string, Trio>>;
}

const ETAPAS: readonly { readonly id: IdEtapa; readonly nome: string; readonly area: AreaFunil }[] =
  [
    { id: 'leads', nome: 'Leads', area: 'marketing' },
    { id: 'qualificados', nome: 'Leads qualificados', area: 'marketing' },
    { id: 'oportunidades', nome: 'Oportunidades', area: 'comercial' },
    { id: 'ganhos', nome: 'Negócios ganhos', area: 'comercial' },
    { id: 'onboarding', nome: 'Clientes em onboarding', area: 'cs' },
  ];

/** Equipe comercial do ranking (Pedro Martins foi desligado: não aparece). */
const VENDEDORES: readonly { readonly nome: string; readonly papel: Papel }[] = [
  { nome: 'João Batista', papel: 'COMERCIAL' },
  { nome: 'Marina Costa', papel: 'COMERCIAL' },
  { nome: 'Carla Nogueira', papel: 'LIDER_COMERCIAL' },
  { nome: 'Diego Fernandes', papel: 'COMERCIAL' },
  { nome: 'Paula Mendes', papel: 'COMERCIAL' },
  { nome: 'Thiago Moreira', papel: 'COMERCIAL' },
];

/** MRR e health score são "de hoje": iguais em todos os períodos; só a variação muda. */
const MRR_ATUAL = 412_000;
const HEALTH_SCORE_ATUAL = 78;

/** Conversas em andamento agora, por canal (iguais em todos os períodos). */
const EM_ANDAMENTO = { whatsapp: 22, instagram: 8, chat: 3, email: 5 } as const;

const BRUTOS: Readonly<Record<IdPeriodo, PeriodoBruto>> = {
  '7d': {
    etapas: {
      leads: { dias: 3, origens: [176, 134, 78] },
      qualificados: { dias: 2, origens: [86, 79, 45] },
      oportunidades: { dias: 9, origens: [49, 48, 35] },
      ganhos: { dias: 2, origens: [22, 22, 18] },
      onboarding: { dias: 12, origens: [20, 20, 17] },
    },
    receitaGanha: 42_400,
    variacoes: { leads: 5.2, taxaGanho: -1.2, mrr: 0.7, healthScore: 0.5 },
    atendimento: {
      primeiraRespostaMin: 3.4,
      variacaoPrimeiraResposta: -8,
      slaCumprido: 96,
      variacaoSla: 1.2,
      csat: 93,
      variacaoCsat: 0.8,
      canais: {
        WhatsApp: [98, 156, EM_ANDAMENTO.whatsapp],
        Instagram: [34, 55, EM_ANDAMENTO.instagram],
        'Chat do site': [45, 33, EM_ANDAMENTO.chat],
        'E-mail': [0, 56, EM_ANDAMENTO.email],
      },
    },
    vendas: {
      'João Batista': [13, 51, 13],
      'Marina Costa': [12, 47, 13],
      'Carla Nogueira': [10, 36, 9],
      'Diego Fernandes': [10, 44, 13],
      'Paula Mendes': [9, 40, 12],
      'Thiago Moreira': [8, 35, 12],
    },
  },
  '30d': {
    etapas: {
      leads: { dias: 3, origens: [720, 560, 320] },
      qualificados: { dias: 2, origens: [360, 330, 190] },
      oportunidades: { dias: 10, origens: [210, 205, 145] },
      ganhos: { dias: 2, origens: [96, 98, 78] },
      onboarding: { dias: 13, origens: [93, 95, 76] },
    },
    receitaGanha: 186_000,
    variacoes: { leads: 8.4, taxaGanho: 2.1, mrr: 3.1, healthScore: 2.6 },
    atendimento: {
      primeiraRespostaMin: 4.2,
      variacaoPrimeiraResposta: -12,
      slaCumprido: 94,
      variacaoSla: 2.5,
      csat: 92,
      variacaoCsat: 1.6,
      canais: {
        WhatsApp: [430, 728, EM_ANDAMENTO.whatsapp],
        Instagram: [150, 252, EM_ANDAMENTO.instagram],
        'Chat do site': [190, 147, EM_ANDAMENTO.chat],
        'E-mail': [0, 255, EM_ANDAMENTO.email],
      },
    },
    vendas: {
      'João Batista': [58, 214, 55],
      'Marina Costa': [52, 198, 55],
      'Carla Nogueira': [47, 156, 40],
      'Diego Fernandes': [44, 187, 55],
      'Paula Mendes': [39, 171, 50],
      'Thiago Moreira': [32, 149, 50],
    },
  },
  trimestre: {
    etapas: {
      leads: { dias: 4, origens: [2010, 1590, 920] },
      qualificados: { dias: 2, origens: [990, 920, 530] },
      oportunidades: { dias: 11, origens: [570, 560, 400] },
      ganhos: { dias: 2, origens: [255, 262, 206] },
      onboarding: { dias: 14, origens: [250, 257, 202] },
    },
    receitaGanha: 494_000,
    variacoes: { leads: 12.1, taxaGanho: 3.4, mrr: 8.5, healthScore: 5.4 },
    atendimento: {
      primeiraRespostaMin: 5.1,
      variacaoPrimeiraResposta: -6,
      slaCumprido: 91,
      variacaoSla: 3.8,
      csat: 90,
      variacaoCsat: 2.9,
      canais: {
        WhatsApp: [1240, 2158, EM_ANDAMENTO.whatsapp],
        Instagram: [430, 752, EM_ANDAMENTO.instagram],
        'Chat do site': [545, 432, EM_ANDAMENTO.chat],
        'E-mail': [0, 755, EM_ANDAMENTO.email],
      },
    },
    vendas: {
      'João Batista': [154, 628, 165],
      'Marina Costa': [138, 590, 165],
      'Carla Nogueira': [124, 470, 120],
      'Diego Fernandes': [117, 552, 165],
      'Paula Mendes': [104, 509, 150],
      'Thiago Moreira': [86, 441, 150],
    },
  },
};

// ---------------------------------------------------------------------------------------
// Derivados
// ---------------------------------------------------------------------------------------

/** `parte` em % de `todo`, com uma casa (0 quando `todo` é 0). */
export function percentual(parte: number, todo: number): number {
  return todo > 0 ? Math.round((parte / todo) * 1000) / 10 : 0;
}

function somar(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

function series(nomes: readonly string[], valores: Trio): readonly SerieFunil[] {
  return nomes.map((rotulo, indice) => ({ rotulo, valor: valores[indice] }));
}

function montarJornada(bruto: PeriodoBruto): DadosJornada {
  let anterior: number | null = null;
  const etapas = ETAPAS.map<EtapaFunil>(({ id, nome, area }) => {
    const { dias, origens } = bruto.etapas[id];
    const total = somar(origens);
    const queda = anterior === null ? null : percentual(anterior - total, anterior);
    anterior = total;
    return {
      id,
      etapa: nome,
      area,
      total,
      series: series(ORIGENS, origens),
      queda,
      tempoMedioDias: dias,
    };
  });
  const total = (id: IdEtapa) => etapas.find((etapa) => etapa.id === id)?.total ?? 0;
  return {
    etapas,
    conversaoTotal: percentual(total('ganhos'), total('leads')),
    cicloMedioDias: bruto.etapas.qualificados.dias + bruto.etapas.oportunidades.dias,
    receitaGanha: bruto.receitaGanha,
  };
}

function montarAtendimento(bruto: PeriodoBruto): DadosAtendimento {
  const { canais, ...metricas } = bruto.atendimento;
  const lista = Object.entries(canais)
    .map<CanalAtendimento>(([canal, valores]) => ({
      canal,
      total: somar(valores),
      series: series(SERIES_ATENDIMENTO, valores),
      emAndamento: valores[2],
    }))
    .sort((a, b) => b.total - a.total);
  return {
    ...metricas,
    conversasAbertas: somar(lista.map((canal) => canal.emAndamento)),
    canais: lista,
  };
}

function montarEquipe(bruto: PeriodoBruto): DadosEquipe {
  const pessoas = VENDEDORES.map(({ nome, papel }) => {
    const [ganhos, atividades, meta] = bruto.vendas[nome];
    return {
      nome,
      papel,
      ganhos,
      atividades,
      meta,
      percentualMeta: Math.round((ganhos / meta) * 100),
    };
  })
    .sort((a, b) => b.ganhos - a.ganhos || b.percentualMeta - a.percentualMeta)
    .map<PessoaRanking>((pessoa, indice) => ({
      ...pessoa,
      posicao: indice + 1,
      rotuloPapel: ROTULO_PAPEL[pessoa.papel],
    }));
  return { pessoas, ganhos: somar(pessoas.map((pessoa) => pessoa.ganhos)) };
}

function montarPeriodo(periodo: Periodo): DadosPeriodo {
  const bruto = BRUTOS[periodo.id];
  const jornada = montarJornada(bruto);
  const total = (id: IdEtapa) => jornada.etapas.find((etapa) => etapa.id === id)?.total ?? 0;
  return {
    periodo,
    jornada,
    atendimento: montarAtendimento(bruto),
    equipe: montarEquipe(bruto),
    indicadores: {
      leads: { valor: total('leads'), variacao: bruto.variacoes.leads },
      taxaGanho: {
        valor: percentual(total('ganhos'), total('oportunidades')),
        variacao: bruto.variacoes.taxaGanho,
      },
      mrr: { valor: MRR_ATUAL, variacao: bruto.variacoes.mrr },
      healthScore: { valor: HEALTH_SCORE_ATUAL, variacao: bruto.variacoes.healthScore },
    },
  };
}

/** Todos os dados do painel, por período. */
export const DADOS_POR_PERIODO: Readonly<Record<IdPeriodo, DadosPeriodo>> = {
  '7d': montarPeriodo(PERIODOS[0]),
  '30d': montarPeriodo(PERIODOS[1]),
  trimestre: montarPeriodo(PERIODOS[2]),
};

// ---------------------------------------------------------------------------------------
// Equipe (aba de exemplo)
// ---------------------------------------------------------------------------------------

/** O desligamento do exemplo (regra: as atividades de quem sai vão para o líder). */
export const DESLIGAMENTO = {
  pessoa: 'Pedro Martins',
  atividades: 12,
  destino: 'Carla Nogueira',
  papelDestino: ROTULO_PAPEL.LIDER_COMERCIAL,
} as const;

// ---------------------------------------------------------------------------------------
// Análise com IA (simulada)
// ---------------------------------------------------------------------------------------

/** Módulos onde as ações sugeridas pela IA vão ser feitas (ids de `nucleo/navegacao.ts`). */
export type ModuloSugestao = 'automacoes' | 'disparos' | 'atendimento';

export interface SugestaoIa {
  readonly id: string;
  readonly titulo: string;
  /** A métrica observada no painel, com os números do período. */
  readonly metrica: string;
  readonly hipotese: string;
  readonly acao: string;
  /** Onde a ação vai ser feita: a sugestão leva até o módulo. */
  readonly modulo: ModuloSugestao;
}

/**
 * As três sugestões da análise simulada, montadas com os números do período (o texto
 * acompanha o seletor): o maior gargalo do funil, a origem que mais converte e o canal de
 * atendimento sem chatbot.
 */
export function gerarSugestoes(dados: DadosPeriodo, locale: string): readonly SugestaoIa[] {
  const numero = (valor: number) => formatNumber(valor, locale, '1.0-1');
  const { etapas } = dados.jornada;

  // 1. Maior queda entre etapas, sem contar a passagem para o CS (que é automática).
  const comQueda = etapas.filter((etapa) => etapa.queda !== null && etapa.area !== 'cs');
  const gargalo = comQueda.reduce((maior, etapa) =>
    (etapa.queda ?? 0) > (maior.queda ?? 0) ? etapa : maior,
  );
  const antes = etapas[etapas.indexOf(gargalo) - 1];

  // 2. Origem com a maior conversão de lead em negócio ganho.
  const leads = etapas[0].series;
  const ganhos = etapas.find((etapa) => etapa.id === 'ganhos')?.series ?? [];
  const conversoes = leads.map((serie, i) => ({
    rotulo: serie.rotulo,
    leads: serie.valor,
    ganhos: ganhos[i]?.valor ?? 0,
    taxa: percentual(ganhos[i]?.valor ?? 0, serie.valor),
  }));
  const melhor = conversoes.reduce((a, b) => (b.taxa > a.taxa ? b : a));
  const pior = conversoes.reduce((a, b) => (b.taxa < a.taxa ? b : a));

  // 3. Canal sem chatbot (a 1ª série zerada).
  const { atendimento } = dados;
  const semChatbot =
    atendimento.canais.find((canal) => canal.series[0]?.valor === 0) ?? atendimento.canais[0];

  return [
    {
      id: 'gargalo',
      titulo: 'Destravar a negociação',
      metrica: `Queda de ${numero(gargalo.queda ?? 0)}% entre ${antes.etapa} e ${gargalo.etapa} (${numero(antes.total)} → ${numero(gargalo.total)}).`,
      hipotese:
        'Propostas ficam paradas na etapa Negociação além do prazo-alvo de 10 dias, sem um próximo passo combinado.',
      acao: 'Criar uma automação que avisa o responsável e o líder quando o negócio passa do prazo-alvo e abre uma tarefa de follow-up.',
      modulo: 'automacoes',
    },
    {
      id: 'origem',
      titulo: 'Investir em indicações',
      metrica: `Leads de ${melhor.rotulo} viram negócio ganho em ${numero(melhor.taxa)}% dos casos (${numero(melhor.ganhos)} de ${numero(melhor.leads)}); os de ${pior.rotulo}, em ${numero(pior.taxa)}%.`,
      hipotese: 'Quem chega indicado já confia na marca e decide mais rápido.',
      acao: 'Lançar uma campanha de indicação para clientes com health score acima de 80, com convite por disparo no WhatsApp.',
      modulo: 'disparos',
    },
    {
      id: 'atendimento',
      titulo: 'Levar o chatbot ao e-mail',
      metrica: `${semChatbot.canal} é o único canal sem chatbot: ${numero(semChatbot.series[1]?.valor ?? 0)} conversas resolvidas só pela equipe.`,
      hipotese: `Perguntas repetidas (2ª via, acesso, prazos) ocupam a equipe e puxam a 1ª resposta para ${numero(atendimento.primeiraRespostaMin)} min em média.`,
      acao: 'Ativar a triagem do chatbot e as respostas rápidas também no e-mail, com transferência para a equipe quando não resolver.',
      modulo: 'atendimento',
    },
  ];
}
