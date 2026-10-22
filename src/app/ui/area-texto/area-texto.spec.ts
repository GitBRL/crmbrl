import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AreaTexto } from './area-texto';

@Component({
  imports: [AreaTexto],
  template: `<app-area-texto
    rotulo="Motivo da perda"
    [maximoCaracteres]="200"
    [(valor)]="motivo"
    monoespacado
  />`,
})
class Hospedeiro {
  readonly motivo = signal('Preço');
}

describe('AreaTexto', () => {
  it('liga o valor, conta os caracteres e descreve o limite', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector('textarea') as HTMLTextAreaElement;
    expect(campo.value).toBe('Preço');
    expect(campo.getAttribute('maxlength')).toBe('200');
    expect(campo.classList).toContain('area__campo--mono');
    expect(raiz.querySelector('.area__contagem')?.textContent?.trim()).toBe('5 de 200');
    const descricao = raiz.querySelector(`#${campo.getAttribute('aria-describedby')}`);
    expect(descricao?.textContent).toBe('Até 200 caracteres.');

    campo.value = 'Preço acima do orçamento';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.motivo()).toBe('Preço acima do orçamento');
    expect(raiz.querySelector('.area__contagem')?.textContent?.trim()).toBe('24 de 200');
  });
});
