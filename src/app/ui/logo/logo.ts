import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Símbolo da BRL (DESIGN-SYSTEM.md §9): o leque de quatro barras — horizontal, ~31°, ~60,5° e
 * vertical, todas com a mesma espessura —, medido na assinatura oficial colorida e redesenhado
 * em vetor. No app ele é sempre monocromático: as quatro barras viram uma forma só, na cor
 * `--cor-logo`. Mesmo desenho do favicon (public/favicon.svg).
 */
export const CAMINHO_SIMBOLO_BRL =
  'M0 313L346 313L346 393L0 393Z' +
  'M25 207.4L66.8 137.7L346.6 305.6L304.8 375.3Z' +
  'M208.3 25.8L375.7 322.1L304.8 362.1L137.4 65.8Z' +
  'M306 0L386 0L386 393L306 393Z';

/** Proporção largura/altura do símbolo (viewBox 386 × 393). */
const PROPORCAO_SIMBOLO = 386 / 393;

/**
 * Logo do BRL CRM: o símbolo da BRL + "BRL" (Urbanist 800) e "CRM" (Urbanist 300), tudo em
 * `--cor-logo` — preto no tema claro, branco no escuro. As proporções seguem a assinatura
 * oficial da marca e escalam com `tamanho` (a altura do símbolo).
 * Puramente visual: envolva num link para a visão geral, se for o caso.
 */
@Component({
  selector: 'app-logo',
  template: `
    <svg
      class="logo__simbolo"
      viewBox="0 0 386 393"
      aria-hidden="true"
      focusable="false"
      [attr.width]="larguraSimbolo()"
      [attr.height]="tamanho()"
    >
      <path [attr.d]="caminho" />
    </svg>
    @if (!somenteSimbolo()) {
      <span class="logo__nome" aria-hidden="true">
        <span class="logo__brl">BRL</span><span class="logo__produto">CRM</span>
      </span>
    }
    <span class="visualmente-oculto">BRL CRM</span>
  `,
  styleUrl: './logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'logo',
    '[style.--logo-altura.px]': 'tamanho()',
  },
})
export class Logo {
  /** Só o símbolo (mobile, navegação recolhida). */
  readonly somenteSimbolo = input(false, { transform: booleanAttribute });
  /** Altura do símbolo em px; o nome escala junto. */
  readonly tamanho = input(28);

  protected readonly caminho = CAMINHO_SIMBOLO_BRL;
  protected readonly larguraSimbolo = computed(
    () => Math.round(this.tamanho() * PROPORCAO_SIMBOLO * 100) / 100,
  );
}
