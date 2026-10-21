import { TestBed } from '@angular/core/testing';

import { CHAVE_PERFIL_DEMO, PerfilDemoService } from '../nucleo/perfil-demo.service';
import { EstadoCasca } from './estado-casca';
import { MenuConta } from './menu-conta';

describe('MenuConta (Ver como)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EstadoCasca] });
  });
  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(MenuConta);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector('.conta__botao') as HTMLButtonElement;
    const itens = () => [...raiz.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const teclar = (alvo: HTMLElement, key: string) =>
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    return { fixture, raiz, botao, itens, teclar };
  }

  it('botão de menu com o nome da persona para leitores de tela', () => {
    const { raiz, botao } = criar();
    expect(botao.getAttribute('aria-haspopup')).toBe('menu');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.textContent).toContain('Conta: Ana Ribeiro, Admin (modo demonstração)');
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
  });

  it('abre com o aviso de demonstração e o foco na persona atual', async () => {
    const { fixture, raiz, botao, itens } = criar();
    botao.click();
    await fixture.whenStable();

    const menu = raiz.querySelector('[role="menu"]') as HTMLElement;
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(botao.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-label')).toBe('Ver como');
    const aviso = raiz.querySelector(`#${menu.getAttribute('aria-describedby')}`);
    expect(aviso?.textContent).toContain('Modo demonstração');
    expect(aviso?.textContent).toContain('Ainda não há login');

    expect(itens().length).toBe(8);
    const marcados = itens().filter((item) => item.getAttribute('aria-checked') === 'true');
    expect(marcados.map((item) => item.getAttribute('aria-label'))).toEqual(['Ana Ribeiro, Admin']);
    expect(document.activeElement).toBe(marcados[0]);
    expect(itens().every((item) => item.tabIndex === -1)).toBe(true);
  });

  it('setas, Home e End movem o foco entre as personas', async () => {
    const { fixture, botao, itens, teclar } = criar();
    botao.click();
    await fixture.whenStable();
    teclar(itens()[0], 'ArrowDown');
    expect(document.activeElement).toBe(itens()[1]);
    teclar(itens()[1], 'End');
    expect(document.activeElement).toBe(itens()[7]);
    teclar(itens()[7], 'ArrowDown');
    expect(document.activeElement).toBe(itens()[0]);
    teclar(itens()[0], 'ArrowUp');
    expect(document.activeElement).toBe(itens()[7]);
    teclar(itens()[7], 'Home');
    expect(document.activeElement).toBe(itens()[0]);
  });

  it('seta para cima no botão abre com o foco na última persona', async () => {
    const { fixture, botao, itens, teclar } = criar();
    teclar(botao, 'ArrowUp');
    await fixture.whenStable();
    expect(document.activeElement).toBe(itens()[7]);
  });

  it('escolher uma persona troca o papel, salva, anuncia e fecha', async () => {
    const { fixture, raiz, botao, itens } = criar();
    const perfil = TestBed.inject(PerfilDemoService);
    botao.click();
    await fixture.whenStable();

    itens()
      .find((item) => item.getAttribute('aria-label') === 'Rafael Souto, Marketing')!
      .click();
    await fixture.whenStable();

    expect(perfil.papel()).toBe('MARKETING');
    expect(localStorage.getItem(CHAVE_PERFIL_DEMO)).toBe('MARKETING');
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(botao);
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe(
      'Agora você vê o CRM como Rafael Souto, Marketing.',
    );
    expect(botao.textContent).toContain('Rafael Souto, Marketing');
  });

  it('Esc fecha e devolve o foco ao botão', async () => {
    const { fixture, raiz, botao, itens, teclar } = criar();
    botao.click();
    await fixture.whenStable();
    teclar(itens()[0], 'Escape');
    await fixture.whenStable();
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao);
  });

  it('fecha com toque fora', async () => {
    const { fixture, raiz, botao } = criar();
    botao.click();
    await fixture.whenStable();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
  });

  it('abre quando outra parte da casca pede ("Trocar persona")', async () => {
    const { fixture, raiz, itens } = criar();
    TestBed.inject(EstadoCasca).pedirMenuConta();
    await fixture.whenStable();
    expect(raiz.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement).toBe(itens()[0]);
  });
});
