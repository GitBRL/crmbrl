import type { Routes } from '@angular/router';

/**
 * Rotas de `/atendimento` (carregadas sob demanda por app.routes.ts; o acesso ao módulo — todos
 * os papéis menos Marketing, R12 — a casca já confere). A página é a caixa de entrada; a
 * conversa aberta é a rota filha `:conversaId`, para a lista não ser recriada ao trocar de
 * conversa.
 *
 * Esqueleto da Onda A (base-front-a): a tela completa é do agente `atendimento-front`, que pode
 * reorganizar estas rotas à vontade dentro desta pasta.
 */
export const ROTAS_ATENDIMENTO: Routes = [
  {
    path: '',
    loadComponent: () => import('./atendimento').then((m) => m.Atendimento),
    children: [
      // Nenhuma conversa aberta: a página mostra o convite para escolher uma.
      { path: '', pathMatch: 'full', children: [] },
      {
        path: 'ligacoes/:ligacaoId',
        loadComponent: () => import('./ligacao-aberta').then((m) => m.LigacaoAberta),
      },
      {
        path: ':conversaId',
        loadComponent: () => import('./conversa').then((m) => m.Conversa),
      },
    ],
  },
];
