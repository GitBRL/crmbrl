import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { Seletor, type OpcaoSeletor } from './seletor';

interface Lider {
  readonly id: number;
  readonly nome: string;
}

@Component({
  imports: [ReactiveFormsModule, Seletor],
  template: `
    <app-seletor rotulo="Papel" [opcoes]="papeis" [formControl]="papel" />
    <app-seletor
      rotulo="Líder"
      placeholder="Sem líder"
      permitirVazio
      [opcoes]="lideres"
      [comparar]="mesmoId"
      [formControl]="lider"
    />
  `,
})
class Hospedeiro {
  readonly papeis: OpcaoSeletor<string>[] = [
    { valor: 'admin', rotulo: 'Administrador' },
    { valor: 'lider', rotulo: 'Líder' },
    { valor: 'vendedor', rotulo: 'Vendedor', desabilitada: true },
  ];
  readonly lideres: OpcaoSeletor<Lider>[] = [
    { valor: { id: 1, nome: 'Carla' }, rotulo: 'Carla' },
    { valor: { id: 2, nome: 'Pedro' }, rotulo: 'Pedro' },
  ];
  readonly papel = new FormControl<string | null>(null, Validators.required);
  readonly lider = new FormControl<Lider | null>({ id: 2, nome: 'Pedro' });
  readonly mesmoId = (a: Lider | null, b: Lider) => a?.id === b.id;
}

describe('Seletor', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const [papel, lider] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('select')];
    return { fixture, papel, lider, hospedeiro: fixture.componentInstance };
  }

  it('é um select nativo com o placeholder fixo e as opções', async () => {
    const { papel } = await criar();
    const opcoes = [...papel.options];
    expect(opcoes.map((opcao) => opcao.textContent?.trim())).toEqual([
      'Escolha uma opção',
      'Administrador',
      'Líder',
      'Vendedor',
    ]);
    expect(opcoes[0].disabled).toBe(true);
    expect(opcoes[3].disabled).toBe(true);
    expect(papel.selectedIndex).toBe(0);
    expect(papel.getAttribute('aria-required')).toBe('true');
  });

  it('escolher devolve o valor da opção; sem escolha, pede uma', async () => {
    const { fixture, papel, hospedeiro } = await criar();
    papel.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Escolha uma opção.');

    papel.value = '1';
    papel.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(hospedeiro.papel.value).toBe('lider');
    expect(papel.hasAttribute('aria-invalid')).toBe(false);
  });

  it('compara objetos e permite voltar a vazio', async () => {
    const { fixture, lider, hospedeiro } = await criar();
    expect(lider.selectedIndex).toBe(2);
    expect(lider.options[0].disabled).toBe(false);
    lider.value = '';
    lider.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(hospedeiro.lider.value).toBeNull();
  });

  it('opções com `grupo` ficam sob um optgroup e o valor segue o índice da opção', async () => {
    const fixture = TestBed.createComponent(Seletor<string>);
    fixture.componentRef.setInput('rotulo', 'Campo');
    fixture.componentRef.setInput('opcoes', [
      { valor: 'nome', rotulo: 'Nome', grupo: 'Contato' },
      { valor: 'email', rotulo: 'E-mail', grupo: 'Contato' },
      { valor: 'funil', rotulo: 'Funil', grupo: 'Negócio' },
    ]);
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    expect(
      Array.from(select.querySelectorAll('optgroup')).map((g) => [g.label, g.children.length]),
    ).toEqual([
      ['Contato', 2],
      ['Negócio', 1],
    ]);
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.valor()).toBe('funil');
  });
});
