import { ehDiretoria, ehLiderDe, ehMembroDe, type QuemTemPapel } from '../../nucleo/papeis';
import { SETOR_COMERCIAL, SETOR_CS, SETOR_MARKETING } from '../../nucleo/setores/setores';

/**
 * Financeiro e régua: comportamentos presos às chaves dos setores de base (CS cuida da carteira,
 * Comercial só consulta, Marketing não acessa). Setores novos não entram aqui.
 */

/** Cria contratos e parcelas e usa a régua: Admin, C-level e o setor CS (líder e membro). */
export function ehCarteiraDeCs(quem: QuemTemPapel | null | undefined): boolean {
  return ehDiretoria(quem) || ehLiderDe(quem, SETOR_CS) || ehMembroDe(quem, SETOR_CS);
}

/** Importa e baixa parcelas: Admin, C-level e o líder de CS. */
export function ehGestorDaCarteira(quem: QuemTemPapel | null | undefined): boolean {
  return ehDiretoria(quem) || ehLiderDe(quem, SETOR_CS);
}

/** Comercial (líder e membro) só consulta os contratos que ganhou. */
export function ehConsultaComercial(quem: QuemTemPapel | null | undefined): boolean {
  return ehLiderDe(quem, SETOR_COMERCIAL) || ehMembroDe(quem, SETOR_COMERCIAL);
}

/** O setor de Marketing não tem acesso ao Financeiro. */
export function ehDoMarketing(quem: QuemTemPapel | null | undefined): boolean {
  return ehLiderDe(quem, SETOR_MARKETING) || ehMembroDe(quem, SETOR_MARKETING);
}
