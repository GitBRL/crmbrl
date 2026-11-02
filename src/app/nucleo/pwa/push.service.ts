import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { erroDaApi } from '../api/erro-api';
import { PushApi, type PreferenciasPush } from './push.api';

/**
 * Situação do push neste aparelho:
 * - `nao-suportado`: sem service worker/Push (navegador antigo, desenvolvimento, iOS fora do app);
 * - `nao-configurado`: o servidor não tem as chaves VAPID (503 `nao_configurado`);
 * - `bloqueado`: a pessoa negou a permissão no navegador;
 * - `desativado`: pronto para ativar (a permissão só é pedida no clique);
 * - `ativo`: este aparelho está inscrito.
 */
export type SituacaoPush =
  'carregando' | 'nao-suportado' | 'nao-configurado' | 'bloqueado' | 'desativado' | 'ativo';

/** Nome curto do aparelho para a lista de inscrições ("Chrome em Android"). */
export function nomeDoAparelho(agente: string): string {
  const navegador = /edg/i.test(agente)
    ? 'Edge'
    : /firefox/i.test(agente)
      ? 'Firefox'
      : /chrome|crios/i.test(agente)
        ? 'Chrome'
        : /safari/i.test(agente)
          ? 'Safari'
          : 'Navegador';
  const sistema = /android/i.test(agente)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(agente)
      ? 'iOS'
      : /windows/i.test(agente)
        ? 'Windows'
        : /mac/i.test(agente)
          ? 'macOS'
          : /linux/i.test(agente)
            ? 'Linux'
            : null;
  return sistema ? `${navegador} em ${sistema}` : navegador;
}

/**
 * Notificações push do CRM neste aparelho. A permissão do navegador só é pedida em `ativar()`,
 * chamado por um clique nas preferências — nunca ao abrir o app.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly sw = inject(SwPush);
  private readonly api = inject(PushApi);
  private readonly janela = inject(DOCUMENT).defaultView;

  private readonly _situacao = signal<SituacaoPush>('carregando');
  private readonly _inscricaoId = signal<string | null>(null);
  private readonly _ocupado = signal(false);
  private readonly _preferencias = signal<PreferenciasPush | null>(null);
  readonly situacao = this._situacao.asReadonly();
  readonly inscricaoId = this._inscricaoId.asReadonly();
  readonly ocupado = this._ocupado.asReadonly();
  readonly preferencias = this._preferencias.asReadonly();

  readonly suportado =
    this.sw.isEnabled &&
    !!this.janela &&
    'Notification' in this.janela &&
    'PushManager' in this.janela;

  /** Lê o estado deste aparelho, do servidor e as preferências. Falhas viram `erro` no chamador. */
  async carregar(): Promise<void> {
    if (!this.suportado) {
      this._situacao.set('nao-suportado');
      return;
    }
    const preferencias = await this.api.preferencias();
    this._preferencias.set(preferencias.tipos);
    if (this.janela!.Notification.permission === 'denied') {
      this._situacao.set('bloqueado');
      return;
    }
    const atual = await firstValueFrom(this.sw.subscription);
    let id: string | null = null;
    if (atual) {
      const minhas = await this.api.minhasInscricoes();
      id = minhas.find((i) => i.endpoint === atual.endpoint)?.id ?? null;
    }
    this._inscricaoId.set(id);
    this._situacao.set(id ? 'ativo' : 'desativado');
  }

  /** Pede a permissão, inscreve o aparelho e registra a inscrição no servidor. */
  async ativar(): Promise<void> {
    if (this._ocupado()) {
      return;
    }
    this._ocupado.set(true);
    try {
      let chave: string;
      try {
        chave = await this.api.chavePublica();
      } catch (falha) {
        if (erroDaApi(falha).detalhes?.['motivo'] === 'nao_configurado') {
          this._situacao.set('nao-configurado');
        }
        throw falha;
      }
      let sub: PushSubscription;
      try {
        sub = await this.sw.requestSubscription({ serverPublicKey: chave });
      } catch (falha) {
        if (this.janela?.Notification.permission === 'denied') {
          this._situacao.set('bloqueado');
        }
        throw falha;
      }
      const json = sub.toJSON();
      const { id } = await this.api.inscrever({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
        aparelho: nomeDoAparelho(this.janela?.navigator.userAgent ?? ''),
      });
      this._inscricaoId.set(id);
      this._situacao.set('ativo');
    } finally {
      this._ocupado.set(false);
    }
  }

  /** Remove a inscrição no servidor e neste aparelho. */
  async desativar(): Promise<void> {
    if (this._ocupado()) {
      return;
    }
    this._ocupado.set(true);
    try {
      const id = this._inscricaoId();
      if (id) {
        await this.api.remover(id);
      }
      await this.sw.unsubscribe().catch(() => undefined);
      this._inscricaoId.set(null);
      this._situacao.set('desativado');
    } finally {
      this._ocupado.set(false);
    }
  }

  async salvarPreferencias(tipos: PreferenciasPush): Promise<void> {
    const r = await this.api.salvarPreferencias(tipos);
    this._preferencias.set(r.tipos ?? tipos);
  }

  testar(): Promise<unknown> {
    return this.api.testar();
  }
}
