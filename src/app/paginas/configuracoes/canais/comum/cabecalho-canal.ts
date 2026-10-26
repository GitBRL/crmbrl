import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideDynamicIcon } from '@lucide/angular';

import { Selo } from '../../../../ui/selo/selo';
import { TIPO_DE_CANAL, type SituacaoVisual } from '../apresentacao';
import type { TipoCanal } from '../canais.modelos';
import { ICONE_DO_CANAL } from '../icones';

/**
 * Cabeçalho das telas de um canal: "← Canais", o ícone do tipo, o nome em dois tons
 * ("Comercial — principal · WhatsApp"), a situação num selo e as ações projetadas
 * (`[cabecalho-acoes]`, ex.: o menu "⋯").
 */
@Component({
  selector: 'app-cabecalho-canal',
  imports: [RouterLink, LucideArrowLeft, LucideDynamicIcon, Selo],
  template: `
    <a class="voltar" routerLink="/configuracoes/canais">
      <svg lucideArrowLeft [size]="16" />
      Canais
    </a>
    <header class="cabecalho">
      <span class="cabecalho__icone" aria-hidden="true">
        <svg [lucideIcon]="icone()" [size]="22" />
      </span>
      <div class="cabecalho__textos">
        <h2 class="cabecalho__titulo" [id]="idTitulo()">
          {{ titulo() }}&nbsp;<span class="tom-fraco">· </span
          ><span class="tom-fraco sem-quebra">{{ rotuloTipo() }}</span>
        </h2>
        @if (situacao(); as situacao) {
          <app-selo [variante]="situacao.variante" [ponto]="situacao.ponto">{{
            situacao.rotulo
          }}</app-selo>
        }
        @if (frase()) {
          <p class="cabecalho__frase">{{ frase() }}</p>
        }
      </div>
      <div class="cabecalho__acoes"><ng-content select="[cabecalho-acoes]" /></div>
    </header>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: var(--esp-3);
    }

    .voltar {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-self: start;
      gap: var(--esp-2);
      min-height: 32px;
      padding: 0 var(--esp-3) 0 var(--esp-2);
      border-radius: var(--raio-pilula);
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      text-decoration: none;
      @include m.area-toque(6px, 0);

      &:hover {
        background: var(--cor-superficie-2);
        color: var(--cor-texto);
      }
    }

    .cabecalho {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--esp-4);
    }

    .cabecalho__icone {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    .cabecalho__textos {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-1) var(--esp-3);
      min-width: 0;
    }

    .cabecalho__titulo {
      min-width: 0;
      font: var(--fonte-h2);
      letter-spacing: var(--tracking-titulo);
      overflow-wrap: anywhere;
    }

    .cabecalho__frase {
      flex-basis: 100%;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .cabecalho__acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);

      &:empty {
        display: none;
      }
    }

    @include m.abaixo(m.$sm) {
      .cabecalho {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .cabecalho__icone {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoCanal {
  readonly titulo = input.required<string>();
  readonly tipo = input.required<TipoCanal>();
  readonly situacao = input<SituacaoVisual | null>(null);
  readonly frase = input<string | null>(null);
  /** Id do h2, para a seção da tela apontar com `aria-labelledby`. */
  readonly idTitulo = input('canal-titulo');

  protected readonly icone = computed(() => ICONE_DO_CANAL[this.tipo()]);
  protected readonly rotuloTipo = computed(() => TIPO_DE_CANAL[this.tipo()].rotulo);
}
