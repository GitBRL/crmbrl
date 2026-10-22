import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MODULOS } from '../nucleo/navegacao';
import { entrarComo } from '../nucleo/sessao/sessao-de-teste';
import { MenuLateral } from './menu-lateral';

@Component({ template: '' })
class PaginaFalsa {}

// A navegação fica dentro de uma área que rola, como o cartão lateral da casca.
@Component({
  imports: [MenuLateral],
  template: `<div class="area" style="overflow-y: auto">
    <app-menu-lateral [recolhida]="recolhida()" />
  </div>`,
})
class Hospedeiro {
  readonly recolhida = signal(false);
}

/** Retângulo para simular o layout (o jsdom não calcula posições). */
const retangulo = (top: number, bottom: number) =>
  ({ top, bottom, left: 0, right: 40, width: 40, height: bottom - top, x: 0, y: top }) as DOMRect;

describe('MenuLateral', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...MODULOS.map((modulo) => ({ path: modulo.rota.slice(1), component: PaginaFalsa })),
          { path: 'empresas/:id', component: PaginaFalsa },
        ]),
      ],
    });
    entrarComo('ADMIN');
  });
  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const itens = () => [...raiz.querySelectorAll<HTMLAnchorElement>('a.menu__item')];
    return { fixture, raiz, itens };
  }

  it('Admin vê todos os módulos, em grupos nomeados', () => {
    const { raiz, itens } = criar();
    expect(raiz.querySelector('nav')?.getAttribute('aria-label')).toBe('Principal');
    expect(itens().map((item) => item.getAttribute('href'))).toEqual(MODULOS.map((m) => m.rota));
    const grupos = [...raiz.querySelectorAll('.menu__grupo')].map((g) => g.textContent?.trim());
    expect(grupos).toEqual(['Funis', 'Relacionamento', 'Gestão', 'Sistema']);
    for (const lista of raiz.querySelectorAll('ul[aria-labelledby]')) {
      const rotulo = raiz.querySelector(`#${lista.getAttribute('aria-labelledby')}`);
      expect(rotulo?.classList).toContain('menu__grupo');
    }
  });

  it('a página atual entra na área que rola ajustando o scrollTop, sem scrollIntoView', async () => {
    // scrollIntoView move o ponto de partida do Tab no Chrome (o 1º Tab pularia o link
    // "Pular para o conteúdo"): a navegação não pode usá-lo.
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      const { fixture, raiz, itens } = criar();
      const area = raiz.querySelector('.area') as HTMLElement;
      let rolagem = 0;
      Object.defineProperties(area, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 300 },
        scrollTop: { configurable: true, get: () => rolagem, set: (valor) => (rolagem = valor) },
      });
      area.getBoundingClientRect = () => retangulo(100, 400);
      const administracao = itens().find((item) => item.getAttribute('href') === '/administracao')!;
      administracao.getBoundingClientRect = () => retangulo(600 - rolagem, 640 - rolagem);

      await TestBed.inject(Router).navigateByUrl('/administracao');
      await fixture.whenStable();

      expect(administracao.classList).toContain('menu__item--ativo');
      expect(scrollIntoView).not.toHaveBeenCalled();
      // A base do item (640) fica 8px acima da base da área (400): rola 640 - 392 = 248.
      expect(rolagem).toBe(248);
    } finally {
      if (original) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      } else {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      }
    }
  });

  it('módulos "em breve" têm selo; os prontos, não', () => {
    const { itens } = criar();
    const emBreve = MODULOS.filter((modulo) => modulo.status === 'em-breve').length;
    expect(itens().filter((item) => item.querySelector('app-selo')).length).toBe(emBreve);
    const inicio = itens().find((item) => item.getAttribute('href') === '/inicio');
    expect(inicio?.querySelector('app-selo')).toBeNull();
    expect(inicio?.getAttribute('aria-label')).toBeNull();
    expect(inicio?.textContent?.trim()).toBe('Visão geral');
    // O selo é visual; o nome acessível já diz "em breve".
    const atendimento = itens().find((item) => item.getAttribute('href') === '/atendimento');
    expect(atendimento?.getAttribute('aria-label')).toBe('Atendimento (em breve)');
    expect(atendimento?.querySelector('app-selo')?.getAttribute('aria-hidden')).toBe('true');
    expect(atendimento?.querySelector('app-selo')?.getAttribute('tamanho')).toBe('sm');
    // Os módulos da Fase 1 estão prontos.
    for (const rota of ['/funis/marketing', '/contatos', '/atividades', '/configuracoes']) {
      const item = itens().find((link) => link.getAttribute('href') === rota);
      expect(item?.querySelector('app-selo'), rota).toBeNull();
    }
  });

  it('filtra pelo papel e pelas permissões reais (Marketing não vê Atendimento nem Gestão)', () => {
    entrarComo('MARKETING');
    const { raiz, itens } = criar();
    const rotas = itens().map((item) => item.getAttribute('href'));
    expect(rotas).toContain('/funis/marketing');
    expect(rotas).toContain('/contatos');
    expect(rotas).toContain('/configuracoes');
    expect(rotas).not.toContain('/administracao');
    expect(rotas).not.toContain('/atendimento');
    expect(rotas).not.toContain('/funis/comercial');
    expect(rotas).not.toContain('/integracoes');
    const grupos = [...raiz.querySelectorAll('.menu__grupo')].map((g) => g.textContent?.trim());
    expect(grupos).not.toContain('Gestão');
  });

  it('marca a página atual com aria-current e o círculo invertido', async () => {
    const { fixture, itens } = criar();
    await TestBed.inject(Router).navigateByUrl('/funis/cs');
    await fixture.whenStable();
    const atual = itens().filter((item) => item.getAttribute('aria-current') === 'page');
    expect(atual.length).toBe(1);
    expect(atual[0].getAttribute('href')).toBe('/funis/cs');
    expect(atual[0].classList).toContain('menu__item--ativo');
  });

  it('rotas relacionadas marcam o módulo dono (empresa → Contatos e empresas)', async () => {
    const { fixture, itens } = criar();
    await TestBed.inject(Router).navigateByUrl('/empresas/123');
    await fixture.whenStable();
    const atual = itens().filter((item) => item.getAttribute('aria-current') === 'page');
    expect(atual.map((item) => item.getAttribute('href'))).toEqual(['/contatos']);
  });

  it('recolhida: rótulos só para leitores de tela e dica ao passar o mouse', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();

    expect(raiz.querySelector('nav')?.classList).toContain('menu--recolhido');
    const marketing = itens().find((item) => item.getAttribute('href') === '/atendimento')!;
    expect(marketing.querySelector('.menu__rotulo')?.classList).toContain('visualmente-oculto');
    expect(marketing.querySelector('app-selo')).toBeNull();
    expect(marketing.getAttribute('aria-label')).toBe('Atendimento (em breve)');

    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    expect(dica.getAttribute('aria-hidden')).toBe('true');
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.textContent?.trim()).toBe('Atendimento · em breve');
    expect(dica.classList).toContain('menu__dica--visivel');

    marketing.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');

    // No toque não há dica (o toque já navega).
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('recolhida: Esc fecha a dica, com o foco no item ou só com o mouse em cima (WCAG 1.4.13)', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();
    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    const marketing = itens().find((item) => item.getAttribute('href') === '/funis/marketing')!;

    // Pelo mouse: o foco está em outro lugar e o Esc chega ao documento.
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');

    // Pelo teclado: foco no item, Esc no próprio item.
    marketing.focus();
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');
    marketing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('recolhida: a dica fica aberta enquanto o ponteiro vai do item até ela', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();
    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    const marketing = itens().find((item) => item.getAttribute('href') === '/funis/marketing')!;
    const sair = (de: HTMLElement, para: Element) =>
      de.dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'mouse', relatedTarget: para }),
      );

    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    sair(marketing, dica);
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');

    sair(dica, marketing.querySelector('.menu__circulo')!);
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');

    // Clicar no balão é clicar no item.
    dica.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/funis/marketing');

    sair(dica, document.body);
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('expandida não mostra dica', async () => {
    const { fixture, raiz, itens } = criar();
    itens()[1].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(raiz.querySelector('.menu__dica')?.classList).not.toContain('menu__dica--visivel');
  });
});
