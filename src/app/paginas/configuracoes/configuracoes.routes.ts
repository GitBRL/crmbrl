import { inject } from '@angular/core';
import type { Routes } from '@angular/router';

import { ehUuid, exigirPermissao, redirecionar } from '../../nucleo/sessao/guardas';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { podeCriarFunil } from './funis/permissao';
import { SECOES_CONFIGURACOES, secaoConfiguracoes } from './secoes';

/**
 * Rotas de `/configuracoes` (carregadas sob demanda por app.routes.ts). Cada seção confere a
 * própria permissão; `/configuracoes` sozinho abre a primeira seção que o usuário acessa.
 */
function secao(caminho: string, carregar: Routes[number]['loadComponent']): Routes[number] {
  const definicao = secaoConfiguracoes(caminho);
  return {
    path: caminho,
    title: definicao.rotulo,
    canActivate: [exigirPermissao(definicao.permite)],
    loadComponent: carregar,
  };
}

const SECOES_DE_CONSULTA: ReadonlySet<string> = new Set(['funis', 'setores']);

export const ROTAS_CONFIGURACOES: Routes = [
  {
    path: '',
    loadComponent: () => import('./configuracoes').then((m) => m.Configuracoes),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [
          redirecionar(() => {
            const sessao = inject(SessaoService);
            // Funis e Setores são consulta: a porta de entrada continua sendo a primeira seção de gestão.
            const primeira = SECOES_CONFIGURACOES.find(
              (item) => !SECOES_DE_CONSULTA.has(item.caminho) && sessao.permite(item.permite),
            );
            return `/configuracoes/${primeira?.caminho ?? 'perfil'}`;
          }),
        ],
        children: [],
      },
      secao('usuarios', () => import('./usuarios').then((m) => m.Usuarios)),
      secao('equipe', () => import('./minha-equipe').then((m) => m.MinhaEquipe)),
      secao('distribuicao', () => import('./distribuicao').then((m) => m.Distribuicao)),
      {
        path: 'funis',
        title: secaoConfiguracoes('funis').rotulo,
        canActivate: [exigirPermissao(secaoConfiguracoes('funis').permite)],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./funis/funis-config').then((m) => m.FunisConfig),
          },
          {
            path: 'novo',
            title: 'Novo funil',
            canActivate: [exigirPermissao((_p, perfil) => podeCriarFunil(perfil.usuario))],
            loadComponent: () => import('./funis/novo-funil').then((m) => m.FormularioNovoFunil),
          },
          {
            path: ':id',
            title: 'Configurar funil',
            canMatch: [ehUuid],
            loadComponent: () =>
              import('./funis/configurar-funil').then((m) => m.ConfigurarFunilPagina),
          },
        ],
      },
      secao('setores', () => import('./setores').then((m) => m.SetoresConfig)),
      secao('passagens', () => import('./passagens').then((m) => m.Passagens)),
      secao('disparos', () => import('./disparos-config').then((m) => m.DisparosConfig)),
      secao('apps-de-login', () =>
        import('./apps-de-login/apps-de-login').then((m) => m.AppsDeLogin),
      ),
      secao('assistente', () => import('./assistente-config').then((m) => m.AssistenteConfig)),
      secao('perfil', () => import('./meu-perfil').then((m) => m.MeuPerfil)),
    ],
  },
];
