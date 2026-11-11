import { signal } from '@angular/core';

import { rotuloDoPapel, type QuemTemPapel } from '../papeis';

/** Cores aceitas pela API para um setor (os tons do `app-selo`). */
export type CorDoSetor = 'ciano' | 'menta' | 'lima' | 'coral' | 'neutro';

/** `SetorDto` do `GET /setores`. `lideres` e `contagens` só vêm para Admin e C-level. */
export interface Setor {
  readonly chave: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: CorDoSetor | string | null;
  readonly base: boolean;
  readonly ativo: boolean;
  readonly ordem: number;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly lideres: readonly { readonly id: string; readonly nome: string }[] | null;
  readonly contagens: { readonly usuariosAtivos: number; readonly funisAtivos: number } | null;
}

/** Chaves dos setores de base: comportamentos presos a eles (Financeiro, régua, BI, SDR). */
export const SETOR_MARKETING = 'MARKETING';
export const SETOR_COMERCIAL = 'COMERCIAL';
export const SETOR_CS = 'CS';
export const CHAVES_BASE: readonly string[] = [SETOR_MARKETING, SETOR_COMERCIAL, SETOR_CS];

/** Nome usado enquanto a lista não chegou (e para os setores de base). */
const NOME_BASE: Readonly<Record<string, string>> = {
  MARKETING: 'Marketing',
  COMERCIAL: 'Comercial',
  CS: 'Customer Success',
};

/** Registro reativo chave → setor, alimentado pelo `SetoresService` (e pelos testes). */
const registro = signal<ReadonlyMap<string, Setor>>(new Map());

export function definirRegistroDeSetores(setores: readonly Setor[]): void {
  registro.set(new Map(setores.map((setor) => [setor.chave, setor])));
}

/** O setor já carregado pela chave (lê signal), ou `undefined` se a lista não chegou ou não o tem. */
export function setorCarregado(chave: string | null | undefined): Setor | undefined {
  return chave ? registro().get(chave) : undefined;
}

/** Setores ativos já carregados (lê signal); vazio antes de o `SetoresService` carregar. */
export function setoresAtivosCarregados(): readonly Setor[] {
  return [...registro().values()].filter((setor) => setor.ativo);
}

/** "POS_VENDA" → "Pos venda": último recurso quando o setor não está na lista. */
function humanizar(chave: string): string {
  const texto = chave.toLowerCase().replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Nome do setor pela chave (lê signal: reativo em templates e `computed`). Setor inativo continua
 * com nome quando a lista foi pedida com inativos; senão cai no nome de base ou na chave.
 */
export function nomeDoSetor(chave: string | null | undefined): string {
  if (!chave) {
    return '';
  }
  return registro().get(chave)?.nome ?? NOME_BASE[chave] ?? humanizar(chave);
}

/** Cor do setor (token do `app-selo`) ou `null`. */
export function corDoSetor(chave: string | null | undefined): string | null {
  return chave ? (registro().get(chave)?.cor ?? null) : null;
}

/** Pedaço da URL do funil de um setor: `/funis/comercial`, `/funis/pos_venda`. */
export function slugDaArea(chave: string): string {
  return chave.toLowerCase();
}

/** `"comercial"` → `"COMERCIAL"`; texto que não parece chave de setor → `null`. */
export function areaDoSlug(slug: string | null | undefined): string | null {
  return slug && /^[a-z0-9_]{1,40}$/i.test(slug) ? slug.toUpperCase() : null;
}

/**
 * Posição do setor na jornada do cliente: a `ordem` dos setores ativos (os de base são 1, 2 e 3;
 * os novos vêm depois). Setor desconhecido ou inativo vai para o fim. Sem a lista carregada, os
 * de base seguem a ordem Marketing, Comercial, CS.
 */
export function posicaoNaJornada(chave: string): number {
  const setor = registro().get(chave);
  if (setor) {
    return setor.ativo ? setor.ordem : Number.MAX_SAFE_INTEGER;
  }
  const base = CHAVES_BASE.indexOf(chave);
  return base === -1 ? Number.MAX_SAFE_INTEGER : base + 1;
}

/** Compara dois setores pela jornada; empate (os do fim) pelo nome. */
export function compararNaJornada(a: string, b: string): number {
  return (
    posicaoNaJornada(a) - posicaoNaJornada(b) ||
    nomeDoSetor(a).localeCompare(nomeDoSetor(b), 'pt-BR')
  );
}

/** Setores de base primeiro (Marketing, Comercial, CS), os demais por nome. */
export function ordemDoSetor(chave: string): number {
  const indice = CHAVES_BASE.indexOf(chave);
  return indice === -1 ? CHAVES_BASE.length : indice;
}

/** "Líder Comercial", "Customer Success"… a partir do papel e da chave do setor da pessoa. */
export function rotuloDaPessoa(quem: QuemTemPapel): string {
  return rotuloDoPapel(quem.papel, quem.area ? nomeDoSetor(quem.area) : null);
}
