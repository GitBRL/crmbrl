import { formatNumber } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { LucideArrowDown } from '@lucide/angular';

import { Selo } from '../selo/selo';

export interface SerieFunil {
  /** Nome da série ("Site e webhooks"). */
  readonly rotulo: string;
  readonly valor: number;
}

interface Segmento {
  readonly indice: number;
  readonly cor: number;
  readonly inicio: number;
  readonly fim: number;
  readonly capsula: boolean;
  readonly primeiro: boolean;
  readonly antesDeCapsula: boolean;
  readonly valor: string;
  readonly titulo: string;
  /**
   * Os números da barra estão na lista ao lado da pílula (algum segmento não comporta o
   * próprio número): vale para todos os segmentos da barra, nunca só para alguns.
   */
  readonly fora: boolean;
}

/** Largura estimada de um caractere do número (`--fonte-micro`, 11px, algarismos tabulares). */
const LARGURA_CARACTERE = 7;

/**
 * O número de um segmento cabe dentro dele? Conta a largura nominal do segmento na pílula,
 * o texto (7px por caractere), o respiro dos dois lados (14px; 12px na pílula de 40px) e,
 * quando a ponta direita fica sob a cápsula seguinte, mais meia altura.
 */
export function numeroCabe(
  segmento: Pick<Segmento, 'inicio' | 'fim' | 'valor' | 'antesDeCapsula'>,
  larguraPilula: number,
  altura: number,
): boolean {
  const respiro = altura <= 40 ? 12 : 14;
  const necessario =
    segmento.valor.length * LARGURA_CARACTERE +
    2 * respiro +
    (segmento.antesDeCapsula ? altura / 2 : 0);
  return (segmento.fim - segmento.inicio) * larguraPilula >= necessario;
}

/**
 * Barra de funil (DESIGN-SYSTEM.md §6), inspirada no widget "Funnel Conversion":
 * total da etapa, queda em relação à anterior, nome da etapa com o tempo médio e uma pílula
 * com largura proporcional ao total (em relação a `totalReferencia`, a primeira etapa).
 *
 * Dentro da pílula, um segmento por série (ciano → menta → lima → coral). Contando a partir
 * da última série, as de posição ímpar (penúltima, antepenúltima…) são cápsulas com as duas
 * pontas arredondadas, por cima dos vizinhos, invadindo o anterior em meia altura — o efeito
 * de cápsulas empilhadas da referência; a última fica sempre por baixo, encostada à direita.
 * Os números ficam dentro dos segmentos quando todos cabem; se algum não couber, todos saem
 * para uma lista logo depois da pílula (bolinha da cor da série + número), nenhum dentro.
 * Para leitores de tela, cada barra é uma imagem com a descrição completa.
 */
@Component({
  selector: 'app-barra-funil',
  imports: [Selo, LucideArrowDown],
  template: `
    <div class="funil__cabecalho">
      <span class="funil__total">{{ totalFormatado() }}</span>
      @if (quedaFormatada(); as queda) {
        <span class="funil__queda">
          <svg lucideArrowDown [size]="16" />
          <span>{{ queda }}<span class="funil__pct">%</span></span>
        </span>
      }
      <span class="funil__etapa-grupo">
        <span class="funil__etapa">{{ etapa() }}</span>
        @if (tempoMedioDias() !== null) {
          <app-selo>{{ tempoMedioDias() }}d</app-selo>
        }
      </span>
    </div>
    <div class="funil__linha">
      <div #pilula class="funil__barra" [style.--largura]="largura()">
        @for (segmento of segmentos(); track segmento.indice) {
          <span
            class="funil__segmento"
            [class.funil__segmento--capsula]="segmento.capsula"
            [class.funil__segmento--primeiro]="segmento.primeiro"
            [class.funil__segmento--antes-capsula]="segmento.antesDeCapsula"
            [class.funil__segmento--fora]="segmento.fora"
            [attr.data-serie]="segmento.cor"
            [attr.title]="segmento.titulo"
            [style.--inicio]="segmento.inicio"
            [style.--fim]="segmento.fim"
          >
            <span class="funil__valor">{{ segmento.valor }}</span>
          </span>
        }
      </div>
      @if (valoresFora().length) {
        <ul class="funil__valores" aria-hidden="true">
          @for (segmento of valoresFora(); track segmento.indice) {
            <li class="funil__valor-fora" [attr.title]="segmento.titulo">
              <span class="funil__ponto" [attr.data-serie]="segmento.cor"></span>
              {{ segmento.valor }}
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './barra-funil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'funil',
    role: 'img',
    '[attr.aria-label]': 'descricao()',
  },
})
export class BarraFunil {
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pilula = viewChild.required<ElementRef<HTMLElement>>('pilula');

  readonly etapa = input.required<string>();
  readonly total = input.required<number>();
  readonly series = input.required<readonly SerieFunil[]>();
  /** Total da primeira etapa; a largura da barra é `total / totalReferencia`. */
  readonly totalReferencia = input<number | null>(null);
  /** Queda em % em relação à etapa anterior ("↓ 12%"); `null` na primeira etapa. */
  readonly queda = input<number | null>(null);
  /** Tempo médio na etapa, em dias (selo "4d"). */
  readonly tempoMedioDias = input<number | null>(null);

  /** Largura do componente e altura da pílula, medidas no navegador (0 = sem medida). */
  private readonly larguraHost = signal(0);
  private readonly alturaPilula = signal(0);

  protected readonly totalFormatado = computed(() => this.numero(this.total()));

  protected readonly quedaFormatada = computed(() => {
    const queda = this.queda();
    return queda === null ? null : formatNumber(queda, this.locale, '1.0-1');
  });

  /** Largura da pílula em % do espaço disponível. */
  protected readonly largura = computed(() => {
    const referencia = this.totalReferencia() ?? this.total();
    if (referencia <= 0) {
      return 100;
    }
    return Math.round(Math.min(1, Math.max(0, this.total() / referencia)) * 10000) / 100;
  });

  protected readonly segmentos = computed<readonly Segmento[]>(() => {
    const visiveis = this.series()
      .map((serie, indice) => ({ ...serie, indice }))
      .filter((serie) => serie.valor > 0);
    const soma = visiveis.reduce((total, serie) => total + serie.valor, 0);
    if (soma <= 0) {
      return [];
    }
    // Largura final da pílula (não a animada: nada pisca enquanto ela cresce ao aparecer),
    // com o mínimo de duas alturas. Sem medida (jsdom, antes da 1ª renderização), tudo dentro.
    const altura = this.alturaPilula();
    const larguraPilula = Math.max((this.largura() / 100) * this.larguraHost(), 2 * altura);
    const medido = this.larguraHost() > 0 && altura > 0;

    let acumulado = 0;
    const segmentos = visiveis.map((serie, posicao): Omit<Segmento, 'fora'> => {
      const inicio = acumulado / soma;
      acumulado += serie.valor;
      // Paridade contada do fim: a última série fica sempre por baixo, encostada à direita.
      const deTras = visiveis.length - 1 - posicao;
      const valor = this.numero(serie.valor);
      return {
        indice: serie.indice,
        cor: (serie.indice % 4) + 1,
        inicio,
        fim: acumulado / soma,
        capsula: deTras % 2 === 1,
        primeiro: posicao === 0,
        antesDeCapsula: deTras % 2 === 0 && posicao < visiveis.length - 1,
        valor,
        titulo: `${serie.rotulo}: ${valor}`,
      };
    });
    // Tudo dentro ou tudo fora: se algum segmento não comporta o próprio número, todos os
    // números saem para a lista ao lado da pílula (na ordem das séries) e nenhum fica dentro —
    // nunca "98" dentro e "● 96 ● 78" fora na mesma barra.
    const fora =
      medido && segmentos.some((segmento) => !numeroCabe(segmento, larguraPilula, altura));
    return segmentos.map((segmento) => ({ ...segmento, fora }));
  });

  protected readonly valoresFora = computed(() =>
    this.segmentos().filter((segmento) => segmento.fora),
  );

  protected readonly descricao = computed(() => {
    const partes = [`${this.etapa()}: ${this.totalFormatado()}`];
    const series = this.series().map((serie) => `${serie.rotulo} ${this.numero(serie.valor)}`);
    if (series.length) {
      partes.push(series.join(', '));
    }
    const queda = this.quedaFormatada();
    if (queda !== null) {
      partes.push(`queda de ${queda}% em relação à etapa anterior`);
    }
    const dias = this.tempoMedioDias();
    if (dias !== null) {
      partes.push(`tempo médio de ${this.numero(dias)} ${dias === 1 ? 'dia' : 'dias'}`);
    }
    return partes.join('; ');
  });

  constructor() {
    // Mede a largura disponível para decidir quais números cabem dentro dos segmentos.
    // Sem ResizeObserver (jsdom, navegadores antigos), os números ficam todos dentro.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const host = this.host.nativeElement;
      const observador = new ResizeObserver(() => {
        this.larguraHost.set(host.clientWidth);
        this.alturaPilula.set(this.pilula().nativeElement.offsetHeight);
      });
      observador.observe(host);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  private numero(valor: number): string {
    return formatNumber(valor, this.locale, '1.0-1');
  }
}
