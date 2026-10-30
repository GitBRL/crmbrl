import type { Routes } from '@angular/router';

import { ehUuid, redirecionar } from '../../nucleo/sessao/guardas';

/** Rotas de `/contatos` (carregadas sob demanda por app.routes.ts). */
export const ROTAS_CONTATOS: Routes = [
  {
    path: '',
    loadComponent: () => import('./contatos').then((m) => m.Contatos),
  },
  {
    // Esqueleto da Onda B; o agente `importacao-front` troca o conteúdo.
    path: 'importar',
    title: 'Importar contatos',
    loadComponent: () => import('./importar/importar').then((m) => m.Importar),
  },
  {
    path: ':id',
    title: 'Contato',
    canMatch: [ehUuid],
    loadComponent: () => import('./detalhe-contato').then((m) => m.DetalheContato),
  },
];

/**
 * Rotas de `/empresas` (o detalhe da empresa; a lista fica na aba "Empresas" de
 * `/contatos?aba=empresas`).
 */
export const ROTAS_EMPRESAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [redirecionar(() => '/contatos?aba=empresas')],
    children: [],
  },
  {
    path: ':id',
    title: 'Empresa',
    canMatch: [ehUuid],
    loadComponent: () => import('./detalhe-empresa').then((m) => m.DetalheEmpresa),
  },
];
