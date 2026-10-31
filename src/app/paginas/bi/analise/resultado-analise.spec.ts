import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { caminhoSeguro, ResultadoAnalise } from './resultado-analise';

describe('ResultadoAnalise', () => {
  it('só aceita caminhos internos do CRM', () => {
    expect(caminhoSeguro('/funis/comercial')).toBe('/funis/comercial');
    expect(caminhoSeguro('//outro.site/x')).toBeNull();
    expect(caminhoSeguro('https://outro.site')).toBeNull();
    expect(caminhoSeguro('javascript:alert(1)')).toBeNull();
    expect(caminhoSeguro(undefined)).toBeNull();
  });

  it('mostra o que já chegou do parcial (campos que faltam não quebram) e escreve o texto sem HTML', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ResultadoAnalise);
    fixture.componentRef.setInput('conteudo', {
      texto: '<b>negrito?</b>',
      destaques: [{ titulo: 'Só o título' }],
      acoes: [{ detalhe: 'sem título nem link' }],
    });
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.texto')?.textContent).toBe('<b>negrito?</b>');
    expect(raiz.querySelector('.texto b')).toBeNull();
    expect(raiz.textContent).toContain('Só o título');
    expect(raiz.querySelector('a')).toBeNull();
  });
});
