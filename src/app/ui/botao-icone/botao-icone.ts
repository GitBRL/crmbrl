import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

import { TAMANHO_ICONE, type TamanhoControle } from '../tipos';

export type VarianteBotaoIcone = 'neutro' | 'contorno' | 'invertido' | 'destaque' | 'marca';

/**
 * Botão-ícone circular (DESIGN-SYSTEM.md §4): `<button appBotaoIcone [icone]="…" rotulo="…">`.
 * `rotulo` é obrigatório e vira o `aria-label` (e a dica nativa do navegador).
 * `ponto` mostra um ponto de notificação; `contagem` mostra um número (ex.: filtros ativos).
 * Os dois são visuais: inclua a informação no `rotulo` ("Notificações, 3 novas").
 */
@Component({
  selector: 'button[appBotaoIcone], a[appBotaoIcone]',
  imports: [LucideDynamicIcon],
  template: `
    <svg [lucideIcon]="icone()" [size]="tamanhoIcone()" />
    @if (textoContagem(); as texto) {
      <span class="botao-icone__contagem" aria-hidden="true">{{ texto }}</span>
    } @else if (ponto()) {
      <span class="botao-icone__ponto" aria-hidden="true"></span>
    }
  `,
  styleUrl: './botao-icone.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'botao-icone',
    '[class.botao-icone--neutro]': "variante() === 'neutro'",
    '[class.botao-icone--contorno]': "variante() === 'contorno'",
    '[class.botao-icone--invertido]': "variante() === 'invertido'",
    '[class.botao-icone--destaque]': "variante() === 'destaque'",
    '[class.botao-icone--marca]': "variante() === 'marca'",
    '[class.botao-icone--sm]': "tamanho() === 'sm'",
    '[class.botao-icone--lg]': "tamanho() === 'lg'",
    '[attr.aria-label]': 'rotulo()',
    '[attr.title]': 'rotulo()',
  },
})
export class BotaoIcone {
  readonly icone = input.required<LucideIconInput>();
  /** Nome acessível do botão (`aria-label`). Diga a ação: "Fechar", "Ativar tema claro". */
  readonly rotulo = input.required<string>();
  readonly variante = input<VarianteBotaoIcone>('neutro');
  readonly tamanho = input<TamanhoControle>('md');
  readonly ponto = input(false, { transform: booleanAttribute });
  readonly contagem = input<number | null>(null);

  protected readonly tamanhoIcone = computed(() => TAMANHO_ICONE[this.tamanho()]);
  protected readonly textoContagem = computed(() => {
    const contagem = this.contagem();
    if (contagem === null || contagem <= 0) {
      return null;
    }
    return contagem > 9 ? '9+' : String(contagem);
  });
}
