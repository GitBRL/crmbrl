import { InjectionToken } from '@angular/core';
import type { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

/** Caminho do Socket.IO na API (o Caddy e o dev server repassam `/api/*`, websocket incluso). */
export const CAMINHO_SOCKET = '/api/socket.io';
/** Namespace do tempo real dos usuários logados. */
export const NAMESPACE_TEMPO_REAL = '/tempo-real';

/** O que o `TempoRealService` usa do socket do `socket.io-client`. */
export type SocketTempoReal = Pick<
  Socket,
  'connected' | 'active' | 'on' | 'onAny' | 'emit' | 'connect' | 'disconnect' | 'removeAllListeners'
>;

export type OpcoesSocket = Partial<ManagerOptions & SocketOptions>;

/**
 * Cria o socket. O padrão carrega o `socket.io-client` sob demanda (`import()`): o pacote não
 * entra no carregamento inicial e só baixa depois que alguém entra. Nos testes, troque por
 * uma fábrica que devolve um socket falso.
 */
export type FabricaSocket = (namespace: string, opcoes: OpcoesSocket) => Promise<SocketTempoReal>;

export const FABRICA_SOCKET = new InjectionToken<FabricaSocket>('FABRICA_SOCKET', {
  providedIn: 'root',
  factory: () => async (namespace, opcoes) => {
    const { io } = await import('socket.io-client');
    return io(namespace, opcoes);
  },
});
