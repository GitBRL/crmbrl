import type { ListRange } from '@angular/cdk/collections';
import type { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

import { EstrategiaAlturaVariavel, OPCOES_ESTRATEGIA } from './estrategia-altura-variavel';

const ESTIMATIVA = OPCOES_ESTRATEGIA.estimativa;

/** Viewport falso: guarda a rolagem, o tamanho total e a faixa renderizada. */
class ViewportFalso {
  topo = 0;
  total = 0;
  faixa: ListRange = { start: 0, end: 0 };
  deslocamento = 0;
  readonly rolagens: { px: number; comportamento?: ScrollBehavior }[] = [];
  readonly area = document.createElement('div');
  readonly conteudo = document.createElement('div');
  readonly elementRef = { nativeElement: this.area };

  constructor(
    public chaves: string[],
    public altura = 500,
  ) {
    this.conteudo.className = 'cdk-virtual-scroll-content-wrapper';
    this.area.appendChild(this.conteudo);
    // O jsdom não tem scrollTo: com ele, a estratégia rola pelo viewport (scrollToOffset).
    Object.defineProperty(this.area, 'scrollTo', { value: () => undefined, configurable: true });
  }

  getDataLength = () => this.chaves.length;
  getViewportSize = () => this.altura;
  measureScrollOffset = () => this.topo;
  setTotalContentSize = (total: number) => (this.total = total);
  setRenderedRange = (faixa: ListRange) => (this.faixa = faixa);
  setRenderedContentOffset = (px: number) => (this.deslocamento = px);
  scrollToOffset = (px: number, comportamento?: ScrollBehavior) => {
    this.topo = px;
    this.rolagens.push({ px, comportamento });
  };
  checkViewportSize = () => undefined;

  /** Renderiza os itens da faixa atual com as alturas dadas (o resto, a estimativa). */
  renderizar(alturas: Readonly<Record<string, number>> = {}): void {
    this.conteudo.replaceChildren(
      ...this.chaves.slice(this.faixa.start, this.faixa.end).map((chave) => {
        const item = document.createElement('div');
        item.dataset['chave'] = chave;
        const altura = alturas[chave] ?? ESTIMATIVA;
        item.getBoundingClientRect = () => ({ height: altura }) as DOMRect;
        return item;
      }),
    );
  }
}

function chavesDeMensagens(de: number, ate: number): string[] {
  const chaves = ['topo'];
  for (let i = de; i <= ate; i++) {
    chaves.push(`m:${i}`);
  }
  return chaves;
}

function montar(chaves: string[], altura = 500) {
  const viewport = new ViewportFalso(chaves, altura);
  const estrategia = new EstrategiaAlturaVariavel();
  estrategia.chaves = () => viewport.chaves;
  estrategia.podeAncorar = (chave) => chave.startsWith('m:');
  const eventos = { topo: 0, fim: [] as boolean[] };
  estrategia.aoChegarNoTopo = () => eventos.topo++;
  estrategia.aoMudarFim = (noFim) => eventos.fim.push(noFim);
  estrategia.attach(viewport as unknown as CdkVirtualScrollViewport);
  return { viewport, estrategia, eventos };
}

describe('EstrategiaAlturaVariavel', () => {
  it('começa grudada no fim, com o tamanho total pelas estimativas e só os itens perto da tela', () => {
    const { viewport, estrategia } = montar(chavesDeMensagens(1, 100));
    const total = 101 * ESTIMATIVA;
    expect(viewport.total).toBe(total);
    expect(estrategia.noFim).toBe(true);
    expect(viewport.topo).toBe(total - 500);
    // Reserva de 600px acima e abaixo da área visível.
    expect(viewport.faixa.end).toBe(101);
    expect(viewport.faixa.start).toBeGreaterThan(70);
    expect(viewport.deslocamento).toBe(viewport.faixa.start * ESTIMATIVA);
  });

  it('mede as alturas reais por chave e continua no fim quando elas mudam', () => {
    const { viewport, estrategia } = montar(chavesDeMensagens(1, 20));
    viewport.renderizar({ 'm:20': 300 });
    estrategia.onContentRendered();
    const total = 21 * ESTIMATIVA + (300 - ESTIMATIVA);
    expect(viewport.total).toBe(total);
    expect(viewport.topo).toBe(total - 500);
  });

  it('fora do fim, a mensagem visível fica no lugar quando as anteriores entram no começo', () => {
    const { viewport, estrategia, eventos } = montar(chavesDeMensagens(1, 60));
    // A pessoa sobe até 1000px: deixa o fim.
    viewport.topo = 1000;
    estrategia.onContentScrolled();
    expect(estrategia.noFim).toBe(false);
    expect(eventos.fim).toEqual([false]);
    const indice = Math.floor(1000 / ESTIMATIVA); // item no topo da área visível
    const chave = viewport.chaves[indice];
    const deslocamento = indice * ESTIMATIVA - 1000;

    // Chegam 10 mensagens mais antigas antes de todas.
    viewport.chaves = ['topo', ...chavesDeMensagens(-9, 0).slice(1), ...viewport.chaves.slice(1)];
    estrategia.onDataLengthChanged();
    const novoIndice = viewport.chaves.indexOf(chave);
    expect(viewport.topo).toBe(novoIndice * ESTIMATIVA - deslocamento);
    expect(viewport.topo).toBe(1000 + 10 * ESTIMATIVA);
  });

  it('mensagem nova no fim: grudada acompanha; lendo mais acima, fica onde está', () => {
    const { viewport, estrategia } = montar(chavesDeMensagens(1, 30));
    viewport.chaves.push('m:31');
    estrategia.onDataLengthChanged();
    expect(viewport.topo).toBe(32 * ESTIMATIVA - 500);

    viewport.topo = 200;
    estrategia.onContentScrolled();
    viewport.chaves.push('m:32');
    estrategia.onDataLengthChanged();
    expect(viewport.topo).toBe(200);
  });

  it('subindo perto do topo pede as anteriores; descendo, não', () => {
    const { viewport, estrategia, eventos } = montar(chavesDeMensagens(1, 60));
    viewport.topo = 2000;
    estrategia.onContentScrolled();
    viewport.topo = 300; // subiu e está a menos de 400px do topo
    estrategia.onContentScrolled();
    expect(eventos.topo).toBe(1);
    viewport.topo = 350; // desceu um pouco
    estrategia.onContentScrolled();
    expect(eventos.topo).toBe(1);
  });

  it('conteúdo que nem enche a área também pede as anteriores', () => {
    const { estrategia, eventos } = montar(chavesDeMensagens(1, 3));
    estrategia.onContentScrolled();
    expect(eventos.topo).toBe(1);
  });

  it('rolarParaOFim volta a grudar; scrollToIndex leva ao item e desgruda', () => {
    const { viewport, estrategia, eventos } = montar(chavesDeMensagens(1, 60));
    estrategia.scrollToIndex(5, 'smooth');
    expect(viewport.topo).toBe(5 * ESTIMATIVA);
    expect(viewport.rolagens.at(-1)?.comportamento).toBe('smooth');
    expect(estrategia.noFim).toBe(false);
    estrategia.rolarParaOFim('smooth');
    expect(estrategia.noFim).toBe(true);
    expect(viewport.topo).toBe(61 * ESTIMATIVA - 500);
    expect(eventos.fim).toEqual([false, true]);
  });

  it('lista vazia não renderiza nada', () => {
    const { viewport } = montar([]);
    expect(viewport.total).toBe(0);
    expect(viewport.faixa).toEqual({ start: 0, end: 0 });
  });

  it('sem scrollTo no elemento (jsdom), ajusta o scrollTop', () => {
    const viewport = new ViewportFalso(chavesDeMensagens(1, 10));
    Object.defineProperty(viewport.area, 'scrollTo', { value: undefined });
    const estrategia = new EstrategiaAlturaVariavel();
    estrategia.chaves = () => viewport.chaves;
    estrategia.attach(viewport as unknown as CdkVirtualScrollViewport);
    expect(viewport.rolagens).toEqual([]);
    estrategia.detach();
  });
});
