import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideBot, LucideHand, LucideUndo2 } from '@lucide/angular';

import { Botao } from '../../ui/botao/botao';
import { Selo } from '../../ui/selo/selo';
import { ROTULO_SITUACAO, VARIANTE_SITUACAO } from './sdr.apresentacao';
import type { EstadoDoSdr } from './sdr.tipos';
import { SeloTemperatura } from './selo-temperatura';

/**
 * Faixa do SDR com IA na conversa: quem está com o lead (IA, uma pessoa, a equipe), por que a IA
 * parou, o resumo que ela deixou e os botões "Assumir" e "Devolver para a IA". Os botões só
 * pedem; quem confirma e chama a API é a conversa.
 */
@Component({
  selector: 'app-faixa-sdr',
  imports: [Botao, Selo, SeloTemperatura],
  template: `
    @if (estado(); as e) {
      @if (e.situacao) {
        <section class="faixa-sdr" aria-label="Atendimento pela IA">
          <div class="faixa-sdr__linha">
            @if (e.situacao !== 'ATIVA') {
              <app-selo [variante]="variante()" [icone]="icones.ia">{{ rotulo() }}</app-selo>
            }
            @if (e.qualificacao?.temperatura) {
              <app-selo-temperatura
                [temperatura]="e.qualificacao?.temperatura"
                [nota]="e.qualificacao?.nota"
              />
            }
            <p class="faixa-sdr__texto">{{ texto() }}</p>
            <div class="faixa-sdr__acoes">
              @if (e.acoes.assumir) {
                <button
                  appBotao
                  type="button"
                  tamanho="sm"
                  variante="invertido"
                  [icone]="icones.assumir"
                  [carregando]="ocupado() === 'assumir'"
                  [disabled]="!!ocupado()"
                  (click)="assumir.emit()"
                >
                  Assumir
                </button>
              }
              @if (e.acoes.devolver) {
                <button
                  appBotao
                  type="button"
                  tamanho="sm"
                  variante="contorno"
                  [icone]="icones.devolver"
                  [carregando]="ocupado() === 'devolver'"
                  [disabled]="!!ocupado()"
                  (click)="devolver.emit()"
                >
                  Devolver para a IA
                </button>
              }
            </div>
          </div>
          @if (e.qualificacao?.resumo; as resumo) {
            <details class="faixa-sdr__resumo">
              <summary>Resumo da IA para quem continua</summary>
              <p>{{ resumo }}</p>
            </details>
          }
        </section>
      }
    }
  `,
  styleUrl: './faixa-sdr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'faixa-sdr-host' },
})
export class FaixaSdr {
  readonly estado = input<EstadoDoSdr | null>(null);
  readonly ocupado = input<string | null>(null);

  readonly assumir = output<void>();
  readonly devolver = output<void>();

  protected readonly icones = { ia: LucideBot, assumir: LucideHand, devolver: LucideUndo2 };

  protected readonly variante = computed(() => {
    const situacao = this.estado()?.situacao;
    return situacao ? VARIANTE_SITUACAO[situacao] : 'neutro';
  });

  protected readonly rotulo = computed(() => {
    const e = this.estado();
    if (!e?.situacao) {
      return '';
    }
    return ROTULO_SITUACAO[e.situacao];
  });

  protected readonly texto = computed(() => {
    const e = this.estado();
    const q = e?.qualificacao;
    switch (e?.situacao) {
      case 'ATIVA':
        return e.modo === 'SUGESTAO'
          ? 'Modo sugestão: a IA escreve a resposta e você decide se envia. Assuma para responder você.'
          : 'Modo automático: a IA responde este lead sozinha. Assuma quando quiser falar você.';
      case 'HUMANO':
        return e.humano
          ? `${e.humano.nome} está com a conversa. A IA está parada.`
          : 'Uma pessoa está com a conversa. A IA está parada.';
      case 'PASSADA_HUMANO':
        return q?.motivo
          ? `A IA passou para a equipe: ${q.motivo}`
          : 'A IA passou esta conversa para a equipe.';
      case 'QUALIFICADA':
        return 'A IA qualificou o lead e passou o negócio para o Comercial.';
      case 'DESQUALIFICADA':
        return q?.motivo ? `A IA desqualificou o lead: ${q.motivo}` : 'A IA desqualificou o lead.';
      default:
        return 'A conversa foi encerrada.';
    }
  });
}
