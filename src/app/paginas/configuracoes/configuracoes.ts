import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { SECOES_CONFIGURACOES } from './secoes';

/**
 * Configurações (`/configuracoes`) — TELAS-FASE1 §6: o título, as seções que o usuário acessa
 * (links em pílula; a aberta fica invertida, com `aria-current`) e a seção no `<router-outlet>`.
 */
@Component({
  selector: 'app-configuracoes',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="configuracoes__cabecalho">
      <h1 class="texto-display">Configurações</h1>
      <p class="configuracoes__frase">{{ frase() }}</p>
    </header>
    <!-- Com uma seção só (membro: Meu perfil), não há entre o que escolher. -->
    @if (secoes().length > 1) {
      <nav class="configuracoes__secoes rolagem-horizontal" aria-label="Seções de configurações">
        @for (secao of secoes(); track secao.caminho) {
          <a
            class="configuracoes__secao"
            routerLinkActive="configuracoes__secao--ativa"
            ariaCurrentWhenActive="page"
            [routerLink]="secao.caminho"
            >{{ secao.rotulo }}</a
          >
        }
      </nav>
    }
    <router-outlet />
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: var(--esp-6);
      min-width: 0;
    }

    // O <router-outlet> é um elemento vazio: fora da grade, para não somar um vão a mais.
    router-outlet {
      display: none;
    }

    .configuracoes__cabecalho {
      display: grid;
      gap: var(--esp-3);
    }

    .configuracoes__frase {
      max-width: 48rem;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .configuracoes__secoes {
      gap: var(--esp-2);
      margin-top: calc(-1 * var(--esp-2));
      padding: 2px;

      @include m.abaixo(m.$md) {
        // A linha rola até a borda da tela (o conteúdo da casca tem 16px de margem).
        margin-inline: calc(-1 * var(--esp-4));
        padding-inline: var(--esp-4);
      }
    }

    .configuracoes__secao {
      display: inline-flex;
      align-items: center;
      min-height: var(--altura-md);
      padding: 0 var(--esp-5);
      border: 1px solid var(--cor-contorno-controle);
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

    .configuracoes__secao--ativa,
    .configuracoes__secao--ativa:hover {
      border-color: transparent;
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    @media (forced-colors: active) {
      .configuracoes__secao--ativa {
        border: 2px solid CanvasText;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracoes {
  private readonly sessao = inject(SessaoService);

  protected readonly secoes = computed(() =>
    SECOES_CONFIGURACOES.filter((secao) => this.sessao.permite(secao.permite)),
  );
  /** A frase de topo fala só do que o papel acessa. */
  protected readonly frase = computed(() => {
    const caminhos = new Set(this.secoes().map((secao) => secao.caminho));
    if (caminhos.has('usuarios')) {
      return 'Quem usa o CRM, como os leads são distribuídos, as passagens entre funis e o seu perfil.';
    }
    if (caminhos.has('passagens')) {
      return 'A sua equipe, a distribuição dos leads, as passagens entre funis e o seu perfil.';
    }
    if (caminhos.has('distribuicao')) {
      return 'A sua equipe, quem recebe os leads da sua área e o seu perfil.';
    }
    return 'O seu acesso ao CRM.';
  });
}
