import { ChangeDetectionStrategy, Component, model } from '@angular/core';

import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { BlocoCodigo } from './comum/bloco-codigo';
import { ValorUnico } from './comum/valor-unico';

/** O que o modal mostra: valores que a API só devolve agora (endereço novo, segredo). */
export interface ResultadoUnicoDados {
  readonly titulo: string;
  readonly texto: string;
  readonly valores: readonly {
    readonly rotulo: string;
    readonly valor: string;
    readonly oQue: string;
  }[];
  /** Exemplo de uso (curl) ou de código, opcional. */
  readonly exemplo?: { readonly rotulo: string; readonly codigo: string } | null;
}

/**
 * Modal que mostra **uma única vez** um endereço ou segredo novo (gerar novo endereço, gerar
 * segredo), com "Copiar" e o exemplo de uso. Fechar não tem volta: a pessoa é avisada.
 *
 * `<app-resultado-unico [(dados)]="resultado" />` — abre quando `dados` não é nulo.
 */
@Component({
  selector: 'app-resultado-unico',
  imports: [Modal, Botao, ValorUnico, BlocoCodigo],
  template: `
    <app-modal
      largura="lg"
      [aberto]="!!dados()"
      [titulo]="dados()?.titulo ?? ''"
      (fechado)="dados.set(null)"
    >
      @if (dados(); as d) {
        <div class="resultado">
          <p class="resultado__texto">{{ d.texto }}</p>
          @for (item of d.valores; track item.rotulo) {
            <app-valor-unico [rotulo]="item.rotulo" [valor]="item.valor" [oQue]="item.oQue" />
          }
          @if (d.exemplo; as exemplo) {
            <app-bloco-codigo [rotulo]="exemplo.rotulo" oQue="Exemplo" [codigo]="exemplo.codigo" />
          }
        </div>
      }
      <div modal-rodape>
        <button appBotao type="button" variante="invertido" (click)="dados.set(null)">
          Já copiei
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: contents;
    }

    .resultado {
      display: grid;
      gap: var(--esp-5);
      min-width: 0;
    }

    /* O botão vira filho direto do rodapé do modal (que dá o espaçamento). */
    [modal-rodape] {
      display: contents;
    }

    .resultado__texto {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoUnico {
  readonly dados = model<ResultadoUnicoDados | null>(null);
}
