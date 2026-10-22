import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MenuAcoes, type ItemMenuAcoes } from './menu-acoes';

@Component({
  imports: [MenuAcoes],
  template: `<app-menu-acoes
    rotulo="Ações de Maria Souza"
    [itens]="itens"
    (escolher)="escolhidos.push($event.id)"
  />`,
})
class Hospedeiro {
  readonly itens: ItemMenuAcoes[] = [
    { id: 'editar', rotulo: 'Editar' },
    { id: 'reabrir', rotulo: 'Reabrir', desabilitado: true, motivo: 'Só o líder pode reabrir.' },
    { id: 'desligar', rotulo: 'Desligar', perigo: true, separarAntes: true },
  ];
  readonly escolhidos: string[] = [];
}

describe('MenuAcoes', () => {
  async function abrir() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const gatilho = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    gatilho.click();
    await fixture.whenStable();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    return { fixture, gatilho, menu, hospedeiro: fixture.componentInstance };
  }

  it('botão "⋯" nomeado que abre um menu do CDK com os itens', async () => {
    const { gatilho, menu } = await abrir();
    expect(gatilho.getAttribute('aria-label')).toBe('Ações de Maria Souza');
    expect(gatilho.getAttribute('aria-haspopup')).toBe('menu');
    expect(gatilho.getAttribute('aria-expanded')).toBe('true');
    expect(menu.getAttribute('aria-label')).toBe('Ações de Maria Souza');
    const itens = [...menu.querySelectorAll('[role="menuitem"]')];
    expect(itens.map((item) => item.querySelector('.menu-acoes__rotulo')?.textContent)).toEqual([
      'Editar',
      'Reabrir',
      'Desligar',
    ]);
    expect(menu.querySelectorAll('[role="separator"]').length).toBe(1);
    expect(itens[2].classList).toContain('menu-acoes__item--perigo');
  });

  it('ação desabilitada diz por quê e não dispara', async () => {
    const { fixture, menu, hospedeiro } = await abrir();
    const reabrir = menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1];
    expect(reabrir.getAttribute('aria-disabled')).toBe('true');
    expect(
      document.getElementById(reabrir.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Só o líder pode reabrir.');
    reabrir.click();
    await fixture.whenStable();
    expect(hospedeiro.escolhidos).toEqual([]);
  });

  it('escolher emite o item e fecha o menu', async () => {
    const { fixture, gatilho, menu, hospedeiro } = await abrir();
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
    await fixture.whenStable();
    expect(hospedeiro.escolhidos).toEqual(['editar']);
    expect(gatilho.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
