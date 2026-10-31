import type { Routes } from '@angular/router';

/**
 * Rotas de `/chatbot` (carregadas sob demanda por app.routes.ts). `novo` vem antes de `:id`.
 */
export const ROTAS_CHATBOT: Routes = [
  {
    path: '',
    loadComponent: () => import('./chatbot').then((m) => m.Chatbot),
  },
  {
    path: 'novo',
    title: 'Novo fluxo',
    loadComponent: () => import('./novo-fluxo').then((m) => m.NovoFluxo),
  },
  {
    path: ':id',
    title: 'Fluxo do chatbot',
    loadComponent: () => import('./editor-fluxo').then((m) => m.EditorFluxo),
  },
];
