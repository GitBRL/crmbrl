import { TestBed } from '@angular/core/testing';

import { CHAVE_TEMA } from '../../nucleo/tema.service';
import { AlternadorTema } from './alternador-tema';

describe('AlternadorTema', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('mostra a ação e alterna o tema do documento', () => {
    const fixture = TestBed.createComponent(AlternadorTema);
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLElement;
    // Sem preferência salva e sem matchMedia (jsdom), o tema é o escuro.
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
    expect(botao.getAttribute('aria-label')).toBe('Ativar tema claro');

    botao.click();
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect(botao.getAttribute('aria-label')).toBe('Ativar tema escuro');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
  });
});
