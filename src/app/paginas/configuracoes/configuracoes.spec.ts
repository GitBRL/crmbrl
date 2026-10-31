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
import { Configuracoes, trazerPilulaParaVista } from './configuracoes';
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

  it('Admin: usuários, distribuição, passagens, assistente e perfil', () => {
    expect(secoesDe('ADMIN')).toEqual([
      'Usuários',
      'Distribuição de leads',
      'Passagens entre funis',
      'Disparos',
      'Assistente de ajuda',
      'Meu perfil',
    ]);
  });

  it('C-level: equipe, distribuição, passagens e perfil', () => {
    expect(secoesDe('C_LEVEL')).toEqual([
      'Minha equipe',
      'Distribuição de leads',
      'Passagens entre funis',
      'Disparos',
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

  describe('pílula da seção aberta no celular (a linha rola na horizontal)', () => {
    function linhaDePilulas(pilula: { left: number; right: number }, scrollLeft = 0) {
      const linha = document.createElement('nav');
      const link = document.createElement('a');
      linha.append(link);
      Object.defineProperties(linha, {
        scrollWidth: { configurable: true, value: 640 },
        clientWidth: { configurable: true, value: 390 },
        scrollLeft: { configurable: true, writable: true, value: scrollLeft },
      });
      const scrollTo = vi.fn((opcoes: ScrollToOptions) => {
        linha.scrollLeft = opcoes.left ?? 0;
      });
      linha.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
      linha.getBoundingClientRect = () => ({ left: 0, right: 390 }) as DOMRect;
      link.getBoundingClientRect = () => pilula as DOMRect;
      return { linha, link, scrollTo };
    }

    it('"Meu perfil", fora da tela à direita, vem para a vista com 16px de folga', () => {
      const { linha, link, scrollTo } = linhaDePilulas({ left: 511, right: 615 });
      trazerPilulaParaVista(link, true);
      expect(scrollTo).toHaveBeenCalledWith({ left: 241, behavior: 'instant' });
      expect(linha.scrollLeft).toBe(241);
    });

    it('cortada à esquerda volta; inteira na vista, a linha não mexe', () => {
      const cortada = linhaDePilulas({ left: -40, right: 80 }, 200);
      trazerPilulaParaVista(cortada.link);
      expect(cortada.scrollTo).toHaveBeenCalledWith({ left: 144, behavior: 'auto' });

      const inteira = linhaDePilulas({ left: 120, right: 300 });
      trazerPilulaParaVista(inteira.link);
      expect(inteira.scrollTo).not.toHaveBeenCalled();
    });
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
