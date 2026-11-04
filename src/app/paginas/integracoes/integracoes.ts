import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { AcaoDaSecao } from './comum/acao-da-secao';

/**
 * Integrações (`/integracoes`, Admin) — TELAS-FASE1 §7 e Onda H: o título, a frase de propósito,
 * as seções (aplicativos, histórico e webhooks de saída) como links e a seção aberta no
 * `<router-outlet>`.
 * A ação principal da seção ("Novo webhook…") fica à direita do título; no celular, vira o
 * botão flutuante circular.
 */
@Component({
  selector: 'app-integracoes',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Botao, BotaoIcone],
  providers: [AcaoDaSecao],
  template: `
    <header class="moldura__cabecalho">
      <div class="moldura__titulos">
        <h1 class="texto-display">Integrações — Webhooks e aplicativos</h1>
        <p class="moldura__frase">
          Receba leads das suas ferramentas, acompanhe o que chegou e avise outros sistemas quando
          algo acontece no CRM.
        </p>
      </div>
      @if (acao.atual(); as principal) {
        <button
          appBotao
          type="button"
          variante="invertido"
          class="moldura__acao"
          [icone]="principal.icone"
          (click)="principal.executar()"
        >
          {{ principal.rotulo }}
        </button>
        <button
          appBotaoIcone
          type="button"
          variante="invertido"
          tamanho="lg"
          class="moldura__flutuante"
          [icone]="principal.icone"
          [rotulo]="principal.rotulo"
          (click)="principal.executar()"
        ></button>
      }
      <nav class="moldura__secoes rolagem-horizontal" aria-label="Seções de integrações">
        @for (secao of secoes; track secao.caminho) {
          <a
            class="moldura__secao"
            routerLinkActive="moldura__secao--ativa"
            ariaCurrentWhenActive="page"
            [routerLink]="secao.caminho"
            >{{ secao.rotulo }}</a
          >
        }
      </nav>
    </header>
    <router-outlet />
  `,
  styleUrl: './moldura.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Integracoes {
  protected readonly acao = inject(AcaoDaSecao);

  protected readonly secoes = [
    { caminho: 'aplicativos', rotulo: 'Aplicativos' },
    { caminho: 'historico', rotulo: 'Histórico' },
    { caminho: 'saida', rotulo: 'Webhooks de saída' },
  ] as const;
}
