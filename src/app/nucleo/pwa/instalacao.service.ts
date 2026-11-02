import { DOCUMENT, inject, Injectable, signal } from '@angular/core';

/** O evento `beforeinstallprompt` (Chrome/Android), ainda fora dos tipos do TypeScript. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Plataforma = 'android' | 'ios' | 'outra';

/** Plataforma pelo user agent (só para escolher o texto da dica de instalação). */
export function detectarPlataforma(agente: string, maxToque = 0): Plataforma {
  if (/iphone|ipad|ipod/i.test(agente) || (/macintosh/i.test(agente) && maxToque > 1)) {
    return 'ios';
  }
  return /android/i.test(agente) ? 'android' : 'outra';
}

/**
 * Instalação do CRM como aplicativo: guarda o pedido de instalação do navegador (Chrome) para
 * o botão "Instalar", sabe se o app já roda instalado (`standalone`) e diz qual dica mostrar
 * (Android ou iOS, onde a instalação é manual).
 */
@Injectable({ providedIn: 'root' })
export class InstalacaoService {
  private readonly janela = inject(DOCUMENT).defaultView;
  private pedido: EventoInstalar | null = null;
  private readonly _podeInstalar = signal(false);
  private readonly _instalado = signal(this.rodaInstalado());
  readonly podeInstalar = this._podeInstalar.asReadonly();
  readonly instalado = this._instalado.asReadonly();
  readonly plataforma: Plataforma = detectarPlataforma(
    this.janela?.navigator?.userAgent ?? '',
    this.janela?.navigator?.maxTouchPoints ?? 0,
  );

  constructor() {
    this.janela?.addEventListener('beforeinstallprompt', (evento) => {
      evento.preventDefault();
      this.pedido = evento as EventoInstalar;
      this._podeInstalar.set(true);
    });
    this.janela?.addEventListener('appinstalled', () => {
      this.pedido = null;
      this._podeInstalar.set(false);
      this._instalado.set(true);
    });
  }

  /** Abre o pedido de instalação do navegador. `true` se a pessoa aceitou. */
  async instalar(): Promise<boolean> {
    const pedido = this.pedido;
    if (!pedido) {
      return false;
    }
    this.pedido = null;
    this._podeInstalar.set(false);
    await pedido.prompt();
    return (await pedido.userChoice).outcome === 'accepted';
  }

  private rodaInstalado(): boolean {
    const j = this.janela;
    return (
      j?.matchMedia?.('(display-mode: standalone)').matches === true ||
      (j?.navigator as { standalone?: boolean } | undefined)?.standalone === true
    );
  }
}
