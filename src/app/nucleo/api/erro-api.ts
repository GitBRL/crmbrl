import { HttpErrorResponse } from '@angular/common/http';

import { formatarEspera } from '../formatos';

/**
 * Erros da API, normalizados. Toda falha da API sai no formato
 * `{ statusCode, erro, mensagem, detalhes?, requisicaoId }` (mensagem já em português). O
 * interceptor (`interceptor-erros.ts`) transforma qualquer falha de `/api/v1` num `ErroApi`,
 * com uma `mensagem` pronta para a tela — inclusive quando a API nem respondeu.
 */

/** Códigos do campo `erro` (crmbrl-api, comum/erros/excecoes.ts) + os do próprio front. */
export type CodigoErro =
  | 'dados_invalidos'
  | 'nao_autenticado'
  | 'sem_permissao'
  | 'nao_encontrado'
  | 'metodo_nao_permitido'
  | 'conflito'
  | 'desativado'
  | 'muito_grande'
  | 'tipo_nao_suportado'
  | 'regra_violada'
  | 'muitas_tentativas'
  | 'erro_interno'
  | 'indisponivel'
  | 'erro_http'
  /** Front: a requisição não chegou à API (rede, proxy, servidor fora do ar). */
  | 'sem_conexao'
  /** Front: falha que não veio da API (erro de programação, tempo esgotado…). */
  | 'desconhecido';

/** Corpo de erro da API. */
export interface CorpoErro {
  readonly statusCode: number;
  readonly erro: CodigoErro;
  readonly mensagem: string;
  readonly detalhes?: Readonly<Record<string, unknown>>;
  readonly requisicaoId: string;
}

/** Problema de um campo (`detalhes.campos` do 400 `dados_invalidos`). */
export interface ErroDeCampo {
  readonly campo: string;
  readonly mensagens: readonly string[];
}

export const MENSAGENS_ERRO = {
  semConexao:
    'Não foi possível falar com o servidor do CRM. Confira a sua conexão e tente de novo.',
  foraDoAr: 'O servidor do CRM está fora do ar no momento. Tente de novo em instantes.',
  interno: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  semPermissao: 'Você não tem permissão para esta ação.',
  naoEncontrado: 'Não encontramos o que você procurou. Ele pode ter sido removido.',
  sessao: 'Faça login para continuar.',
  esperar: 'Espere um pouco e tente de novo.',
  desconhecido: 'Algo deu errado. Tente de novo.',
} as const;

export interface DadosErroApi {
  readonly status: number;
  readonly codigo: CodigoErro;
  readonly mensagemDaApi?: string | null;
  readonly detalhes?: Readonly<Record<string, unknown>> | null;
  readonly requisicaoId?: string | null;
  readonly tentarDeNovoEmSegundos?: number | null;
  /** Rota e método, só para o console (quem investiga). */
  readonly origem?: string;
  readonly causa?: unknown;
}

/**
 * Falha de uma chamada à API. Use `mensagem` na tela; os outros campos servem para decidir
 * onde mostrar (campo do formulário, regra violada, sessão…).
 *
 * ```ts
 * try { await this.api.mover(id, etapaId); }
 * catch (falha) {
 *   const erro = erroDaApi(falha);
 *   if (erro.regra === 'R5.5') { this.pedirMotivo(); } else { this.avisos.erro(erro); }
 * }
 * ```
 */
export class ErroApi extends Error {
  /** HTTP (0 quando a API não respondeu). */
  readonly status: number;
  readonly codigo: CodigoErro;
  /**
   * Mensagem humana, em português, pronta para a tela (também em `message`). Nos erros do
   * servidor, termina com o código para a TI ("Se continuar, informe à TI o código …").
   */
  readonly mensagem: string;
  /** A mesma mensagem, sem o código para a TI (quando o código aparece à parte). */
  readonly resumo: string;
  /** A mensagem original da API, quando veio uma. */
  readonly mensagemDaApi: string | null;
  readonly detalhes: Readonly<Record<string, unknown>> | null;
  /** Id da requisição (`X-Request-Id`), para achar a falha nos logs técnicos. */
  readonly requisicaoId: string | null;
  /** Código da regra de negócio (`detalhes.regra`, ex.: "R5.5"), quando houver. */
  readonly regra: string | null;
  /** Problemas por campo (400 `dados_invalidos`). */
  readonly campos: readonly ErroDeCampo[];
  /** 429: em quantos segundos tentar de novo (`Retry-After`). */
  readonly tentarDeNovoEmSegundos: number | null;

  constructor(dados: DadosErroApi) {
    const detalhes = dados.detalhes ?? null;
    const mensagem = montarMensagem(dados);
    super(mensagem, { cause: dados.causa });
    this.name = 'ErroApi';
    this.status = dados.status;
    this.codigo = dados.codigo;
    this.mensagem = mensagem;
    this.resumo = montarMensagem({ ...dados, requisicaoId: null });
    this.mensagemDaApi = dados.mensagemDaApi?.trim() || null;
    this.detalhes = detalhes;
    this.requisicaoId = dados.requisicaoId ?? null;
    this.regra = typeof detalhes?.['regra'] === 'string' ? detalhes['regra'] : null;
    this.campos = lerCampos(detalhes);
    this.tentarDeNovoEmSegundos = dados.tentarDeNovoEmSegundos ?? null;
  }

  /** 401: sem sessão (ou credenciais erradas no login). */
  get ehSemSessao(): boolean {
    return this.status === 401;
  }

  /** 403: autenticado, mas sem permissão. */
  get ehSemPermissao(): boolean {
    return this.status === 403 && !this.ehTrocaDeSenhaPendente;
  }

  /** 403 da troca de senha obrigatória (R2.7). */
  get ehTrocaDeSenhaPendente(): boolean {
    return this.status === 403 && this.detalhes?.['motivo'] === 'troca_de_senha_pendente';
  }

  /** 404 — inclusive o que existe mas a pessoa não pode ver (a API responde 404). */
  get ehNaoEncontrado(): boolean {
    return this.status === 404;
  }

  /** 400 com problemas por campo. */
  get ehDadosInvalidos(): boolean {
    return this.codigo === 'dados_invalidos';
  }

  /** 422 `regra_violada` (a `regra` diz qual). */
  get ehRegraViolada(): boolean {
    return this.codigo === 'regra_violada';
  }

  get ehConflito(): boolean {
    return this.status === 409;
  }

  get ehMuitasTentativas(): boolean {
    return this.status === 429;
  }

  /** 5xx ou sem resposta: a culpa não é de quem usa; vale oferecer "Tentar de novo". */
  get ehFalhaDoServidor(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /**
   * Mensagem de um campo, como frase ("Deve ser um e-mail válido."), ou `null`. Aceita o
   * caminho do campo como a API manda (`email`, `etapas.0.nome`).
   */
  mensagemDoCampo(campo: string): string | null {
    const encontrado = this.campos.find((item) => item.campo === campo);
    return encontrado?.mensagens.length ? comoFrase(encontrado.mensagens.join('; ')) : null;
  }
}

/** Qualquer falha → `ErroApi` (o que já é `ErroApi` passa direto). */
export function erroDaApi(falha: unknown): ErroApi {
  if (falha instanceof ErroApi) {
    return falha;
  }
  if (falha instanceof HttpErrorResponse) {
    return deRespostaHttp(falha);
  }
  return new ErroApi({ status: 0, codigo: 'desconhecido', causa: falha });
}

/** O corpo é o erro padrão da API? */
export function ehCorpoErro(valor: unknown): valor is CorpoErro {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const corpo = valor as Partial<CorpoErro>;
  return (
    typeof corpo.statusCode === 'number' &&
    typeof corpo.erro === 'string' &&
    typeof corpo.mensagem === 'string'
  );
}

function deRespostaHttp(resposta: HttpErrorResponse): ErroApi {
  const corpo = ehCorpoErro(resposta.error) ? resposta.error : null;
  const status = resposta.status;
  const requisicaoId = corpo?.requisicaoId ?? resposta.headers?.get('X-Request-Id') ?? null;
  return new ErroApi({
    status,
    codigo: corpo?.erro ?? codigoPorStatus(status),
    mensagemDaApi: corpo?.mensagem ?? null,
    detalhes: corpo?.detalhes ?? null,
    requisicaoId,
    tentarDeNovoEmSegundos:
      status === 429 ? lerEspera(resposta.headers?.get('Retry-After'), corpo?.detalhes) : null,
    origem: resposta.url ?? undefined,
    causa: resposta,
  });
}

function codigoPorStatus(status: number): CodigoErro {
  switch (status) {
    case 0:
      return 'sem_conexao';
    case 400:
      return 'dados_invalidos';
    case 401:
      return 'nao_autenticado';
    case 403:
      return 'sem_permissao';
    case 404:
      return 'nao_encontrado';
    case 409:
      return 'conflito';
    case 429:
      return 'muitas_tentativas';
    case 502:
    case 503:
    case 504:
      return 'indisponivel';
    default:
      return status >= 500 ? 'erro_interno' : 'erro_http';
  }
}

function montarMensagem(dados: DadosErroApi): string {
  const daApi = dados.mensagemDaApi?.trim() || null;
  const { status, codigo } = dados;

  if (codigo === 'desconhecido') {
    return MENSAGENS_ERRO.desconhecido;
  }
  if (status === 0 || codigo === 'sem_conexao') {
    return MENSAGENS_ERRO.semConexao;
  }
  if (status >= 500) {
    // Erro interno: frase genérica (a API não dá detalhe). Sem corpo da API (proxy sem
    // resposta): "fora do ar". Um 503 da API com motivo ("O envio de e-mail está
    // indisponível…") mantém a mensagem dela.
    const base =
      status === 500 || codigo === 'erro_interno'
        ? MENSAGENS_ERRO.interno
        : (daApi ?? MENSAGENS_ERRO.foraDoAr);
    return dados.requisicaoId
      ? `${comoFrase(base)} Se continuar, informe à TI o código ${dados.requisicaoId}.`
      : comoFrase(base);
  }
  if (status === 429) {
    const base = daApi ?? 'Muitas tentativas.';
    if (/tente de novo em/i.test(base)) {
      return comoFrase(base);
    }
    const espera = dados.tentarDeNovoEmSegundos;
    return `${comoFrase(base)} ${espera ? `Tente de novo em ${formatarEspera(espera)}.` : MENSAGENS_ERRO.esperar}`;
  }
  if (daApi) {
    return comoFrase(daApi);
  }
  switch (status) {
    case 401:
      return MENSAGENS_ERRO.sessao;
    case 403:
      return MENSAGENS_ERRO.semPermissao;
    case 404:
      return MENSAGENS_ERRO.naoEncontrado;
    default:
      return MENSAGENS_ERRO.desconhecido;
  }
}

/** `Retry-After` em segundos ou data HTTP; sem ele, `detalhes.ate` (bloqueio do login). */
function lerEspera(
  cabecalho: string | null | undefined,
  detalhes: Readonly<Record<string, unknown>> | undefined,
): number | null {
  const agora = Date.now();
  if (cabecalho) {
    const segundos = Number(cabecalho);
    if (Number.isFinite(segundos) && segundos >= 0) {
      return Math.ceil(segundos);
    }
    const data = Date.parse(cabecalho);
    if (!Number.isNaN(data)) {
      return Math.max(1, Math.ceil((data - agora) / 1000));
    }
  }
  const ate = detalhes?.['ate'];
  if (typeof ate === 'string' && !Number.isNaN(Date.parse(ate))) {
    return Math.max(1, Math.ceil((Date.parse(ate) - agora) / 1000));
  }
  return null;
}

function lerCampos(detalhes: Readonly<Record<string, unknown>> | null): readonly ErroDeCampo[] {
  const campos = detalhes?.['campos'];
  if (!Array.isArray(campos)) {
    return [];
  }
  return campos
    .filter(
      (item): item is { campo: string; mensagens: unknown } =>
        typeof item === 'object' && item !== null && typeof item.campo === 'string',
    )
    .map((item) => ({
      campo: item.campo,
      mensagens: Array.isArray(item.mensagens)
        ? item.mensagens.filter((texto): texto is string => typeof texto === 'string')
        : [],
    }));
}

/** "deve ser um texto" → "Deve ser um texto." */
function comoFrase(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) {
    return limpo;
  }
  const inicio = limpo.charAt(0).toLocaleUpperCase('pt-BR') + limpo.slice(1);
  return /[.!?…]$/.test(inicio) ? inicio : `${inicio}.`;
}
