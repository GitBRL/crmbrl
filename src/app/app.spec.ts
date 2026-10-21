import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from './app';
import { routes } from './app.routes';
import { MODULOS } from './nucleo/navegacao';
import { TituloPagina } from './nucleo/titulo-pagina';

@Component({ template: '<p>página</p>' })
class PaginaFalsa {}

describe('App', () => {
  it('só tem o roteamento e liga o tema na partida', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('router-outlet')).not.toBeNull();
    expect(raiz.querySelector('h1')).toBeNull();
    expect(document.documentElement.getAttribute('data-tema')).toMatch(/^(escuro|claro)$/);
  });

  it('título da aba: "<página> · BRL CRM"', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'x', title: 'Visão geral', component: PaginaFalsa }]),
        { provide: TitleStrategy, useClass: TituloPagina },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/x');
    expect(document.title).toBe('Visão geral · BRL CRM');
  });
});

describe('app.routes', () => {
  const filhas: Route[] = routes[0].children ?? [];

  it('a casca envolve todas as rotas; "/" vai para /inicio e "**" para a 404', () => {
    expect(routes.length).toBe(1);
    expect(routes[0].loadComponent).toBeDefined();
    expect(filhas[0]).toMatchObject({ path: '', redirectTo: 'inicio', pathMatch: 'full' });
    expect(filhas[filhas.length - 1].path).toBe('**');
  });

  it('tem uma rota lazy com título para cada módulo da navegação', () => {
    for (const modulo of MODULOS) {
      const rota = filhas.find((item) => item.path === modulo.rota.slice(1));
      expect(rota, modulo.rota).toBeDefined();
      expect(rota?.loadComponent).toBeDefined();
      expect(rota?.title).toBe(modulo.rotulo);
      if (modulo.status === 'em-breve') {
        expect(rota?.data).toEqual({ modulo: modulo.id });
      }
    }
  });
});
