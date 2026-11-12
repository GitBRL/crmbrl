import type {
  Catalogo,
  PainelDeIndicadores,
  ResultadoDoWidget,
  RespostaDeCalculo,
  Widget,
} from './indicadores.tipos';

/** Fixtures dos specs dos indicadores (respostas no formato de `/indicadores/*`). */

export const CATALOGO_DE_TESTE: Catalogo = {
  grupos: [
    { chave: 'LEADS', rotulo: 'Leads' },
    { chave: 'REUNIOES', rotulo: 'Reuniões' },
    { chave: 'VENDAS', rotulo: 'Vendas' },
  ],
  indicadores: [
    {
      chave: 'leads_recebidos',
      nome: 'Leads recebidos',
      descricao: 'Negócios criados no período.',
      grupo: 'LEADS',
      unidade: 'NUMERO',
      melhorQuando: 'maior',
      agora: false,
      parametros: [
        {
          chave: 'agrupamento',
          rotulo: 'Agrupar a série por',
          tipo: 'AGRUPAMENTO',
          obrigatorioEm: null,
          vale: ['SERIE'],
          opcoes: [
            { valor: 'DIA', rotulo: 'Dia' },
            { valor: 'MES', rotulo: 'Mês' },
          ],
          padrao: 'DIA',
          dica: 'Dia ou mês.',
        },
      ],
      visualizacoes: ['NUMERO', 'SERIE', 'RANKING'],
      barras: [],
    },
    {
      chave: 'taxa_no_show',
      nome: 'Taxa de no-show',
      descricao: 'Não compareceu ÷ (compareceu + não compareceu).',
      grupo: 'REUNIOES',
      unidade: 'PERCENTUAL',
      melhorQuando: 'menor',
      agora: false,
      parametros: [],
      visualizacoes: ['NUMERO', 'SERIE'],
      barras: [],
    },
    {
      chave: 'conversao_entre_etapas',
      nome: 'Conversão entre etapas',
      descricao: 'Dos que entraram na origem, quantos chegaram ao destino.',
      grupo: 'VENDAS',
      unidade: 'PERCENTUAL',
      melhorQuando: 'maior',
      agora: false,
      parametros: [
        {
          chave: 'etapaOrigemId',
          rotulo: 'Etapa de origem',
          tipo: 'ETAPA',
          obrigatorioEm: ['NUMERO'],
          vale: ['NUMERO'],
          dica: 'A etapa em que o negócio entrou.',
        },
        {
          chave: 'etapaDestinoId',
          rotulo: 'Etapa de destino',
          tipo: 'ETAPA',
          obrigatorioEm: ['NUMERO'],
          vale: ['NUMERO'],
          dica: 'A etapa que ele alcançou.',
        },
      ],
      visualizacoes: ['NUMERO', 'FUNIL'],
      barras: [],
    },
  ],
  modelos: [
    {
      chave: 'time_comercial',
      nome: 'Time comercial',
      descricao: 'Leads, reuniões, conversão e ligações.',
      quantidadeDeWidgets: 18,
    },
  ],
};

export function widget(parcial: Partial<Widget> = {}): Widget {
  return {
    id: 'w1',
    indicador: 'leads_recebidos',
    parametros: {},
    visualizacao: 'NUMERO',
    largura: 1,
    ordem: 0,
    ...parcial,
  };
}

export function painel(parcial: Partial<PainelDeIndicadores> = {}): PainelDeIndicadores {
  return {
    id: 'p1',
    nome: 'Time comercial',
    descricao: 'Leads e reuniões.',
    dono: { id: 'u9', nome: 'Rafael Mendes' },
    minha: true,
    podeEditar: true,
    modelo: 'time_comercial',
    filtrosPadrao: {},
    widgets: [
      widget({ id: 'w1' }),
      widget({ id: 'w2', indicador: 'taxa_no_show', ordem: 1, titulo: 'No-show' }),
    ],
    quantidadeDeWidgets: 2,
    compartilhamento: { setores: [], pessoas: [], papeis: [] },
    criadoEm: '2026-11-10T12:00:00.000Z',
    atualizadoEm: '2026-11-10T12:00:00.000Z',
    ...parcial,
  };
}

export function resultadoNumero(parcial: Partial<ResultadoDoWidget> = {}): ResultadoDoWidget {
  return {
    id: 'w1',
    indicador: 'leads_recebidos',
    nome: 'Leads recebidos',
    visualizacao: 'NUMERO',
    titulo: 'Leads recebidos',
    unidade: 'NUMERO',
    melhorQuando: 'maior',
    largura: 1,
    ordem: 0,
    periodo: { de: '2026-11-01T03:00:00.000Z', ate: '2026-11-12T03:00:00.000Z' },
    anterior: { de: '2026-10-21T03:00:00.000Z', ate: '2026-11-01T03:00:00.000Z' },
    ok: true,
    valor: 42,
    valorAnterior: 30,
    variacao: 40,
    meta: null,
    clique: null,
    ...parcial,
  };
}

export function calculo(widgets: readonly ResultadoDoWidget[]): RespostaDeCalculo {
  return {
    painelId: 'p1',
    geradoEm: '2026-11-12T15:30:00.000Z',
    periodo: { de: '2026-11-01T03:00:00.000Z', ate: '2026-11-12T03:00:00.000Z' },
    anterior: { de: '2026-10-21T03:00:00.000Z', ate: '2026-11-01T03:00:00.000Z' },
    filtros: {},
    widgets,
  };
}
