import type { Routes } from '@angular/router';

import { exigirPapel } from '../../nucleo/sessao/guardas';

/**
 * Rotas de `/bi` (carregadas sob demanda por app.routes.ts). `/bi` abre o primeiro painel que o
 * papel vê; `/bi/:painel` abre um deles (marketing, comercial, cs, atendimento, financeiro); `/bi/indicadores` e `/bi/indicadores/:id` são os painéis de indicadores configuráveis (R33); `/bi/analises` é o histórico das análises
 * com IA (só o Admin).
 */
export const ROTAS_BI: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./bi').then((m) => m.Bi) },
  {
    path: 'analises',
    title: 'Análises com IA',
    canActivate: [exigirPapel('ADMIN')],
    loadComponent: () => import('./analise/historico-analises').then((m) => m.HistoricoAnalises),
  },
  {
    path: 'indicadores',
    title: 'Indicadores',
    loadComponent: () => import('./indicadores/indicadores').then((m) => m.Indicadores),
  },
  {
    path: 'indicadores/:id',
    title: 'Indicadores',
    loadComponent: () => import('./indicadores/indicadores').then((m) => m.Indicadores),
  },
  { path: ':painel', loadComponent: () => import('./bi').then((m) => m.Bi) },
];
