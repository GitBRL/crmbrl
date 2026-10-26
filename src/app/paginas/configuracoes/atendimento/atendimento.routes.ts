import type { Routes } from '@angular/router';

import { exigirPermissao } from '../../../nucleo/sessao/guardas';
import { podeConfigurarAtendimento } from '../../../nucleo/sessao/perfil';

/**
 * Seção Configurações → Atendimento (`/configuracoes/atendimento…`; Admin, C-level e os líderes
 * do Comercial e do CS). Entra como filha da página de Configurações por `app.routes.ts`
 * (`rotasDeConfiguracoes`). A página (`ConfigAtendimento`) tem três partes, cada uma numa rota:
 *
 * - `filas` — filas, distribuição e SLA (padrão);
 * - `horarios` — horário de atendimento, resposta fora do horário e pesquisa de satisfação de
 *   cada canal (`?canal=<id>` abre o canal direto);
 * - `respostas` — respostas rápidas.
 */
export const ROTAS_CONFIG_ATENDIMENTO: Routes = [
  {
    path: 'atendimento',
    title: 'Atendimento',
    canActivate: [exigirPermissao(podeConfigurarAtendimento)],
    loadComponent: () => import('./config-atendimento').then((m) => m.ConfigAtendimento),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'filas' },
      {
        path: 'filas',
        title: 'Filas e SLA',
        loadComponent: () => import('./filas').then((m) => m.Filas),
      },
      {
        path: 'horarios',
        title: 'Horário e satisfação',
        loadComponent: () => import('./horarios').then((m) => m.Horarios),
      },
      {
        path: 'respostas',
        title: 'Respostas rápidas',
        loadComponent: () => import('./respostas-rapidas').then((m) => m.RespostasRapidas),
      },
    ],
  },
];
