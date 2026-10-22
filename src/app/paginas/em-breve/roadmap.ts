/**
 * Fases do roadmap do CRM, como aprovadas em 2026-10-20. A fase de cada módulo fica em
 * `nucleo/navegacao.ts` (`modulo.fase`); aqui só os nomes, para a página "em breve".
 */
export interface FaseRoadmap {
  readonly numero: number;
  readonly nome: string;
  readonly concluida: boolean;
}

/** As fases, na ordem de entrega. As Fases 0 (base) e 1 (núcleo do CRM) estão no ar. */
export const FASES_ROADMAP: readonly FaseRoadmap[] = [
  { numero: 0, nome: 'Base', concluida: true },
  { numero: 1, nome: 'Núcleo do CRM', concluida: true },
  { numero: 2, nome: 'Atendimento e comunicação', concluida: false },
  { numero: 3, nome: 'BI', concluida: false },
  { numero: 4, nome: 'Financeiro', concluida: false },
  { numero: 5, nome: 'Assistente de IA e chamados', concluida: false },
  { numero: 6, nome: 'App mobile (PWA)', concluida: false },
];

/** "Fase 2" → 2; texto sem número → `null`. */
export function numeroDaFase(fase: string | null | undefined): number | null {
  const encontrado = fase?.match(/\d+/);
  return encontrado ? Number(encontrado[0]) : null;
}

/**
 * "a Fase 0 (base) já está no ar", "as Fases 0 (base) e 1 (núcleo do CRM) já estão no ar":
 * a frase da dica do roadmap, a partir das fases concluídas.
 */
export function frasesNoAr(fases: readonly FaseRoadmap[] = FASES_ROADMAP): string {
  const noAr = fases.filter((fase) => fase.concluida);
  if (!noAr.length) {
    return 'nenhuma fase está no ar ainda';
  }
  // Só a inicial em minúscula: "Núcleo do CRM" → "núcleo do CRM".
  const nome = (texto: string) => texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1);
  const nomes = noAr.map((fase) => `${fase.numero} (${nome(fase.nome)})`);
  if (nomes.length === 1) {
    return `a Fase ${nomes[0]} já está no ar`;
  }
  return `as Fases ${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)} já estão no ar`;
}
