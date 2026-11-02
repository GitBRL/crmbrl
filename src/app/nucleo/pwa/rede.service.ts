import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

/**
 * Estado da conexão do aparelho com a internet (`online`/`offline` do navegador). Quando está
 * sem conexão, o app abre pelo cache do service worker, mas os dados (sempre pela rede) não
 * carregam: a casca mostra o aviso "sem conexão".
 */
@Injectable({ providedIn: 'root' })
export class RedeService {
  private readonly janela = inject(DOCUMENT).defaultView;
  private readonly _online = signal(this.janela?.navigator?.onLine ?? true);
  readonly online = this._online.asReadonly();

  constructor() {
    this.janela?.addEventListener('online', () => this._online.set(true));
    this.janela?.addEventListener('offline', () => this._online.set(false));
  }
}
