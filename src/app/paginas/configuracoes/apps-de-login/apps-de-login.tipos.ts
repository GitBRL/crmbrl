/**
 * Tipos dos apps de login (`/configuracoes/apps-de-login`; REGRAS-DE-NEGOCIO R32.22): o app da
 * Meta, do Typeform e do RD Station, cadastrado uma vez e usado por todos os assistentes.
 */

export type AplicativoDeLogin = 'META' | 'TYPEFORM' | 'RD_STATION';

export interface UsoDoApp {
  readonly conexoes: number;
  readonly canais: number;
  readonly integracoes: number;
}

export interface WebhookDoAppMeta {
  readonly url: string;
  readonly tokenVerificacao: string;
  readonly campos: readonly string[];
}

export interface AppDeLogin {
  readonly aplicativo: AplicativoDeLogin;
  readonly nome: string;
  readonly configurado: boolean;
  readonly clientId: string | null;
  /** O segredo nunca sai da API: só uma máscara. */
  readonly segredoMascarado: string | null;
  readonly enderecoDeRetorno: string;
  readonly emUso: UsoDoApp;
  readonly escopos: readonly string[];
  /** Só o app da Meta, depois de configurado. */
  readonly webhook: WebhookDoAppMeta | null;
  readonly atualizadoEm: string | null;
  readonly atualizadoPor: { readonly id: string; readonly nome: string } | null;
}

export interface DadosDoApp {
  readonly clientId: string;
  readonly segredo?: string;
  readonly confirmarTroca?: boolean;
}

export const ORDEM_DOS_APPS: readonly AplicativoDeLogin[] = ['META', 'TYPEFORM', 'RD_STATION'];

/** Qual logotipo do catálogo de aplicativos representa cada app de login. */
export const LOGOTIPO_DO_APP = {
  META: 'FACEBOOK_LEAD_ADS',
  TYPEFORM: 'TYPEFORM',
  RD_STATION: 'RD_STATION',
} as const;

export interface TextosDoApp {
  readonly rotuloDoId: string;
  readonly rotuloDoSegredo: string;
  readonly ondeFica: string;
  readonly ondeCadastrarRetorno: string;
  readonly passos: readonly string[];
}

export const TEXTOS_DOS_APPS: Readonly<Record<AplicativoDeLogin, TextosDoApp>> = {
  META: {
    rotuloDoId: 'ID do app',
    rotuloDoSegredo: 'Segredo do app',
    ondeFica: 'Configurações do app > Básico, no painel de desenvolvedores da Meta.',
    ondeCadastrarRetorno:
      'URIs de redirecionamento OAuth válidos, nas configurações do Login do Facebook do app.',
    passos: [
      'Em developers.facebook.com, crie um app do tipo Empresa.',
      'Adicione o produto Login do Facebook e cole o endereço de retorno acima em URIs de redirecionamento OAuth válidos.',
      'Adicione o produto Webhooks, escolha Page e cole o endereço e o token de verificação mostrados aqui; assine o campo leadgen.',
      'Em Configurações > Básico, copie o ID e o segredo do app para os campos acima.',
      'Peça a permissão leads_retrieval na Análise de apps e libere o CRM em Leads Access.',
    ],
  },
  TYPEFORM: {
    rotuloDoId: 'Client ID',
    rotuloDoSegredo: 'Client secret',
    ondeFica: 'Typeform, em Account > Developer apps, ao registrar o aplicativo.',
    ondeCadastrarRetorno: 'Redirect URI(s), no formulário de registro do aplicativo.',
    passos: [
      'No Typeform, abra Account > Developer apps e escolha Register a new app.',
      'Dê um nome e o endereço do CRM, e cole o endereço de retorno acima em Redirect URI(s).',
      'Copie o Client ID e o Client secret que o Typeform mostra uma vez só.',
      'Cole os dois nos campos acima e salve.',
    ],
  },
  RD_STATION: {
    rotuloDoId: 'Client ID',
    rotuloDoSegredo: 'Client secret',
    ondeFica: 'App Store do RD Station, ao criar o aplicativo.',
    ondeCadastrarRetorno: 'URL de callback, no cadastro do aplicativo.',
    passos: [
      'No RD Station, abra a App Store > Criar aplicativo (conta de desenvolvedor).',
      'Cole o endereço de retorno acima como URL de callback.',
      'Copie o Client ID e o Client secret do aplicativo.',
      'Cole os dois nos campos acima e salve.',
    ],
  },
};

export function resumoDoUso(uso: UsoDoApp): string {
  const partes: string[] = [];
  const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;
  if (uso.conexoes) {
    partes.push(plural(uso.conexoes, 'conexão', 'conexões'));
  }
  if (uso.canais) {
    partes.push(plural(uso.canais, 'canal', 'canais'));
  }
  if (uso.integracoes) {
    partes.push(plural(uso.integracoes, 'integração', 'integrações'));
  }
  return partes.length ? partes.join(', ') : 'Nada usa este app ainda';
}

export function haUso(uso: UsoDoApp): boolean {
  return uso.conexoes + uso.canais + uso.integracoes > 0;
}
