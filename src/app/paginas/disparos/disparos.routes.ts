import type { Routes } from '@angular/router';

/**
 * Rotas de `/disparos` (carregadas sob demanda por app.routes.ts). Esqueletos da Onda B: o
 * agente `disparos-front` troca o conteúdo de cada página. `novo` vem antes de `:id`.
 */
export const ROTAS_DISPAROS: Routes = [
  {
    path: '',
    loadComponent: () => import('./disparos').then((m) => m.Disparos),
  },
  {
    path: 'novo',
    title: 'Nova campanha',
    loadComponent: () => import('./disparo-novo').then((m) => m.DisparoNovo),
  },
  {
    path: ':id',
    title: 'Campanha',
    loadComponent: () => import('./detalhe-disparo').then((m) => m.DetalheDisparo),
  },
];
