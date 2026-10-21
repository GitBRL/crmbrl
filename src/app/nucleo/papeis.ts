/**
 * Papéis de usuário — espelham o enum `Papel` do banco (crmbrl-api, prisma/schema.prisma).
 */
export const PAPEIS = [
  'ADMIN',
  'C_LEVEL',
  'LIDER_COMERCIAL',
  'COMERCIAL',
  'LIDER_MARKETING',
  'MARKETING',
  'LIDER_CS',
  'CS',
] as const;

export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Readonly<Record<Papel, string>> = {
  ADMIN: 'Admin',
  C_LEVEL: 'C-level',
  LIDER_COMERCIAL: 'Líder Comercial',
  COMERCIAL: 'Comercial',
  LIDER_MARKETING: 'Líder Marketing',
  MARKETING: 'Marketing',
  LIDER_CS: 'Líder CS',
  CS: 'CS',
};

/** Todos os papéis, na ordem de exibição. */
export const TODOS_OS_PAPEIS: readonly Papel[] = PAPEIS;

/** Líderes de área (Comercial, Marketing e CS). */
export const LIDERES: readonly Papel[] = ['LIDER_COMERCIAL', 'LIDER_MARKETING', 'LIDER_CS'];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}

/** "Admin, C-level e Líder Comercial" — para textos como "quem acessa este módulo". */
export function listarPapeis(papeis: readonly Papel[]): string {
  const rotulos = papeis.map((papel) => ROTULO_PAPEL[papel]);
  if (rotulos.length <= 1) {
    return rotulos.join('');
  }
  return `${rotulos.slice(0, -1).join(', ')} e ${rotulos[rotulos.length - 1]}`;
}
