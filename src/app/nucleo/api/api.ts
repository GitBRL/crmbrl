import { HttpParams } from '@angular/common/http';

/**
 * Apoio para falar com a API (`crmbrl-api`, contrato em docs/ARQUITETURA.md). Tudo passa
 * pela mesma origem: o dev server e o Caddy repassam `/api` para a API. A sessão vai no
 * cookie `crmbrl_sessao` (HttpOnly), que o navegador manda sozinho — o front nunca lê nem
 * guarda token.
 */

/** Prefixo das rotas da API. */
export const API = '/api/v1';

/**
 * Monta a URL de uma rota da API, codificando cada parte:
 * `urlApi('negocios', id, 'mover')` → `/api/v1/negocios/<id>/mover`.
 */
export function urlApi(...partes: readonly (string | number)[]): string {
  return [API, ...partes.map((parte) => encodeURIComponent(String(parte)))].join('/');
}

/** Lista paginada: `?pagina=&porPagina=` → `{ itens, total, pagina, porPagina }`. */
export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly total: number;
  /** A partir de 1. */
  readonly pagina: number;
  readonly porPagina: number;
}

/** Lista por cursor (auditoria e logs técnicos): `?cursor=&limite=` → `{ itens, proximoCursor }`. */
export interface PaginaCursor<T> {
  readonly itens: readonly T[];
  /** `null` quando não há mais nada para carregar. */
  readonly proximoCursor: string | null;
}

export interface ParametrosPagina {
  readonly pagina?: number;
  readonly porPagina?: number;
}

/** Tamanho de página padrão da API. */
export const POR_PAGINA_PADRAO = 20;
/** Tamanho máximo de página que a API aceita. */
export const POR_PAGINA_MAXIMO = 100;

/** Quantas páginas a lista tem (no mínimo 1, para a paginação não sumir com a lista vazia). */
export function totalDePaginas(pagina: Pick<Pagina<unknown>, 'total' | 'porPagina'>): number {
  return Math.max(1, Math.ceil(pagina.total / Math.max(1, pagina.porPagina)));
}

/** "21–40 de 135" — o intervalo de itens mostrado numa página. */
export function intervaloDaPagina(pagina: Pagina<unknown>): string {
  if (pagina.total === 0 || pagina.itens.length === 0) {
    return `0 de ${pagina.total}`;
  }
  const inicio = (pagina.pagina - 1) * pagina.porPagina + 1;
  const fim = inicio + pagina.itens.length - 1;
  return `${inicio}–${fim} de ${pagina.total}`;
}

type ValorParametro = string | number | boolean | Date | null | undefined;

/**
 * Filtros → query string, sem os vazios: `undefined`, `null`, texto em branco e listas
 * vazias não vão. Listas viram o parâmetro repetido (`?tipo=A&tipo=B`, que a API aceita),
 * booleanos `true`/`false` e datas ISO 8601.
 *
 * ```ts
 * this.http.get<Pagina<Contato>>(urlApi('contatos'), { params: parametros({ busca, pagina }) });
 * ```
 */
export function parametros(
  filtros: Readonly<Record<string, ValorParametro | readonly ValorParametro[]>>,
): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    const valores = Array.isArray(valor) ? valor : [valor];
    for (const item of valores as readonly ValorParametro[]) {
      const texto = paraTexto(item);
      if (texto !== null) {
        params = params.append(chave, texto);
      }
    }
  }
  return params;
}

function paraTexto(valor: ValorParametro): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  }
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}
