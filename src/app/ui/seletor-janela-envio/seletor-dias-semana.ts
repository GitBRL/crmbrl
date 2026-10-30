import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { gerarId } from '../tipos';
import { alternarDia, DIAS_SEMANA, type DiaSemana } from './janela-envio';

/**
 * Sete pílulas, uma por dia da semana (botões com `aria-pressed` e o nome completo como nome
 * acessível). Usado pela janela de envio e pela agenda semanal.
 *
 * `<app-seletor-dias-semana rotulo="Dias da semana" [(valor)]="dias" />`
 */
@Component({
  selector: 'app-seletor-dias-semana',
  template: `
    <div class="dias" role="group" [attr.aria-labelledby]="idRotulo">
      <span class="dias__rotulo" [id]="idRotulo">{{ rotulo() }}</span>
      <div class="dias__pilulas">
        @for (dia of dias; track dia.valor) {
          <button
            type="button"
            class="dias__dia"
            [disabled]="desabilitado()"
            [attr.aria-pressed]="valor().includes(dia.valor)"
            [attr.aria-label]="dia.longo"
            (click)="alternar(dia.valor)"
          >
            {{ dia.curto }}
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './seletor-dias-semana.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorDiasSemana {
  readonly valor = model<readonly DiaSemana[]>([]);
  readonly rotulo = input('Dias da semana');
  readonly desabilitado = input(false, { transform: booleanAttribute });

  protected readonly dias = DIAS_SEMANA;
  protected readonly idRotulo = gerarId('dias-semana');

  protected alternar(dia: DiaSemana): void {
    this.valor.set(alternarDia(this.valor(), dia));
  }
}
