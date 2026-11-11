import { ehDiretoria, ehLider, type QuemTemPapel } from '../../../nucleo/papeis';

/** Quem cria funil (R5.1): Admin e C-level em qualquer setor; o líder, no próprio. */
export function podeCriarFunil(quem: QuemTemPapel | null | undefined): boolean {
  return ehDiretoria(quem) || ehLider(quem);
}
