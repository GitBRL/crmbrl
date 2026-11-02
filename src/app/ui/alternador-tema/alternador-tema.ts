import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';

import { TemaService } from '../../nucleo/tema.service';
import { BotaoIcone, type VarianteBotaoIcone } from '../botao-icone/botao-icone';
import type { TamanhoControle } from '../tipos';

/**
 * Alternador de tema (DESIGN-SYSTEM.md §3): botão-ícone ligado ao `TemaService`.
 * O ícone e o `aria-label` mostram a ação ("Ativar tema claro" com o sol, no escuro).
 */
@Component({
  selector: 'app-alternador-tema',
  imports: [BotaoIcone],
  template: `
    <button
      appBotaoIcone
      type="button"
      [icone]="icone()"
      [rotulo]="rotulo()"
      [variante]="variante()"
      [tamanho]="tamanho()"
      (click)="tema.alternar()"
    ></button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'alternador-tema', style: 'display: inline-flex' },
})
export class AlternadorTema {
  protected readonly tema = inject(TemaService);

  readonly variante = input<VarianteBotaoIcone>('neutro');
  readonly tamanho = input<TamanhoControle>('md');

  protected readonly icone = computed(() => (this.tema.ehEscuro() ? LucideSun : LucideMoon));
  protected readonly rotulo = computed(() =>
    this.tema.ehEscuro() ? 'Ativar tema claro' : 'Ativar tema escuro',
  );
}
