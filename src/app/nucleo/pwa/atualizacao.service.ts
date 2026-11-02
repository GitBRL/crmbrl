import { DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** De quanto em quanto tempo o app procura uma versão nova enquanto está aberto. */
export const INTERVALO_VERSAO_MS = 10 * 60_000;

/**
 * Aviso de nova versão: quando o service worker baixa uma versão nova (`VERSION_READY`), o
 * sinal `disponivel` liga e a casca mostra "Nova versão" com o botão Atualizar. Procura versão
 * nova a cada 10 min e quando a aba volta a ficar visível. Sem service worker (desenvolvimento,
 * navegador sem suporte), nada acontece.
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoService {
  private readonly sw = inject(SwUpdate);
  private readonly documento = inject(DOCUMENT);
  private readonly _disponivel = signal(false);
  private readonly _atualizando = signal(false);
  readonly disponivel = this._disponivel.asReadonly();
  readonly atualizando = this._atualizando.asReadonly();

  constructor() {
    if (!this.sw.isEnabled) {
      return;
    }
    const assinatura = this.sw.versionUpdates.subscribe((evento) => {
      if (evento.type === 'VERSION_READY') {
        this._disponivel.set(true);
      }
    });
    const procurar = () => {
      if (this.documento.visibilityState !== 'hidden') {
        this.sw.checkForUpdate().catch(() => undefined);
      }
    };
    const relogio = setInterval(procurar, INTERVALO_VERSAO_MS);
    this.documento.addEventListener('visibilitychange', procurar);
    inject(DestroyRef).onDestroy(() => {
      assinatura.unsubscribe();
      clearInterval(relogio);
      this.documento.removeEventListener('visibilitychange', procurar);
    });
  }

  /** Ativa a versão nova e recarrega a página. */
  async atualizar(): Promise<void> {
    if (this._atualizando()) {
      return;
    }
    this._atualizando.set(true);
    try {
      await this.sw.activateUpdate();
    } catch (falha) {
      // Segue para o recarregamento: o service worker serve a versão nova mesmo assim.
      console.warn('[pwa] activateUpdate falhou', falha);
    }
    this.documento.location.reload();
  }
}
