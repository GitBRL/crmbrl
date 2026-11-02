import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import { type EstadoConexao, TempoRealService } from '../nucleo/tempo-real/tempo-real.service';

/** Quedas mais curtas que isto não aparecem (sem piscar a cada oscilação da rede). */
export const ATRASO_RECONECTANDO_MS = 2_500;
/** Quanto tempo o "Conectado" / "Conectado de novo" fica depois que a conexão é feita. */
export const DURACAO_RECONECTADO_MS = 2_500;

type Situacao = 'oculto' | 'conectando' | 'reconectando' | 'conectado' | 'reconectado';

/**
 * Indicador discreto do tempo real (contrato da Onda A, §2.2): uma pílula pequena na barra
 * superior, antes dos botões da direita (no celular, flutuando logo abaixo da barra), que só
 * aparece quando a conexão ao vivo está fora há mais de `ATRASO_RECONECTANDO_MS` —
 * "Reconectando…" depois de uma queda, "Conectando…" se a primeira conexão ainda não deu certo
 * — e, quando ela é feita, diz "Conectado de novo" (ou "Conectado") por alguns segundos. O resto do CRM continua
 * funcionando (as ações vão pela API); só as atualizações ao vivo esperam. A pílula não pega
 * cliques e não ocupa espaço quando está oculta.
 *
 * A região viva (`role="status"`) existe sempre, para o leitor de tela anunciar as trocas.
 */
@Component({
  selector: 'app-indicador-conexao',
  template: `
    <p
      class="conexao"
      role="status"
      [class.conexao--visivel]="situacao() !== 'oculto'"
      [class.conexao--ok]="situacao() === 'reconectado' || situacao() === 'conectado'"
    >
      @if (situacao() === 'reconectando' || situacao() === 'conectando') {
        <span class="conexao__ponto" aria-hidden="true"></span>
        {{ situacao() === 'reconectando' ? 'Reconectando…' : 'Conectando…' }}
        <span class="visualmente-oculto"
          >As atualizações ao vivo começam assim que a conexão for feita.</span
        >
      } @else if (situacao() === 'reconectado' || situacao() === 'conectado') {
        <span class="conexao__ponto" aria-hidden="true"></span>
        {{ situacao() === 'reconectado' ? 'Conectado de novo' : 'Conectado' }}
      }
    </p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: flex;
      flex: none;
      pointer-events: none;
    }

    // Celular: a barra não tem espaço; a pílula flutua logo abaixo dela, no meio.
    @include m.abaixo(m.$md) {
      :host {
        position: fixed;
        top: calc(var(--casca-altura-topo, 68px) + var(--esp-1));
        left: 50%;
        z-index: var(--z-cabecalho);
        transform: translateX(-50%);
      }

      .conexao {
        box-shadow: var(--sombra-flutuante);
      }
    }

    .conexao {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: 28px;
      padding: 0 var(--esp-3);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-flutuante);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
      white-space: nowrap;
      opacity: 0;
      transform: translateY(-4px);
      transition:
        opacity var(--duracao-opacidade) ease-out,
        transform var(--duracao) var(--curva);

      &:empty {
        display: none;
      }
    }

    .conexao--visivel {
      opacity: 1;
      transform: none;
    }

    // Ponto lima (atenção) que pulsa três vezes e para; menta quando a conexão voltou.
    .conexao__ponto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cor-aviso);
      animation: pulso-conexao 1.4s var(--curva) 3;
    }

    .conexao--ok .conexao__ponto {
      background: var(--cor-sucesso);
      animation: none;
    }

    @keyframes pulso-conexao {
      50% {
        opacity: 0.35;
      }
    }

    @media (forced-colors: active) {
      .conexao__ponto {
        forced-color-adjust: none;
        background: CanvasText;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadorConexao {
  private readonly tempoReal = inject(TempoRealService);
  protected readonly situacao = signal<Situacao>('oculto');
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const estado = this.tempoReal.estado();
      untracked(() => this.acompanhar(estado));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  private acompanhar(estado: EstadoConexao): void {
    const situacao = this.situacao();
    if (estado === 'conectando' || estado === 'reconectando') {
      if (situacao === 'conectando' || situacao === 'reconectando') {
        this.situacao.set(estado); // já à mostra: só troca o texto
        return;
      }
      clearTimeout(this.temporizador);
      this.situacao.set('oculto');
      this.temporizador = setTimeout(() => this.situacao.set(estado), ATRASO_RECONECTANDO_MS);
      return;
    }
    clearTimeout(this.temporizador);
    if (estado === 'conectado' && (situacao === 'reconectando' || situacao === 'conectando')) {
      this.situacao.set(situacao === 'reconectando' ? 'reconectado' : 'conectado');
      this.temporizador = setTimeout(() => this.situacao.set('oculto'), DURACAO_RECONECTADO_MS);
      return;
    }
    if ((situacao !== 'reconectado' && situacao !== 'conectado') || estado === 'desligado') {
      this.situacao.set('oculto');
    }
  }
}
