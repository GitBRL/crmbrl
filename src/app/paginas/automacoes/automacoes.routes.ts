import type { Routes } from '@angular/router';

/**
 * Rotas de `/automacoes` (carregadas sob demanda por app.routes.ts). Esqueletos da Onda B: o
 * agente `automacoes-front` troca o conteúdo. `nova` vem antes de `:id`.
 */
export const ROTAS_AUTOMACOES: Routes = [
  {
    path: '',
    loadComponent: () => import('./automacoes').then((m) => m.Automacoes),
  },
  {
    path: 'nova',
    title: 'Nova automação',
    loadComponent: () => import('./editor-automacao').then((m) => m.EditorAutomacao),
  },
  {
    path: ':id',
    title: 'Automação',
    loadComponent: () => import('./editor-automacao').then((m) => m.EditorAutomacao),
  },
];
