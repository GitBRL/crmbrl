import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { partirTitulo } from '../../ui/tipos';

/**
 * Seção do catálogo: número em pílula lima, título h2 em dois tons, uma frase (projetada com
 * o atributo `frase`) e o conteúdo. É uma região nomeada pelo título e o alvo da âncora do
 * índice (`ancora` vira o id). Uso interno de paginas/design-system.
 */
@Component({
  selector: 'app-ds-secao',
  template: `
    <header class="secao__cabecalho">
      <span class="secao__numero" aria-hidden="true">{{ numero() }}</span>
      <!-- Título em dois tons: as três partes coladas, sem espaço entre elas (§2.3). -->
      <h2 class="secao__titulo" [id]="idTitulo()">
        {{ partes().principal }}<span class="tom-fraco">{{ partes().ponto }}</span
        ><span class="tom-fraco sem-quebra">{{ partes().complemento }}</span>
      </h2>
      <div class="secao__frase"><ng-content select="[frase]" /></div>
    </header>
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--esp-6);
      scroll-margin-top: var(--esp-6);
    }

    .secao__cabecalho {
      display: grid;
      justify-items: start;
      gap: var(--esp-3);
      max-width: 780px;
    }

    /* Pílula lima: no claro, o contorno de dado (lima sobre o fundo claro dá 1,1:1). */
    .secao__numero {
      padding: 4px 10px;
      border-radius: var(--raio-pilula);
      background: var(--cor-marca);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
      color: var(--cor-sobre-marca);
      font: var(--fonte-micro);
    }

    .secao__titulo {
      font: var(--fonte-h1);
      letter-spacing: var(--tracking-titulo);
    }

    .secao__frase {
      max-width: 68ch;
      color: var(--cor-texto-suave);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.id]': 'ancora()',
    '[attr.aria-labelledby]': 'idTitulo()',
  },
})
export class Secao {
  /** Id da seção (alvo do índice: `/design-system#cores`). */
  readonly ancora = input.required<string>();
  readonly numero = input.required<string>();
  readonly titulo = input.required<string>();
  /** Segundo tom do título ("· paleta e tokens"): curto, até três palavras. */
  readonly complemento = input('');

  protected readonly idTitulo = computed(() => `titulo-${this.ancora()}`);
  protected readonly partes = computed(() => partirTitulo(this.titulo(), this.complemento()));
}
