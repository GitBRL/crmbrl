import type { Routes } from '@angular/router';

import { exigirPapel } from '../../nucleo/sessao/guardas';

/**
 * Rotas de `/financeiro` (carregadas sob demanda por app.routes.ts). A casca (`financeiro.ts`)
 * traz o título e as seções; cada seção é uma filha. `contratos/novo` vem antes de `:id`.
 */
export const ROTAS_FINANCEIRO: Routes = [
  {
    path: '',
    loadComponent: () => import('./financeiro').then((m) => m.Financeiro),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'contratos' },
      {
        path: 'contratos',
        title: 'Contratos',
        loadComponent: () => import('./contratos').then((m) => m.Contratos),
      },
      {
        path: 'contratos/novo',
        title: 'Novo contrato',
        loadComponent: () => import('./contrato-novo').then((m) => m.ContratoNovo),
      },
      {
        path: 'contratos/:id',
        title: 'Contrato',
        loadComponent: () => import('./contrato-detalhe').then((m) => m.ContratoDetalhePagina),
      },
      {
        path: 'parcelas',
        title: 'Parcelas a receber',
        loadComponent: () => import('./parcelas').then((m) => m.Parcelas),
      },
      {
        path: 'parcelas/importar',
        title: 'Importar parcelas',
        data: { tipo: 'PARCELAS' },
        loadComponent: () => import('../contatos/importar/importar').then((m) => m.Importar),
      },
      {
        path: 'regua',
        title: 'Régua de cobrança',
        canActivate: [exigirPapel('ADMIN', 'C_LEVEL', 'LIDER_CS', 'CS')],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'hoje' },
          {
            path: ':aba',
            loadComponent: () => import('./regua').then((m) => m.Regua),
          },
        ],
      },
      {
        path: 'indicadores',
        title: 'Indicadores financeiros',
        loadComponent: () => import('./indicadores').then((m) => m.Indicadores),
      },
    ],
  },
];
