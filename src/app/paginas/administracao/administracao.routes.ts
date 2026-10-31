import { inject } from '@angular/core';
import type { Routes } from '@angular/router';

import { exigirPermissao, redirecionar } from '../../nucleo/sessao/guardas';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { SECOES_ADMINISTRACAO, secaoAdministracao } from './secoes';

/**
 * Rotas de `/administracao` (carregadas sob demanda por app.routes.ts). Cada aba confere a
 * própria permissão; `/administracao` sozinho abre a primeira aba que o usuário acessa.
 */
function secao(caminho: string, carregar: Routes[number]['loadComponent']): Routes[number] {
  const definicao = secaoAdministracao(caminho);
  return {
    path: caminho,
    title: definicao.rotulo,
    canActivate: [exigirPermissao(definicao.permite)],
    loadComponent: carregar,
  };
}

export const ROTAS_ADMINISTRACAO: Routes = [
  {
    path: '',
    loadComponent: () => import('./administracao').then((m) => m.Administracao),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [
          redirecionar(() => {
            const sessao = inject(SessaoService);
            const primeira = SECOES_ADMINISTRACAO.find((item) => sessao.permite(item.permite));
            return `/administracao/${primeira?.caminho ?? 'auditoria'}`;
          }),
        ],
        children: [],
      },
      secao('auditoria', () => import('./auditoria').then((m) => m.Auditoria)),
      secao('logs', () => import('./logs-tecnicos').then((m) => m.LogsTecnicos)),
      { path: 'ia', redirectTo: 'duvidas' },
      secao('duvidas', () => import('./duvidas/duvidas').then((m) => m.Duvidas)),
    ],
  },
];
