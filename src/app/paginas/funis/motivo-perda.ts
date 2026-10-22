import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';

/** Até onde o motivo pode ir (a API guarda texto livre; aqui, uma frase ou duas). */
export const MOTIVO_MAXIMO = 500;

/**
 * Modal do motivo da perda (R5.5): aparece ao soltar um negócio na etapa de perda (ou ao
 * escolher "Mover para perda" no detalhe). Confirmar manda o motivo; cancelar (botão, Esc ou
 * véu) desfaz o movimento.
 */
@Component({
  selector: 'app-motivo-perda',
  imports: [AreaTexto, Botao, Modal],
  template: `
    <app-modal [(aberto)]="aberto" [titulo]="titulo()" largura="sm" (fechado)="aoFechar()">
      <form class="motivo" [id]="idFormulario" (submit)="$event.preventDefault(); confirmar()">
        <p class="motivo__frase">
          Conte por que <strong>{{ negocio() }}</strong> não deu certo. O motivo fica na linha do
          tempo e ajuda a entender as perdas do funil.
        </p>
        <app-area-texto
          #campo
          rotulo="Motivo da perda"
          placeholder="Ex.: escolheu um concorrente mais barato"
          obrigatorio
          [linhas]="3"
          [maximoCaracteres]="maximo"
          [erro]="erro()"
          [(valor)]="motivo"
        />
      </form>
      <div modal-rodape class="motivo__acoes">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button appBotao type="submit" [attr.form]="idFormulario" variante="invertido">
          {{ rotuloConfirmar() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .motivo {
      display: grid;
      gap: var(--esp-5);
    }

    .motivo__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .motivo__frase strong {
      color: var(--cor-texto);
      font-weight: 500;
    }

    .motivo__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotivoPerda {
  readonly aberto = model(false);
  /** Título do negócio. */
  readonly negocio = input('');
  /** Nome da etapa de perda ("Perdido", "Descartado"). */
  readonly etapa = input<string | null>(null);
  readonly titulo = input('Por que perdemos?');
  readonly rotuloConfirmar = input('Marcar como perdido');

  /** O motivo, aparado. */
  readonly confirmado = output<string>();
  /** Fechou sem confirmar. */
  readonly cancelado = output<void>();

  protected readonly maximo = MOTIVO_MAXIMO;
  /**
   * Id único por instância: o quadro e o detalhe do negócio (rota filha do quadro) têm cada um
   * o seu modal ao mesmo tempo, e o botão do rodapé fica fora do form (`form=`).
   */
  protected readonly idFormulario = gerarId('form-motivo-perda');
  protected readonly motivo = signal('');
  protected readonly erro = signal<string | null>(null);
  private readonly campo = viewChild<AreaTexto>('campo');
  private confirmou = false;

  constructor() {
    effect(() => {
      if (this.aberto()) {
        this.motivo.set('');
        this.erro.set(null);
        this.confirmou = false;
        queueMicrotask(() => this.campo()?.focar());
      }
    });
  }

  protected confirmar(): void {
    const texto = this.motivo().trim();
    if (!texto) {
      this.erro.set('Escreva o motivo da perda para continuar.');
      this.campo()?.focar();
      return;
    }
    if (texto.length > MOTIVO_MAXIMO) {
      this.erro.set(`Use no máximo ${MOTIVO_MAXIMO} caracteres.`);
      return;
    }
    this.confirmou = true;
    this.confirmado.emit(texto);
    this.aberto.set(false);
  }

  protected aoFechar(): void {
    if (!this.confirmou) {
      this.cancelado.emit();
    }
  }
}
