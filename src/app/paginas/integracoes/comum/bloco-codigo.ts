import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BotaoCopiar } from './botao-copiar';

/**
 * Bloco de código (JSON, `curl`, exemplo de assinatura): legenda, botão "Copiar" e o texto em
 * fonte monoespaçada, que rola na horizontal dentro do bloco (nunca a página). A área que rola
 * é focável e nomeada pela legenda, para quem usa teclado conseguir rolar.
 *
 * `<app-bloco-codigo rotulo="Exemplo com curl" [codigo]="curl()" oQue="Exemplo" />`
 */
@Component({
  selector: 'app-bloco-codigo',
  imports: [BotaoCopiar],
  template: `
    <figure class="codigo" [class.codigo--compacto]="compacto()">
      <figcaption class="codigo__cabecalho">
        <span class="codigo__rotulo">{{ rotulo() }}</span>
        @if (copiavel()) {
          <app-botao-copiar [texto]="codigo()" [oQue]="oQue()" />
        }
      </figcaption>
      <pre
        class="codigo__texto"
        tabindex="0"
        role="region"
        [attr.aria-label]="rotulo()"
        [style.max-height]="alturaMaxima()"
      ><code>{{ codigo() }}</code></pre>
    </figure>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .codigo {
      display: grid;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
      background: var(--cor-superficie-2);
    }

    .codigo__cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
      min-height: var(--altura-md);
      padding: var(--esp-1) var(--esp-2) var(--esp-1) var(--esp-4);
      border-bottom: 1px solid var(--cor-borda);
    }

    .codigo__rotulo {
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
      font-weight: 500;
    }

    .codigo__texto {
      min-width: 0;
      margin: 0;
      padding: var(--esp-4);
      overflow: auto;
      color: var(--cor-texto);
      font-family: var(--familia-mono);
      font-size: 13px;
      line-height: 1.55;
      white-space: pre;
      tab-size: 2;

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: -2px;
        border-radius: 0 0 var(--raio-md) var(--raio-md);
      }
    }

    .codigo--compacto .codigo__texto {
      padding: var(--esp-3) var(--esp-4);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocoCodigo {
  readonly codigo = input.required<string>();
  /** Legenda visível e nome da região: "Corpo recebido", "Exemplo com curl". */
  readonly rotulo = input.required<string>();
  /** Para o aviso do botão: "Corpo", "Exemplo". */
  readonly oQue = input('Código');
  readonly copiavel = input(true, { transform: booleanAttribute });
  readonly compacto = input(false, { transform: booleanAttribute });
  /** Altura máxima (CSS) antes de rolar; sem ela, o bloco cresce com o texto. */
  readonly alturaMaxima = input<string | null>('24rem');
}
