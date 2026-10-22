import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Dica } from '../dica/dica';

/**
 * Moldura de um campo (DESIGN-SYSTEM.md §4.2): rótulo ligado ao controle (`for`), dica em
 * balão opcional ao lado do rótulo, o controle projetado, o texto de ajuda e o erro. Os ids
 * da ajuda e do erro vêm do campo, que os põe no `aria-describedby` do controle.
 *
 * Usada por todos os campos de `ui/`; uma tela pode usá-la em volta de um controle próprio
 * (ex.: busca de contato com sugestões) para ter o mesmo rótulo, ajuda e erro.
 */
@Component({
  selector: 'app-moldura-campo',
  imports: [Dica],
  template: `
    <div class="moldura__topo" [class.visualmente-oculto]="rotuloOculto()">
      <label class="moldura__rotulo" [for]="paraId()"
        >{{ rotulo() }}
        @if (opcional()) {
          <span class="moldura__opcional"> (opcional)</span>
        }
      </label>
      @if (ajuda(); as texto) {
        <app-dica [rotulo]="'Sobre ' + rotulo()" [texto]="texto" />
      }
    </div>
    <ng-content />
    @if (erro(); as mensagem) {
      <p class="moldura__erro" [id]="idErro()">{{ mensagem }}</p>
    }
    @if (dica(); as texto) {
      <p class="moldura__dica" [id]="idDica()">{{ texto }}</p>
    }
  `,
  styleUrl: './moldura-campo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moldura' },
})
export class MolduraCampo {
  readonly rotulo = input.required<string>();
  /** Id do controle que o rótulo nomeia. */
  readonly paraId = input.required<string>();
  readonly idDica = input<string | null>(null);
  readonly idErro = input<string | null>(null);
  readonly dica = input<string | null>(null);
  /** Mensagem de erro já resolvida (vazia: sem erro). */
  readonly erro = input<string | null>(null);
  readonly ajuda = input<string | null>(null);
  readonly opcional = input(false, { transform: booleanAttribute });
  readonly rotuloOculto = input(false, { transform: booleanAttribute });
}
