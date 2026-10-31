import { inject } from '@angular/core';
import type { Routes } from '@angular/router';

import { exigirPermissao, redirecionar } from '../../nucleo/sessao/guardas';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
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
            const primeira = SECOES_CONFIGURACOES.find((item) => sessao.permite(item.permite));
            return `/configuracoes/${primeira?.caminho ?? 'perfil'}`;
          }),
        ],
        children: [],
      },
      secao('usuarios', () => import('./usuarios').then((m) => m.Usuarios)),
      secao('equipe', () => import('./minha-equipe').then((m) => m.MinhaEquipe)),
      secao('distribuicao', () => import('./distribuicao').then((m) => m.Distribuicao)),
      secao('passagens', () => import('./passagens').then((m) => m.Passagens)),
      secao('disparos', () => import('./disparos-config').then((m) => m.DisparosConfig)),
      secao('perfil', () => import('./meu-perfil').then((m) => m.MeuPerfil)),
    ],
  },
];
