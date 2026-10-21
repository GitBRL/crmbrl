import type { Routes } from '@angular/router';

import { MODULOS, moduloPorId } from './nucleo/navegacao';

/**
 * Rotas do CRM. Todas carregam sob demanda (`loadComponent`) dentro da casca (layout/).
 * As rotas dos módulos "em breve" saem de `nucleo/navegacao.ts` — a fonte única — e levam o
 * id do módulo em `data.modulo` (vira o input `modulo` da página, via component input binding).
 * O `title` de cada rota vira "<título> · BRL CRM" (nucleo/titulo-pagina.ts).
 */

const paginaEmBreve = () => import('./paginas/em-breve/em-breve').then((m) => m.EmBreve);

const rotasEmBreve: Routes = MODULOS.filter((modulo) => modulo.status === 'em-breve').map(
  (modulo) => ({
    path: modulo.rota.slice(1),
    title: modulo.rotulo,
    data: { modulo: modulo.id },
    loadComponent: paginaEmBreve,
  }),
);

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/casca').then((m) => m.Casca),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: moduloPorId('inicio')?.rotulo,
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'design-system',
        title: moduloPorId('design-system')?.rotulo,
        loadComponent: () =>
          import('./paginas/design-system/design-system').then((m) => m.DesignSystem),
      },
      ...rotasEmBreve,
      {
        path: '**',
        title: 'Página não encontrada',
        loadComponent: () =>
          import('./paginas/nao-encontrada/nao-encontrada').then((m) => m.NaoEncontrada),
      },
    ],
  },
];
