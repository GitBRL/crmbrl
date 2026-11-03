import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideFlame, LucideSnowflake, LucideSun } from '@lucide/angular';

import { Selo } from '../../ui/selo/selo';
import {
  descricaoDaTemperatura,
  ROTULO_TEMPERATURA,
  VARIANTE_TEMPERATURA,
} from './sdr.apresentacao';
import type { TemperaturaSdr } from './sdr.tipos';

/**
 * Temperatura do lead (quente, morno, frio): cor, ícone e texto juntos, nunca só a cor. Com
 * `nota`, o leitor de tela ouve também a nota de 0 a 100.
 */
@Component({
  selector: 'app-selo-temperatura',
  imports: [Selo],
  template: `
    @if (temperatura(); as valor) {
      <app-selo [tamanho]="tamanho()" [variante]="variante()" [icone]="icone()">
        <span class="visualmente-oculto">{{ descricao() }}</span>
        <span aria-hidden="true">{{ rotulo() }}</span>
      </app-selo>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'selo-temperatura' },
})
export class SeloTemperatura {
  readonly temperatura = input<TemperaturaSdr | null | undefined>(null);
  readonly nota = input<number | null | undefined>(null);
  readonly tamanho = input<'sm' | 'md'>('md');

  protected readonly rotulo = computed(() => {
    const valor = this.temperatura();
    return valor ? ROTULO_TEMPERATURA[valor] : '';
  });
  protected readonly variante = computed(() => {
    const valor = this.temperatura();
    return valor ? VARIANTE_TEMPERATURA[valor] : 'neutro';
  });
  protected readonly icone = computed(() => {
    switch (this.temperatura()) {
      case 'QUENTE':
        return LucideFlame;
      case 'FRIO':
        return LucideSnowflake;
      default:
        return LucideSun;
    }
  });
  protected readonly descricao = computed(() => {
    const valor = this.temperatura();
    return valor ? descricaoDaTemperatura(valor, this.nota()) : '';
  });
}
