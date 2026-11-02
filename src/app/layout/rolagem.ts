import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/** Folga mínima entre o item trazido para a vista e a borda da área que rola. */
const FOLGA_PX = 8;

/**
 * Área rolável mais próxima de `elemento`: sobe pelos ancestrais até achar um com
 * `overflow-y` `auto`/`scroll` e conteúdo maior que a altura visível. Não depende de seletor:
 * a navegação rola dentro do cartão lateral, da gaveta ou do próprio cartão (tela baixa).
 */
export function ancestralRolavel(elemento: HTMLElement): HTMLElement | null {
  const janela = elemento.ownerDocument.defaultView;
  if (!janela) {
    return null;
  }
  for (let atual = elemento.parentElement; atual; atual = atual.parentElement) {
    const { overflowY } = janela.getComputedStyle(atual);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      atual.scrollHeight > atual.clientHeight
    ) {
      return atual;
    }
  }
  return null;
}

/**
 * Mostra `elemento` dentro da área que rola, mexendo só no `scrollTop` dela. A folga respeita
 * o `scroll-padding` da área (a faixa esmaecida das bordas).
 *
 * Não usa `scrollIntoView`: no Chrome e no Edge ele leva o ponto de partida da navegação por
 * Tab para o elemento, e o 1º Tab depois de carregar a página pularia o "Pular para o
 * conteúdo" e a barra superior (WCAG 2.4.1 e 2.4.3). Nem rola a página inteira.
 */
export function trazerParaVista(elemento: HTMLElement): void {
  const area = ancestralRolavel(elemento);
  const janela = elemento.ownerDocument.defaultView;
  if (!area || !janela) {
    return;
  }
  const estilo = janela.getComputedStyle(area);
  const folgaTopo = Math.max(FOLGA_PX, parseFloat(estilo.scrollPaddingTop) || 0);
  const folgaBase = Math.max(FOLGA_PX, parseFloat(estilo.scrollPaddingBottom) || 0);
  const item = elemento.getBoundingClientRect();
  const visivel = area.getBoundingClientRect();
  if (item.top < visivel.top + folgaTopo) {
    area.scrollTop -= visivel.top + folgaTopo - item.top;
  } else if (item.bottom > visivel.bottom - folgaBase) {
    area.scrollTop += item.bottom - (visivel.bottom - folgaBase);
  }
}

/**
 * Área que rola com as bordas esmaecidas quando há conteúdo escondido daquele lado: o sinal de
 * que a lista continua (navegação lateral e gaveta). A diretiva só mede e marca as classes
 * `rolagem-esmaecida--acima`/`--abaixo`; o desenho fica no CSS de quem usa (casca.scss).
 *
 * Mede na rolagem, depois da primeira renderização e sempre que a área ou o conteúdo mudam de
 * tamanho (janela, persona com mais ou menos módulos, gaveta abrindo).
 */
@Directive({
  selector: '[appRolagemEsmaecida]',
  host: {
    class: 'rolagem-esmaecida',
    '[class.rolagem-esmaecida--acima]': 'acima()',
    '[class.rolagem-esmaecida--abaixo]': 'abaixo()',
    '(scroll)': 'medir()',
  },
})
export class RolagemEsmaecida {
  private readonly area = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly acima = signal(false);
  protected readonly abaixo = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.medir();
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observador = new ResizeObserver(() => this.medir());
      observador.observe(this.area);
      for (const filho of this.area.children) {
        observador.observe(filho);
      }
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  protected medir(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.area;
    this.acima.set(scrollTop > 1);
    this.abaixo.set(scrollTop + clientHeight < scrollHeight - 1);
  }
}
