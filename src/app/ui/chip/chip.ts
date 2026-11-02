import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideCalendarDays, LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

export type TipoChip = 'texto' | 'numero' | 'data';

/**
 * Chip de campo (DESIGN-SYSTEM.md §4): pílula 36px com selo circular de tipo à esquerda
 * ("A" texto, "#" número, calendário para data) — os campos da referência.
 * É visual; para um chip clicável, coloque-o dentro de um `<button>`.
 * `arrastavel` liga o arrastar nativo (`draggable`); `arrastando` é o visual do item em voo.
 * `multilinha` deixa o rótulo longo quebrar a linha em vez de cortar com reticências.
 */
@Component({
  selector: 'app-chip',
  imports: [LucideDynamicIcon, LucideCalendarDays],
  template: `
    @if (icone(); as iconeAtual) {
      <span class="chip__tipo" aria-hidden="true"
        ><svg [lucideIcon]="iconeAtual" [size]="14"
      /></span>
    } @else if (tipo() === 'data') {
      <span class="chip__tipo" aria-hidden="true"><svg lucideCalendarDays [size]="14" /></span>
    } @else if (tipo()) {
      <span class="chip__tipo" aria-hidden="true">{{ tipo() === 'numero' ? '#' : 'A' }}</span>
    }
    <span class="chip__rotulo"><ng-content /></span>
  `,
  styleUrl: './chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'chip',
    '[class.chip--com-tipo]': 'icone() !== null || tipo() !== null',
    '[class.chip--selecionado]': 'selecionado()',
    '[class.chip--arrastando]': 'arrastando()',
    '[class.chip--arrastavel]': 'arrastavel()',
    '[class.chip--multilinha]': 'multilinha()',
    '[attr.draggable]': "arrastavel() ? 'true' : null",
  },
})
export class Chip {
  readonly tipo = input<TipoChip | null>(null);
  /** Ícone no lugar do selo de tipo. */
  readonly icone = input<LucideIconInput | null>(null);
  readonly selecionado = input(false, { transform: booleanAttribute });
  readonly arrastando = input(false, { transform: booleanAttribute });
  readonly arrastavel = input(false, { transform: booleanAttribute });
  /** Rótulo longo quebra em mais de uma linha (listas de funcionalidades, descrições). */
  readonly multilinha = input(false, { transform: booleanAttribute });
}
