import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CampoTexto } from './campo-texto';

@Component({
  imports: [ReactiveFormsModule, CampoTexto],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviado = true">
      <app-campo-texto
        rotulo="E-mail"
        tipo="email"
        dica="Use o e-mail da empresa."
        formControlName="email"
        [erro]="erroApi()"
      />
      <app-campo-texto rotulo="Valor" tipo="number" prefixo="R$" formControlName="valor" />
      <button type="submit">Enviar</button>
    </form>
  `,
})
class ComFormulario {
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    valor: new FormControl<number | null>(1500),
  });
  readonly erroApi = signal<string | null>(null);
  enviado = false;
}

describe('CampoTexto', () => {
  async function criar() {
    const fixture = TestBed.createComponent(ComFormulario);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const [email, valor] = [...raiz.querySelectorAll('input')];
    return { fixture, raiz, email, valor, hospedeiro: fixture.componentInstance };
  }

  it('liga rótulo, ajuda e obrigatoriedade ao controle', async () => {
    const { raiz, email } = await criar();
    const rotulo = raiz.querySelector(`label[for="${email.id}"]`);
    expect(rotulo?.textContent?.trim()).toBe('E-mail');
    expect(email.type).toBe('email');
    expect(email.getAttribute('aria-required')).toBe('true');
    const dica = raiz.querySelector(`#${email.getAttribute('aria-describedby')}`);
    expect(dica?.textContent).toBe('Use o e-mail da empresa.');
    expect(email.hasAttribute('aria-invalid')).toBe(false);
  });

  it('mostra o erro do controle só depois de tocado, ligado por aria-describedby', async () => {
    const { fixture, raiz, email } = await criar();
    expect(raiz.textContent).not.toContain('Preencha este campo.');
    email.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    const [idErro] = (email.getAttribute('aria-describedby') ?? '').split(' ');
    expect(raiz.querySelector(`#${idErro}`)?.textContent).toBe('Preencha este campo.');

    email.value = 'maria@';
    email.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(raiz.querySelector(`#${idErro}`)?.textContent).toContain('e-mail válido');
  });

  it('mostra os erros ao enviar o formulário, mesmo sem tocar', async () => {
    const { fixture, raiz } = await criar();
    raiz.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Preencha este campo.');
  });

  it('o erro da tela (API) vence e o valor digitado chega ao formulário', async () => {
    const { fixture, raiz, email, hospedeiro } = await criar();
    email.value = 'maria@escola.com.br';
    email.dispatchEvent(new Event('input'));
    hospedeiro.erroApi.set('Este e-mail já está em uso.');
    await fixture.whenStable();
    expect(hospedeiro.form.value.email).toBe('maria@escola.com.br');
    expect(raiz.textContent).toContain('Este e-mail já está em uso.');
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  it('número: escreve o valor do formulário, devolve número e lê o prefixo', async () => {
    const { fixture, raiz, valor, hospedeiro } = await criar();
    expect(valor.value).toBe('1500');
    expect(valor.getAttribute('inputmode')).toBe('decimal');
    const prefixo = raiz.querySelector(`#${valor.getAttribute('aria-describedby')}`);
    expect(prefixo?.textContent).toBe('R$');

    valor.value = '2300.5';
    valor.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(hospedeiro.form.value.valor).toBe(2300.5);

    valor.value = '';
    valor.dispatchEvent(new Event('input'));
    expect(hospedeiro.form.value.valor).toBeNull();

    hospedeiro.form.controls.valor.setValue(99);
    await fixture.whenStable();
    expect(valor.value).toBe('99');
  });

  it('desabilita pelo formulário', async () => {
    const { fixture, email, hospedeiro } = await criar();
    hospedeiro.form.controls.email.disable();
    await fixture.whenStable();
    expect(email.disabled).toBe(true);
  });
});
