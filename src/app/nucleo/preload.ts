import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { PreloadingStrategy, Route } from '@angular/router';
import { filter, mergeMap, type Observable, of, take } from 'rxjs';

import { moduloBasePorRota } from './modulos';
import { SessaoService } from './sessao/sessao.service';

/**
 * Pré-carregamento das páginas, no lugar do `PreloadAllModules`: espera alguém entrar e só
 * baixa, em segundo plano, as páginas dos módulos que o papel acessa (`SessaoService.pode`).
 * Quem está na tela de entrar não baixa o app inteiro, e um membro não baixa Administração nem
 * Integrações. Rotas com `data: { preload: false }` (o catálogo do design system) nunca são
 * pré-carregadas: abrem sob demanda.
 */
@Injectable({ providedIn: 'root' })
export class PreloadDoQueAcessa implements PreloadingStrategy {
  private readonly sessao = inject(SessaoService);
  private readonly perfil$ = toObservable(this.sessao.perfil);

  preload(rota: Route, carregar: () => Observable<unknown>): Observable<unknown> {
    if (rota.data?.['preload'] === false) {
      return of(null);
    }
    return this.perfil$.pipe(
      filter((perfil) => perfil !== null),
      take(1),
      mergeMap(() => (this.acessa(rota) ? carregar() : of(null))),
    );
  }

  /**
   * O papel acessa o módulo dono da rota? Rotas internas dos módulos (seções, detalhe) não têm
   * módulo próprio: vêm junto, já que o módulo de cima só carregou porque o papel o acessa.
   */
  private acessa(rota: Route): boolean {
    if (rota.path === ':area') {
      return (this.sessao.permissoes()?.areasVisiveis.length ?? 0) > 0;
    }
    const modulo = rota.path ? moduloBasePorRota(`/${rota.path}`) : undefined;
    return modulo ? this.sessao.pode(modulo) : true;
  }
}
