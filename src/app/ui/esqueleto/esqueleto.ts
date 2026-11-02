import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FormaEsqueleto = 'texto' | 'bloco' | 'pilula' | 'circulo';

/**
 * Esqueleto (DESIGN-SYSTEM.md §4.3): o lugar do conteúdo enquanto ele carrega, com a forma
 * dele (nunca um indicador giratório solto). Um brilho atravessa a forma três vezes e para
 * (nenhuma animação passa de 5 s; com movimento reduzido, nem começa).
 *
 * É decorativo (`aria-hidden`): quem carrega marca o contêiner com `aria-busy="true"` e diz
 * "Carregando…" num `role="status"` (a tabela já faz isso).
 *
 * - `texto`: `linhas` linhas de texto (a última mais curta);
 * - `bloco`: retângulo com o raio de painel (`altura` obrigatória na prática: padrão 96px);
 * - `pilula`: botão/selo/campo (44px);
 * - `circulo`: avatar (`largura` = diâmetro, padrão 44px).
 *
 * `<app-esqueleto forma="texto" [linhas]="2" largura="60%" />`
 */
@Component({
  selector: 'app-esqueleto',
  template: `
    @for (linha of indicesLinhas(); track linha) {
      <span
        class="esqueleto__forma"
        [style.width]="linha === indicesLinhas().length - 1 && linha > 0 ? '62%' : null"
      ></span>
    }
  `,
  styleUrl: './esqueleto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'esqueleto',
    'aria-hidden': 'true',
    '[class]': "'esqueleto--' + forma()",
    '[style.--_largura]': 'largura()',
    '[style.--_altura]': 'altura()',
  },
})
export class Esqueleto {
  readonly forma = input<FormaEsqueleto>('texto');
  /** Largura em CSS ("12rem", "60%"). */
  readonly largura = input<string | null>(null);
  /** Altura em CSS (bloco, pílula). */
  readonly altura = input<string | null>(null);
  /** Linhas de texto (forma `texto`). */
  readonly linhas = input(1);

  protected readonly indicesLinhas = computed(() =>
    Array.from({ length: this.forma() === 'texto' ? Math.max(1, this.linhas()) : 1 }, (_, i) => i),
  );
}
