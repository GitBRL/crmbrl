import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { LucideDynamicIcon, LucideLoaderCircle, type LucideIconInput } from '@lucide/angular';

import { TAMANHO_ICONE, type TamanhoControle } from '../tipos';

export type VarianteBotao = 'neutro' | 'contorno' | 'invertido' | 'destaque' | 'marca';

/**
 * Botão pílula (DESIGN-SYSTEM.md §4). Fica sobre o elemento nativo para herdar semântica,
 * foco e teclado: `<button appBotao>` ou `<a appBotao routerLink="…">`.
 *
 * O ícone opcional vai dentro de um círculo à esquerda (como "Layout" e "Customizing" na
 * referência); `ativo` inverte o círculo (item selecionado). `carregando` troca o ícone por um
 * indicador giratório, marca `aria-busy` e ignora cliques.
 */
@Component({
  selector: 'button[appBotao], a[appBotao]',
  imports: [LucideDynamicIcon, LucideLoaderCircle],
  template: `
    @if (carregando()) {
      <span class="botao__icone" aria-hidden="true">
        <svg lucideLoaderCircle class="botao__giro" [size]="tamanhoIcone()" />
      </span>
    } @else if (icone(); as iconeAtual) {
      <span class="botao__icone" aria-hidden="true">
        <svg [lucideIcon]="iconeAtual" [size]="tamanhoIcone()" />
      </span>
    }
    <span class="botao__rotulo"><ng-content /></span>
  `,
  styleUrl: './botao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'botao',
    '[class.botao--neutro]': "variante() === 'neutro'",
    '[class.botao--contorno]': "variante() === 'contorno'",
    '[class.botao--invertido]': "variante() === 'invertido'",
    '[class.botao--destaque]': "variante() === 'destaque'",
    '[class.botao--marca]': "variante() === 'marca'",
    '[class.botao--sm]': "tamanho() === 'sm'",
    '[class.botao--lg]': "tamanho() === 'lg'",
    '[class.botao--com-circulo]': 'temCirculo()',
    '[class.botao--com-icone]': 'temIcone()',
    '[class.botao--ativo]': 'ativo()',
    '[attr.aria-busy]': 'carregando() || null',
    '[attr.aria-disabled]': 'carregando() || null',
  },
})
export class Botao {
  readonly variante = input<VarianteBotao>('neutro');
  readonly tamanho = input<TamanhoControle>('md');
  /** Componente de ícone do Lucide (ex.: `LucideShare2`). */
  readonly icone = input<LucideIconInput | null>(null);
  /** Inverte o círculo do ícone: item selecionado/ativo (navegação, seletores). */
  readonly ativo = input(false, { transform: booleanAttribute });
  readonly carregando = input(false, { transform: booleanAttribute });
  /** Mostra o ícone solto, sem o círculo (como o "Share" da referência). */
  readonly semCirculo = input(false, { transform: booleanAttribute });

  protected readonly tamanhoIcone = computed(() => TAMANHO_ICONE[this.tamanho()]);
  protected readonly temIcone = computed(() => this.carregando() || this.icone() !== null);
  protected readonly temCirculo = computed(() => this.temIcone() && !this.semCirculo());

  constructor() {
    // Carregando, o clique não pode chegar a ninguém. O ouvinte fica na fase de captura do
    // próprio elemento: roda antes dos (click) de quem usa o botão e os cancela.
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const bloquear = (evento: Event) => {
      if (this.carregando()) {
        evento.preventDefault();
        evento.stopImmediatePropagation();
      }
    };
    elemento.addEventListener('click', bloquear, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      elemento.removeEventListener('click', bloquear, { capture: true }),
    );
  }
}
