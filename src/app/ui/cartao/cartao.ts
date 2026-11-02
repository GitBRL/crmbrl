import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { Dica } from '../dica/dica';
import { gerarId, partirTitulo } from '../tipos';

export type VarianteCartao = 'padrao' | 'palco' | 'destaque';

/**
 * Cartão (DESIGN-SYSTEM.md §4): superfície com raio grande e padding de 24px.
 * - `padrao`: `--cor-superficie`;
 * - `palco`: o cartão principal da tela, com os brilhos do `--gradiente-palco` e raio 36px.
 *   Dentro dele as superfícies 2/3 viram vidro translúcido (pílulas, selos e botões-ícone
 *   neutros deixam o gradiente aparecer, como na referência);
 * - `destaque`: coral com listras diagonais; dentro dele texto, bordas e superfícies viram
 *   tons de preto, então os componentes se adaptam sozinhos.
 *
 * Cabeçalho opcional: `titulo` (+ `complemento` em segundo tom; com "· " no início, o ponto
 * fica no fim da primeira linha e o complemento desce inteiro), `dica` e ações projetadas
 * com o atributo `cartao-acoes`.
 */
@Component({
  selector: 'app-cartao',
  imports: [Dica, NgTemplateOutlet],
  template: `
    @if (titulo(); as titulo) {
      <header class="cartao__cabecalho">
        <div class="cartao__titulo">
          @switch (nivel()) {
            @case (3) {
              <h3 class="cartao__h" [id]="idTitulo">
                <ng-container [ngTemplateOutlet]="conteudoTitulo" />
              </h3>
            }
            @case (4) {
              <h4 class="cartao__h" [id]="idTitulo">
                <ng-container [ngTemplateOutlet]="conteudoTitulo" />
              </h4>
            }
            @default {
              <h2 class="cartao__h" [id]="idTitulo">
                <ng-container [ngTemplateOutlet]="conteudoTitulo" />
              </h2>
            }
          }
          @if (dica(); as dica) {
            <app-dica [texto]="dica" [rotulo]="'Sobre: ' + titulo" />
          }
        </div>
        <div class="cartao__acoes"><ng-content select="[cartao-acoes]" /></div>
      </header>
    }
    <ng-content />

    <!-- Título em dois tons: as três partes coladas, sem espaço entre elas (§2.3). -->
    <ng-template #conteudoTitulo
      >{{ partes().principal }}<span class="tom-fraco">{{ partes().ponto }}</span
      ><span class="tom-fraco sem-quebra">{{ partes().complemento }}</span></ng-template
    >
  `,
  styleUrl: './cartao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cartao',
    '[class.cartao--palco]': "variante() === 'palco'",
    '[class.cartao--destaque]': "variante() === 'destaque'",
    '[attr.role]': 'regiao() && titulo() ? "region" : null',
    '[attr.aria-labelledby]': 'regiao() && titulo() ? idTitulo : null',
  },
})
export class Cartao {
  readonly variante = input<VarianteCartao>('padrao');
  readonly titulo = input<string | null>(null);
  /** Segundo tom do título ("· outubro"). */
  readonly complemento = input<string | null>(null);
  /** Nível do título no documento (o visual é sempre o h3 do design system). */
  readonly nivel = input<2 | 3 | 4>(2);
  readonly dica = input<string | null>(null);
  /** Marca o cartão como região nomeada pelo título (landmark), para blocos principais. */
  readonly regiao = input(false, { transform: booleanAttribute });

  protected readonly idTitulo = gerarId('cartao-titulo');
  protected readonly partes = computed(() => partirTitulo(this.titulo() ?? '', this.complemento()));
}
