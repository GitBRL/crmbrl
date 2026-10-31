import type {
  Cartao,
  ColunaBi,
  IdPainel,
  LinhaBi,
  RespostaPainel,
  TabelaBi,
  TipoColuna,
  UnidadeCartao,
} from './bi.tipos';

/** Fixtures dos specs do BI e da Visão geral (respostas no formato de `GET /bi/:painel`). */

export function cartao(
  chave: string,
  rotulo: string,
  valor: number | null,
  opcoes: Partial<Cartao> & { readonly unidade?: UnidadeCartao } = {},
): Cartao {
  return {
    chave,
    rotulo,
    valor,
    anterior: null,
    variacao: null,
    unidade: 'numero',
    melhorQuando: 'maior',
    dica: `Dica de ${rotulo}.`,
    ...opcoes,
  };
}

export function tabela(
  chave: string,
  titulo: string,
  colunas: readonly [string, TipoColuna][],
  linhas: readonly LinhaBi[],
): TabelaBi {
  const lista: readonly ColunaBi[] = colunas.map(([c, tipo]) => ({
    chave: c,
    rotulo: c.charAt(0).toUpperCase() + c.slice(1),
    tipo,
    visivel: tipo !== 'id',
  }));
  return { chave, titulo, dica: `Dica da tabela ${titulo}.`, colunas: lista, linhas };
}

export function resposta(
  painel: IdPainel,
  cartoes: readonly Cartao[],
  tabelas: readonly TabelaBi[],
  extra: Partial<RespostaPainel> = {},
): RespostaPainel {
  return {
    painel,
    periodo: { de: '2026-10-01T03:00:00.000Z', ate: '2026-11-01T03:00:00.000Z' },
    anterior: { de: '2026-09-01T03:00:00.000Z', ate: '2026-10-01T03:00:00.000Z' },
    geradoEm: '2026-10-31T15:30:00.000Z',
    filtros: {
      area: null,
      equipeId: null,
      pessoaId: null,
      funilId: null,
      canalId: null,
      filaId: null,
      comparar: true,
    },
    cartoes,
    tabelas: Object.fromEntries(tabelas.map((t) => [t.chave, t])),
    meta: {},
    ...extra,
  };
}

const COLUNAS_ATENDIMENTO: readonly [string, TipoColuna][] = [
  ['id', 'id'],
  ['nome', 'texto'],
  ['conversas', 'numero'],
  ['resolvidas', 'numero'],
];

export const PAINEIS_DE_TESTE: Readonly<Record<IdPainel, RespostaPainel>> = {
  marketing: resposta(
    'marketing',
    [cartao('leads', 'Leads', 76, { anterior: 36, variacao: 111.11 })],
    [
      tabela(
        'leadsPorOrigem',
        'Leads por origem',
        [
          ['origem', 'texto'],
          ['leads', 'numero'],
        ],
        [
          { origem: 'SITE', leads: 36 },
          { origem: 'WEBHOOK', leads: 20 },
        ],
      ),
    ],
  ),
  comercial: resposta(
    'comercial',
    [
      cartao('novos', 'Negócios novos', 51, { anterior: 25, variacao: 104 }),
      cartao('cicloMedio', 'Ciclo médio', 29.59, {
        unidade: 'dias',
        melhorQuando: 'menor',
        anterior: 34.79,
        variacao: -14.95,
      }),
      cartao('abertos', 'Negócios abertos', 70, { melhorQuando: null }),
    ],
    [
      tabela(
        'ranking',
        'Ranking',
        [
          ['usuarioId', 'id'],
          ['nome', 'texto'],
          ['ganhos', 'numero'],
          ['valorGanho', 'moeda'],
          ['atividadesFeitas', 'numero'],
          ['taxaGanho', 'percentual'],
        ],
        [
          {
            usuarioId: 'u1',
            nome: 'Lucas Pereira',
            ganhos: 7,
            valorGanho: 143964.75,
            atividadesFeitas: 57,
            taxaGanho: 33.33,
          },
          {
            usuarioId: 'u2',
            nome: 'Marina Costa',
            ganhos: 4,
            valorGanho: 60500,
            atividadesFeitas: 30,
            taxaGanho: 57.14,
          },
        ],
      ),
      tabela(
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
      ),
    ],
  ),
  cs: resposta(
    'cs',
    [
      cartao('renovados', 'Renovados', 6, { anterior: 5, variacao: 20 }),
      cartao('riscoAlto', 'Risco alto', 5, { melhorQuando: 'menor' }),
    ],
    [],
  ),
  atendimento: resposta(
    'atendimento',
    [
      cartao('conversas', 'Conversas', 96, { anterior: 80, variacao: 20, melhorQuando: null }),
      cartao('primeiraRespostaMediana', 'Primeira resposta (mediana)', 300, {
        unidade: 'segundos',
        melhorQuando: 'menor',
        anterior: 330,
        variacao: -9.09,
      }),
      cartao('slaPrimeiraResposta', 'SLA da primeira resposta', 72.5, {
        unidade: 'percentual',
        anterior: 70,
        variacao: 3.57,
      }),
      cartao('csat', 'Satisfação (CSAT)', 3.65, { unidade: 'nota', anterior: 3.5, variacao: 4.3 }),
      cartao('emAberto', 'Conversas em aberto', 18, { melhorQuando: null }),
    ],
    [
      tabela('porCanal', 'Conversas por canal', COLUNAS_ATENDIMENTO, [
        { id: 'c1', nome: 'WhatsApp Vendas', conversas: 57, resolvidas: 51 },
        { id: 'c2', nome: 'Chat do site', conversas: 20, resolvidas: 18 },
        { id: 'c3', nome: 'Instagram', conversas: 0, resolvidas: 0 },
      ]),
    ],
  ),
  financeiro: resposta(
    'financeiro',
    [
      cartao('mrrAtual', 'MRR atual', 119500, { unidade: 'moeda', melhorQuando: null }),
      cartao('mrrNovo', 'MRR novo', 16600, {
        unidade: 'moeda',
        anterior: 8200,
        variacao: 102.4,
      }),
    ],
    [
      tabela(
        'mrrPorMes',
        'MRR por mês',
        [
          ['mes', 'texto'],
          ['novo', 'moeda'],
          ['expansao', 'moeda'],
          ['contracao', 'moeda'],
          ['churn', 'moeda'],
          ['mrr', 'moeda'],
        ],
        [
          { mes: '2026-09', novo: 8200, expansao: 0, contracao: 0, churn: 900, mrr: 100000 },
          { mes: '2026-10', novo: 16600, expansao: 500, contracao: 0, churn: 1700, mrr: 119500 },
        ],
      ),
    ],
  ),
};
