import type { Routes } from '@angular/router';

import { redirecionar } from '../../nucleo/sessao/guardas';

/**
 * Rotas de `/integracoes` (carregadas sob demanda por app.routes.ts; o módulo inteiro é do
 * Admin, conferido pela casca). `/integracoes` sozinho abre os webhooks de entrada — ou os de
 * saída quando o link traz `?webhookSaida=<id>` (notificações de falha de entrega).
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
            rota.queryParamMap.has('webhookSaida') ? '/integracoes/saida' : '/integracoes/entrada',
          ),
        ],
        children: [],
      },
      {
        path: 'entrada',
        title: 'Webhooks de entrada',
        loadComponent: () => import('./webhooks-entrada').then((m) => m.WebhooksEntrada),
      },
      {
        path: 'saida',
        title: 'Webhooks de saída',
        loadComponent: () => import('./webhooks-saida').then((m) => m.WebhooksSaida),
      },
    ],
  },
];
