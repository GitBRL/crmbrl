import { POR_PAGINA_PADRAO } from '../../nucleo/api/api';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import type { Ordenacao } from '../../ui/tabela/tabela';
import type { UsuarioResumo } from './contatos.tipos';

/**
 * Estado das listas de pessoas e empresas, guardado na URL (`/contatos?aba=empresas&busca=…`):
 * voltar do detalhe para a lista mantém busca, filtros, ordem e página, e o link pode ser
 * compartilhado.
 */
export type AbaContatos = 'pessoas' | 'empresas';

/** Filtro de opt-out de marketing (R4.6). */
export type FiltroMarketing = 'optout' | 'recebe';

export interface ConsultaLista {
  readonly busca: string;
  /** `meus`, `sem` (sem responsável) ou o id do usuário. */
  readonly responsavel: string | null;
  readonly origem: string | null;
  readonly etiqueta: string | null;
  readonly marketing: FiltroMarketing | null;
  readonly uf: string | null;
  readonly ordem: Ordenacao | null;
  readonly pagina: number;
  readonly porPagina: number;
}

/** Os parâmetros da URL como chegam (inputs da rota). */
export interface ParametrosConsulta {
  readonly busca?: string | null;
  readonly responsavel?: string | null;
  readonly origem?: string | null;
  readonly etiqueta?: string | null;
  readonly marketing?: string | null;
  readonly uf?: string | null;
  readonly ordem?: string | null;
  readonly pagina?: string | number | null;
  readonly porPagina?: string | number | null;
}

export const OPCOES_POR_PAGINA: readonly number[] = [20, 50, 100];

function inteiro(valor: string | number | null | undefined, padrao: number): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

function texto(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/** `"nome.asc"` ↔ `{ coluna: 'nome', direcao: 'asc' }`. */
export function lerOrdem(valor: string | null | undefined): Ordenacao | null {
  const [coluna, direcao] = (valor ?? '').split('.');
  return coluna && (direcao === 'asc' || direcao === 'desc') ? { coluna, direcao } : null;
}

export function escreverOrdem(ordem: Ordenacao | null): string | null {
  return ordem ? `${ordem.coluna}.${ordem.direcao}` : null;
}

export function lerConsulta(parametros: ParametrosConsulta): ConsultaLista {
  const marketing = parametros.marketing;
  const porPagina = inteiro(parametros.porPagina, POR_PAGINA_PADRAO);
  return {
    busca: parametros.busca?.trim() ?? '',
    responsavel: texto(parametros.responsavel),
    origem: texto(parametros.origem),
    etiqueta: texto(parametros.etiqueta),
    marketing: marketing === 'optout' || marketing === 'recebe' ? marketing : null,
    uf: texto(parametros.uf),
    ordem: lerOrdem(parametros.ordem),
    pagina: inteiro(parametros.pagina, 1),
    porPagina: OPCOES_POR_PAGINA.includes(porPagina) ? porPagina : POR_PAGINA_PADRAO,
  };
}

/**
 * Mudança na consulta → query params (`null` tira o parâmetro). Mudar qualquer filtro volta
 * à página 1, salvo quando a própria mudança é de página.
 */
export function paraQueryParams(
  mudanca: Partial<ConsultaLista>,
): Record<string, string | number | null> {
  const params: Record<string, string | number | null> = {};
  for (const [chave, valor] of Object.entries(mudanca)) {
    if (chave === 'ordem') {
      params['ordem'] = escreverOrdem(valor as Ordenacao | null);
    } else if (chave === 'pagina') {
      params['pagina'] = valor === 1 ? null : (valor as number);
    } else if (chave === 'porPagina') {
      params['porPagina'] = valor === POR_PAGINA_PADRAO ? null : (valor as number);
    } else {
      params[chave] = valor === '' || valor === undefined ? null : (valor as string | null);
    }
  }
  if (!('pagina' in mudanca)) {
    params['pagina'] = null;
  }
  return params;
}

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto com cara de UUID (os ids da API). */
export function ehUuid(valor: string | null | undefined): valor is string {
  return !!valor && PADRAO_UUID.test(valor);
}

/**
 * Filtro de responsável da URL → parâmetros da API: `meus` é quem está logado, `sem` são os
 * sem responsável e um id é aquele usuário (outro texto é ignorado).
 */
export function filtroDeResponsavel(
  responsavel: string | null,
  euId: string | null,
): { readonly responsavelId: string | null; readonly semResponsavel: boolean | null } {
  if (responsavel === 'sem') {
    return { responsavelId: null, semResponsavel: true };
  }
  if (responsavel === 'meus') {
    return { responsavelId: euId, semResponsavel: null };
  }
  return { responsavelId: ehUuid(responsavel) ? responsavel : null, semResponsavel: null };
}

/** Algum filtro (além da busca) ligado? */
export function temFiltros(consulta: ConsultaLista): boolean {
  return !!(
    consulta.responsavel ||
    consulta.origem ||
    consulta.etiqueta ||
    consulta.marketing ||
    consulta.uf
  );
}

/** Opções do filtro de responsável: os meus, os sem responsável e cada usuário que a pessoa vê. */
export function opcoesDeResponsavel(
  usuarios: readonly UsuarioResumo[],
  euId: string | null,
): readonly OpcaoSeletor<string>[] {
  const outros = usuarios
    .filter((usuario) => usuario.id !== euId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((usuario) => ({ valor: usuario.id, rotulo: usuario.nome }));
  return [
    { valor: 'meus', rotulo: 'Meus' },
    { valor: 'sem', rotulo: 'Sem responsável' },
    ...outros,
  ];
}
