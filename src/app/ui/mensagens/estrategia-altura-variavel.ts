import type { CdkVirtualScrollViewport, VirtualScrollStrategy } from '@angular/cdk/scrolling';
import { distinctUntilChanged, Subject } from 'rxjs';

export interface OpcoesEstrategia {
  /** Altura de um item ainda não medido (px). */
  readonly estimativa: number;
  /** Quanto renderizar além da área visível, em cima e embaixo (px). */
  readonly reserva: number;
  /** Distância do fim que ainda conta como "no fim" (px). */
  readonly toleranciaFim: number;
  /** Distância do topo que pede as mensagens anteriores (px). */
  readonly distanciaTopo: number;
}

export const OPCOES_ESTRATEGIA: OpcoesEstrategia = {
  estimativa: 72,
  reserva: 600,
  toleranciaFim: 48,
  distanciaTopo: 400,
};

/**
 * Rolagem virtual com itens de alturas diferentes, para conversas (`@angular/cdk/scrolling`
 * só traz a de altura fixa). Cada item renderizado tem `data-chave` no elemento raiz; a
 * estratégia mede a altura real (ResizeObserver: também quando uma imagem termina de carregar)
 * e guarda por chave, então inserir mensagens antigas no começo não perde nenhuma medida.
 *
 * Comportamento de conversa:
 * - **grudada no fim**: começa na mensagem mais recente e, enquanto a pessoa estiver no fim,
 *   continua nele quando chegam mensagens ou alturas mudam;
 * - **âncora**: fora do fim, a primeira mensagem visível fica no mesmo lugar quando entram
 *   mensagens antes dela (carregar anteriores) ou quando alturas acima dela mudam;
 * - **perto do topo**: avisa (`aoChegarNoTopo`) quando a pessoa rola para cima até perto do
 *   começo, ou quando o conteúdo nem enche a área.
 *
 * Uso interno de `app-lista-mensagens`.
 */
export class EstrategiaAlturaVariavel implements VirtualScrollStrategy {
  private readonly indice = new Subject<number>();
  readonly scrolledIndexChange = this.indice.pipe(distinctUntilChanged());

  /** Chaves dos itens, na ordem dos dados (a lista informa). */
  chaves: () => readonly string[] = () => [];
  /** Itens que servem de âncora (as mensagens; o topo e os separadores mudam de lugar). */
  podeAncorar: (chave: string) => boolean = () => true;
  /** A rolagem chegou perto do topo. */
  aoChegarNoTopo: () => void = () => undefined;
  /** Entrou ou saiu do fim da conversa. */
  aoMudarFim: (noFim: boolean) => void = () => undefined;

  private viewport: CdkVirtualScrollViewport | null = null;
  private conteudo: HTMLElement | null = null;
  private readonly alturas = new Map<string, number>();
  /** `posicoes[i]` é o topo do item `i`; `posicoes[n]`, a altura total. */
  private posicoes: number[] = [0];
  private chavesAtuais: readonly string[] = [];
  private grudada = true;
  private ancora: { readonly chave: string; readonly deslocamento: number } | null = null;
  private ultimoTopo = 0;
  private observadorItens: ResizeObserver | null = null;
  private observadorFilhos: MutationObserver | null = null;
  private observadorArea: ResizeObserver | null = null;
  private quadro = 0;

  constructor(private readonly opcoes: OpcoesEstrategia = OPCOES_ESTRATEGIA) {}

  /** Está no fim da conversa (e vai continuar nele quando chegar mensagem). */
  get noFim(): boolean {
    return this.grudada;
  }

  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
    const area = viewport.elementRef.nativeElement;
    this.conteudo = area.querySelector<HTMLElement>('.cdk-virtual-scroll-content-wrapper');
    if (typeof ResizeObserver !== 'undefined' && this.conteudo) {
      const itens = new ResizeObserver(() => this.agendarMedicao());
      this.observadorItens = itens;
      for (const filho of Array.from(this.conteudo.children)) {
        itens.observe(filho);
      }
      this.observadorFilhos = new MutationObserver((registros) => {
        for (const registro of registros) {
          registro.addedNodes.forEach((no) => no instanceof Element && itens.observe(no));
          registro.removedNodes.forEach((no) => no instanceof Element && itens.unobserve(no));
        }
        this.agendarMedicao();
      });
      this.observadorFilhos.observe(this.conteudo, { childList: true });
      // A área muda de altura quando o compositor cresce ou a janela muda.
      this.observadorArea = new ResizeObserver(() => viewport.checkViewportSize());
      this.observadorArea.observe(area);
    }
    this.recalcular();
  }

  detach(): void {
    this.observadorItens?.disconnect();
    this.observadorFilhos?.disconnect();
    this.observadorArea?.disconnect();
    this.observadorItens = this.observadorFilhos = this.observadorArea = null;
    if (this.quadro) {
      cancelAnimationFrame(this.quadro);
      this.quadro = 0;
    }
    this.viewport = null;
    this.conteudo = null;
  }

  onContentScrolled(): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const topo = viewport.measureScrollOffset('top');
    this.lembrarPosicao(topo);
    this.atualizarFaixa();
    const total = this.posicoes[this.posicoes.length - 1];
    const subindo = topo < this.ultimoTopo;
    this.ultimoTopo = topo;
    if (
      this.chavesAtuais.length > 0 &&
      topo < this.opcoes.distanciaTopo &&
      (subindo || total <= viewport.getViewportSize())
    ) {
      this.aoChegarNoTopo();
    }
  }

  onDataLengthChanged(): void {
    this.recalcular();
  }

  onContentRendered(): void {
    this.medir();
  }

  onRenderedOffsetChanged(): void {
    // As posições já vêm das medidas.
  }

  scrollToIndex(indice: number, comportamento: ScrollBehavior): void {
    const alvo = this.posicoes[Math.max(0, Math.min(indice, this.posicoes.length - 1))] ?? 0;
    this.definirGrudada(false);
    this.rolar(alvo, comportamento);
  }

  /** Vai para a mensagem mais recente e passa a acompanhar o fim. */
  rolarParaOFim(comportamento: ScrollBehavior = 'auto'): void {
    this.definirGrudada(true);
    const viewport = this.viewport;
    if (viewport) {
      const total = this.posicoes[this.posicoes.length - 1];
      this.rolar(Math.max(0, total - viewport.getViewportSize()), comportamento);
    }
  }

  /** Mede os itens na tela; se alguma altura mudou, recalcula as posições. */
  medir(): void {
    if (!this.conteudo) {
      return;
    }
    let mudou = false;
    for (const filho of Array.from(this.conteudo.children)) {
      const chave = (filho as HTMLElement).dataset?.['chave'];
      if (!chave) {
        continue;
      }
      const altura = filho.getBoundingClientRect().height;
      if (altura > 0 && Math.abs((this.alturas.get(chave) ?? -1) - altura) > 0.5) {
        this.alturas.set(chave, altura);
        mudou = true;
      }
    }
    if (mudou) {
      this.recalcular();
    }
  }

  /** Rola a área até `px` (sem `scrollTo` — o jsdom dos testes —, ajusta o `scrollTop`). */
  private rolar(px: number, comportamento: ScrollBehavior = 'auto'): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const area = viewport.elementRef.nativeElement;
    if (typeof area.scrollTo === 'function') {
      viewport.scrollToOffset(px, comportamento);
    } else {
      area.scrollTop = px;
    }
  }

  private agendarMedicao(): void {
    if (this.quadro) {
      return;
    }
    this.quadro = requestAnimationFrame(() => {
      this.quadro = 0;
      this.medir();
    });
  }

  private recalcular(): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const chaves = this.chaves().slice(0, viewport.getDataLength());
    const posicoes = [0];
    for (let i = 0; i < chaves.length; i++) {
      posicoes.push(posicoes[i] + (this.alturas.get(chaves[i]) ?? this.opcoes.estimativa));
    }
    this.posicoes = posicoes;
    this.chavesAtuais = chaves;
    const total = posicoes[chaves.length];
    viewport.setTotalContentSize(total);

    const altura = viewport.getViewportSize();
    const topo = viewport.measureScrollOffset('top');
    let alvo: number | null = null;
    if (this.grudada) {
      alvo = Math.max(0, total - altura);
    } else if (this.ancora) {
      const indice = chaves.indexOf(this.ancora.chave);
      if (indice >= 0) {
        alvo = Math.max(0, posicoes[indice] - this.ancora.deslocamento);
      }
    }
    if (alvo !== null && Math.abs(alvo - topo) > 0.5) {
      this.rolar(alvo);
      this.ultimoTopo = alvo;
    }
    this.atualizarFaixa(alvo ?? topo);
  }

  private atualizarFaixa(topoConhecido?: number): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const n = this.chavesAtuais.length;
    if (n === 0) {
      viewport.setRenderedRange({ start: 0, end: 0 });
      viewport.setRenderedContentOffset(0);
      return;
    }
    const topo = topoConhecido ?? viewport.measureScrollOffset('top');
    const altura = viewport.getViewportSize() || this.opcoes.reserva;
    const inicio = this.indiceEm(Math.max(0, topo - this.opcoes.reserva));
    const fim = Math.min(n, this.indiceEm(topo + altura + this.opcoes.reserva) + 1);
    viewport.setRenderedRange({ start: inicio, end: fim });
    viewport.setRenderedContentOffset(this.posicoes[inicio]);
    this.indice.next(this.indiceEm(topo));
  }

  private lembrarPosicao(topo: number): void {
    const viewport = this.viewport;
    if (!viewport) {
      return;
    }
    const total = this.posicoes[this.posicoes.length - 1];
    this.definirGrudada(topo + viewport.getViewportSize() >= total - this.opcoes.toleranciaFim);
    let indice = this.indiceEm(topo);
    while (indice < this.chavesAtuais.length && !this.podeAncorar(this.chavesAtuais[indice])) {
      indice++;
    }
    const chave = this.chavesAtuais[indice];
    this.ancora = chave ? { chave, deslocamento: this.posicoes[indice] - topo } : null;
  }

  private definirGrudada(grudada: boolean): void {
    if (grudada !== this.grudada) {
      this.grudada = grudada;
      this.aoMudarFim(grudada);
    }
  }

  /** O item que contém a posição `px` (busca binária nas posições). */
  private indiceEm(px: number): number {
    const n = this.chavesAtuais.length;
    let baixo = 0;
    let alto = n - 1;
    while (baixo < alto) {
      const meio = (baixo + alto + 1) >> 1;
      if (this.posicoes[meio] <= px) {
        baixo = meio;
      } else {
        alto = meio - 1;
      }
    }
    return Math.max(0, Math.min(baixo, n - 1));
  }
}
