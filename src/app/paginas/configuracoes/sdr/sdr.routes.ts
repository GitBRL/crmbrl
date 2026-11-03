import type { Routes } from '@angular/router';

import { exigirPermissao } from '../../../nucleo/sessao/guardas';
import { secaoConfiguracoes } from '../secoes';

/**
 * Seção Configurações → SDR com IA (`/configuracoes/sdr…`; só Admin). Entra como filha da página
 * de Configurações por `app.routes.ts` (`rotasDeConfiguracoes`).
 */
const definicao = secaoConfiguracoes('sdr');

export const ROTAS_CONFIG_SDR: Routes = [
  {
    path: 'sdr',
    title: definicao.rotulo,
    canActivate: [exigirPermissao(definicao.permite)],
    loadComponent: () => import('./sdr-config').then((m) => m.SdrConfig),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'canais' },
      {
        path: 'canais',
        title: 'SDR: canais',
        loadComponent: () => import('./canais-sdr').then((m) => m.CanaisSdr),
      },
      {
        path: 'persona',
        title: 'SDR: persona',
        loadComponent: () => import('./persona-sdr').then((m) => m.PersonaSdr),
      },
      {
        path: 'conhecimento',
        title: 'SDR: base de conhecimento',
        loadComponent: () => import('./conhecimento-sdr').then((m) => m.ConhecimentoSdr),
      },
      {
        path: 'criterios',
        title: 'SDR: critérios',
        loadComponent: () => import('./criterios-sdr').then((m) => m.CriteriosSdr),
      },
      {
        path: 'regras',
        title: 'SDR: temperatura e limites',
        loadComponent: () => import('./regras-sdr').then((m) => m.RegrasSdr),
      },
      {
        path: 'simulador',
        title: 'SDR: simulador',
        loadComponent: () => import('./simulador-sdr').then((m) => m.SimuladorSdr),
      },
    ],
  },
];
