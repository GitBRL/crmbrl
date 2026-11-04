import type { Routes } from '@angular/router';

import { redirecionar } from '../../nucleo/sessao/guardas';

/**
 * Rotas de `/integracoes` (carregadas sob demanda por app.routes.ts; o módulo inteiro é do
 * Admin, conferido pela casca). `/integracoes` sozinho abre os aplicativos — ou os webhooks de
 * saída quando o link traz `?webhookSaida=<id>` (notificações de falha de entrega). Os links
 * antigos de `/integracoes/entrada` seguem para os aplicativos.
 */
export const ROTAS_INTEGRACOES: Routes = [
  {
    path: '',
    loadComponent: () => import('./integracoes').then((m) => m.Integracoes),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [
          redirecionar((rota) =>
            rota.queryParamMap.has('webhookSaida')
              ? '/integracoes/saida'
              : '/integracoes/aplicativos',
          ),
        ],
        children: [],
      },
      {
        path: 'entrada',
        pathMatch: 'full',
        canActivate: [redirecionar(() => '/integracoes/aplicativos')],
        children: [],
      },
      {
        path: 'aplicativos',
        title: 'Aplicativos',
        loadComponent: () => import('./aplicativos').then((m) => m.Aplicativos),
      },
      {
        path: 'historico',
        title: 'Histórico de recebimentos',
        loadComponent: () => import('./historico').then((m) => m.Historico),
      },
      {
        path: 'saida',
        title: 'Webhooks de saída',
        loadComponent: () => import('./webhooks-saida').then((m) => m.WebhooksSaida),
      },
    ],
  },
];
