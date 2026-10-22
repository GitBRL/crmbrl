import type { Pagina } from '../../nucleo/api/api';
import type {
  Entrega,
  EntregaDetalhe,
  EventoDisponivel,
  FunilDoDestino,
  ModelosDeMapeamento,
  Recebimento,
  RecebimentoDetalhe,
  ResultadoDaPrevia,
  UsuarioDoDestino,
  WebhookEntrada,
  WebhookSaida,
} from './tipos';

/** Dados de exemplo das specs de Integrações (formato do OpenAPI da API). */

export function pagina<T>(itens: readonly T[], porPagina = 20): Pagina<T> {
  return { itens, total: itens.length, pagina: 1, porPagina };
}

export function webhookEntrada(ajustes: Partial<WebhookEntrada> = {}): WebhookEntrada {
  return {
    id: 'we1',
    nome: 'Disparos BRL — WhatsApp',
    tokenPrefixo: 'yxBjWicA',
    enderecoMascarado: 'http://localhost:4200/api/v1/webhooks/entrada/yxBjWicA…',
    funil: { id: 'f-mkt', nome: 'Marketing', area: 'MARKETING' },
    etapa: { id: 'e-novo', nome: 'Novo lead', tipo: 'ABERTA' },
    estrategia: 'RODIZIO',
    responsavelFixo: null,
    modeloMapeamento: 'DISPAROS_BRL',
    mapeamento: {
      campos: [
        { caminho: 'name', destino: 'nome' },
        { caminho: 'email', destino: 'email' },
        { caminho: 'faturamento', destino: 'camposPersonalizados.faturamento' },
      ],
      ignorarQuando: [{ caminho: 'teste', valor: true }],
    },
    etiquetasFixas: ['Disparos BRL'],
    exigeAssinatura: false,
    segredoMascarado: null,
    ativo: true,
    ultimoRecebimentoEm: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    recebimentos24h: { total: 8, erros: 1 },
    criadoPor: { id: 'u-admin', nome: 'Administrador' },
    criadoEm: '2026-10-21T21:10:51.380Z',
    atualizadoEm: '2026-10-21T21:10:51.380Z',
    ...ajustes,
  };
}

export const FUNIS: readonly FunilDoDestino[] = [
  {
    id: 'f-mkt',
    nome: 'Marketing',
    area: 'MARKETING',
    ativo: true,
    etapas: [
      { id: 'e-novo', nome: 'Novo lead', tipo: 'ABERTA', ordem: 1 },
      { id: 'e-contato', nome: 'Em contato', tipo: 'ABERTA', ordem: 2 },
      { id: 'e-mql', nome: 'Qualificado (MQL)', tipo: 'GANHO', ordem: 3 },
      { id: 'e-desc', nome: 'Descartado', tipo: 'PERDIDO', ordem: 4 },
    ],
  },
  {
    id: 'f-com',
    nome: 'Comercial',
    area: 'COMERCIAL',
    ativo: true,
    etapas: [
      { id: 'c-novo', nome: 'Novo', tipo: 'ABERTA', ordem: 1 },
      { id: 'c-ganho', nome: 'Ganho', tipo: 'GANHO', ordem: 2 },
      { id: 'c-perdido', nome: 'Perdido', tipo: 'PERDIDO', ordem: 3 },
    ],
  },
];

export const USUARIOS: readonly UsuarioDoDestino[] = [
  {
    id: 'u-admin',
    nome: 'Administrador',
    papel: 'ADMIN',
    rotuloPapel: 'Admin',
    area: null,
    ativo: true,
  },
  {
    id: 'u-camila',
    nome: 'Camila Rocha',
    papel: 'LIDER_MARKETING',
    rotuloPapel: 'Líder Marketing',
    area: 'MARKETING',
    ativo: true,
  },
  {
    id: 'u-lucas',
    nome: 'Lucas Pereira',
    papel: 'COMERCIAL',
    rotuloPapel: 'Comercial',
    area: 'COMERCIAL',
    ativo: true,
  },
];

export const MODELOS: ModelosDeMapeamento = {
  modelos: [
    {
      modelo: 'GENERICO',
      nome: 'Genérico',
      descricao: 'Campos `name`, `email` e `phone`.',
      mapeamento: {
        campos: [
          { caminho: 'name', destino: 'nome' },
          { caminho: 'email', destino: 'email' },
          { caminho: 'phone', destino: 'telefone' },
        ],
        ignorarQuando: [],
      },
      exemplo: { name: 'Maria Souza', email: 'maria@empresa.com.br' },
    },
    {
      modelo: 'DISPAROS_BRL',
      nome: 'Disparos BRL',
      descricao: 'O formato do sistema de disparos.',
      mapeamento: {
        campos: [
          { caminho: 'name', destino: 'nome' },
          { caminho: 'whatsapp', destino: 'telefone' },
        ],
        ignorarQuando: [{ caminho: 'teste', valor: true }],
      },
      exemplo: { name: 'Lead de Teste', whatsapp: '5511999998888' },
    },
  ],
  destinos: [
    { destino: 'nome', descricao: 'Nome do contato.' },
    { destino: 'email', descricao: 'E-mail do contato.' },
    { destino: 'telefone', descricao: 'Telefone do contato.' },
  ],
};

export const PREVIA_VALIDA: ResultadoDaPrevia = {
  valido: true,
  ignorado: null,
  problemas: [],
  avisos: [],
  contato: {
    nome: 'Maria Souza',
    email: 'maria@empresa.com.br',
    telefone: '5511987654321',
    empresa: null,
    cargo: null,
    etiquetas: [],
    camposPersonalizados: { faturamento: 'Acima de R$ 80 mil' },
  },
  negocio: { titulo: null, valor: null, valorRecorrente: null },
  utm: { campaign: 'black-friday' },
  encontrados: [{ caminho: 'name', destino: 'nome' }],
};

export function recebimento(ajustes: Partial<Recebimento> = {}): Recebimento {
  return {
    id: 'r1',
    webhookId: 'we1',
    recebidoEm: new Date(Date.now() - 5 * 60_000).toISOString(),
    ip: '::ffff:172.21.0.1',
    tipoConteudo: 'application/json',
    status: 'ERRO',
    mensagem: 'Sem e-mail nem telefone (R4.1).',
    tentativas: 1,
    processadoEm: new Date(Date.now() - 4 * 60_000).toISOString(),
    contato: null,
    negocio: null,
    recusadoNaRecepcao: false,
    podeReprocessar: true,
    ...ajustes,
  };
}

export function recebimentoDetalhe(ajustes: Partial<RecebimentoDetalhe> = {}): RecebimentoDetalhe {
  return {
    ...recebimento(),
    cabecalhos: { 'content-type': 'application/json' },
    corpo: { name: 'Lead sem contato', campanha: 'Black Friday' },
    ...ajustes,
  };
}

export function webhookSaida(ajustes: Partial<WebhookSaida> = {}): WebhookSaida {
  return {
    id: 'ws1',
    nome: 'Receptor de testes (dev)',
    url: 'http://apoio:8090/webhooks/brl-crm',
    eventos: ['contato.criado', 'negocio.ganho'],
    cabecalhos: [{ nome: 'Authorization', valorMascarado: '••••••••acao' }],
    segredoMascarado: '••••••••My-w',
    ativo: true,
    falhasConsecutivas: 0,
    desativadoAutomaticamenteEm: null,
    entregas: { pendentes: 0, falhas: 0 },
    criadoPor: { id: 'u-admin', nome: 'Administrador' },
    criadoEm: '2026-10-21T21:10:49.497Z',
    atualizadoEm: '2026-10-21T21:10:49.497Z',
    ...ajustes,
  };
}

export const EVENTOS: readonly EventoDisponivel[] = [
  { evento: 'contato.criado', descricao: 'Contato criado.' },
  { evento: 'negocio.ganho', descricao: 'Negócio ganho.' },
  { evento: 'negocio.perdido', descricao: 'Negócio perdido, com o motivo.' },
  { evento: 'webhook.teste', descricao: 'Evento de teste.' },
];

export function entrega(ajustes: Partial<Entrega> = {}): Entrega {
  return {
    id: 'en1',
    webhookId: 'ws1',
    eventoId: 'ev1',
    evento: 'negocio.perdido',
    status: 'PENDENTE',
    tentativas: 4,
    ultimaTentativaEm: new Date(Date.now() - 60_000).toISOString(),
    proximaTentativaEm: new Date(Date.now() + 3_600_000).toISOString(),
    statusHttp: 500,
    duracaoMs: 2,
    trechoResposta: '{"ok":false}',
    erro: 'HTTP 500 Internal Server Error',
    entregueEm: null,
    criadoEm: new Date(Date.now() - 30 * 60_000).toISOString(),
    atualizadoEm: new Date(Date.now() - 60_000).toISOString(),
    ...ajustes,
  };
}

export function entregaDetalhe(ajustes: Partial<EntregaDetalhe> = {}): EntregaDetalhe {
  return {
    ...entrega(),
    payload: {
      id: 'ev1',
      evento: 'negocio.perdido',
      ocorridoEm: '2026-10-21T21:11:53Z',
      dados: {},
    },
    historicoTentativas: [
      {
        numero: 1,
        sucesso: false,
        statusHttp: 500,
        duracaoMs: 2,
        trechoResposta: '{"ok":false}',
        erro: 'HTTP 500 Internal Server Error',
        criadoEm: '2026-10-21T21:11:54Z',
      },
    ],
    ...ajustes,
  };
}

/** Deixa as promessas pendentes andarem (respostas do HttpTestingController). */
export async function microtarefas(vezes = 8): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await Promise.resolve();
  }
}
