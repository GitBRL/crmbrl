import type {
  CanalEmail,
  CanalMeta,
  CanalOficial,
  CanalSite,
  EnviosNoDia,
  NumeroWhatsapp,
  TemplateDoCanal,
} from './canais.modelos';

/**
 * **Só para testes (specs) de Configurações → Canais.** Canais falsos no formato da API.
 */

export function numero(ajustes: Partial<NumeroWhatsapp> = {}): NumeroWhatsapp {
  return {
    id: 'n-1',
    canalId: 'c-wa-1',
    nome: 'Comercial — principal',
    ativo: true,
    filaPadrao: { id: 'f-com', nome: 'Comercial — WhatsApp', area: 'COMERCIAL' },
    status: 'CONECTADO',
    motivo: null,
    telefone: '5511988887777',
    limiteDiario: 1000,
    intervaloMinimoSegundos: 2,
    intervaloMaximoSegundos: 6,
    aquecimento: {
      ativo: true,
      dia: 3,
      dias: 14,
      inicioEm: '2026-10-24T12:00:00.000Z',
      terminaEm: '2026-11-07',
    },
    hoje: { dia: '2026-10-26', enviados: 42, falhas: 1, limite: 214 },
    protecoes: {
      digitando: true,
      digitandoMaximoSegundos: 4,
      verificarNumero: true,
      pausarAposFalhasSeguidas: 5,
      limitarRespostas: false,
    },
    pausa: null,
    conectadoEm: '2026-10-26T10:00:00.000Z',
    desconectadoEm: null,
    ultimoEventoEm: '2026-10-26T12:00:00.000Z',
    tentativasReconexao: 0,
    criadoEm: '2026-10-24T11:00:00.000Z',
    atualizadoEm: '2026-10-26T12:00:00.000Z',
    ...ajustes,
  };
}

export function envios(dias = 3): EnviosNoDia[] {
  return Array.from({ length: dias }, (_, i) => ({
    dia: `2026-10-${String(24 + i).padStart(2, '0')}`,
    enviados: 10 * (i + 1),
    falhas: i === 1 ? 1 : 0,
    limite: 71 * (i + 1),
  }));
}

const BASE = {
  ativo: true,
  filaPadrao: null,
  horarioAtendimento: null,
  mensagemForaHorario: null,
  pesquisaSatisfacao: false,
  mensagemSatisfacao: null,
  ultimoErro: null,
  ultimoErroEm: null,
  criadoEm: '2026-10-20T12:00:00.000Z',
  atualizadoEm: '2026-10-20T12:00:00.000Z',
} as const;

export function site(ajustes: Partial<CanalSite> = {}): CanalSite {
  return {
    ...BASE,
    id: 's-1',
    tipo: 'WEBCHAT',
    nome: 'Site institucional',
    idExterno: 'wc_abc123',
    chavePublica: 'wc_abc123',
    dominios: ['https://www.brl.com.br'],
    aparencia: {
      titulo: 'Fale com a gente',
      subtitulo: 'Respondemos em minutos.',
      saudacao: 'Olá! Como podemos ajudar?',
      corPrimaria: '#2563EB',
      corTextoPrimaria: '#FFFFFF',
      tema: 'automatico',
      posicao: 'direita',
    },
    contato: 'EMAIL_OU_TELEFONE',
    textoConsentimento:
      'Concordo que meus dados sejam usados para responder a este atendimento, conforme a política de privacidade.',
    urlPrivacidade: null,
    permitirAnexos: true,
    instalacao: {
      urlDoWidget: 'http://localhost:4200/api/v1/publico/webchat/widget.js',
      trecho:
        '<script src="http://localhost:4200/api/v1/publico/webchat/widget.js" data-chave="wc_abc123" async></script>',
    },
    ...ajustes,
  };
}

export function email(ajustes: Partial<CanalEmail> = {}): CanalEmail {
  return {
    ...BASE,
    id: 'e-1',
    tipo: 'EMAIL',
    nome: 'E-mail do atendimento',
    idExterno: 'atendimento@brl.com.br',
    endereco: 'atendimento@brl.com.br',
    nomeRemetente: 'Atendimento BRL',
    imap: {
      host: 'imap.gmail.com',
      porta: 993,
      tls: true,
      usuario: 'atendimento@brl.com.br',
      pasta: 'INBOX',
    },
    smtp: {
      host: 'smtp.gmail.com',
      porta: 465,
      seguranca: 'TLS',
      usuario: 'atendimento@brl.com.br',
    },
    ignorarCertificado: false,
    assinatura: null,
    senha: '••••••••3f9a',
    senhaSmtp: null,
    ultimaVarreduraEm: '2026-10-26T11:59:00.000Z',
    ...ajustes,
  };
}

export function meta(ajustes: Partial<CanalMeta> = {}): CanalMeta {
  return {
    ...BASE,
    id: 'm-1',
    tipo: 'INSTAGRAM',
    nome: 'Instagram @brl',
    idExterno: '17841400000000000',
    appId: '1234567890123456',
    pageId: '109876543210987',
    instagramId: '17841400000000000',
    appSecret: '••••••••3f9a',
    tokenPagina: '••••••••Zx0P',
    webhook: {
      url: 'http://localhost:4200/api/v1/publico/meta/webhook',
      tokenVerificacao: 'vt_123456',
      campos: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
    },
    ...ajustes,
  };
}

export function oficial(ajustes: Partial<CanalOficial> = {}): CanalOficial {
  return {
    ...BASE,
    id: 'o-1',
    tipo: 'WHATSAPP_OFICIAL',
    nome: 'WhatsApp Oficial (demo)',
    idExterno: '100000000000001',
    phoneNumberId: '100000000000001',
    wabaId: '200000000000001',
    numeroExibido: '5511999990000',
    token: '••••••••Zx0P',
    appSecret: '••••••••3f9a',
    webhook: {
      url: 'http://localhost:4200/api/v1/publico/meta/webhook',
      tokenVerificacao: 'vt_oficial',
      campos: ['messages'],
    },
    estado: {
      situacao: 'CONECTADO',
      motivo: null,
      conferidoEm: '2026-10-26T11:59:00.000Z',
      nomeVerificado: 'BRL Educação',
      qualidade: 'GREEN',
    },
    templates: { total: 2, aprovados: 1, sincronizadoEm: '2026-10-26T03:00:00.000Z' },
    ...ajustes,
  };
}

export function templateDoCanal(ajustes: Partial<TemplateDoCanal> = {}): TemplateDoCanal {
  return {
    id: 't-1',
    nome: 'pedido_atualizacao',
    idioma: 'pt_BR',
    categoria: 'UTILITY',
    status: 'APPROVED',
    usavel: true,
    motivoIndisponivel: null,
    cabecalho: null,
    corpo: {
      texto: 'Olá {{1}}, seu pedido {{2}} está {{3}}.',
      variaveis: ['1', '2', '3'],
    },
    rodape: null,
    botoes: [],
    sincronizadoEm: '2026-10-26T03:00:00.000Z',
    ...ajustes,
  };
}

/** Deixa as continuações das promessas (then/finally) rodarem. */
export async function microtarefas(vezes = 12): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await Promise.resolve();
  }
}

export function falhaDaApi(status: number, erro: string, mensagem: string, detalhes?: unknown) {
  return {
    corpo: { statusCode: status, erro, mensagem, detalhes, requisicaoId: 'req-teste' },
    opcoes: { status, statusText: 'Erro' },
  };
}
