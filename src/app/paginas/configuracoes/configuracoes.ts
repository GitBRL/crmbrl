import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { SECOES_CONFIGURACOES } from './secoes';

/** Folga entre a pílula da seção aberta e a borda da linha quando a linha rola até ela. */
const FOLGA_ROLAGEM = 16;

/** Como cada seção aparece na frase de topo, na ordem das abas. */
const RESUMO_DA_SECAO: Readonly<Record<string, string>> = {
  usuarios: 'quem usa o CRM',
  equipe: 'a sua equipe',
  distribuicao: 'a distribuição dos leads',
  passagens: 'as passagens entre funis',
  canais: 'os canais de atendimento',
  atendimento: 'as filas e os horários do atendimento',
  disparos: 'os limites dos disparos',
  assistente: 'o assistente de ajuda',
  perfil: 'o seu perfil',
};

/**
 * Configurações (`/configuracoes`) — TELAS-FASE1 §6: o título, as seções que o usuário acessa
 * (links em pílula; a aberta fica invertida, com `aria-current`) e a seção no `<router-outlet>`.
 * No celular a linha de pílulas rola na horizontal: a da seção aberta é trazida para a área
 * visível ao abrir a tela e a cada troca de seção.
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
            #pilula
            class="configuracoes__secao"
            routerLinkActive="configuracoes__secao--ativa"
            ariaCurrentWhenActive="page"
            [routerLink]="secao.caminho"
            (isActiveChange)="$event && mostrarSecao(pilula)"
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
  private readonly injector = inject(Injector);
  /** A primeira vez (ao abrir a tela) a linha vai direto, sem animar. */
  private primeiraRolagem = true;

  protected readonly secoes = computed(() =>
    SECOES_CONFIGURACOES.filter((secao) => this.sessao.permite(secao.permite)),
  );
  /** A frase de topo fala só do que o papel acessa. */
  protected readonly frase = computed(() => {
    const partes = this.secoes()
      .map((secao) => RESUMO_DA_SECAO[secao.caminho])
      .filter((parte): parte is string => !!parte);
    if (partes.length <= 1) {
      return 'O seu acesso ao CRM.';
    }
    const texto = `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}.`;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  /** A seção aberta mudou: a pílula dela vai para a área visível da linha (celular). */
  protected mostrarSecao(pilula: HTMLElement): void {
    const instantaneo = this.primeiraRolagem;
    this.primeiraRolagem = false;
    afterNextRender(() => trazerPilulaParaVista(pilula, instantaneo), { injector: this.injector });
  }
}

/**
 * Traz a pílula para dentro da área visível da linha que rola, com uma folga de 16px. Mexe só
 * no `scrollLeft` da linha (como `app-abas`): `scrollIntoView` também rolaria a página e mudaria
 * o ponto de partida do Tab no Chrome.
 */
export function trazerPilulaParaVista(pilula: HTMLElement, instantaneo = false): void {
  const linha = pilula.parentElement;
  if (!linha || linha.scrollWidth <= linha.clientWidth) {
    return;
  }
  const caixaLinha = linha.getBoundingClientRect();
  const caixa = pilula.getBoundingClientRect();
  let deslocamento = 0;
  if (caixa.left < caixaLinha.left + FOLGA_ROLAGEM) {
    deslocamento = caixa.left - caixaLinha.left - FOLGA_ROLAGEM;
  } else if (caixa.right > caixaLinha.right - FOLGA_ROLAGEM) {
    deslocamento = caixa.right - caixaLinha.right + FOLGA_ROLAGEM;
  }
  if (deslocamento === 0) {
    return;
  }
  const destino = linha.scrollLeft + deslocamento;
  if (typeof linha.scrollTo === 'function') {
    // 'auto' segue o `scroll-behavior` do CSS (instantâneo com movimento reduzido).
    linha.scrollTo({ left: destino, behavior: instantaneo ? 'instant' : 'auto' });
  } else {
    linha.scrollLeft = destino;
  }
}
