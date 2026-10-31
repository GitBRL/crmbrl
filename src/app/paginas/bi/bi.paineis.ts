import type { EspecieGrafico } from './bi.graficos';
import type { IdPainel } from './bi.tipos';

/** Para onde o clique numa barra ou linha da tabela leva. */
export type DestinoClique =
  /** Etapa de um funil: `/funis/<area>?etapaId=…`. */
  | { readonly tipo: 'etapa'; readonly coluna: string; readonly area: 'comercial' | 'cs' }
  /** Vira o filtro "Responsável" do próprio painel. */
  | { readonly tipo: 'pessoa'; readonly coluna: string }
  | { readonly tipo: 'canal'; readonly coluna: string }
  | { readonly tipo: 'fila'; readonly coluna: string }
  | { readonly tipo: 'negocio'; readonly coluna: string; readonly area: 'cs' }
  | { readonly tipo: 'contato'; readonly coluna: string }
  | { readonly tipo: 'campanha'; readonly coluna: string };

export interface BlocoBi {
  /** Identifica o bloco (uma mesma tabela pode virar dois gráficos). */
  readonly id: string;
  /** Chave da tabela na resposta da API. */
  readonly tabela: string;
  /** Título do cartão, quando diferente do da tabela. */
  readonly titulo?: string;
  readonly grafico?: EspecieGrafico;
  readonly clique?: DestinoClique;
  /** Ocupa a linha toda (séries longas no tempo e tabelas largas). */
  readonly inteiro?: boolean;
}

export interface EspecificacaoPainel {
  /** Chaves dos cartões "de agora" (sem comparação com o período anterior). */
  readonly agora: readonly string[];
  readonly blocos: readonly BlocoBi[];
}

export const PAINEIS_BI: Readonly<Record<IdPainel, EspecificacaoPainel>> = {
  marketing: {
    agora: [],
    blocos: [
      {
        id: 'leadsPorDia',
        tabela: 'leadsPorDia',
        inteiro: true,
        grafico: {
          categoria: 'dia',
          tipoValor: 'numero',
          series: [
            { chave: 'leads', nome: 'Leads', cor: 0, tipo: 'linha' },
            { chave: 'passagens', nome: 'Passagens', cor: 1, tipo: 'linha' },
          ],
        },
      },
      {
        id: 'leadsPorOrigem',
        tabela: 'leadsPorOrigem',
        grafico: {
          categoria: 'origem',
          tipoValor: 'numero',
          orientacao: 'barras',
          series: [{ chave: 'leads', nome: 'Leads', cor: 0 }],
        },
      },
      {
        id: 'campanhas',
        tabela: 'campanhas',
        inteiro: true,
        clique: { tipo: 'campanha', coluna: 'id' },
      },
      { id: 'leadsPorUtm', tabela: 'leadsPorUtm', inteiro: true },
    ],
  },
  comercial: {
    agora: ['abertos', 'valorAberto', 'valorPonderado', 'atividadesAtrasadas'],
    blocos: [
      {
        id: 'funil',
        tabela: 'funil',
        clique: { tipo: 'etapa', coluna: 'etapaId', area: 'comercial' },
        grafico: {
          categoria: 'etapa',
          tipoValor: 'numero',
          orientacao: 'barras',
          chaveId: 'etapaId',
          series: [{ chave: 'quantidade', nome: 'Negócios', cor: 0 }],
        },
      },
      {
        id: 'motivosDePerda',
        tabela: 'motivosDePerda',
        grafico: {
          categoria: 'motivo',
          tipoValor: 'numero',
          orientacao: 'barras',
          series: [{ chave: 'perdidos', nome: 'Perdidos', cor: 3 }],
        },
      },
      {
        id: 'evolucao',
        tabela: 'evolucao',
        inteiro: true,
        grafico: {
          categoria: 'dia',
          tipoValor: 'numero',
          series: [
            { chave: 'novos', nome: 'Novos', cor: 0, tipo: 'linha' },
            { chave: 'ganhos', nome: 'Ganhos', cor: 1, tipo: 'linha' },
            { chave: 'perdidos', nome: 'Perdidos', cor: 3, tipo: 'linha' },
          ],
        },
      },
      {
        id: 'ranking',
        tabela: 'ranking',
        inteiro: true,
        clique: { tipo: 'pessoa', coluna: 'usuarioId' },
      },
    ],
  },
  cs: {
    agora: [
      'carteira',
      'valorRecorrenteCarteira',
      'emOnboarding',
      'renovacoesProximas',
      'renovacoesVencidas',
      'riscoAlto',
      'riscoMedio',
    ],
    blocos: [
      {
        id: 'onboardingPorEtapa',
        tabela: 'onboardingPorEtapa',
        clique: { tipo: 'etapa', coluna: 'etapaId', area: 'cs' },
        grafico: {
          categoria: 'etapa',
          tipoValor: 'numero',
          orientacao: 'barras',
          chaveId: 'etapaId',
          series: [{ chave: 'quantidade', nome: 'Clientes', cor: 0 }],
        },
      },
      {
        id: 'renovacoes',
        tabela: 'renovacoes',
        grafico: {
          categoria: 'faixa',
          tipoValor: 'numero',
          series: [{ chave: 'quantidade', nome: 'Renovações', cor: 1 }],
        },
      },
      {
        id: 'carteiraPorResponsavel',
        tabela: 'carteiraPorResponsavel',
        clique: { tipo: 'pessoa', coluna: 'usuarioId' },
        grafico: {
          categoria: 'nome',
          tipoValor: 'numero',
          orientacao: 'barras',
          chaveId: 'usuarioId',
          series: [{ chave: 'clientes', nome: 'Clientes', cor: 0 }],
        },
      },
      {
        id: 'satisfacaoPorNota',
        tabela: 'satisfacaoPorNota',
        grafico: {
          categoria: 'nota',
          tipoValor: 'numero',
          series: [{ chave: 'respostas', nome: 'Respostas', cor: 2 }],
        },
      },
      {
        id: 'riscoDeChurn',
        tabela: 'riscoDeChurn',
        inteiro: true,
        clique: { tipo: 'contato', coluna: 'contatoId' },
      },
      {
        id: 'proximasRenovacoes',
        tabela: 'proximasRenovacoes',
        inteiro: true,
        clique: { tipo: 'negocio', coluna: 'negocioId', area: 'cs' },
      },
    ],
  },
  atendimento: {
    agora: ['emAberto', 'semResponsavel'],
    blocos: [
      {
        id: 'porDia',
        tabela: 'porDia',
        inteiro: true,
        grafico: {
          categoria: 'dia',
          tipoValor: 'numero',
          series: [
            { chave: 'conversas', nome: 'Conversas', cor: 0, tipo: 'linha' },
            { chave: 'resolvidas', nome: 'Resolvidas', cor: 1, tipo: 'linha' },
          ],
        },
      },
      {
        id: 'porHora',
        tabela: 'porHora',
        grafico: {
          categoria: 'hora',
          tipoValor: 'numero',
          series: [{ chave: 'conversas', nome: 'Conversas', cor: 0 }],
        },
      },
      {
        id: 'porCanal',
        tabela: 'porCanal',
        clique: { tipo: 'canal', coluna: 'id' },
        grafico: {
          categoria: 'nome',
          tipoValor: 'numero',
          orientacao: 'barras',
          chaveId: 'id',
          series: [{ chave: 'conversas', nome: 'Conversas', cor: 0 }],
        },
      },
      {
        id: 'porFila',
        tabela: 'porFila',
        clique: { tipo: 'fila', coluna: 'id' },
        grafico: {
          categoria: 'nome',
          tipoValor: 'numero',
          orientacao: 'barras',
          chaveId: 'id',
          series: [{ chave: 'conversas', nome: 'Conversas', cor: 1 }],
        },
      },
      {
        id: 'porAtendente',
        tabela: 'porAtendente',
        inteiro: true,
        clique: { tipo: 'pessoa', coluna: 'id' },
      },
    ],
  },
  financeiro: {
    agora: [
      'mrrAtual',
      'contratosAtivos',
      'valorInadimplente',
      'taxaInadimplencia',
      'clientesInadimplentes',
    ],
    blocos: [
      {
        id: 'mrrPorMes',
        tabela: 'mrrPorMes',
        titulo: 'Receita recorrente (MRR) por mês',
        inteiro: true,
        grafico: {
          categoria: 'mes',
          tipoValor: 'moeda',
          series: [{ chave: 'mrr', nome: 'MRR', cor: 0, tipo: 'linha' }],
        },
      },
      {
        id: 'movimentoMrr',
        tabela: 'mrrPorMes',
        titulo: 'O que mexeu no MRR',
        inteiro: true,
        grafico: {
          categoria: 'mes',
          tipoValor: 'moeda',
          series: [
            { chave: 'novo', nome: 'Novo', cor: 0, pilha: 'mrr' },
            { chave: 'expansao', nome: 'Expansão', cor: 1, pilha: 'mrr' },
            { chave: 'contracao', nome: 'Contração', cor: 2, pilha: 'mrr', negativa: true },
            { chave: 'churn', nome: 'Cancelamentos', cor: 3, pilha: 'mrr', negativa: true },
          ],
        },
      },
      {
        id: 'previstoRealizado',
        tabela: 'previstoRealizado',
        inteiro: true,
        grafico: {
          categoria: 'mes',
          tipoValor: 'moeda',
          series: [
            { chave: 'previsto', nome: 'Previsto', cor: 0 },
            { chave: 'realizado', nome: 'Realizado', cor: 1 },
          ],
        },
      },
      {
        id: 'inadimplenciaPorFaixa',
        tabela: 'inadimplenciaPorFaixa',
        inteiro: true,
        grafico: {
          categoria: 'faixa',
          tipoValor: 'moeda',
          series: [{ chave: 'valor', nome: 'Valor em atraso', cor: 3 }],
        },
      },
    ],
  },
};
