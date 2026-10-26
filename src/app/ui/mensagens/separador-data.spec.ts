import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SeparadorData } from './separador-data';

@Component({
  imports: [SeparadorData],
  template: `<app-separador-data [data]="data()" [rotulo]="rotulo()" />`,
})
class Hospedeiro {
  readonly data = signal<string | Date | null>(null);
  readonly rotulo = signal<string | null>(null);
}

describe('SeparadorData', () => {
  it('rótulo pronto vence a data; a data vira "Hoje", "Ontem"…', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    const texto = () =>
      fixture.nativeElement.querySelector('.separador__rotulo')?.textContent?.trim();
    fixture.componentInstance.data.set(new Date());
    await fixture.whenStable();
    expect(texto()).toBe('Hoje');
    fixture.componentInstance.data.set(new Date(Date.now() - 86_400_000));
    await fixture.whenStable();
    expect(texto()).toBe('Ontem');
    fixture.componentInstance.rotulo.set('Começo da conversa');
    await fixture.whenStable();
    expect(texto()).toBe('Começo da conversa');
  });
});
