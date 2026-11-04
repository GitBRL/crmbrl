import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { type AplicativoIntegracao, logotipoDoAplicativo } from '../tipos';

/**
 * Logotipo de um aplicativo de integração sobre um bloco claro, que mantém as cores da marca
 * também no tema escuro. Decorativo (`alt=""`): o nome do aplicativo sempre aparece ao lado.
 *
 * `<app-logotipo-aplicativo aplicativo="ELEMENTOR" tamanho="lg" />`
 */
@Component({
  selector: 'app-logotipo-aplicativo',
  template: `<img [src]="arquivo()" alt="" loading="lazy" decoding="async" draggable="false" />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 5.25rem;
      height: 2.25rem;
      padding: 0.3rem 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: var(--raio-md);
      background: #fff;
    }

    :host(.logotipo--lg) {
      width: 100%;
      height: 4.5rem;
      padding: 0.75rem 1rem;
    }

    :host(.logotipo--md) {
      width: 4.5rem;
      height: 2.75rem;
      padding: 0.4rem 0.6rem;
    }

    img {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  `,
  host: { '[class]': 'classe()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogotipoAplicativo {
  readonly aplicativo = input.required<AplicativoIntegracao>();
  readonly tamanho = input<'sm' | 'md' | 'lg'>('sm');

  protected readonly arquivo = computed(() => logotipoDoAplicativo(this.aplicativo()));
  protected readonly classe = computed(() => `logotipo--${this.tamanho()}`);
}
