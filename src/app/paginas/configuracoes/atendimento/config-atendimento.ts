import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideClock,
  LucideDynamicIcon,
  LucideListOrdered,
  LucideMessageSquareText,
} from '@lucide/angular';

import { SessaoService } from '../../../nucleo/sessao/sessao.service';

/**
 * Configurações → Atendimento (`/configuracoes/atendimento…`; Admin, C-level e os líderes do
 * Comercial e do CS) — §6 do contrato da Onda A e R12: três partes, cada uma numa rota filha —
 * **Filas e SLA** (`filas`), **Horário e satisfação** dos canais (`horarios`) e **Respostas
 * rápidas** (`respostas`).
 */
@Component({
  selector: 'app-config-atendimento',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideDynamicIcon],
  template: `
    <section class="secao" aria-labelledby="config-atendimento-titulo">
      <header class="secao__cabecalho">
        <div class="secao__textos">
          <h2 class="secao__titulo" id="config-atendimento-titulo">Atendimento</h2>
          <p class="secao__frase">{{ frase() }}</p>
        </div>
      </header>
      <nav class="partes rolagem-horizontal" aria-label="Partes da configuração do Atendimento">
        @for (parte of partes; track parte.caminho) {
          <a
            class="parte"
            routerLinkActive="parte--ativa"
            ariaCurrentWhenActive="page"
            [routerLink]="parte.caminho"
          >
            <span class="parte__icone" aria-hidden="true"
              ><svg [lucideIcon]="parte.icone" [size]="16"
            /></span>
            {{ parte.rotulo }}
          </a>
        }
      </nav>
      <router-outlet />
    </section>
  `,
  styles: `
    @use 'mixins' as m;
    @use '../secao' as s;

    :host {
      display: block;
    }

    .secao {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--esp-5);
      min-width: 0;
    }

    router-outlet {
      display: none;
    }

    @include s.cabecalho;

    .partes {
      gap: var(--esp-2);
      padding: 2px;

      @include m.abaixo(m.$md) {
        margin-inline: calc(-1 * var(--esp-4));
        padding-inline: var(--esp-4);
      }
    }

    // As partes: pílulas com o círculo do ícone; a aberta fica com o círculo invertido
    // (como "Layout" na referência).
    .parte {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: var(--altura-md);
      padding: 0 var(--esp-4) 0 4px;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      white-space: nowrap;
      text-decoration: none;
      transition:
        background-color var(--duracao) var(--curva),
        color var(--duracao) var(--curva);

      &:hover {
        background: var(--cor-superficie-3);
        color: var(--cor-texto);
      }
    }

    .parte__icone {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--cor-superficie-3);
      color: var(--cor-texto);
    }

    .parte--ativa {
      border-color: var(--cor-borda-forte);
      color: var(--cor-texto);

      .parte__icone {
        background: var(--cor-inverso);
        color: var(--cor-sobre-inverso);
      }
    }

    @media (forced-colors: active) {
      .parte--ativa {
        border: 2px solid CanvasText;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigAtendimento {
  private readonly sessao = inject(SessaoService);

  protected readonly partes = [
    { caminho: 'filas', rotulo: 'Filas e SLA', icone: LucideListOrdered },
    { caminho: 'horarios', rotulo: 'Horário e satisfação', icone: LucideClock },
    { caminho: 'respostas', rotulo: 'Respostas rápidas', icone: LucideMessageSquareText },
  ];

  protected readonly frase = computed(() =>
    this.sessao.ehDiretoria()
      ? 'Como as conversas chegam a cada pessoa, os prazos de resposta, quando cada canal atende e as mensagens prontas da equipe.'
      : 'As filas, os prazos e as mensagens prontas do seu setor, e quando cada canal atende.',
  );
}
