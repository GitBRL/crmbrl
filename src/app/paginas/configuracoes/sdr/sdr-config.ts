import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBookOpen,
  LucideDynamicIcon,
  LucideGauge,
  LucideListChecks,
  LucideMessagesSquare,
  LucideUserRound,
  LucideFlaskConical,
} from '@lucide/angular';

/**
 * Configurações → SDR com IA (`/configuracoes/sdr…`, só Admin; R31): o que o SDR faz em cada canal
 * e como. Cada parte é uma rota filha: **Canais**, **Persona**, **Base de conhecimento**,
 * **Critérios**, **Temperatura e limites** e **Simulador**.
 */
@Component({
  selector: 'app-sdr-config',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, LucideDynamicIcon],
  template: `
    <section class="secao" aria-labelledby="sdr-titulo">
      <header class="secao__cabecalho">
        <div class="secao__textos">
          <h2 class="secao__titulo" id="sdr-titulo">SDR com IA</h2>
          <p class="secao__frase">
            Uma assistente virtual que responde os leads novos, descobre o que você precisa saber e
            passa o lead qualificado para o Comercial.
          </p>
        </div>
      </header>
      <nav class="partes rolagem-horizontal" aria-label="Partes da configuração do SDR com IA">
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
export class SdrConfig {
  protected readonly partes = [
    { caminho: 'canais', rotulo: 'Canais', icone: LucideMessagesSquare },
    { caminho: 'persona', rotulo: 'Persona', icone: LucideUserRound },
    { caminho: 'conhecimento', rotulo: 'Base de conhecimento', icone: LucideBookOpen },
    { caminho: 'criterios', rotulo: 'Critérios', icone: LucideListChecks },
    { caminho: 'regras', rotulo: 'Temperatura e limites', icone: LucideGauge },
    { caminho: 'simulador', rotulo: 'Simulador', icone: LucideFlaskConical },
  ];
}
