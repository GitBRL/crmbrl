import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideCheck,
  LucideCheckCheck,
  LucideClock,
  LucideDynamicIcon,
  LucideTriangleAlert,
  type LucideIcon,
} from '@lucide/angular';

import { ROTULO_STATUS, type StatusMensagem } from './mensagens';

const ICONE_STATUS: Readonly<Record<StatusMensagem, LucideIcon>> = {
  PENDENTE: LucideClock,
  ENVIADA: LucideCheck,
  ENTREGUE: LucideCheckCheck,
  LIDA: LucideCheckCheck,
  FALHOU: LucideTriangleAlert,
};

/**
 * Status de entrega de uma mensagem enviada (DESIGN-SYSTEM.md §4.6): relógio (enviando), um
 * visto (enviada), dois vistos (entregue), dois vistos em `--cor-info` (lida) e alerta em
 * `--cor-erro` (não enviada). A forma muda a cada passo, então não depende só da cor. É uma
 * imagem com nome ("Lida"), que aparece também ao passar o mouse.
 *
 * ```html
 * <app-status-entrega status="LIDA" />
 * ```
 */
@Component({
  selector: 'app-status-entrega',
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="icone()" [size]="tamanho()" [strokeWidth]="2" />`,
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      color: inherit;
      line-height: 0;
    }

    :host(.status-entrega--lida) {
      color: var(--cor-info);
    }

    :host(.status-entrega--falhou) {
      color: var(--cor-erro);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'status-entrega',
    role: 'img',
    '[class.status-entrega--lida]': "status() === 'LIDA'",
    '[class.status-entrega--falhou]': "status() === 'FALHOU'",
    '[attr.aria-label]': 'rotulo()',
    '[attr.title]': 'rotulo()',
  },
})
export class StatusEntrega {
  readonly status = input.required<StatusMensagem>();
  /** Tamanho do ícone em px (16). */
  readonly tamanho = input(16);

  protected readonly icone = computed(() => ICONE_STATUS[this.status()]);
  protected readonly rotulo = computed(() => ROTULO_STATUS[this.status()]);
}
