/**
 * Contrato do `GET /api/saude` (crmbrl-api). Para qualquer pessoa vem só `{ status }`; o detalhe
 * (versão, ambiente, banco, migrations, avisos de configuração) vem apenas para o Admin logado.
 * Com o banco fora do ar a API responde HTTP 503: `status: 'degradado'` e, para o Admin,
 * `banco.status: 'erro'` e `migrations: null`.
 */
export interface RespostaSaude {
  readonly status: 'ok' | 'degradado';
  /** Versão do package.json da API (só Admin). */
  readonly versao?: string;
  /** NODE_ENV da API ("production", "development"…) (só Admin). */
  readonly ambiente?: string;
  /** Horário do servidor, ISO 8601 (só Admin). */
  readonly horario?: string;
  readonly uptimeSegundos?: number;
  readonly banco?: SaudeBanco;
  readonly migrations?: SaudeMigrations | null;
  /** Avisos de configuração da subida, sem valores secretos (só Admin). */
  readonly avisos?: readonly string[];
}

export interface SaudeBanco {
  readonly status: 'ok' | 'erro';
  readonly latenciaMs?: number;
  /** Mensagem curta, sem segredo, quando `status` é "erro". */
  readonly erro?: string;
}

export interface SaudeMigrations {
  readonly aplicadas: number;
  /** Nome da última migration aplicada, ex.: "20261020180000_inicial". */
  readonly ultima: string | null;
}

/**
 * Situação resumida para a tela:
 * - `carregando`: primeira consulta em andamento;
 * - `ok`: API e banco respondendo;
 * - `degradado`: API no ar, banco com erro (HTTP 503);
 * - `indisponivel`: a API não respondeu (rede, proxy, timeout, rota inexistente).
 */
export type SituacaoSaude = 'carregando' | 'ok' | 'degradado' | 'indisponivel';

export function ehRespostaSaude(valor: unknown): valor is RespostaSaude {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const resposta = valor as Partial<RespostaSaude>;
  return resposta.status === 'ok' || resposta.status === 'degradado';
}
