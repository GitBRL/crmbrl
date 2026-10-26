import { inject } from '@angular/core';
import { type CanActivateFn, Router, type Routes } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ehUuid } from '../../nucleo/sessao/guardas';
import { ChatApi } from './chat.api';

/**
 * Menção clicada (`/chat/pessoa/<usuarioId>`): abre a conversa direta com a pessoa (a API cria
 * se ainda não existe) e vai para ela. Sem poder (pessoa desligada, você mesmo), avisa e fica
 * onde estava.
 */
export const abrirDiretaComPessoa: CanActivateFn = async (rota) => {
  const router = inject(Router);
  const avisos = inject(AvisosService);
  try {
    const { canal } = await inject(ChatApi).iniciarDireta(rota.paramMap.get('usuarioId') ?? '');
    return router.createUrlTree(['/chat', canal.id]);
  } catch (falha) {
    avisos.erro(falha);
    return router.navigated ? false : router.createUrlTree(['/chat']);
  }
};

/**
 * Referência a um negócio clicada (`/chat/negocio/<funilId>/<negocioId>`): o link da API é
 * `/funis/<funilId>?negocio=<id>` (a rota de app.routes.ts que descobre a área do funil), que
 * o `routerLink` em texto não monta por causa da consulta.
 */
export const abrirNegocio: CanActivateFn = (rota) =>
  inject(Router).createUrlTree(['/funis', rota.paramMap.get('funilId')], {
    queryParams: { negocio: rota.paramMap.get('negocioId') },
  });

/**
 * Rotas de `/chat` (carregadas sob demanda por app.routes.ts). A página é a lista de canais
 * (Geral, áreas, grupos e diretas) com o canal aberto na rota filha `:canalId`
 * (`?mensagem=<id>` abre já na mensagem, como nos avisos de menção).
 */
export const ROTAS_CHAT: Routes = [
  {
    path: '',
    loadComponent: () => import('./chat').then((m) => m.Chat),
    children: [
      // Nenhum canal aberto: a página mostra o convite para escolher um.
      { path: '', pathMatch: 'full', children: [] },
      {
        path: ':canalId',
        // Trocar de canal não é trocar de página: a casca não leva o foco ao topo (no desktop
        // ele fica na lista; no celular, o canal o recebe — Canal.recuperarFoco).
        data: { painel: true },
        canMatch: [ehUuid],
        loadComponent: () => import('./canal').then((m) => m.Canal),
      },
    ],
  },
  // Links das mensagens (o `:canalId` acima só aceita ids, então estes caem aqui).
  {
    path: 'pessoa/:usuarioId',
    canActivate: [abrirDiretaComPessoa],
    children: [],
  },
  {
    path: 'negocio/:funilId/:negocioId',
    canActivate: [abrirNegocio],
    children: [],
  },
];
