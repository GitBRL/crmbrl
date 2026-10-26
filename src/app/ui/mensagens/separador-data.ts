import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { rotuloDoDia } from './mensagens';

/**
 * Separador de data entre as mensagens (DESIGN-SYSTEM.md §4.6): um fio de cada lado e, no
 * meio, uma pílula neutra com "Hoje", "Ontem", o dia da semana ou a data. É texto comum (o
 * leitor de tela lê na ordem da conversa).
 *
 * ```html
 * <app-separador-data [data]="mensagem.criadaEm" />  ou  <app-separador-data rotulo="Hoje" />
 * ```
 */
@Component({
  selector: 'app-separador-data',
  template: `<span class="separador__rotulo">{{ texto() }}</span>`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      padding-block: var(--esp-3);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      font-weight: 500;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--cor-borda);
      }
    }

    .separador__rotulo {
      padding: 4px var(--esp-3);
      border-radius: var(--raio-pilula);
      background: var(--cor-vidro-forte);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'separador-data' },
})
export class SeparadorData {
  /** O dia (o rótulo sai daqui); ignorado quando há `rotulo`. */
  readonly data = input<string | Date | null>(null);
  /** Texto pronto ("Hoje"). */
  readonly rotulo = input<string | null>(null);

  protected readonly texto = computed(() => {
    const rotulo = this.rotulo();
    if (rotulo) {
      return rotulo;
    }
    const data = this.data();
    return data ? rotuloDoDia(data) : '';
  });
}
