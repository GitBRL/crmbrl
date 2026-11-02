import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EstadoVazio, type FalhaDoEstado, type VarianteEstado } from './estado-vazio';

@Component({
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      [variante]="variante()"
      titulo="Nenhum contato ainda"
      texto="Cadastre o primeiro contato."
      [codigo]="codigo()"
      [falha]="falha()"
    >
      <button type="button">Novo contato</button>
    </app-estado-vazio>
  `,
})
class Hospedeiro {
  readonly variante = signal<VarianteEstado>('vazio');
  readonly codigo = signal<string | null>(null);
  readonly falha = signal<FalhaDoEstado | null>(null);
}

describe('EstadoVazio', () => {
  it('mostra ilustração decorativa, frase e a ação projetada', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const estado = (fixture.nativeElement as HTMLElement).querySelector(
      'app-estado-vazio',
    ) as HTMLElement;
    expect(estado.querySelector('.estado__ilustracao')?.getAttribute('aria-hidden')).toBe('true');
    expect(estado.querySelector('.estado__titulo')?.textContent).toBe('Nenhum contato ainda');
    expect(estado.querySelector('.estado__acoes button')?.textContent).toBe('Novo contato');
    expect(estado.hasAttribute('role')).toBe(false);
  });

  it('erro é anunciado e mostra o código da requisição', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.variante.set('erro');
    fixture.componentInstance.codigo.set('req-7f3a');
    await fixture.whenStable();
    const estado = (fixture.nativeElement as HTMLElement).querySelector(
      'app-estado-vazio',
    ) as HTMLElement;
    expect(estado.getAttribute('role')).toBe('alert');
    expect(estado.classList).toContain('estado--erro');
    expect(estado.textContent).toContain('req-7f3a');
  });

  it('com a falha de um 403: "sem acesso", sem "Tentar de novo" e sem código', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.variante.set('erro');
    fixture.componentInstance.codigo.set('req-403');
    fixture.componentInstance.falha.set({
      ehSemPermissao: true,
      ehFalhaDoServidor: false,
      requisicaoId: 'req-403',
    });
    await fixture.whenStable();
    const estado = (fixture.nativeElement as HTMLElement).querySelector(
      'app-estado-vazio',
    ) as HTMLElement;
    expect(estado.classList).toContain('estado--sem-acesso');
    expect(estado.querySelector('.estado__titulo')?.textContent).toBe('Você não tem acesso a isto');
    expect(estado.querySelector('.estado__acoes')).toBeNull();
    expect(estado.querySelector('.estado__codigo')).toBeNull();
    expect(estado.hasAttribute('role')).toBe(false);
  });

  it('com a falha do servidor: erro com o código para o suporte', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.variante.set('erro');
    fixture.componentInstance.falha.set({
      ehSemPermissao: false,
      ehFalhaDoServidor: true,
      requisicaoId: 'req-500',
    });
    await fixture.whenStable();
    const estado = (fixture.nativeElement as HTMLElement).querySelector(
      'app-estado-vazio',
    ) as HTMLElement;
    expect(estado.querySelector('.estado__codigo')?.textContent).toContain('req-500');
    expect(estado.querySelector('.estado__acoes button')).not.toBeNull();
  });
});
