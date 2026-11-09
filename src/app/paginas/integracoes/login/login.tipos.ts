/**
 * Tipos do login em outra janela (REGRAS-DE-NEGOCIO R32.23 a R32.26), comuns ao Facebook, ao
 * Typeform e ao RD Station: o que o `…/oauth/iniciar` devolve, o que o retorno diz e as conexões
 * de aplicativo (Typeform e RD Station).
 */
import type { LoginIniciado, ResultadoDoRetorno } from '../facebook.tipos';

export type { LoginIniciado, ResultadoDoRetorno };

/** O nome do serviço na URL de retorno (`/retorno-login?app=…`, `/integracoes?<app>=…`). */
export type ServicoDeLogin = 'facebook' | 'typeform' | 'rd-station';

export const SERVICOS_DE_LOGIN: readonly ServicoDeLogin[] = ['facebook', 'typeform', 'rd-station'];

export const NOME_DO_SERVICO: Readonly<Record<ServicoDeLogin, string>> = {
  facebook: 'Facebook',
  typeform: 'Typeform',
  'rd-station': 'RD Station',
};

export type ModoDeLogin = 'janela' | 'pagina';

/** O que o retorno do login diz (o mesmo na janela e na página). */
export interface RetornoDoLogin {
  readonly app: ServicoDeLogin;
  readonly resultado: ResultadoDoRetorno;
  readonly conexaoId: string | null;
  readonly motivo: string | null;
  readonly mensagem: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DA_MENSAGEM = 300;

export function ehServicoDeLogin(valor: unknown): valor is ServicoDeLogin {
  return typeof valor === 'string' && (SERVICOS_DE_LOGIN as readonly string[]).includes(valor);
}

export function ehResultadoDoRetorno(valor: unknown): valor is ResultadoDoRetorno {
  return valor === 'conectado' || valor === 'cancelado' || valor === 'erro';
}

/** Valida o que veio na URL ou numa mensagem: `null` se não for um retorno de login. */
export function lerRetornoDoLogin(valor: {
  readonly app?: unknown;
  readonly resultado?: unknown;
  readonly conexao?: unknown;
  readonly motivo?: unknown;
  readonly mensagem?: unknown;
}): RetornoDoLogin | null {
  if (!ehServicoDeLogin(valor.app) || !ehResultadoDoRetorno(valor.resultado)) {
    return null;
  }
  const texto = (v: unknown, limite: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, limite) : null;
  const conexao =
    typeof valor.conexao === 'string' && UUID.test(valor.conexao) ? valor.conexao : null;
  return {
    app: valor.app,
    resultado: valor.resultado,
    conexaoId: conexao,
    motivo: texto(valor.motivo, 60),
    mensagem: texto(valor.mensagem, LIMITE_DA_MENSAGEM),
  };
}

const MOTIVOS: Readonly<Record<string, string>> = {
  state_invalido: 'O pedido de login não é reconhecido. Comece de novo pelo assistente.',
  state_vencido: 'O login demorou mais de 10 minutos e venceu. Comece de novo.',
  state_usado: 'Este login já foi usado. Comece de novo pelo assistente.',
  sem_codigo: 'O serviço não devolveu o código de acesso. Tente entrar de novo.',
  meta_recusou: 'O Facebook recusou o acesso. Confira o app e tente de novo.',
  servico_recusou: 'O serviço recusou o acesso. Confira o app cadastrado e tente de novo.',
  servico_indisponivel: 'O serviço não respondeu agora. Tente de novo em instantes.',
  app_nao_cadastrado:
    'O app deste serviço ainda não foi cadastrado em Configurações > Apps de login.',
  access_denied: 'O acesso foi negado no serviço.',
};

export function motivoDoLogin(motivo: string | null, servico: ServicoDeLogin): string {
  return (
    (motivo && MOTIVOS[motivo]) ||
    `Não foi possível concluir o login com o ${NOME_DO_SERVICO[servico]}.`
  );
}

// ---------------------------------------------------------------------------------------------
// Conexões de aplicativo (Typeform e RD Station)
// ---------------------------------------------------------------------------------------------

export type AplicativoDeConexao = 'TYPEFORM' | 'RD_STATION';

export interface ConexaoAplicativo {
  readonly id: string;
  readonly aplicativo: AplicativoDeConexao;
  readonly nome: string;
  /** Nome ou e-mail da conta no serviço; `null` se ele não disse. */
  readonly conta: string | null;
  readonly conectada: boolean;
  readonly conectadaEm: string | null;
  readonly expiraEm: string | null;
  /** Integrações (não excluídas) que usam a conexão. */
  readonly integracoes: number;
  readonly precisaAtencao: boolean;
  readonly atencaoMotivo: string | null;
  readonly criadoEm: string;
}

export interface PedidoDeLoginDeAplicativo {
  readonly aplicativo: AplicativoDeConexao;
  readonly nome?: string;
  readonly conexaoId?: string;
  readonly modo?: ModoDeLogin;
}

export const SERVICO_DO_APLICATIVO: Readonly<Record<AplicativoDeConexao, ServicoDeLogin>> = {
  TYPEFORM: 'typeform',
  RD_STATION: 'rd-station',
};

/** Situação mínima que a janela consulta a cada 3 s (Facebook e conexões de aplicativo). */
export interface SituacaoDaConexao {
  readonly conectada: boolean;
  readonly precisaAtencao: boolean;
  readonly conectadaEm: string | null;
}

/** Webhook que o CRM criou no serviço e não conseguiu apagar (`detalhes.pendencias` do 409 R32.26). */
export interface PendenciaDeRemocao {
  readonly integracaoId: string;
  readonly nome: string;
  readonly webhookId: string | null;
}

/** As pendências que a API devolve no 409 ao excluir uma conexão de aplicativo (lista vazia se não houver). */
export function pendenciasDoErro(
  detalhes: Readonly<Record<string, unknown>> | null,
): readonly PendenciaDeRemocao[] {
  const bruto = detalhes?.['pendencias'];
  if (!Array.isArray(bruto)) {
    return [];
  }
  return bruto.flatMap((item: unknown) => {
    const o = item as Record<string, unknown> | null;
    if (!o || typeof o['nome'] !== 'string') {
      return [];
    }
    return [
      {
        integracaoId: typeof o['integracaoId'] === 'string' ? o['integracaoId'] : '',
        nome: o['nome'],
        webhookId: typeof o['webhookId'] === 'string' ? o['webhookId'] : null,
      },
    ];
  });
}
