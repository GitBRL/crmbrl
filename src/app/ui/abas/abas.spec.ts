import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Abas, type ItemAba, type ModoAbas } from './abas';

@Component({
  imports: [Abas],
  template: `
    <app-abas rotulo="Visões" [abas]="abas" [modo]="modo()" [(selecionada)]="selecionada">
      <p>Conteúdo de {{ selecionada() }}</p>
    </app-abas>
  `,
})
class Hospedeiro {
  readonly abas: readonly ItemAba[] = [
    { id: 'jornada', rotulo: 'Jornada do cliente' },
    { id: 'atendimento', rotulo: 'Atendimento' },
    { id: 'equipe', rotulo: 'Equipe' },
  ];
  readonly modo = signal<ModoAbas>('abas');
  readonly selecionada = signal<string | null>(null);
}

describe('Abas', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const abas = () => [...raiz.querySelectorAll<HTMLButtonElement>('button')];
    return { fixture, hospedeiro: fixture.componentInstance, raiz, abas };
  }

  it('monta tablist, tabs e tabpanel ligados; a primeira aba vem ativa', () => {
    const { raiz, abas } = criar();
    const lista = raiz.querySelector('[role="tablist"]');
    expect(lista?.getAttribute('aria-label')).toBe('Visões');
    expect(abas().map((aba) => aba.getAttribute('role'))).toEqual(['tab', 'tab', 'tab']);
    expect(abas()[0].getAttribute('aria-selected')).toBe('true');
    expect(abas()[0].tabIndex).toBe(0);
    expect(abas()[1].tabIndex).toBe(-1);
    const painel = raiz.querySelector('[role="tabpanel"]');
    expect(painel?.getAttribute('aria-labelledby')).toBe(abas()[0].id);
    expect(abas()[0].getAttribute('aria-controls')).toBe(painel?.id);
  });

  it('clique seleciona e atualiza o two-way binding', () => {
    const { fixture, hospedeiro, abas, raiz } = criar();
    abas()[2].click();
    fixture.detectChanges();
    expect(hospedeiro.selecionada()).toBe('equipe');
    expect(abas()[2].getAttribute('aria-selected')).toBe('true');
    expect(raiz.querySelector('[role="tabpanel"]')?.textContent).toContain('Conteúdo de equipe');
  });

  it('setas, Home e End trocam a aba e o foco', () => {
    const { fixture, hospedeiro, abas } = criar();
    const teclar = (key: string) => {
      abas()[0].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    teclar('ArrowRight');
    expect(hospedeiro.selecionada()).toBe('atendimento');
    expect(document.activeElement).toBe(abas()[1]);
    teclar('End');
    expect(hospedeiro.selecionada()).toBe('equipe');
    teclar('ArrowRight');
    expect(hospedeiro.selecionada()).toBe('jornada');
    teclar('ArrowLeft');
    expect(hospedeiro.selecionada()).toBe('equipe');
    teclar('Home');
    expect(hospedeiro.selecionada()).toBe('jornada');
  });

  describe('lista que rola (abas que não cabem)', () => {
    /** Simula uma lista de 200px com 400px de abas (o jsdom não calcula layout). */
    function simularRolagem(raiz: HTMLElement, abas: HTMLButtonElement[]) {
      const lista = raiz.querySelector('.abas__lista') as HTMLElement;
      const caixa = (left: number, right: number) =>
        ({ left, right, top: 0, bottom: 44, width: right - left, height: 44 }) as DOMRect;
      Object.defineProperty(lista, 'scrollWidth', { configurable: true, value: 400 });
      Object.defineProperty(lista, 'clientWidth', { configurable: true, value: 200 });
      Object.defineProperty(lista, 'scrollLeft', { configurable: true, writable: true, value: 0 });
      const scrollTo = vi.fn((opcoes: ScrollToOptions) => {
        lista.scrollLeft = opcoes.left ?? 0;
      });
      lista.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
      lista.getBoundingClientRect = () => caixa(0, 200);
      const posicoes = [
        [0, 160],
        [168, 300],
        [308, 400],
      ];
      abas.forEach(
        (aba, i) => (aba.getBoundingClientRect = () => caixa(posicoes[i][0], posicoes[i][1])),
      );
      return { lista, scrollTo };
    }

    it('traz a aba selecionada para a área visível, só rolando a lista', () => {
      const { fixture, raiz, abas } = criar();
      const { lista, scrollTo } = simularRolagem(raiz, abas());
      abas()[2].click();
      fixture.detectChanges();
      // 400 − 200 + 16 de folga: a aba "Equipe" inteira à vista.
      expect(scrollTo).toHaveBeenCalledWith({ left: 216, behavior: 'auto' });
      expect(lista.scrollLeft).toBe(216);
    });

    it('esmaece a borda que tem abas escondidas', () => {
      const { fixture, raiz, abas } = criar();
      const { lista } = simularRolagem(raiz, abas());
      lista.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      expect(lista.classList).not.toContain('abas__lista--mais-inicio');
      expect(lista.classList).toContain('abas__lista--mais-fim');

      lista.scrollLeft = 200;
      lista.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      expect(lista.classList).toContain('abas__lista--mais-inicio');
      expect(lista.classList).not.toContain('abas__lista--mais-fim');
    });
  });

  it('modo "opcoes" vira um radiogroup sem painel', () => {
    const { fixture, hospedeiro, raiz, abas } = criar();
    hospedeiro.modo.set('opcoes');
    fixture.detectChanges();
    expect(raiz.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(raiz.querySelector('[role="tabpanel"]')).toBeNull();
    expect(abas()[0].getAttribute('role')).toBe('radio');
    expect(abas()[0].getAttribute('aria-checked')).toBe('true');
    expect(abas()[0].hasAttribute('aria-selected')).toBe(false);
  });
});
