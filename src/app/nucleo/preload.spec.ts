import { TestBed } from '@angular/core/testing';
import type { Route } from '@angular/router';
import { of } from 'rxjs';

import { PreloadDoQueAcessa } from './preload';
import { SessaoService } from './sessao/sessao.service';
import { entrarComo } from './sessao/sessao-de-teste';

describe('PreloadDoQueAcessa', () => {
  function preparar() {
    const estrategia = TestBed.inject(PreloadDoQueAcessa);
    const carregadas: string[] = [];
    const pedir = (rota: Route) =>
      estrategia
        .preload(rota, () => {
          carregadas.push(rota.path ?? '');
          return of(true);
        })
        .subscribe();
    return { carregadas, pedir };
  }

  it('sem sessão (tela de entrar) não baixa nada; ao entrar, baixa o que o papel acessa', async () => {
    const { carregadas, pedir } = preparar();
    for (const path of ['contatos', 'integracoes', 'administracao', ':area', 'entrada']) {
      pedir({ path });
    }
    TestBed.tick();
    expect(carregadas).toEqual([]);

    entrarComo('COMERCIAL');
    TestBed.tick();
    await Promise.resolve();
    expect(carregadas).toEqual(['contatos', ':area', 'entrada']);
  });

  it('o Admin baixa tudo, menos o que pede `preload: false`', async () => {
    entrarComo('ADMIN');
    const { carregadas, pedir } = preparar();
    pedir({ path: 'administracao' });
    pedir({ path: 'design-system', data: { preload: false } });
    TestBed.tick();
    await Promise.resolve();
    expect(carregadas).toEqual(['administracao']);
    expect(TestBed.inject(SessaoService).autenticado()).toBe(true);
  });
});
