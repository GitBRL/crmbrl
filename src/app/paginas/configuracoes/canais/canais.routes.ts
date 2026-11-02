import type { Routes } from '@angular/router';

import { exigirPermissao } from '../../../nucleo/sessao/guardas';
import { podeGerenciarCanais } from '../../../nucleo/sessao/perfil';

/**
 * Seção Configurações → Canais (`/configuracoes/canais…`, Admin). Entra como filha da página de
 * Configurações por `app.routes.ts` (`rotasDeConfiguracoes`), então herda o título e as seções
 * em pílula dela.
 *
 * - `''` — a lista: um cartão por tipo de canal;
 * - `whatsapp/:id` — um número (o novo é criado num modal da lista e abre aqui com
 *   `?conectar=1`, já mostrando o QR);
 * - `site/novo`, `site/:id` — chat do site;
 * - `email/novo`, `email/:id` — caixa de e-mail;
 * - `instagram/novo`, `messenger/novo`, `meta/:id` — Instagram e Messenger.
 */
export const ROTAS_CONFIG_CANAIS: Routes = [
  {
    path: 'canais',
    title: 'Canais',
    canActivate: [exigirPermissao(podeGerenciarCanais)],
    children: [
      { path: '', loadComponent: () => import('./canais').then((m) => m.Canais) },
      {
        path: 'whatsapp/:id',
        title: 'WhatsApp',
        loadComponent: () => import('./whatsapp/detalhe-whatsapp').then((m) => m.DetalheWhatsapp),
      },
      {
        path: 'site/novo',
        title: 'Novo chat do site',
        loadComponent: () => import('./site/canal-site').then((m) => m.CanalSite),
      },
      {
        path: 'site/:id',
        title: 'Chat do site',
        loadComponent: () => import('./site/canal-site').then((m) => m.CanalSite),
      },
      {
        path: 'email/novo',
        title: 'Nova caixa de e-mail',
        loadComponent: () => import('./email/canal-email').then((m) => m.CanalEmail),
      },
      {
        path: 'email/:id',
        title: 'E-mail',
        loadComponent: () => import('./email/canal-email').then((m) => m.CanalEmail),
      },
      {
        path: 'instagram/novo',
        title: 'Nova conta do Instagram',
        data: { tipo: 'INSTAGRAM' },
        loadComponent: () => import('./meta/canal-meta').then((m) => m.CanalMeta),
      },
      {
        path: 'messenger/novo',
        title: 'Nova página do Messenger',
        data: { tipo: 'MESSENGER' },
        loadComponent: () => import('./meta/canal-meta').then((m) => m.CanalMeta),
      },
      {
        path: 'meta/:id',
        title: 'Instagram e Messenger',
        loadComponent: () => import('./meta/canal-meta').then((m) => m.CanalMeta),
      },
    ],
  },
];
