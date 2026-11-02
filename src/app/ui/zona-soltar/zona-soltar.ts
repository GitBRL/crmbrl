import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { LucidePlus } from '@lucide/angular';

/**
 * Zona de soltar (DESIGN-SYSTEM.md §4): área com círculo "+" contornado e legenda fraca
 * ("Drop Field Here" da referência). Recebe o arrastar nativo do HTML: enquanto um item
 * passa por cima, a borda fica coral; ao soltar, emite `(soltar)` com o texto arrastado
 * (`dataTransfer` "text/plain"). `ativa` força o visual de "recebendo".
 * Arrastar não funciona por teclado: ofereça sempre um botão alternativo para a mesma ação.
 */
@Component({
  selector: 'app-zona-soltar',
  imports: [LucidePlus],
  template: `
    <span class="zona__circulo" aria-hidden="true"><svg lucidePlus [size]="18" /></span>
    <span class="zona__legenda">{{ legenda() }}</span>
  `,
  styleUrl: './zona-soltar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'zona',
    '[class.zona--recebendo]': 'ativa() || recebendo()',
    '(dragenter)': 'aoEntrar($event)',
    '(dragover)': 'aoSobrevoar($event)',
    '(dragleave)': 'aoSair()',
    '(drop)': 'aoSoltar($event)',
  },
})
export class ZonaSoltar {
  readonly legenda = input('Solte um campo aqui');
  readonly ativa = input(false, { transform: booleanAttribute });
  readonly soltar = output<string>();

  protected readonly recebendo = signal(false);
  /** dragenter/dragleave disparam também nos filhos: conta a profundidade. */
  private profundidade = 0;

  protected aoEntrar(evento: Event): void {
    evento.preventDefault();
    this.profundidade += 1;
    this.recebendo.set(true);
  }

  protected aoSobrevoar(evento: Event): void {
    evento.preventDefault();
    const transferencia = (evento as DragEvent).dataTransfer;
    if (transferencia) {
      transferencia.dropEffect = 'move';
    }
  }

  protected aoSair(): void {
    this.profundidade = Math.max(0, this.profundidade - 1);
    if (this.profundidade === 0) {
      this.recebendo.set(false);
    }
  }

  protected aoSoltar(evento: Event): void {
    evento.preventDefault();
    this.profundidade = 0;
    this.recebendo.set(false);
    this.soltar.emit((evento as DragEvent).dataTransfer?.getData('text/plain') ?? '');
  }
}
