import type { Routes } from '@angular/router';

import { ehUuid } from '../../nucleo/sessao/guardas';

/**
 * Rotas de `/funis/:area` (carregadas sob demanda por app.routes.ts, que já confere a área e
 * o acesso). O parâmetro `area` (`marketing`, `comercial` ou `cs`) chega a todas as telas
 * (`paramsInheritanceStrategy: 'always'`); a query `funil=<id>` escolhe um funil extra da
 * área. O detalhe do negócio é rota filha do quadro (painel lateral sobre o kanban).
 */
export const ROTAS_FUNIS: Routes = [
  {
    path: '',
    loadComponent: () => import('./quadro').then((m) => m.QuadroFunil),
    children: [
      {
        path: ':negocioId',
        title: 'Negócio',
        // Painel sobre o quadro: abrir e fechar não leva o foco ao topo da página (casca).
        data: { painel: true },
        canMatch: [ehUuid],
        loadComponent: () => import('./detalhe-negocio').then((m) => m.DetalheNegocio),
      },
    ],
  },
];
