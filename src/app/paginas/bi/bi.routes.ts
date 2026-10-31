import type { Routes } from '@angular/router';

/**
 * Rotas de `/bi` (carregadas sob demanda por app.routes.ts). `/bi` abre o primeiro painel que o
 * papel vê; `/bi/:painel` abre um deles (marketing, comercial, cs, atendimento, financeiro).
 */
export const ROTAS_BI: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./bi').then((m) => m.Bi) },
  { path: ':painel', loadComponent: () => import('./bi').then((m) => m.Bi) },
];
