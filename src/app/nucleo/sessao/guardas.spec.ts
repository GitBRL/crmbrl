import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withRouterConfig, type Routes } from '@angular/router';

import { interceptarErros } from '../api/interceptor-erros';
import {
  acessoAoModulo,
  apenasVisitante,
  ehAreaDeFunil,
  ehUuid,
  exigirPapel,
  exigirPermissao,
  exigirSessao,
  paraPrimeiroFunil,
  redirecionarFunilPorId,
} from './guardas';
import { perfilDeTeste } from './sessao-de-teste';
import { SessaoService } from './sessao.service';

@Component({ template: 'página' })
class Pagina {}

const ROTAS: Routes = [
  { path: 'entrar', canActivate: [apenasVisitante], component: Pagina },
  { path: 'trocar-senha', component: Pagina },
  {
    path: '',
    canActivate: [exigirSessao],
    canActivateChild: [exigirSessao, acessoAoModulo],
    children: [
      { path: 'inicio', component: Pagina },
      { path: 'sem-acesso', component: Pagina },
      {
        path: 'funis',
        children: [
          { path: '', pathMatch: 'full', canActivate: [paraPrimeiroFunil], children: [] },
          { path: ':area', canMatch: [ehAreaDeFunil], component: Pagina },
          {
            path: ':funilId',
            canMatch: [ehUuid],
            canActivate: [redirecionarFunilPorId],
            children: [],
          },
        ],
      },
      {
        path: 'configuracoes/usuarios',
        canActivate: [exigirPermissao((p) => p.gerenciarUsuarios)],
        component: Pagina,
      },
      {
        path: 'configuracoes/equipe',
        canActivate: [exigirPapel('C_LEVEL', 'LIDER_CS')],
        component: Pagina,
      },
      { path: 'integracoes', component: Pagina },
      { path: '**', component: Pagina },
    ],
  },
];

describe('guardas de rota', () => {
  let http: HttpTestingController;
  let router: Router;
  let sessao: SessaoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(ROTAS, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
        provideHttpClient(withInterceptors([interceptarErros])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    sessao = TestBed.inject(SessaoService);
  });
  afterEach(() => http.verify());

  async function navegar(url: string): Promise<string> {
    await router.navigateByUrl(url);
    return router.url;
  }

  it('sem sessão: vai para /entrar guardando a rota', async () => {
    const indo = navegar('/funis/cs?x=1');
    await new Promise((fim) => setTimeout(fim));
    http.expectOne('/api/v1/auth/eu').flush(null, { status: 401, statusText: 'x' });
    expect(await indo).toBe('/entrar?voltar=%2Ffunis%2Fcs%3Fx%3D1');
  });

  it('com troca de senha pendente: vai para /trocar-senha', async () => {
    sessao.definirPerfil(perfilDeTeste('CS', { deveTrocarSenha: true }));
    expect(await navegar('/inicio')).toBe('/trocar-senha');
    expect(await navegar('/funis/cs')).toBe('/trocar-senha?voltar=%2Ffunis%2Fcs');
  });

  it('com sessão, /entrar segue para a rota guardada', async () => {
    sessao.definirPerfil(perfilDeTeste('CS'));
    expect(await navegar('/entrar?voltar=%2Ffunis%2Fcs')).toBe('/funis/cs');
    expect(await navegar('/entrar')).toBe('/inicio');
  });

  it('módulo que o papel não acessa: página sem acesso dizendo qual era', async () => {
    sessao.definirPerfil(perfilDeTeste('COMERCIAL'));
    expect(await navegar('/funis/comercial')).toBe('/funis/comercial');
    expect(await navegar('/funis/marketing')).toBe('/sem-acesso?pagina=%2Ffunis%2Fmarketing');
    expect(await navegar('/integracoes')).toBe('/sem-acesso?pagina=%2Fintegracoes');
  });

  it('seções com permissão própria e por papel', async () => {
    sessao.definirPerfil(perfilDeTeste('C_LEVEL'));
    expect(await navegar('/configuracoes/usuarios')).toBe(
      '/sem-acesso?pagina=%2Fconfiguracoes%2Fusuarios',
    );
    expect(await navegar('/configuracoes/equipe')).toBe('/configuracoes/equipe');
    sessao.definirPerfil(perfilDeTeste('ADMIN'));
    expect(await navegar('/configuracoes/usuarios')).toBe('/configuracoes/usuarios');
    expect(await navegar('/configuracoes/equipe')).toBe(
      '/sem-acesso?pagina=%2Fconfiguracoes%2Fequipe',
    );
  });

  it('/funis vai para o primeiro funil visível; área inválida cai na 404', async () => {
    sessao.definirPerfil(perfilDeTeste('LIDER_CS'));
    expect(await navegar('/funis')).toBe('/funis/cs');
    expect(await navegar('/funis/qualquer')).toBe('/funis/qualquer');
  });

  it('link de notificação com o id do funil vira /funis/<area>/<negocio>', async () => {
    sessao.definirPerfil(perfilDeTeste('LIDER_COMERCIAL'));
    const funil = 'b4f84a76-8c49-41fa-973c-bbaaf2a7f749';
    const indo = navegar(`/funis/${funil}?negocio=n1`);
    await new Promise((fim) => setTimeout(fim));
    http.expectOne(`/api/v1/funis/${funil}`).flush({ id: funil, area: 'COMERCIAL' });
    expect(await indo).toBe(`/funis/comercial/n1?funil=${funil}`);
  });
});
