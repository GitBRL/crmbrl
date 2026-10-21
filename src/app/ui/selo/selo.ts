import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

export type VarianteSelo = 'neutro' | 'ciano' | 'menta' | 'lima' | 'coral' | 'contorno';

/**
 * Selo (DESIGN-SYSTEM.md §4): pílula 24px, 12/500 — tempos ("4d"), variações, status.
 * Nas cores de dado o texto é sempre preto. Nada depende só de cor: escreva o significado.
 * `tamanho="sm"`: 20px, 11/500, para listas densas (o "em breve" da navegação).
 * `ponto` mostra um ponto que pulsa três vezes antes do texto (ex.: "ao vivo"); a cor sai de
 * `--selo-ponto` (padrão: a cor do texto), ex.: `--selo-ponto: var(--cor-sucesso)`.
 */
@Component({
  selector: 'app-selo',
  imports: [LucideDynamicIcon],
  template: `
    @if (ponto()) {
      <span class="selo__ponto" aria-hidden="true"></span>
    }
    @if (icone(); as iconeAtual) {
      <svg [lucideIcon]="iconeAtual" [size]="14" />
    }
    <ng-content />
  `,
  styleUrl: './selo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'selo',
    '[class]': "'selo--' + variante()",
    '[class.selo--sm]': "tamanho() === 'sm'",
  },
})
export class Selo {
  readonly variante = input<VarianteSelo>('neutro');
  readonly tamanho = input<'sm' | 'md'>('md');
  readonly icone = input<LucideIconInput | null>(null);
  readonly ponto = input(false, { transform: booleanAttribute });
}
