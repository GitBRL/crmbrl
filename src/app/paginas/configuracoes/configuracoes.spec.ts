import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import type { Papel } from '../../nucleo/papeis';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Configuracoes } from './configuracoes';
import { ROTAS_CONFIGURACOES } from './configuracoes.routes';
import { formatarTelefone, gerarSenha } from './textos';

@Component({ template: '' })
class SemAcessoFalso {}

describe('Configuracoes (moldura e seções por papel)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'configuracoes', children: ROTAS_CONFIGURACOES },
          { path: 'sem-acesso', component: SemAcessoFalso },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  function secoesDe(papel: Papel): string[] {
    entrarComo(papel);
    const fixture = TestBed.createComponent(Configuracoes);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(
      (link) => link.textContent?.trim() ?? '',
    );
  }

  it('Admin: usuários, distribuição, passagens e perfil', () => {
    expect(secoesDe('ADMIN')).toEqual([
      'Usuários',
      'Distribuição de leads',
      'Passagens entre funis',
      'Meu perfil',
    ]);
  });

  it('C-level: equipe, distribuição, passagens e perfil', () => {
    expect(secoesDe('C_LEVEL')).toEqual([
      'Minha equipe',
      'Distribuição de leads',
      'Passagens entre funis',
      'Meu perfil',
    ]);
  });

  it('líder: equipe, distribuição e perfil; membro: só o perfil', () => {
    expect(secoesDe('LIDER_CS')).toEqual(['Minha equipe', 'Distribuição de leads', 'Meu perfil']);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    // Uma seção só: sem as pílulas de navegação.
    expect(secoesDe('MARKETING')).toEqual([]);
  });

  it('/configuracoes abre a primeira seção permitida; membro não entra em Usuários', () => {
    const filhas = ROTAS_CONFIGURACOES[0].children!;
    const router = TestBed.inject(Router);
    const rota = { queryParams: {} } as unknown as ActivatedRouteSnapshot;
    const guarda = (caminho: string, url: string) => {
      const definicao = filhas.find((filha) => filha.path === caminho)!;
      const canActivate = definicao.canActivate![0] as CanActivateFn;
      const resultado = TestBed.runInInjectionContext(() =>
        canActivate(rota, { url } as RouterStateSnapshot),
      );
      return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
    };

    entrarComo('LIDER_COMERCIAL');
    expect(guarda('', '/configuracoes')).toBe('/configuracoes/equipe');
    entrarComo('ADMIN');
    expect(guarda('', '/configuracoes')).toBe('/configuracoes/usuarios');
    expect(guarda('usuarios', '/configuracoes/usuarios')).toBe(true);
    entrarComo('COMERCIAL');
    expect(guarda('', '/configuracoes')).toBe('/configuracoes/perfil');
    expect(guarda('usuarios', '/configuracoes/usuarios')).toBe(
      '/sem-acesso?pagina=%2Fconfiguracoes%2Fusuarios',
    );
    expect(guarda('perfil', '/configuracoes/perfil')).toBe(true);
  });

  it('telefone em E.164 vira o formato brasileiro e a senha gerada é forte', () => {
    expect(formatarTelefone('5511987654321')).toBe('+55 (11) 98765-4321');
    expect(formatarTelefone('551133334444')).toBe('+55 (11) 3333-4444');
    expect(formatarTelefone(null)).toBe('');
    const senha = gerarSenha();
    expect(senha).toHaveLength(14);
    expect(senha).toMatch(/[2-9]/);
    expect(senha).toMatch(/[@#$%&*+\-=?]/);
    expect(senha).not.toMatch(/[lIO01]/);
  });
});
