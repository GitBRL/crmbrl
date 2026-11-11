import { Injectable, signal } from '@angular/core';

/**
 * Pedido para abrir o painel de Ajuda já com uma pergunta (ex.: o botão "Ver tutorial" de uma
 * tela). O painel da barra superior (`app-ajuda`) observa `pedido` e envia a pergunta.
 */
@Injectable({ providedIn: 'root' })
export class AjudaPainel {
  readonly pedido = signal<{ readonly pergunta: string; readonly numero: number } | null>(null);
  private contador = 0;

  perguntar(pergunta: string): void {
    this.pedido.set({ pergunta, numero: ++this.contador });
  }
}
