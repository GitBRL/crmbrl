import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { RECARREGAR_EM } from '../nucleo/sessao/sessao.service';
import { entrarComo } from '../nucleo/sessao/sessao-de-teste';
import { MenuConta } from './menu-conta';

@Component({ template: '' })
class PaginaFalsa {}

describe('MenuConta', () => {
  const recarregarEm = vi.fn();

  beforeEach(() => {
    recarregarEm.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: PaginaFalsa }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RECARREGAR_EM, useValue: recarregarEm },
      ],
    });
    entrarComo('LIDER_COMERCIAL', { usuario: { email: 'carla@brl.com.br' } });
  });

  function criar() {
    const fixture = TestBed.createComponent(MenuConta);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector('.conta__botao') as HTMLButtonElement;
    const itens = () => [...raiz.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const teclar = (alvo: HTMLElement, key: string) =>
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    return { fixture, raiz, botao, itens, teclar };
  }

  it('botão de menu com o nome e o papel do usuário logado', () => {
    const { raiz, botao } = criar();
    expect(botao.getAttribute('aria-haspopup')).toBe('menu');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.textContent).toContain('Conta: Carla Nogueira, Líder Comercial');
    expect(botao.textContent).not.toContain('demonstração');
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
  });

  it('abre com nome, papel e e-mail, e o foco em "Meu perfil"', async () => {
    const { fixture, raiz, botao, itens } = criar();
    botao.click();
    await fixture.whenStable();

    const menu = raiz.querySelector('[role="menu"]') as HTMLElement;
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(botao.getAttribute('aria-controls')).toBe(menu.id);
    const quem = raiz.querySelector(`#${menu.getAttribute('aria-describedby')}`);
    expect(quem?.textContent).toContain('Carla Nogueira');
    expect(quem?.textContent).toContain('Líder Comercial');
    expect(quem?.textContent).toContain('carla@brl.com.br');
    expect(itens().map((item) => item.textContent?.trim())).toEqual([
      'Meu perfil',
      'Trocar senha',
      'Sair',
    ]);
    expect(document.activeElement).toBe(itens()[0]);
    expect(itens().every((item) => item.tabIndex === -1)).toBe(true);
  });

  it('setas, Home e End movem o foco; Esc fecha e devolve o foco ao botão', async () => {
    const { fixture, raiz, botao, itens, teclar } = criar();
    botao.click();
    await fixture.whenStable();
    teclar(itens()[0], 'ArrowDown');
    expect(document.activeElement).toBe(itens()[1]);
    teclar(itens()[1], 'End');
    expect(document.activeElement).toBe(itens()[2]);
    teclar(itens()[2], 'ArrowDown');
    expect(document.activeElement).toBe(itens()[0]);
    teclar(itens()[0], 'ArrowUp');
    expect(document.activeElement).toBe(itens()[2]);
    teclar(itens()[2], 'Home');
    expect(document.activeElement).toBe(itens()[0]);
    teclar(itens()[0], 'Escape');
    fixture.detectChanges();
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('seta para cima no botão abre com o foco em "Sair"', async () => {
    const { fixture, botao, itens, teclar } = criar();
    teclar(botao, 'ArrowUp');
    await fixture.whenStable();
    expect(document.activeElement).toBe(itens()[2]);
  });

  it('"Meu perfil" e "Trocar senha" levam às telas e fecham o menu', async () => {
    const { fixture, raiz, botao, itens } = criar();
    const router = TestBed.inject(Router);
    botao.click();
    await fixture.whenStable();
    itens()[0].click();
    await fixture.whenStable();
    expect(router.url).toBe('/configuracoes/perfil');
    expect(raiz.querySelector('[role="menu"]')).toBeNull();

    botao.click();
    await fixture.whenStable();
    itens()[1].click();
    await fixture.whenStable();
    expect(router.url).toBe('/trocar-senha');
  });

  it('"Sair" encerra a sessão na API e recarrega em /entrar', async () => {
    const { fixture, botao, itens } = criar();
    botao.click();
    await fixture.whenStable();
    itens()[2].click();
    fixture.detectChanges();
    expect(itens()[2].textContent?.trim()).toBe('Saindo…');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/sair')
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(recarregarEm).toHaveBeenCalledWith('/entrar');
  });
});
