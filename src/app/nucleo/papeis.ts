/**
 * Papéis de usuário — espelham o enum `Papel` do banco (crmbrl-api): `ADMIN | C_LEVEL | LIDER | MEMBRO`.
 * Líder e Membro pertencem a um setor (`area` = a chave do setor); Admin e C-level não têm setor.
 */
export const PAPEIS = ['ADMIN', 'C_LEVEL', 'LIDER', 'MEMBRO'] as const;

export type Papel = (typeof PAPEIS)[number];

/** Rótulo genérico do papel (sem o setor). Para o rótulo completo use `rotuloDoPapel`. */
export const ROTULO_PAPEL: Readonly<Record<Papel, string>> = {
  ADMIN: 'Admin',
  C_LEVEL: 'C-level',
  LIDER: 'Líder',
  MEMBRO: 'Membro',
};

/** Todos os papéis, na ordem de exibição. */
export const TODOS_OS_PAPEIS: readonly Papel[] = PAPEIS;

/** Papéis que pertencem a um setor. */
export const PAPEIS_DE_SETOR: readonly Papel[] = ['LIDER', 'MEMBRO'];

/** Quem tem papel e setor (usuário da sessão, resumo de usuário, linha de equipe…). */
export interface QuemTemPapel {
  readonly papel: Papel;
  readonly area?: string | null;
}

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}

/** Papel que exige setor (Líder e Membro). */
export function papelExigeSetor(papel: Papel | null | undefined): boolean {
  return papel === 'LIDER' || papel === 'MEMBRO';
}

export function ehAdmin(quem: QuemTemPapel | null | undefined): boolean {
  return quem?.papel === 'ADMIN';
}

/** Admin ou C-level (a diretoria). */
export function ehDiretoria(quem: QuemTemPapel | null | undefined): boolean {
  return quem?.papel === 'ADMIN' || quem?.papel === 'C_LEVEL';
}

export function ehLider(quem: QuemTemPapel | null | undefined): boolean {
  return quem?.papel === 'LIDER';
}

export function ehMembro(quem: QuemTemPapel | null | undefined): boolean {
  return quem?.papel === 'MEMBRO';
}

/** Líder do setor `area`. */
export function ehLiderDe(quem: QuemTemPapel | null | undefined, area: string): boolean {
  return quem?.papel === 'LIDER' && quem.area === area;
}

/** Membro do setor `area`. */
export function ehMembroDe(quem: QuemTemPapel | null | undefined, area: string): boolean {
  return quem?.papel === 'MEMBRO' && quem.area === area;
}

/** Líder ou membro do setor `area`. */
export function ehDoSetor(quem: QuemTemPapel | null | undefined, area: string): boolean {
  return papelExigeSetor(quem?.papel) && quem?.area === area;
}

/**
 * Rótulo do papel: "Líder Comercial", "Customer Success" (membro), "Admin", "C-level". Prefira o
 * `rotuloPapel` que vem da API; este serve quando só há papel e nome do setor.
 */
export function rotuloDoPapel(papel: Papel, nomeSetor?: string | null): string {
  if (papel === 'LIDER') {
    return nomeSetor ? `Líder ${nomeSetor}` : 'Líder';
  }
  if (papel === 'MEMBRO') {
    return nomeSetor || 'Membro';
  }
  return ROTULO_PAPEL[papel];
}

/** Rótulo vindo da API quando houver; senão monta de papel e setor. */
export function rotuloDe(
  quem: QuemTemPapel & { readonly rotuloPapel?: string | null; readonly nomeSetor?: string | null },
): string {
  return quem.rotuloPapel || rotuloDoPapel(quem.papel, quem.nomeSetor);
}

/** "Admin, C-level e Líder" — para textos como "quem acessa este módulo". */
export function listarPapeis(papeis: readonly Papel[]): string {
  const rotulos = papeis.map((papel) => ROTULO_PAPEL[papel]);
  if (rotulos.length <= 1) {
    return rotulos.join('');
  }
  return `${rotulos.slice(0, -1).join(', ')} e ${rotulos[rotulos.length - 1]}`;
}
