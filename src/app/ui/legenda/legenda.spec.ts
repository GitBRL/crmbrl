import { TestBed } from '@angular/core/testing';

import { Legenda } from './legenda';

describe('Legenda', () => {
  it('lista as séries na ordem, com a cor de cada uma', () => {
    const fixture = TestBed.createComponent(Legenda);
    fixture.componentRef.setInput('series', ['Site', 'WhatsApp', 'Indicação', 'Outros', 'Extra']);
    fixture.detectChanges();
    const itens = [...(fixture.nativeElement as HTMLElement).querySelectorAll('li')];
    expect(itens.map((item) => item.textContent?.trim())).toEqual([
      'Site',
      'WhatsApp',
      'Indicação',
      'Outros',
      'Extra',
    ]);
    const pontos = itens.map((item) => item.querySelector('.legenda__ponto'));
    expect(pontos.map((ponto) => ponto?.getAttribute('data-serie'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '1',
    ]);
    expect(pontos[0]?.getAttribute('aria-hidden')).toBe('true');
  });
});
