import { TestBed } from '@angular/core/testing';

import { CAMINHO_SIMBOLO_BRL, Logo } from './logo';

describe('Logo', () => {
  it('desenha o símbolo da BRL decorativo, o nome BRL CRM e um texto para leitores de tela', () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const simbolo = raiz.querySelector('svg') as SVGElement;
    expect(simbolo.getAttribute('aria-hidden')).toBe('true');
    expect(simbolo.getAttribute('viewBox')).toBe('0 0 386 393');
    expect(simbolo.getAttribute('height')).toBe('28');
    expect(simbolo.querySelector('path')?.getAttribute('d')).toBe(CAMINHO_SIMBOLO_BRL);
    expect(raiz.querySelector('.logo__brl')?.textContent).toBe('BRL');
    expect(raiz.querySelector('.logo__produto')?.textContent).toBe('CRM');
    expect(raiz.querySelector('.logo__nome')?.getAttribute('aria-hidden')).toBe('true');
    expect(raiz.querySelector('.visualmente-oculto')?.textContent).toBe('BRL CRM');
  });

  it('`somenteSimbolo` esconde o nome e `tamanho` define a altura do símbolo', () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.componentRef.setInput('somenteSimbolo', true);
    fixture.componentRef.setInput('tamanho', 40);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const simbolo = raiz.querySelector('svg') as SVGElement;
    expect(raiz.querySelector('.logo__nome')).toBeNull();
    expect(simbolo.getAttribute('height')).toBe('40');
    expect(simbolo.getAttribute('width')).toBe('39.29');
    expect(raiz.style.getPropertyValue('--logo-altura')).toBe('40px');
    expect(raiz.querySelector('.visualmente-oculto')?.textContent).toBe('BRL CRM');
  });
});
