import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

import { fraseDigitando } from './mensagens';

/**
 * "Fulano está digitando…" (DESIGN-SYSTEM.md §4.6): três pontos numa pílula com a cor da bolha
 * de entrada e a frase ao lado. Os pontos ondulam quatro vezes (menos de 5 s) e param; cada
 * mudança em `nomes` recomeça. Sem ninguém digitando, não mostra nada — mas a região viva
 * (`role="status"`) continua no lugar, para o leitor de tela anunciar quando alguém começa.
 *
 * ```html
 * <app-digitando [nomes]="['Maria']" />
 * ```
 */
@Component({
  selector: 'app-digitando',
  template: `
    @if (frase()) {
      @for (rodada of [rodada()]; track rodada) {
        <span class="digitando__pontos" aria-hidden="true"><i></i><i></i><i></i></span>
      }
      <span class="digitando__frase">{{ frase() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .digitando__pontos {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);

      i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.45;
        animation: onda-digitando 1.2s var(--curva) 4;

        &:nth-child(2) {
          animation-delay: 0.15s;
        }

        &:nth-child(3) {
          animation-delay: 0.3s;
        }
      }
    }

    @keyframes onda-digitando {
      30% {
        opacity: 1;
        transform: translateY(-3px);
      }

      60% {
        opacity: 0.45;
        transform: none;
      }
    }

    .digitando__frase {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'digitando',
    role: 'status',
  },
})
export class Digitando {
  /** Quem está digitando (vazio: nada aparece). */
  readonly nomes = input<readonly string[]>([]);

  protected readonly frase = computed(() => fraseDigitando(this.nomes()));
  /** Muda a cada novo `nomes`: recria os pontos e a animação recomeça. */
  protected readonly rodada = linkedSignal<readonly string[], number>({
    source: this.nomes,
    computation: (_nomes, anterior) => (anterior?.value ?? 0) + 1,
  });
}
