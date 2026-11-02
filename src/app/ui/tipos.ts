/** Tamanhos de controle (DESIGN-SYSTEM.md §2.6): sm 36px · md 44px · lg 52px. */
export type TamanhoControle = 'sm' | 'md' | 'lg';

/** Tamanho do ícone Lucide em cada tamanho de controle. */
export const TAMANHO_ICONE: Readonly<Record<TamanhoControle, number>> = { sm: 16, md: 20, lg: 22 };

/** Cores de dado (`--dado-1`…`--dado-4`), na ordem fixa das séries. */
export type CorDado = 'ciano' | 'menta' | 'lima' | 'coral';

export const CORES_DADO: readonly CorDado[] = ['ciano', 'menta', 'lima', 'coral'];

/**
 * Título em dois tons (DESIGN-SYSTEM.md §2.3) em três partes, para o "·" ficar no fim da
 * primeira linha e o complemento descer inteiro quando o título quebra:
 * `{{ principal }}<span class="tom-fraco">{{ ponto }}</span><span class="tom-fraco sem-quebra">{{ complemento }}</span>`.
 * Escreva as três partes coladas no template (sem espaço nem quebra de linha entre elas).
 */
export interface TituloDoisTons {
  /** Título; termina em espaço inseparável quando há "·" (o ponto não desce sozinho). */
  readonly principal: string;
  /** "· " (o espaço depois do ponto é onde a linha pode quebrar) ou vazio. */
  readonly ponto: string;
  /** Complemento sem o "·" inicial; vazio quando não há. */
  readonly complemento: string;
}

export function partirTitulo(titulo: string, complemento?: string | null): TituloDoisTons {
  const texto = complemento?.trim() ?? '';
  if (!texto) {
    return { principal: titulo, ponto: '', complemento: '' };
  }
  const semPonto = texto.replace(/^·\s*/, '');
  return semPonto === texto
    ? { principal: `${titulo} `, ponto: '', complemento: texto }
    : { principal: `${titulo}\u00a0`, ponto: '· ', complemento: semPonto };
}

let contadorIds = 0;

/** Id único para ligar elementos por `aria-*` (`abas-3`, `dica-7`…). */
export function gerarId(prefixo: string): string {
  contadorIds += 1;
  return `${prefixo}-${contadorIds}`;
}
