import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DesignSystem } from './design-system';

describe('DesignSystem (catálogo)', () => {
  it('renderiza o índice com âncoras e todas as seções nomeadas', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'design-system', component: DesignSystem }])],
    });
    // Na rota de verdade: o índice usa `routerLink="."`, relativo à página do catálogo.
    const harness = await RouterTestingHarness.create('/design-system');
    const raiz = harness.routeNativeElement as HTMLElement;

    const links = [...raiz.querySelectorAll<HTMLAnchorElement>('.ds-indice__link')];
    const secoes = [...raiz.querySelectorAll<HTMLElement>('[role="region"]')].filter(
      (secao) => secao.tagName === 'APP-DS-SECAO',
    );
    expect(links.length).toBe(17);
    expect(secoes.length).toBe(17);
    for (const [i, link] of links.entries()) {
      expect(link.getAttribute('href')).toBe(`/design-system#${secoes[i].id}`);
      const titulo = raiz.querySelector(`#${secoes[i].getAttribute('aria-labelledby')}`);
      expect(titulo?.tagName).toBe('H2');
    }
    expect(raiz.querySelector('h1')?.textContent).toContain('Design system');
    expect(raiz.querySelectorAll('app-barra-funil').length).toBeGreaterThan(3);
    expect(raiz.querySelectorAll('.dois-temas__painel[data-tema="claro"]').length).toBe(1);
  });

  it('não mostra o nome da referência visual na tela', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'design-system', component: DesignSystem }])],
    });
    const harness = await RouterTestingHarness.create('/design-system');
    expect((harness.routeNativeElement as HTMLElement).textContent).not.toContain('Sugar');
  });

  it('tema e marca: o logo oficial nos dois temas, só o símbolo, o favicon e a regra de cor', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'design-system', component: DesignSystem }])],
    });
    const harness = await RouterTestingHarness.create('/design-system');
    const secao = (harness.routeNativeElement as HTMLElement).querySelector(
      '#marca',
    ) as HTMLElement;
    expect(secao.textContent).not.toMatch(/provis[óo]ri|monograma/i);
    expect(secao.querySelector('h2')?.textContent).toContain('BRL CRM');

    const paineis = [...secao.querySelectorAll<HTMLElement>('.marca__painel')];
    expect(paineis.map((painel) => painel.getAttribute('data-tema'))).toEqual(['claro', 'escuro']);
    for (const painel of paineis) {
      const logos = [...painel.querySelectorAll('app-logo')];
      expect(logos.length).toBe(2);
      expect(logos[0].querySelector('.logo__nome')).not.toBeNull();
      expect(logos[1].querySelector('.logo__nome')).toBeNull();
      expect(painel.querySelector('img[src="favicon.svg"]')).not.toBeNull();
      expect(painel.querySelector('figcaption')?.textContent).toContain('--cor-logo');
    }
    const abas = [...secao.querySelectorAll('.marca__aba')];
    expect(abas.map((aba) => aba.getAttribute('data-tema'))).toEqual(['claro', 'escuro']);
  });

  it('mostra as cinco variantes do botão-ícone, com IA em marca (lima)', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'design-system', component: DesignSystem }])],
    });
    const harness = await RouterTestingHarness.create('/design-system');
    const raiz = harness.routeNativeElement as HTMLElement;
    const variantes = [...raiz.querySelectorAll('#botoes [appbotaoicone]')].slice(0, 5);
    expect(variantes.map((botao) => botao.className.match(/botao-icone--(\w+)/)?.[1])).toEqual([
      'neutro',
      'contorno',
      'invertido',
      'destaque',
      'marca',
    ]);
    expect(raiz.querySelector('#botoes .botao-icone--marca')?.getAttribute('aria-label')).toBe(
      'Sugerir com IA',
    );
  });
});
