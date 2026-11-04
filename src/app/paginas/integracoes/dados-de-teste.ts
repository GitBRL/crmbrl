import type { Pagina } from '../../nucleo/api/api';
import type { EventosDoAplicativo } from './eventos.tipos';
import type { ConexaoFacebook } from './facebook.tipos';
import type {
  AplicativoDoCatalogo,
  CatalogoDeAplicativos,
  Entrega,
  EntregaDetalhe,
  EventoDisponivel,
  FormatoClint,
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
    aplicativo: 'WEBHOOK',
    aplicativoNome: 'Webhook',
    alvo: 'NEGOCIO',
    modo: 'CRIAR_OU_ATUALIZAR',
    statusInicial: 'ABERTO',
    motivoPerdaPadrao: null,
    credencial: { configurada: false, campos: [] },
    configuracao: {},
    camposBuscados: null,
    camposBuscadosEm: null,
    situacao: 'ATIVA',
    precisaAtencao: false,
    atencaoMotivo: null,
    atencaoEm: null,
    enderecoDisponivel: true,
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
    aplicativo: 'ELEMENTOR',
    aplicativoNome: 'Elementor',
    integracao: { id: 'we1', nome: 'H1 Elementor' },
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

// --- Aplicativos (Onda H) ----------------------------------------------------------------------

const AUTENTICIDADE_NENHUMA = {
  tipo: 'NENHUMA',
  descricao:
    'O aplicativo não assina o envio: a única proteção é o endereço secreto da integração.',
  segredo: 'NAO_USA',
  rotuloDoSegredo: null,
  cabecalho: null,
} as const;

export const APLICATIVO_ELEMENTOR: AplicativoDoCatalogo = {
  aplicativo: 'ELEMENTOR',
  nome: 'Elementor',
  descricao: 'Receba os envios dos formulários do Elementor Pro pela ação Webhook.',
  disponivel: true,
  entrega: 'WEBHOOK',
  tiposDeConteudo: ['application/x-www-form-urlencoded', 'application/json'],
  autenticidade: AUTENTICIDADE_NENHUMA,
  credencial: null,
  buscaCampos: false,
  escolheFormulario: false,
  passoAPasso: {
    titulo: 'No Elementor',
    passos: ['Adicione a ação "Webhook" ao formulário.', 'Cole o endereço da integração.'],
  },
  modelo: {
    nome: 'Elementor',
    descricao: 'Campos com os IDs padrão do Elementor.',
    mapeamento: {
      campos: [
        { caminho: 'name', destino: 'nome' },
        { caminho: 'email', destino: 'email' },
        { caminho: 'phone', destino: 'telefone' },
      ],
      ignorarQuando: [],
    },
    exemplo: { name: 'Maria Souza', email: 'maria@empresa.com.br', phone: '11988887777' },
  },
  dicas: [],
};

export const APLICATIVO_TYPEFORM: AplicativoDoCatalogo = {
  aplicativo: 'TYPEFORM',
  nome: 'Typeform',
  descricao: 'Receba as respostas do Typeform; o CRM registra o webhook no formulário.',
  disponivel: true,
  entrega: 'WEBHOOK',
  tiposDeConteudo: ['application/json'],
  autenticidade: {
    tipo: 'HMAC_SHA256',
    descricao: 'O CRM gera o segredo e confere a assinatura Typeform-Signature.',
    segredo: 'GERADO_PELO_CRM',
    rotuloDoSegredo: null,
    cabecalho: 'Typeform-Signature',
  },
  credencial: [
    {
      chave: 'token',
      rotulo: 'Personal token',
      secreto: true,
      obrigatorio: true,
      descricao: 'Token pessoal do Typeform.',
    },
  ],
  buscaCampos: true,
  escolheFormulario: true,
  passoAPasso: { titulo: 'No Typeform', passos: ['Crie um token pessoal.'] },
  modelo: {
    nome: 'Typeform',
    descricao: 'Usa o ref de cada pergunta.',
    mapeamento: { campos: [{ caminho: 'email', destino: 'email' }], ignorarQuando: [] },
    exemplo: { email: 'a@b.com' },
  },
  dicas: [],
};

export const APLICATIVO_WEBHOOK: AplicativoDoCatalogo = {
  ...APLICATIVO_ELEMENTOR,
  aplicativo: 'WEBHOOK',
  nome: 'Webhook',
  descricao: 'Receba dados de qualquer sistema que chame uma URL.',
  autenticidade: {
    tipo: 'HMAC_SHA256',
    descricao: 'Opcional: X-Assinatura com o HMAC-SHA256 do corpo.',
    segredo: 'OPCIONAL',
    rotuloDoSegredo: 'Segredo',
    cabecalho: 'X-Assinatura',
  },
  modelo: null,
};

export const APLICATIVO_HOTMART: AplicativoDoCatalogo = {
  ...APLICATIVO_ELEMENTOR,
  aplicativo: 'HOTMART',
  nome: 'Hotmart',
  descricao: 'Compras da Hotmart.',
  disponivel: false,
  passoAPasso: { titulo: '', passos: [] },
  modelo: null,
};

export const CATALOGO: CatalogoDeAplicativos = {
  aplicativos: [APLICATIVO_ELEMENTOR, APLICATIVO_HOTMART, APLICATIVO_TYPEFORM, APLICATIVO_WEBHOOK],
  destinos: [
    { destino: 'nome', descricao: 'Nome do contato.' },
    { destino: 'email', descricao: 'E-mail do contato.' },
    { destino: 'telefone', descricao: 'Telefone do contato.' },
    { destino: 'cargo', descricao: 'Cargo do contato.' },
    { destino: 'etapa', descricao: 'Etapa do negócio.' },
    { destino: 'camposPersonalizados.<chave>', descricao: 'Campo personalizado do contato.' },
    {
      destino: 'negocio.camposPersonalizados.<chave>',
      descricao: 'Campo personalizado do negócio.',
    },
  ],
};

export function integracaoElementor(ajustes: Partial<WebhookEntrada> = {}): WebhookEntrada {
  return webhookEntrada({
    id: 'we-el',
    nome: 'H1 Elementor',
    aplicativo: 'ELEMENTOR',
    aplicativoNome: 'Elementor',
    modeloMapeamento: 'DO_APLICATIVO',
    mapeamento: APLICATIVO_ELEMENTOR.modelo!.mapeamento,
    etiquetasFixas: [],
    ...ajustes,
  });
}

export const FORMATO_CLINT: FormatoClint = {
  gatilhos: [
    {
      tipo: 'NEGOCIO_CRIADO',
      descricao: 'Quando um negócio é criado.',
      exigeEtapa: false,
      aceitaStatus: false,
    },
    {
      tipo: 'ENTRA_NA_ETAPA',
      descricao: 'Quando entra na etapa.',
      exigeEtapa: true,
      aceitaStatus: false,
    },
    {
      tipo: 'MUDA_DE_ETAPA',
      descricao: 'Quando muda de etapa.',
      exigeEtapa: false,
      aceitaStatus: false,
    },
    {
      tipo: 'MUDA_DE_STATUS',
      descricao: 'Quando muda de status.',
      exigeEtapa: false,
      aceitaStatus: true,
    },
  ],
  campos: [
    {
      origem: 'contato.nome',
      rotulo: 'Nome do contato',
      grupo: 'Contato',
      identificadorPadrao: 'nome',
    },
    {
      origem: 'contato.email',
      rotulo: 'E-mail do contato',
      grupo: 'Contato',
      identificadorPadrao: 'email',
    },
    {
      origem: 'contato.telefone',
      rotulo: 'Telefone do contato',
      grupo: 'Contato',
      identificadorPadrao: 'telefone',
    },
    {
      origem: 'negocio.valor',
      rotulo: 'Valor do negócio',
      grupo: 'Negócio',
      identificadorPadrao: 'valor',
    },
  ],
  metodos: ['POST', 'GET'],
};

// --- Facebook Lead Ads e plataformas de curso (H3) --------------------------------------------

export const APLICATIVO_FACEBOOK: AplicativoDoCatalogo = {
  ...APLICATIVO_ELEMENTOR,
  aplicativo: 'FACEBOOK_LEAD_ADS',
  nome: 'Facebook Lead Ads',
  descricao: 'Receba os leads dos formulários de cadastro do Facebook.',
  entrega: 'API',
  buscaCampos: true,
  escolheFormulario: true,
  passoAPasso: {
    titulo: 'No Facebook',
    passos: ['O app precisa de leads_retrieval aprovado.', 'Libere o CRM em Leads Access.'],
  },
};

export const EVENTOS_HOTMART: EventosDoAplicativo = {
  filtroPorProduto: true,
  eventos: [
    {
      codigo: 'PURCHASE_APPROVED',
      nome: 'Compra aprovada',
      descricao: 'O pagamento foi aprovado.',
      grupo: 'COMPRA',
      padrao: { acao: 'GANHO', etapaId: null, motivoPerda: null, etiquetas: [] },
    },
    {
      codigo: 'PURCHASE_BILLET_PRINTED',
      nome: 'Boleto gerado',
      descricao: 'O comprador gerou o boleto.',
      grupo: 'PAGAMENTO_PENDENTE',
      padrao: { acao: 'ABRIR', etapaId: null, motivoPerda: null, etiquetas: [] },
    },
    {
      codigo: 'PURCHASE_REFUNDED',
      nome: 'Compra reembolsada',
      descricao: 'A compra foi reembolsada.',
      grupo: 'POS_VENDA',
      padrao: {
        acao: 'PERDIDO',
        etapaId: null,
        motivoPerda: 'Reembolso',
        etiquetas: ['reembolso'],
      },
    },
  ],
  modelos: [
    {
      codigo: 'VENDAS',
      nome: 'Vendas completas',
      descricao: 'Compra, carrinho, boleto e reembolso.',
      regras: {
        PURCHASE_APPROVED: { acao: 'GANHO', etapaId: null, motivoPerda: null, etiquetas: [] },
        PURCHASE_BILLET_PRINTED: { acao: 'ABRIR', etapaId: null, motivoPerda: null, etiquetas: [] },
        PURCHASE_REFUNDED: {
          acao: 'PERDIDO',
          etapaId: null,
          motivoPerda: 'Reembolso',
          etiquetas: ['reembolso'],
        },
      },
    },
    {
      codigo: 'SO_COMPRAS',
      nome: 'Só compras aprovadas',
      descricao: 'Só a compra aprovada.',
      regras: {
        PURCHASE_APPROVED: { acao: 'GANHO', etapaId: null, motivoPerda: null, etiquetas: [] },
      },
    },
  ],
};

export const APLICATIVO_HOTMART_COM_EVENTOS: AplicativoDoCatalogo = {
  ...APLICATIVO_ELEMENTOR,
  aplicativo: 'HOTMART',
  nome: 'Hotmart',
  descricao: 'Compras da Hotmart.',
  autenticidade: {
    tipo: 'HOTMART_HOTTOK',
    descricao: 'A Hotmart envia o Hottok no cabeçalho X-HOTMART-HOTTOK.',
    segredo: 'OPCIONAL',
    rotuloDoSegredo: 'Hottok',
    cabecalho: 'X-HOTMART-HOTTOK',
  },
  passoAPasso: {
    titulo: 'Na Hotmart',
    passos: ['Abra Ferramentas > Webhook.', 'Cole o endereço da integração.'],
  },
  eventos: EVENTOS_HOTMART,
};

export const CONEXAO_FACEBOOK: ConexaoFacebook = {
  id: 'cx1',
  nome: 'H3 Facebook (OAuth)',
  tipo: 'USUARIO',
  appId: '900000000000001',
  appSecretMascarado: '••••1234',
  conectada: true,
  usuarioFacebook: { id: 'u1', nome: 'Victor' },
  expiraEm: '2027-01-03T12:00:00Z',
  conectadaEm: '2026-11-04T12:00:00Z',
  canalOrigemId: null,
  paginas: [
    { id: 'p1', nome: 'Escola Demo BRL', categoria: 'Educação' },
    { id: 'p2', nome: 'Clínica Demo BRL', categoria: 'Saúde' },
  ],
  integracoes: 1,
  webhook: {
    url: 'https://crm.exemplo.com.br/api/v1/publico/meta/webhook',
    tokenVerificacao: 'token-verificacao-cx1',
    campos: ['leadgen'],
  },
  precisaAtencao: false,
  atencaoMotivo: null,
  criadoEm: '2026-11-04T12:00:00Z',
};

export const CONEXAO_COM_ATENCAO: ConexaoFacebook = {
  ...CONEXAO_FACEBOOK,
  id: 'cx2',
  nome: 'H3 Facebook (token ruim)',
  tipo: 'PAGINA',
  precisaAtencao: true,
  atencaoMotivo: 'O Facebook recusou o token.',
};
