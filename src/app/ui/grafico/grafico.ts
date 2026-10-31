import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { ECharts } from 'echarts/core';

import { TemaService } from '../../nucleo/tema.service';
import { Esqueleto } from '../esqueleto/esqueleto';
import { lerPaleta, type PaletaGrafico } from './paleta';

/** O que o gráfico precisa do ECharts (o resto do módulo fica de fora do pacote inicial). */
export interface MotorDeGraficos {
  init(
    elemento: HTMLElement,
    tema?: null,
    opcoes?: { renderer: 'svg' },
  ): Pick<ECharts, 'on' | 'setOption' | 'resize' | 'dispose'>;
}

/**
 * Como carregar o ECharts: por padrão, sob demanda (chunk próprio); os testes entregam um motor
 * falso pelo `TestBed`, já que o ECharts não desenha no jsdom.
 */
export const CARREGADOR_ECHARTS = new InjectionToken<() => Promise<{ echarts: MotorDeGraficos }>>(
  'CARREGADOR_ECHARTS',
  {
    providedIn: 'root',
    factory: () => () => import('./echarts-modulos') as Promise<{ echarts: MotorDeGraficos }>,
  },
);

/** Recebe a paleta do tema em uso e devolve a opção do ECharts. */
export type ConstrutorOpcao = (paleta: PaletaGrafico) => EChartsCoreOption;

/** O que o clique num ponto do gráfico entrega: o dado que a tela pôs ali. */
export interface CliqueNoGrafico {
  readonly nome: string;
  readonly serie: string;
  readonly indice: number;
  /** O `data` do ponto (a tela guarda ali, por exemplo, o `id` para filtrar a lista). */
  readonly dado: unknown;
}

/**
 * Gráfico (DESIGN-SYSTEM.md §6): envolve o ECharts, carregado sob demanda (só barras, linhas e
 * o desenho em SVG; o pacote inicial não cresce). A tela passa um **construtor de opção** que
 * recebe a paleta lida dos tokens, então o desenho se refaz sozinho quando o tema muda. Acompanha
 * o tamanho do contêiner e respeita "reduzir movimento".
 *
 * Todo gráfico precisa de alternativa textual: `rotulo` descreve o que ele mostra (lido por
 * leitores de tela) e a tela oferece os mesmos números em tabela.
 *
 * `<app-grafico rotulo="Leads por dia" [opcao]="construir" (clique)="abrir($event)" />`
 */
@Component({
  selector: 'app-grafico',
  imports: [Esqueleto],
  template: `
    <div #area class="grafico__area" role="img" [attr.aria-label]="rotulo()"></div>
    @if (estado() === 'carregando') {
      <div class="grafico__espera" aria-hidden="true">
        <app-esqueleto forma="bloco" altura="100%" largura="100%" />
      </div>
    }
    @if (estado() === 'falha') {
      <p class="grafico__falha" role="alert">
        Não deu para desenhar o gráfico. Veja os números na tabela.
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      min-width: 0;
      height: var(--grafico-altura, 16rem);
    }

    .grafico__area {
      position: absolute;
      inset: 0;
    }

    .grafico__espera {
      position: absolute;
      inset: 0;
    }

    .grafico__falha {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      padding: var(--esp-4);
      text-align: center;
      font: var(--fonte-corpo-sm);
      color: var(--cor-texto-suave);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--grafico-altura]': 'altura()' },
})
export class Grafico {
  private readonly documento = inject(DOCUMENT);
  private readonly tema = inject(TemaService);
  private readonly carregador = inject(CARREGADOR_ECHARTS);
  private readonly area = viewChild.required<ElementRef<HTMLElement>>('area');

  readonly opcao = input.required<ConstrutorOpcao>();
  /** Frase que descreve o gráfico para leitores de tela. */
  readonly rotulo = input.required<string>();
  readonly altura = input('16rem');
  /** Clique num ponto (barra ou marcador). */
  readonly clique = output<CliqueNoGrafico>();

  protected readonly estado = signal<'carregando' | 'pronto' | 'falha'>('carregando');
  private grafico: ReturnType<MotorDeGraficos['init']> | null = null;
  private observador: ResizeObserver | null = null;
  private destruido = false;

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      // Refaz o desenho quando a opção ou o tema mudam.
      this.opcao();
      this.tema.tema();
      if (this.estado() === 'pronto') {
        untracked(() => this.desenhar());
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      this.observador?.disconnect();
      this.grafico?.dispose();
      this.grafico = null;
    });
  }

  private async iniciar(): Promise<void> {
    try {
      const { echarts } = await this.carregador();
      if (this.destruido) {
        return;
      }
      const grafico = echarts.init(this.area().nativeElement, null, { renderer: 'svg' });
      this.grafico = grafico;
      grafico.on('click', (parametros: unknown) => {
        const p = parametros as {
          name?: string;
          seriesName?: string;
          dataIndex?: number;
          data?: unknown;
        };
        this.clique.emit({
          nome: p.name ?? '',
          serie: p.seriesName ?? '',
          indice: p.dataIndex ?? 0,
          dado: p.data,
        });
      });
      if (typeof ResizeObserver !== 'undefined') {
        this.observador = new ResizeObserver(() => this.grafico?.resize());
        this.observador.observe(this.area().nativeElement);
      }
      // O `effect` do construtor faz o primeiro desenho assim que o estado vira "pronto".
      this.estado.set('pronto');
    } catch {
      if (!this.destruido) {
        this.estado.set('falha');
      }
    }
  }

  private desenhar(): void {
    const grafico = this.grafico;
    if (!grafico) {
      return;
    }
    const paleta = lerPaleta(this.documento.documentElement);
    const semMovimento =
      this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ??
      false;
    grafico.setOption(
      {
        animation: !semMovimento,
        textStyle: { fontFamily: paleta.familia },
        ...this.opcao()(paleta),
      },
      { notMerge: true },
    );
  }
}
