import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de progresso de uma campanha (0 a 100), com texto para leitores de tela. */
@Component({
  selector: 'app-barra-progresso',
  template: `
    <div
      class="barra"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="valorArredondado()"
      [attr.aria-label]="rotulo()"
    >
      <span class="barra__preenchimento" [style.width.%]="valorArredondado()"></span>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 6rem;
    }

    .barra {
      height: 0.5rem;
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-3);
      overflow: hidden;
    }

    .barra__preenchimento {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--cor-marca);
      transition: width var(--duracao-lenta) var(--curva);
    }

    @media (prefers-reduced-motion: reduce) {
      .barra__preenchimento {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraProgresso {
  readonly valor = input.required<number>();
  readonly rotulo = input('Progresso da campanha');

  protected readonly valorArredondado = computed(() =>
    Math.max(0, Math.min(100, Math.round(this.valor()))),
  );
}
