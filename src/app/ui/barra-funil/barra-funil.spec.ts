import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BarraFunil, numeroCabe, type SerieFunil } from './barra-funil';

@Component({
  imports: [BarraFunil],
  template: `
    <app-barra-funil
      etapa="Leads qualificados"
      [total]="total()"
      [series]="series()"
      [totalReferencia]="referencia()"
      [queda]="queda()"
      [tempoMedioDias]="8"
    />
  `,
})
class Hospedeiro {
  readonly total = signal(1410);
  readonly referencia = signal<number | null>(1600);
  readonly series = signal<readonly SerieFunil[]>([
    { rotulo: 'Site e webhooks', valor: 600 },
    { rotulo: 'WhatsApp', valor: 500 },
    { rotulo: 'Indicação e outros', valor: 310 },
  ]);
  readonly queda = signal<number | null>(11.9);
}

/** ResizeObserver falso: guarda o callback para o teste disparar com as medidas que quiser. */
class ObservadorFalso {
  static ultimo: ObservadorFalso | null = null;
  constructor(readonly callback: ResizeObserverCallback) {
    ObservadorFalso.ultimo = this;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const series = (...valores: number[]): readonly SerieFunil[] =>
  valores.map((valor, i) => ({ rotulo: `Série ${i + 1}`, valor }));

describe('BarraFunil', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const barra = fixture.nativeElement.querySelector('app-barra-funil') as HTMLElement;
    const segmentos = () => [...barra.querySelectorAll<HTMLElement>('.funil__segmento')];
    return { fixture, hospedeiro: fixture.componentInstance, barra, segmentos };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.ultimo = null;
  });

  it('é uma imagem com a descrição completa', () => {
    const { barra } = criar();
    expect(barra.getAttribute('role')).toBe('img');
    expect(barra.getAttribute('aria-label')).toBe(
      'Leads qualificados: 1.410; Site e webhooks 600, WhatsApp 500, Indicação e outros 310; ' +
        'queda de 11,9% em relação à etapa anterior; tempo médio de 8 dias',
    );
  });

  it('cabeçalho com total, queda, etapa e tempo médio', () => {
    const { barra } = criar();
    expect(barra.querySelector('.funil__total')?.textContent).toBe('1.410');
    expect(barra.querySelector('.funil__queda')?.textContent?.replace(/\s/g, '')).toBe('11,9%');
    expect(barra.querySelector('.funil__etapa')?.textContent).toBe('Leads qualificados');
    expect(barra.querySelector('.funil__etapa-grupo app-selo')?.textContent?.trim()).toBe('8d');
  });

  it('largura proporcional ao total da primeira etapa', () => {
    const { barra } = criar();
    const pilula = barra.querySelector('.funil__barra') as HTMLElement;
    expect(pilula.style.getPropertyValue('--largura')).toBe('88.13');
  });

  it('um segmento por série; com três séries, a do meio é a cápsula', () => {
    const { segmentos } = criar();
    expect(segmentos().map((s) => s.dataset['serie'])).toEqual(['1', '2', '3']);
    expect(segmentos().map((s) => s.classList.contains('funil__segmento--capsula'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(segmentos()[0].classList).toContain('funil__segmento--antes-capsula');
    expect(segmentos()[0].textContent?.trim()).toBe('600');
    expect(segmentos()[1].getAttribute('title')).toBe('WhatsApp: 500');
  });

  it('paridade contada do fim: com duas séries, a primeira é a cápsula', () => {
    const { fixture, hospedeiro, segmentos } = criar();
    hospedeiro.series.set(series(300, 200));
    fixture.detectChanges();
    expect(segmentos().map((s) => s.classList.contains('funil__segmento--capsula'))).toEqual([
      true,
      false,
    ]);
    // A última fica por baixo, encostada à direita.
    expect(segmentos()[1].classList).not.toContain('funil__segmento--antes-capsula');
  });

  it('ignora séries zeradas e esconde a queda na primeira etapa', () => {
    const { fixture, hospedeiro, barra, segmentos } = criar();
    hospedeiro.series.set([
      { rotulo: 'Site e webhooks', valor: 0 },
      { rotulo: 'WhatsApp', valor: 900 },
    ]);
    hospedeiro.queda.set(null);
    fixture.detectChanges();
    expect(segmentos().length).toBe(1);
    expect(segmentos()[0].dataset['serie']).toBe('2');
    expect(segmentos()[0].classList).not.toContain('funil__segmento--capsula');
    expect(barra.querySelector('.funil__queda')).toBeNull();
  });

  it('sem medida (sem ResizeObserver), todos os números ficam dentro', () => {
    const { barra } = criar();
    expect(barra.querySelectorAll('.funil__segmento--fora').length).toBe(0);
    expect(barra.querySelector('.funil__valores')).toBeNull();
  });

  describe('números que não cabem', () => {
    it('cálculo com larguras fixas', () => {
      // 96 · 98 · 78 numa pílula de 110px (Negócios ganhos em 1440): os três ficam fora.
      const pequena = [
        { inicio: 0, fim: 96 / 272, valor: '96', antesDeCapsula: true },
        { inicio: 96 / 272, fim: 194 / 272, valor: '98', antesDeCapsula: false },
        { inicio: 194 / 272, fim: 1, valor: '78', antesDeCapsula: false },
      ];
      expect(pequena.map((s) => numeroCabe(s, 110, 48))).toEqual([false, false, false]);

      // 430 · 728 · 22 numa pílula de 645px: só o 22 fica fora.
      const larga = [
        { inicio: 0, fim: 430 / 1180, valor: '430', antesDeCapsula: true },
        { inicio: 430 / 1180, fim: 1158 / 1180, valor: '728', antesDeCapsula: false },
        { inicio: 1158 / 1180, fim: 1, valor: '22', antesDeCapsula: false },
      ];
      expect(larga.map((s) => numeroCabe(s, 645, 48))).toEqual([true, true, false]);
    });

    function medir(barra: HTMLElement, largura: number, altura = 48) {
      Object.defineProperty(barra, 'clientWidth', { configurable: true, value: largura });
      const pilula = barra.querySelector('.funil__barra') as HTMLElement;
      Object.defineProperty(pilula, 'offsetHeight', { configurable: true, value: altura });
      const observador = ObservadorFalso.ultimo;
      expect(observador).not.toBeNull();
      observador?.callback([], observador as unknown as ResizeObserver);
    }

    it('saem todos do segmento para uma lista ao lado da pílula, com a cor da série', () => {
      vi.stubGlobal('ResizeObserver', ObservadorFalso);
      const { fixture, hospedeiro, barra, segmentos } = criar();
      hospedeiro.total.set(272);
      hospedeiro.referencia.set(272);
      hospedeiro.series.set(series(96, 98, 78));
      fixture.detectChanges();

      medir(barra, 110);
      fixture.detectChanges();
      expect(segmentos().every((s) => s.classList.contains('funil__segmento--fora'))).toBe(true);
      const lista = barra.querySelector('.funil__valores') as HTMLElement;
      expect(lista.getAttribute('aria-hidden')).toBe('true');
      const itens = [...lista.querySelectorAll('li')];
      expect(itens.map((item) => item.textContent?.trim())).toEqual(['96', '98', '78']);
      expect(
        itens.map((item) => item.querySelector('.funil__ponto')?.getAttribute('data-serie')),
      ).toEqual(['1', '2', '3']);

      // Um só número estreito já leva todos para fora (nunca uns dentro e outros fora), na
      // ordem das séries: ciano → menta → lima.
      hospedeiro.total.set(1180);
      hospedeiro.referencia.set(1180);
      hospedeiro.series.set(series(430, 728, 22));
      medir(barra, 645);
      fixture.detectChanges();
      expect(segmentos().map((s) => s.classList.contains('funil__segmento--fora'))).toEqual([
        true,
        true,
        true,
      ]);
      const fora = [...barra.querySelectorAll('.funil__valores li')];
      expect(fora.map((item) => item.textContent?.trim())).toEqual(['430', '728', '22']);
      expect(
        fora.map((item) => item.querySelector('.funil__ponto')?.getAttribute('data-serie')),
      ).toEqual(['1', '2', '3']);
    });

    it('quando todos cabem, todos ficam dentro e a lista some', () => {
      vi.stubGlobal('ResizeObserver', ObservadorFalso);
      const { fixture, hospedeiro, barra, segmentos } = criar();
      hospedeiro.total.set(1600);
      hospedeiro.referencia.set(1600);
      hospedeiro.series.set(series(700, 300, 600));
      fixture.detectChanges();

      medir(barra, 968);
      fixture.detectChanges();
      expect(segmentos().some((s) => s.classList.contains('funil__segmento--fora'))).toBe(false);
      expect(barra.querySelector('.funil__valores')).toBeNull();

      // A mesma barra numa tela estreita: o 300 não cabe (37px), então os três saem juntos.
      medir(barra, 200, 40);
      fixture.detectChanges();
      expect(segmentos().every((s) => s.classList.contains('funil__segmento--fora'))).toBe(true);
      expect(
        [...barra.querySelectorAll('.funil__valores li')].map((item) => item.textContent?.trim()),
      ).toEqual(['700', '300', '600']);
    });
  });
});
