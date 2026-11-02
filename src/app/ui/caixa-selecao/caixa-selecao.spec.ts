import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { CaixaSelecao } from './caixa-selecao';

@Component({
  imports: [ReactiveFormsModule, CaixaSelecao],
  template: `
    <app-caixa-selecao
      rotulo="Aceito os termos"
      dica="Leia antes de continuar."
      [formControl]="termos"
    />
    <app-caixa-selecao rotulo="Selecionar todos" [(indeterminado)]="alguns" [(valor)]="todos" />
  `,
})
class Hospedeiro {
  readonly termos = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });
  readonly alguns = signal(true);
  readonly todos = signal(false);
}

describe('CaixaSelecao', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const [termos, todos] = [...raiz.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    return { fixture, raiz, termos, todos, hospedeiro: fixture.componentInstance };
  }

  it('checkbox nativo com rótulo e descrição ligados', async () => {
    const { raiz, termos } = await criar();
    expect(raiz.querySelector(`label.caixa__rotulo[for="${termos.id}"]`)?.textContent).toBe(
      'Aceito os termos',
    );
    expect(raiz.querySelector(`#${termos.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Leia antes de continuar.',
    );
    expect(termos.getAttribute('aria-required')).toBe('true');
  });

  it('marcar chega ao formulário; desmarcado e tocado, mostra o erro', async () => {
    const { fixture, raiz, termos, hospedeiro } = await criar();
    termos.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Marque esta opção para continuar.');
    termos.click();
    await fixture.whenStable();
    expect(hospedeiro.termos.value).toBe(true);
    expect(raiz.textContent).not.toContain('Marque esta opção');
  });

  it('indeterminado aparece e some no clique', async () => {
    const { fixture, todos, hospedeiro } = await criar();
    expect(todos.indeterminate).toBe(true);
    todos.click();
    await fixture.whenStable();
    expect(hospedeiro.alguns()).toBe(false);
    expect(hospedeiro.todos()).toBe(true);
  });
});
