import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { CampoSenha } from './campo-senha';

@Component({
  imports: [ReactiveFormsModule, CampoSenha],
  template: `<app-campo-senha
    rotulo="Nova senha"
    autocomplete="new-password"
    dica="Mínimo de 8 caracteres."
    [formControl]="senha"
  />`,
})
class Hospedeiro {
  readonly senha = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)],
  });
}

describe('CampoSenha', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector('input') as HTMLInputElement;
    const botao = raiz.querySelector('button') as HTMLButtonElement;
    return { fixture, raiz, campo, botao, hospedeiro: fixture.componentInstance };
  }

  it('é um campo de senha rotulado, com autocomplete de senha nova', async () => {
    const { raiz, campo } = await criar();
    expect(campo.type).toBe('password');
    expect(campo.getAttribute('autocomplete')).toBe('new-password');
    expect(raiz.querySelector(`label[for="${campo.id}"]`)?.textContent?.trim()).toBe('Nova senha');
  });

  it('mostrar/ocultar alterna o tipo e o aria-pressed', async () => {
    const { fixture, campo, botao } = await criar();
    expect(botao.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(botao.getAttribute('aria-pressed')).toBe('false');
    expect(botao.getAttribute('aria-controls')).toBe(campo.id);
    botao.click();
    await fixture.whenStable();
    expect(campo.type).toBe('text');
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });

  it('valida em tempo real depois de tocado e avisa do Caps Lock', async () => {
    const { fixture, raiz, campo, hospedeiro } = await criar();
    campo.value = 'abc';
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(hospedeiro.senha.value).toBe('abc');
    expect(raiz.textContent).toContain('Use pelo menos 8 caracteres.');

    const tecla = new KeyboardEvent('keydown', { key: 'A' });
    Object.defineProperty(tecla, 'getModifierState', { value: () => true });
    campo.dispatchEvent(tecla);
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Caps Lock ligado');
    expect(campo.getAttribute('aria-describedby')).toContain(`${campo.id}-caps`);
  });
});
