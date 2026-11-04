/**
 * Tipos do Facebook Lead Ads (`/webhooks/facebook/*`; REGRAS-DE-NEGOCIO R32.14): conexões com o
 * Facebook, páginas, formulários e o retorno do login em `/integracoes?facebook=…`.
 */

export type TipoDeConexaoFacebook = 'USUARIO' | 'PAGINA';

export interface PaginaFacebook {
  readonly id: string;
  readonly nome: string;
  readonly categoria: string | null;
}

/** Webhook de páginas no app da Meta: o endereço e o token de verificação desta conexão (R32.14). */
export interface WebhookDaConexaoFacebook {
  readonly url: string;
  readonly tokenVerificacao: string;
  readonly campos: readonly string[];
}

export interface ConexaoFacebook {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoDeConexaoFacebook;
  readonly appId: string;
  /** O segredo do app nunca sai da API: só uma máscara. */
  readonly appSecretMascarado: string;
  /** `false` enquanto o diálogo do Facebook está aberto ou foi cancelado. */
  readonly conectada: boolean;
  readonly usuarioFacebook: { readonly id: string; readonly nome: string } | null;
  readonly expiraEm: string | null;
  readonly conectadaEm: string | null;
  readonly canalOrigemId: string | null;
  readonly paginas: readonly PaginaFacebook[];
  /** Quantas integrações usam esta conexão. */
  readonly integracoes: number;
  readonly webhook: WebhookDaConexaoFacebook;
  readonly precisaAtencao: boolean;
  readonly atencaoMotivo: string | null;
  readonly criadoEm: string;
}

export interface FormularioFacebook {
  readonly id: string;
  readonly nome: string;
  readonly status: string;
  readonly idioma: string | null;
  readonly criadoEm: string | null;
  readonly leads: number | null;
}

export interface ConfiguracaoFacebook {
  readonly enderecoDeRetorno: string;
  readonly escopos: readonly string[];
  readonly versaoDaGraph: string;
  readonly enderecoPublicoHttps: boolean;
}

export interface CanalDoFacebook {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'MESSENGER' | 'INSTAGRAM';
  readonly appId: string;
}

export interface LoginIniciado {
  readonly conexaoId: string;
  readonly urlDialogo: string;
  readonly expiraEm: string;
  readonly enderecoDeRetorno: string;
}

/** Corpo de `POST /webhooks/facebook/oauth/iniciar`: um dos três jeitos de dizer qual app usar. */
export type PedidoDeLogin =
  | { readonly appId: string; readonly appSecret: string; readonly nome?: string }
  | { readonly canalId: string; readonly nome?: string }
  | { readonly conexaoId: string };

export type PedidoDeTokenDePagina = {
  readonly tokenPagina: string;
  readonly paginaId?: string;
  readonly nome?: string;
} & ({ readonly appId: string; readonly appSecret: string } | { readonly canalId: string });

export type ResultadoDoRetorno = 'conectado' | 'cancelado' | 'erro';

/** O que a API deixa na URL de `/integracoes` ao fim do login (`?facebook=…&conexao=…`). */
export interface RetornoDoFacebook {
  readonly resultado: ResultadoDoRetorno;
  readonly conexaoId: string | null;
  readonly motivo: string | null;
  readonly mensagem: string | null;
}

const MOTIVOS: Readonly<Record<string, string>> = {
  state_invalido: 'O pedido de login não é reconhecido. Comece de novo pelo assistente.',
  state_vencido: 'O login demorou mais de 10 minutos e venceu. Comece de novo.',
  state_usado: 'Este login já foi usado. Comece de novo pelo assistente.',
  sem_codigo: 'O Facebook não devolveu o código de acesso. Tente entrar de novo.',
  meta_recusou: 'O Facebook recusou o acesso. Confira o app e tente de novo.',
  access_denied: 'O acesso foi negado no Facebook.',
};

export function motivoDoRetorno(motivo: string | null): string {
  return (motivo && MOTIVOS[motivo]) || 'Não foi possível concluir o login com o Facebook.';
}

/** Lê os parâmetros do retorno; `null` se a URL não veio do Facebook. */
export function lerRetornoDoFacebook(
  parametros: Readonly<Record<string, string | null | undefined>>,
): RetornoDoFacebook | null {
  const resultado = parametros['facebook'];
  if (resultado !== 'conectado' && resultado !== 'cancelado' && resultado !== 'erro') {
    return null;
  }
  return {
    resultado,
    conexaoId: parametros['conexao'] || null,
    motivo: parametros['motivo'] || null,
    mensagem: parametros['mensagem'] || null,
  };
}

export const ROTULO_TIPO_DE_CONEXAO: Readonly<Record<TipoDeConexaoFacebook, string>> = {
  USUARIO: 'Login do Facebook',
  PAGINA: 'Token de página',
};

// ---------------------------------------------------------------------------------------------
// O que o assistente guarda enquanto o navegador visita o Facebook
// ---------------------------------------------------------------------------------------------

/** O login sai da página (`window.location`): o assistente lembra o que estava fazendo para voltar. */
export interface ContextoDoLogin {
  /** Integração que estava sendo editada; `null` numa integração nova. */
  readonly integracaoId: string | null;
  readonly nome: string;
}

const CHAVE_DO_CONTEXTO = 'crmbrl.facebook.contexto-do-login';

export function guardarContextoDoLogin(contexto: ContextoDoLogin): void {
  try {
    globalThis.sessionStorage?.setItem(CHAVE_DO_CONTEXTO, JSON.stringify(contexto));
  } catch {
    // Sem armazenamento: o assistente reabre do começo, e tudo bem.
  }
}

/** Lê e apaga o contexto guardado antes do login. */
export function consumirContextoDoLogin(): ContextoDoLogin | null {
  try {
    const texto = globalThis.sessionStorage?.getItem(CHAVE_DO_CONTEXTO);
    globalThis.sessionStorage?.removeItem(CHAVE_DO_CONTEXTO);
    if (!texto) {
      return null;
    }
    const valor: unknown = JSON.parse(texto);
    if (valor && typeof valor === 'object') {
      const { integracaoId, nome } = valor as Record<string, unknown>;
      return {
        integracaoId: typeof integracaoId === 'string' ? integracaoId : null,
        nome: typeof nome === 'string' ? nome : '',
      };
    }
  } catch {
    // Contexto ilegível: ignora.
  }
  return null;
}
