/**
 * Fases do roadmap do CRM, como aprovadas em 2026-10-20. A fase de cada módulo fica em
 * `nucleo/navegacao.ts` (`modulo.fase`); aqui só os nomes, para a página "em breve".
 */
export interface FaseRoadmap {
  readonly numero: number;
  readonly nome: string;
  readonly concluida: boolean;
}

/** As fases, na ordem de entrega. A Fase 0 (base) é a que está no ar. */
export const FASES_ROADMAP: readonly FaseRoadmap[] = [
  { numero: 0, nome: 'Base', concluida: true },
  { numero: 1, nome: 'Núcleo do CRM', concluida: false },
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
