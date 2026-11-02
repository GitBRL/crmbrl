import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Botao } from '../botao/botao';
import { CampoData } from '../campo-data/campo-data';
import {
  descreverJanela,
  erroDaJanela,
  JANELA_COMERCIAL,
  JANELA_SEMPRE,
  type JanelaEnvio,
} from './janela-envio';
import { SeletorDiasSemana } from './seletor-dias-semana';

/**
 * Seletor de janela de envio (DESIGN-SYSTEM.md §4.7): em que dias e em que faixa de horas a
 * campanha ou a automação pode enviar. Sete pílulas de dia (botões com `aria-pressed`), hora
 * de início e de fim, dois atalhos ("Horário comercial", "Todos os dias") e uma frase que
 * resume a regra ("Envia de segunda a sexta, das 8h às 18h (horário de Brasília)."). Quando a
 * janela não serve (nenhum dia, fim antes do início) a frase vira o erro, em `role="alert"`.
 *
 * `<app-seletor-janela-envio [(valor)]="janela" />`
 */
@Component({
  selector: 'app-seletor-janela-envio',
  imports: [CampoData, Botao, SeletorDiasSemana],
  template: `
    <fieldset class="janela" [disabled]="desabilitado()">
      <legend class="janela__rotulo">{{ rotulo() }}</legend>

      <app-seletor-dias-semana [valor]="valor().dias" (valorChange)="mudar({ dias: $event })" />

      <div class="janela__horas">
        <app-campo-data
          class="janela__hora"
          tipo="hora"
          rotulo="Das"
          [valor]="valor().inicio"
          (valorChange)="mudar({ inicio: $event ?? '' })"
        />
        <app-campo-data
          class="janela__hora"
          tipo="hora"
          rotulo="Até"
          [valor]="valor().fim"
          (valorChange)="mudar({ fim: $event ?? '' })"
        />
      </div>

      <div class="janela__atalhos">
        <button
          appBotao
          type="button"
          tamanho="sm"
          variante="contorno"
          (click)="definir(comercial)"
        >
          Horário comercial
        </button>
        <button appBotao type="button" tamanho="sm" variante="contorno" (click)="definir(sempre)">
          Todos os dias
        </button>
      </div>

      @if (erro(); as mensagem) {
        <p class="janela__resumo janela__resumo--erro" role="alert">{{ mensagem }}</p>
      } @else {
        <p class="janela__resumo" aria-live="polite">{{ resumo() }}</p>
      }
    </fieldset>
  `,
  styleUrl: './seletor-janela-envio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorJanelaEnvio {
  readonly valor = model<JanelaEnvio>(JANELA_COMERCIAL);
  readonly rotulo = input('Janela de envio');
  readonly desabilitado = input(false, { transform: booleanAttribute });

  protected readonly comercial = JANELA_COMERCIAL;
  protected readonly sempre = JANELA_SEMPRE;

  protected erro(): string | null {
    return erroDaJanela(this.valor());
  }

  protected resumo(): string {
    return descreverJanela(this.valor());
  }

  protected mudar(parte: Partial<JanelaEnvio>): void {
    this.valor.set({ ...this.valor(), ...parte });
  }

  protected definir(janela: JanelaEnvio): void {
    this.valor.set({ ...janela, fuso: this.valor().fuso });
  }
}
