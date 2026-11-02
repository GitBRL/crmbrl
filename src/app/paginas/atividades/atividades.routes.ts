import type { Routes } from '@angular/router';

/** Rotas de `/atividades` (carregadas sob demanda por app.routes.ts). */
export const ROTAS_ATIVIDADES: Routes = [
  {
    path: '',
    loadComponent: () => import('./atividades').then((m) => m.Atividades),
  },
];
