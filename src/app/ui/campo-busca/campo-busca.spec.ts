import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CampoBusca } from './campo-busca';

@Component({
  imports: [CampoBusca],
  template: `<app-campo-busca [(valor)]="valor" (buscar)="buscas.push($event)" />`,
})
class Hospedeiro {
  readonly valor = signal('');
  readonly buscas: string[] = [];
}

describe('CampoBusca', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector('input') as HTMLInputElement;
    return { fixture, hospedeiro: fixture.componentInstance, raiz, campo };
  }

  it('é um formulário de busca com rótulo ligado ao campo', () => {
    const { raiz, campo } = criar();
    expect(raiz.querySelector('form')?.getAttribute('role')).toBe('search');
    expect(campo.type).toBe('search');
    expect(campo.placeholder).toBe('Buscar…');
    expect(raiz.querySelector(`label[for="${campo.id}"]`)?.textContent).toBe('Buscar');
  });

  it('o marco de busca tem o nome do rótulo', () => {
    const fixture = TestBed.createComponent(CampoBusca);
    fixture.componentRef.setInput('rotulo', 'Buscar no CRM');
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('form[role="search"]')?.getAttribute('aria-label')).toBe(
      'Buscar no CRM',
    );
    expect(raiz.querySelector('label')?.textContent).toBe('Buscar no CRM');
  });

  it('acompanha o texto e emite a busca no Enter (submit)', () => {
    const { fixture, hospedeiro, raiz, campo } = criar();
    campo.value = '  Escola Horizonte ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(hospedeiro.valor()).toBe('  Escola Horizonte ');
    raiz.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(hospedeiro.buscas).toEqual(['Escola Horizonte']);
  });

  it('botão de limpar aparece com texto e limpa', () => {
    const { fixture, hospedeiro, raiz } = criar();
    expect(raiz.querySelector('.campo-busca__limpar')).toBeNull();
    hospedeiro.valor.set('Maria');
    fixture.detectChanges();
    const limpar = raiz.querySelector('.campo-busca__limpar') as HTMLButtonElement;
    expect(limpar.getAttribute('aria-label')).toBe('Limpar busca');
    limpar.click();
    fixture.detectChanges();
    expect(hospedeiro.valor()).toBe('');
    expect(raiz.querySelector('.campo-busca__limpar')).toBeNull();
  });
});
