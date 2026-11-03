import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideBot } from '@lucide/angular';

import { Selo } from '../../ui/selo/selo';
import { descricaoDoSeloIa, textoDoSeloIa } from './sdr.apresentacao';
import type { SdrDaConversa } from './sdr.tipos';

/**
 * Selo "IA atendendo" (lista de conversas e cabeçalho da conversa): só aparece com a IA ativa.
 * No modo sugestão o texto é "IA sugerindo". O leitor de tela ouve o modo por extenso.
 */
@Component({
  selector: 'app-selo-ia',
  imports: [Selo],
  template: `
    @if (sdr(); as dados) {
      @if (dados.situacao === 'ATIVA') {
        <app-selo [tamanho]="tamanho()" variante="menta" [icone]="icone">
          <span class="visualmente-oculto">{{ descricao() }}. </span>
          <span aria-hidden="true">{{ texto() }}</span>
        </app-selo>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'selo-ia' },
})
export class SeloIa {
  readonly sdr = input<SdrDaConversa | null | undefined>(null);
  readonly tamanho = input<'sm' | 'md'>('md');

  protected readonly icone = LucideBot;
  protected readonly texto = computed(() => {
    const dados = this.sdr();
    return dados ? textoDoSeloIa(dados) : '';
  });
  protected readonly descricao = computed(() => {
    const dados = this.sdr();
    return dados ? descricaoDoSeloIa(dados) : '';
  });
}
