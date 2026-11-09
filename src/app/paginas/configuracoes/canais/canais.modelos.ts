import type { StatusWhatsapp } from '../../../nucleo/tempo-real/eventos';
import type { Area } from '../../../nucleo/sessao/perfil';

/**
 * Contratos da API dos canais de atendimento (Onda A, §2.3 e §2.5 do contrato; R13 e R14):
 * crmbrl-api, `src/canais/whatsapp/dto/numeros-whatsapp.dto.ts`, `src/canais/webchat/webchat.dto.ts`,
 * `src/canais/email/email.dto.ts`, `src/canais/meta/meta.dto.ts` e `src/canais/comum/dto-comum.ts`.
 * Todas as rotas de configuração de canais são só do Admin.
 */

export type { StatusWhatsapp };

/** Tipos de canal (enum `TipoCanal` da API). */
export type TipoCanal =
  'WHATSAPP' | 'WHATSAPP_OFICIAL' | 'WEBCHAT' | 'EMAIL' | 'INSTAGRAM' | 'MESSENGER';

export const TIPOS_CANAL: readonly TipoCanal[] = [
  'WHATSAPP',
  'WHATSAPP_OFICIAL',
  'WEBCHAT',
  'EMAIL',
  'INSTAGRAM',
  'MESSENGER',
];

/** Instagram e Messenger (Graph API da Meta). */
export type TipoCanalMeta = 'INSTAGRAM' | 'MESSENGER';

/** Fila de atendimento como os canais a mostram. */
export interface FilaDoCanal {
  readonly id: string;
  readonly nome: string;
  readonly area?: Area;
}

// WhatsApp ------------------------------------------------------------------------------------

export interface AquecimentoDoNumero {
  /** Ainda no aquecimento (o limite do dia é menor que o cheio). */
  readonly ativo: boolean;
  /** Dia do aquecimento (1 = o da primeira conexão), quando ativo. */
  readonly dia: number | null;
  readonly dias: number;
  /** Primeira conexão (início do aquecimento). */
  readonly inicioEm: string | null;
  /** Primeiro dia (São Paulo, `AAAA-MM-DD`) com o limite cheio. */
  readonly terminaEm: string | null;
}

export interface EnviosNoDia {
  /** `AAAA-MM-DD`, no fuso de São Paulo. */
  readonly dia: string;
  readonly enviados: number;
  readonly falhas: number;
  /** Limite daquele dia (com o aquecimento). */
  readonly limite: number;
}

export interface ProtecoesDoNumero {
  /** "digitando…" antes de cada envio. */
  readonly digitando: boolean;
  readonly digitandoMaximoSegundos: number;
  /** Confere se o telefone tem WhatsApp antes de uma mensagem ativa. */
  readonly verificarNumero: boolean;
  /** Falhas seguidas que pausam o número sozinho (0 = nunca). */
  readonly pausarAposFalhasSeguidas: number;
  /** O limite diário vale também para as respostas a conversas abertas pelo contato. */
  readonly limitarRespostas: boolean;
}

export interface PausaDoNumero {
  readonly pausadoEm: string;
  readonly motivo: string | null;
  /** Pausa do gateway (falhas seguidas, limite do WhatsApp, erro grave). */
  readonly automatica: boolean;
}

export interface NumeroWhatsapp {
  readonly id: string;
  readonly canalId: string;
  readonly nome: string;
  /** Canal ativo no Atendimento (recebe conversas novas). */
  readonly ativo: boolean;
  readonly filaPadrao: FilaDoCanal | null;
  readonly status: StatusWhatsapp;
  /** Por que está nesse status, em português. */
  readonly motivo: string | null;
  /** E.164 só com dígitos, depois da leitura do QR. */
  readonly telefone: string | null;
  readonly limiteDiario: number;
  readonly intervaloMinimoSegundos: number;
  readonly intervaloMaximoSegundos: number;
  readonly aquecimento: AquecimentoDoNumero;
  /** Envios de hoje. */
  readonly hoje: EnviosNoDia;
  readonly protecoes: ProtecoesDoNumero;
  readonly pausa: PausaDoNumero | null;
  readonly conectadoEm: string | null;
  readonly desconectadoEm: string | null;
  readonly ultimoEventoEm: string | null;
  readonly tentativasReconexao: number;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** Estado ao vivo no gateway (com o QR enquanto espera a leitura). */
export interface EstadoDoNumero {
  readonly numeroId: string;
  readonly canalId: string;
  readonly status: StatusWhatsapp;
  readonly telefone: string | null;
  readonly motivo: string | null;
  /** Data URL do QR enquanto `AGUARDANDO_QR`. */
  readonly qr: string | null;
  readonly qrExpiraEm: string | null;
}

/** Campos de criar/editar um número (o que não vier fica como está ou no padrão). */
export interface DadosNumeroWhatsapp {
  readonly nome?: string;
  readonly ativo?: boolean;
  readonly filaPadraoId?: string | null;
  readonly limiteDiario?: number;
  readonly intervaloMinimoSegundos?: number;
  readonly intervaloMaximoSegundos?: number;
  readonly aquecimentoDias?: number;
  readonly protecoes?: Partial<ProtecoesDoNumero>;
}

/** Faixas aceitas pela API (crmbrl-api, `src/canais/whatsapp/protecoes.ts`). */
export const FAIXAS_WHATSAPP = {
  limiteDiario: { minimo: 1, maximo: 100_000 },
  intervaloSegundos: { minimo: 0, maximo: 600 },
  aquecimentoDias: { minimo: 0, maximo: 90 },
  digitandoMaximoSegundos: { minimo: 0, maximo: 30 },
  pausarAposFalhasSeguidas: { minimo: 0, maximo: 100 },
} as const;

/** Padrões da API para um número novo. */
export const PADROES_WHATSAPP = {
  limiteDiario: 1000,
  intervaloMinimoSegundos: 2,
  intervaloMaximoSegundos: 6,
  aquecimentoDias: 14,
} as const;

export const TAMANHO_MAXIMO_NOME_NUMERO = 80;
export const TAMANHO_MAXIMO_MOTIVO_PAUSA = 300;

// Campos comuns dos canais extras ------------------------------------------------------------

/** Horário de atendimento (R12): fuso e intervalos por dia, `"0"` (domingo) a `"6"` (sábado). */
export interface HorarioDeAtendimento {
  readonly fusoHorario: string;
  readonly dias: Readonly<Partial<Record<DiaDaSemana, readonly IntervaloDeAtendimento[]>>>;
}

export type DiaDaSemana = '0' | '1' | '2' | '3' | '4' | '5' | '6';

export interface IntervaloDeAtendimento {
  /** `HH:MM`. */
  readonly inicio: string;
  /** `HH:MM`, depois do início; até `24:00`. */
  readonly fim: string;
}

/** O que todo canal (chat do site, e-mail, Instagram, Messenger) mostra. */
export interface CanalBase {
  readonly id: string;
  readonly tipo: TipoCanal;
  readonly nome: string;
  readonly ativo: boolean;
  /** Chave pública do widget, endereço da caixa, id da página ou da conta do Instagram. */
  readonly idExterno: string | null;
  readonly filaPadrao: FilaDoCanal | null;
  readonly horarioAtendimento: HorarioDeAtendimento | null;
  readonly mensagemForaHorario: string | null;
  readonly pesquisaSatisfacao: boolean;
  readonly mensagemSatisfacao: string | null;
  /** Último erro técnico (conexão, credenciais), em português. */
  readonly ultimoErro: string | null;
  readonly ultimoErroEm: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** Campos comuns de criar/editar (na edição, só os que mudaram). */
export interface DadosCanalBase {
  readonly nome?: string;
  readonly ativo?: boolean;
  readonly filaPadraoId?: string | null;
}

// Chat do site ---------------------------------------------------------------------------------

export type TemaDoWidget = 'claro' | 'escuro' | 'automatico';
export type PosicaoDoWidget = 'direita' | 'esquerda';
export type ContatoDoFormulario = 'EMAIL' | 'TELEFONE' | 'EMAIL_OU_TELEFONE';

export interface AparenciaDoWidget {
  readonly titulo: string;
  readonly subtitulo: string | null;
  readonly saudacao: string | null;
  /** `#RRGGBB`. */
  readonly corPrimaria: string;
  /** Cor do texto sobre a principal. */
  readonly corTextoPrimaria: string;
  readonly tema: TemaDoWidget;
  readonly posicao: PosicaoDoWidget;
}

export interface CanalSite extends CanalBase {
  readonly chavePublica: string;
  readonly dominios: readonly string[];
  readonly aparencia: AparenciaDoWidget;
  readonly contato: ContatoDoFormulario;
  readonly textoConsentimento: string;
  readonly urlPrivacidade: string | null;
  readonly permitirAnexos: boolean;
  readonly instalacao: { readonly urlDoWidget: string; readonly trecho: string };
}

export interface DadosCanalSite extends DadosCanalBase {
  readonly dominios?: readonly string[];
  /** `corTextoPrimaria: null` = preto ou branco, o de mais contraste. */
  readonly aparencia?: Partial<
    Omit<AparenciaDoWidget, 'corTextoPrimaria'> & { corTextoPrimaria: string | null }
  >;
  readonly contato?: ContatoDoFormulario;
  readonly textoConsentimento?: string | null;
  readonly urlPrivacidade?: string | null;
  readonly permitirAnexos?: boolean;
}

/** Padrões da API (crmbrl-api, `src/canais/webchat/configuracao-webchat.ts`). */
export const APARENCIA_PADRAO: AparenciaDoWidget = {
  titulo: 'Fale com a gente',
  subtitulo: 'Respondemos o mais rápido possível.',
  saudacao: 'Olá! Como podemos ajudar?',
  corPrimaria: '#2563EB',
  corTextoPrimaria: '#FFFFFF',
  tema: 'automatico',
  posicao: 'direita',
};

export const TEXTO_CONSENTIMENTO_PADRAO =
  'Concordo que meus dados sejam usados para responder a este atendimento, conforme a política de privacidade.';

export const DOMINIOS_POR_CANAL = 20;

// E-mail ----------------------------------------------------------------------------------------

export type SegurancaSmtp = 'TLS' | 'STARTTLS' | 'NENHUMA';

export interface ServidorImap {
  readonly host: string;
  readonly porta: number;
  readonly tls: boolean;
  readonly usuario: string;
  readonly pasta: string;
}

export interface ServidorSmtp {
  readonly host: string;
  readonly porta: number;
  readonly seguranca: SegurancaSmtp;
  readonly usuario: string;
}

export interface CanalEmail extends CanalBase {
  readonly endereco: string;
  readonly nomeRemetente: string | null;
  readonly imap: ServidorImap;
  readonly smtp: ServidorSmtp;
  readonly ignorarCertificado: boolean;
  readonly assinatura: string | null;
  /** A senha gravada, mascarada (`••••••••3f9a`). */
  readonly senha: string | null;
  /** Senha própria do SMTP, mascarada (`null` = usa a do IMAP). */
  readonly senhaSmtp: string | null;
  /** Última leitura da caixa com sucesso. */
  readonly ultimaVarreduraEm: string | null;
}

export interface DadosConexaoEmail {
  readonly endereco?: string;
  readonly imap?: Partial<ServidorImap>;
  readonly smtp?: Partial<ServidorSmtp>;
  /** Na edição, ausente = mantém a gravada. */
  readonly senha?: string;
  /** `null` = usa a do IMAP. */
  readonly senhaSmtp?: string | null;
  readonly ignorarCertificado?: boolean;
}

export interface DadosCanalEmail extends DadosCanalBase, DadosConexaoEmail {
  readonly nomeRemetente?: string | null;
  readonly assinatura?: string | null;
}

export interface ResultadoDoTeste {
  readonly ok: boolean;
  readonly mensagem: string;
}

export interface TesteDeConexaoEmail {
  readonly imap: ResultadoDoTeste;
  readonly smtp: ResultadoDoTeste;
}

/** Portas padrão (crmbrl-api, `src/canais/email/configuracao-email.ts`). */
export const PORTA_PADRAO_EMAIL = {
  imap: { tls: 993, aberta: 143 },
  smtp: { TLS: 465, STARTTLS: 587, NENHUMA: 25 },
} as const;

// Instagram e Messenger ----------------------------------------------------------------------------

export interface WebhookDoCanalMeta {
  /** URL de retorno (callback) para o painel do app na Meta. */
  readonly url: string;
  readonly tokenVerificacao: string;
  /** Campos que o app precisa assinar no webhook. */
  readonly campos: readonly string[];
}

export interface CanalMeta extends CanalBase {
  readonly appId: string;
  /**
   * `true`: usa o app cadastrado em Configurações > Apps de login (R32.22). `false` ou ausente:
   * canal com app próprio (ID e chave secreta digitados no canal).
   */
  readonly appDasConfiguracoes?: boolean;
  readonly pageId: string;
  readonly instagramId: string | null;
  /** Mascarado. */
  readonly appSecret: string | null;
  /** Mascarado. */
  readonly tokenPagina: string | null;
  readonly webhook: WebhookDoCanalMeta;
}

export interface DadosCanalMeta extends DadosCanalBase {
  /** Só na criação. */
  readonly tipo?: TipoCanalMeta;
  readonly appId?: string;
  readonly appSecret?: string;
  readonly pageId?: string;
  readonly tokenPagina?: string;
  readonly instagramId?: string | null;
}

export interface TesteDoCanalMeta {
  readonly ok: boolean;
  readonly mensagem: string;
  /** Nome da página na Meta, quando conectou. */
  readonly nome: string | null;
}

// WhatsApp oficial (API da Meta) -----------------------------------------------------------------

export type SituacaoDoCanalOficial = 'CONECTADO' | 'ERRO' | 'NAO_TESTADO';

export interface EstadoDoCanalOficial {
  readonly situacao: SituacaoDoCanalOficial;
  /** Por que está com erro, em português. */
  readonly motivo: string | null;
  readonly conferidoEm: string | null;
  readonly nomeVerificado: string | null;
  readonly qualidade: string | null;
}

export interface ResumoDosTemplates {
  readonly total: number;
  readonly aprovados: number;
  readonly sincronizadoEm: string | null;
}

/** `GET /whatsapp-oficial/canais`: o webhook é o mesmo do Instagram e do Messenger. */
export interface CanalOficial extends CanalBase {
  readonly phoneNumberId: string;
  readonly wabaId: string;
  readonly numeroExibido: string | null;
  /** Mascarado. */
  readonly token: string | null;
  /** Mascarado. */
  readonly appSecret: string | null;
  readonly webhook: WebhookDoCanalMeta;
  readonly estado: EstadoDoCanalOficial;
  readonly templates: ResumoDosTemplates;
}

export interface DadosCanalOficial extends DadosCanalBase {
  readonly phoneNumberId?: string;
  readonly wabaId?: string;
  readonly numeroExibido?: string | null;
  /** Na edição, ausente = mantém o gravado. */
  readonly token?: string;
  readonly appSecret?: string;
}

export interface TesteDoCanalOficial {
  readonly ok: boolean;
  readonly mensagem: string;
  readonly numeroExibido: string | null;
  readonly nomeVerificado: string | null;
  readonly qualidade: string | null;
}

export type CategoriaDoTemplate = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type FormatoDoCabecalho = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type TipoDoBotao = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTHER';

export interface BotaoDoTemplate {
  readonly tipo: TipoDoBotao;
  readonly texto: string;
  readonly url: string | null;
  readonly variaveis: readonly string[];
}

/** Template da WABA como a API o devolve (`GET …/templates`; no Atendimento, só os usáveis). */
export interface TemplateDoCanal {
  /** É o `templateId` do envio. */
  readonly id: string;
  readonly nome: string;
  readonly idioma: string;
  readonly categoria: CategoriaDoTemplate;
  /** `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`… */
  readonly status: string;
  readonly usavel: boolean;
  readonly motivoIndisponivel: string | null;
  readonly cabecalho: {
    readonly formato: FormatoDoCabecalho;
    readonly texto: string | null;
    readonly variaveis: readonly string[];
  } | null;
  readonly corpo: { readonly texto: string; readonly variaveis: readonly string[] };
  readonly rodape: string | null;
  readonly botoes: readonly BotaoDoTemplate[];
  readonly sincronizadoEm: string;
}

export interface SincronizacaoDeTemplates {
  readonly total: number;
  readonly aprovados: number;
  readonly sincronizadoEm: string;
  readonly itens: readonly TemplateDoCanal[];
}

// Lista ------------------------------------------------------------------------------------------

/** Os canais de todos os tipos, como a tela de Canais os carrega (cada tipo pode falhar sozinho). */
export interface ListaDeCanais {
  readonly whatsapp: readonly NumeroWhatsapp[] | null;
  readonly site: readonly CanalSite[] | null;
  readonly email: readonly CanalEmail[] | null;
  readonly meta: readonly CanalMeta[] | null;
  readonly oficial: readonly CanalOficial[] | null;
}
