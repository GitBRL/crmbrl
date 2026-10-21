import { formatNumber } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideMinus } from '@lucide/angular';

import { Dica } from '../dica/dica';
import { Selo } from '../selo/selo';

/** Unidade da variação: "%" (variação relativa), "p.p." (pontos percentuais) ou "pts". */
export type UnidadeVariacao = '%' | 'p.p.' | 'pts';

/** Folga sobre a largura medida do par: arredondamentos não fazem o número passar da célula. */
const FOLGA = 1.01;

/**
 * Largura do par (prefixo + número + unidade) em "em" do próprio número: a largura medida
 * dividida pelo tamanho atual da fonte, que não muda com a escala. Sem layout (jsdom), `null`.
 */
export function larguraEmDoPar(par: HTMLElement): number | null {
  const largura = par.getBoundingClientRect().width;
  const fonte = parseFloat(getComputedStyle(par).fontSize);
  return largura > 0 && fonte > 0 ? largura / fonte : null;
}

/**
 * Indicador (KPI) — DESIGN-SYSTEM.md §4: número grande e leve (56/300) com a unidade menor,
 * legenda curta em texto fraco (até duas linhas) e, opcionalmente, um selo de variação
 * (menta para alta, coral para queda — ou o contrário com `quedaEhBoa`) e uma dica.
 *
 * Número, prefixo e unidade formam um par que nunca quebra; abaixo (padrão), o indicador ocupa
 * a largura que recebe e o número encolhe aos poucos quando a célula é estreita demais para
 * ele (unidades `cqi`), em vez de mandar "mil" sozinho para a linha de baixo. O componente mede
 * a largura do próprio par em "em" (`--_numero-em`) para o CSS só encolher o número que não cabe.
 *
 * `valor` numérico é formatado em pt-BR (`casas` = digitsInfo do Angular, padrão "1.0-1").
 */
@Component({
  selector: 'app-indicador',
  imports: [Selo, Dica],
  template: `
    <p class="indicador__numero">
      <!-- Número e unidades nunca se separam (.sem-quebra): "mil" não desce sozinho. -->
      <span #par class="indicador__par sem-quebra">
        @if (prefixo(); as prefixo) {
          <span class="indicador__unidade indicador__unidade--antes">{{ prefixo }}</span>
        }
        <span class="indicador__valor">{{ valorFormatado() }}</span>
        @if (unidade(); as unidade) {
          <span class="indicador__unidade">{{ unidade }}</span>
        }
      </span>
      @if (variacaoInfo(); as variacao) {
        @if (variacaoAbaixo()) {
          <span class="indicador__quebra" aria-hidden="true"></span>
        }
        <app-selo
          class="indicador__variacao"
          [variante]="variacao.variante"
          [icone]="variacao.icone"
        >
          <span class="visualmente-oculto">{{ variacao.descricao }}</span>
          <span aria-hidden="true">{{ variacao.texto }}</span>
        </app-selo>
      }
    </p>
    <div class="indicador__rodape">
      <span class="indicador__legenda">{{ legenda() }}</span>
      @if (dica(); as dica) {
        <app-dica [texto]="dica" [rotulo]="'Sobre: ' + legenda()" />
      }
    </div>
  `,
  styleUrl: './indicador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'indicador',
    '[class.indicador--lado]': "disposicao() === 'lado'",
    '[class.indicador--sm]': "tamanho() === 'sm'",
    '[class.indicador--variacao-abaixo]': 'variacaoAbaixo()',
  },
})
export class Indicador {
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly par = viewChild.required<ElementRef<HTMLElement>>('par');
  /** Vira `true` quando as fontes terminam de carregar: a medida é refeita com a Urbanist. */
  private readonly fontesProntas = signal(false);

  readonly valor = input.required<number | string>();
  /** Depois do número, em tamanho menor: "%", "d", "mil". */
  readonly unidade = input<string | null>(null);
  /** Antes do número, em tamanho menor: "R$". */
  readonly prefixo = input<string | null>(null);
  readonly legenda = input.required<string>();
  /**
   * Variação no período (ex.: 4.2 → "↑ 4,2%"); `null` esconde o selo. A unidade do texto sai
   * de `unidadeVariacao`.
   */
  readonly variacao = input<number | null>(null);
  /**
   * "%" para variação relativa (padrão), "p.p." quando o próprio indicador é uma taxa
   * (taxa de ganho: 46,5% → 48,6% = "2,1 p.p.") e "pts" para notas (health score).
   */
  readonly unidadeVariacao = input<UnidadeVariacao>('%');
  /** Põe o selo de variação numa linha própria, abaixo do número (cartões estreitos). */
  readonly variacaoAbaixo = input(false, { transform: booleanAttribute });
  /** Inverte as cores da variação (ex.: ciclo de venda, onde cair é bom). */
  readonly quedaEhBoa = input(false, { transform: booleanAttribute });
  readonly dica = input<string | null>(null);
  readonly disposicao = input<'abaixo' | 'lado'>('abaixo');
  /** `md` usa `--fonte-numero` (56px); `sm` usa `--fonte-h1` (40px). */
  readonly tamanho = input<'md' | 'sm'>('md');
  readonly casas = input('1.0-1');

  protected readonly valorFormatado = computed(() => {
    const valor = this.valor();
    return typeof valor === 'number' ? formatNumber(valor, this.locale, this.casas()) : valor;
  });

  protected readonly variacaoInfo = computed(() => {
    const variacao = this.variacao();
    if (variacao === null) {
      return null;
    }
    const absoluto = Math.abs(variacao);
    const numero = formatNumber(absoluto, this.locale, '1.0-1');
    const unidade = this.unidadeVariacao();
    const umPonto = absoluto === 1;
    const texto =
      unidade === '%' ? `${numero}%` : `${numero} ${unidade === 'pts' && umPonto ? 'pt' : unidade}`;
    const extenso =
      unidade === 'p.p.'
        ? `${numero} ${umPonto ? 'ponto percentual' : 'pontos percentuais'}`
        : unidade === 'pts'
          ? `${numero} ${umPonto ? 'ponto' : 'pontos'}`
          : texto;
    if (variacao === 0) {
      return {
        variante: 'neutro' as const,
        icone: LucideMinus,
        texto,
        descricao: `Estável: ${extenso}`,
      };
    }
    const alta = variacao > 0;
    const boa = alta !== this.quedaEhBoa();
    return {
      variante: boa ? ('menta' as const) : ('coral' as const),
      icone: alta ? LucideArrowUp : LucideArrowDown,
      texto,
      descricao: `${alta ? 'Alta' : 'Queda'} de ${extenso}`,
    };
  });

  constructor() {
    // Mede o par depois de renderizar (e de novo quando o texto, o tamanho ou a fonte mudam):
    // o CSS usa `--_numero-em` para encolher o número só quando *ele* não cabe na célula.
    const injector = inject(Injector);
    effect(() => {
      this.valorFormatado();
      this.prefixo();
      this.unidade();
      this.tamanho();
      this.fontesProntas();
      afterNextRender(() => this.medirPar(), { injector });
    });
    const documento = inject(DOCUMENT);
    afterNextRender(() => {
      const fontes = documento.fonts as FontFaceSet | undefined;
      if (fontes && fontes.status !== 'loaded') {
        void fontes.ready.then(() => this.fontesProntas.set(true));
      }
    });
  }

  private medirPar(): void {
    const em = larguraEmDoPar(this.par().nativeElement);
    if (em !== null) {
      this.host.nativeElement.style.setProperty('--_numero-em', (em * FOLGA).toFixed(3));
    }
  }
}
