import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Alternador } from './alternador';

@Component({
  imports: [ReactiveFormsModule, Alternador],
  template: `<app-alternador
    rotulo="Participa do rodízio"
    dica="Recebe leads novos na sua vez."
    [formControl]="rodizio"
  />`,
})
class Hospedeiro {
  readonly rodizio = new FormControl(true, { nonNullable: true });
}

describe('Alternador', () => {
  it('é um switch rotulado que liga e desliga', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector('input') as HTMLInputElement;
    expect(campo.getAttribute('role')).toBe('switch');
    expect(campo.checked).toBe(true);
    expect(raiz.querySelector(`.alternador__rotulo[for="${campo.id}"]`)?.textContent).toBe(
      'Participa do rodízio',
    );
    expect(raiz.querySelector(`#${campo.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Recebe leads novos na sua vez.',
    );

    campo.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.rodizio.value).toBe(false);
    expect(fixture.componentInstance.rodizio.touched).toBe(true);

    fixture.componentInstance.rodizio.disable();
    await fixture.whenStable();
    expect(campo.disabled).toBe(true);
  });
});
