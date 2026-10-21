import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Legenda de séries (DESIGN-SYSTEM.md §6): bolinhas nas cores de dado, na ordem fixa
 * (ciano, menta, lima, coral), com o nome de cada série. Acompanha barras de funil e gráficos.
 */
@Component({
  selector: 'app-legenda',
  template: `
    <ul class="legenda__lista" role="list">
      @for (serie of series(); track $index) {
        <li class="legenda__item">
          <span
            class="legenda__ponto"
            aria-hidden="true"
            [attr.data-serie]="($index % 4) + 1"
          ></span>
          {{ serie }}
        </li>
      }
    </ul>
  `,
  styleUrl: './legenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'legenda' },
})
export class Legenda {
  /** Nomes das séries, na ordem dos dados. */
  readonly series = input.required<readonly string[]>();
}
