import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { CampoEtiquetas } from '../contatos/campo-etiquetas';

/** Etiquetas de uma conversa (até 20, com até 40 caracteres cada, como na API). */
@Component({
  selector: 'app-editar-etiquetas',
  imports: [Botao, CampoEtiquetas, Modal],
  template: `
    <app-modal [(aberto)]="aberto" titulo="Etiquetas da conversa" largura="sm">
      <form id="form-etiquetas" (submit)="$event.preventDefault(); salvar.emit(rascunho())">
        <app-campo-etiquetas
          rotulo="Etiquetas"
          placeholder="Ex.: orçamento, escola, urgente"
          [valor]="rascunho()"
          (valorChange)="rascunho.set($event)"
          [sugestoes]="sugestoes()"
          ajuda="Etiquetas ajudam a achar conversas parecidas: use o filtro de etiqueta na lista."
        />
      </form>
      <div modal-rodape class="etiquetas__rodape">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button
          appBotao
          type="submit"
          form="form-etiquetas"
          variante="invertido"
          [carregando]="salvando()"
        >
          Salvar
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .etiquetas__rodape {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarEtiquetas {
  readonly aberto = model(false);
  readonly etiquetas = input<readonly string[]>([]);
  readonly sugestoes = input<readonly string[]>([]);
  readonly salvando = input(false);
  readonly salvar = output<readonly string[]>();

  protected readonly rascunho = signal<readonly string[]>([]);

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.rascunho.set(this.etiquetas()));
      }
    });
  }
}
