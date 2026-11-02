import type { Provider } from '@angular/core';

import { FABRICA_SOCKET, type OpcoesSocket, type SocketTempoReal } from './socket';

type Funcao = (...args: never[]) => void;

/**
 * **Só para testes (specs).** Socket falso com a mesma interface que o `TempoRealService` usa,
 * para simular a conexão e os eventos do servidor sem rede. Todos os testes já recebem uma
 * fábrica de sockets falsos inertes (`src/provedores-teste.ts`); quem precisa controlar o
 * socket usa `provideSocketFalso()`:
 *
 * ```ts
 * const falso = provideSocketFalso();
 * TestBed.configureTestingModule({ providers: [..., falso.providers] });
 * // … depois de entrar:
 * await Promise.resolve();
 * falso.ultimo().simularConexao();
 * falso.ultimo().receber('nao-lidas', { atendimento: 3, chat: 1 });
 * ```
 */
export class SocketFalso {
  connected = false;
  active = true;
  /** Vezes que `connect()` foi chamado (tentativas manuais). */
  conexoesPedidas = 0;
  desconectado = false;
  readonly emitidos: { readonly evento: string; readonly dados: unknown }[] = [];
  /** A confirmação (ack) de cada emissão, na mesma posição de `emitidos` (ou `undefined`). */
  readonly confirmacoes: (((resposta: unknown) => void) | undefined)[] = [];
  private readonly ouvintes = new Map<string, Set<Funcao>>();
  private readonly qualquer = new Set<Funcao>();

  constructor(
    readonly namespace = '/tempo-real',
    readonly opcoes: OpcoesSocket = {},
  ) {}

  on(evento: string, tratar: Funcao): this {
    let lista = this.ouvintes.get(evento);
    if (!lista) {
      lista = new Set();
      this.ouvintes.set(evento, lista);
    }
    lista.add(tratar);
    return this;
  }

  onAny(tratar: Funcao): this {
    this.qualquer.add(tratar);
    return this;
  }

  emit(evento: string, ...args: unknown[]): this {
    this.emitidos.push({ evento, dados: args[0] });
    const ultimo = args[args.length - 1];
    this.confirmacoes.push(
      args.length > 1 && typeof ultimo === 'function'
        ? (ultimo as (resposta: unknown) => void)
        : undefined,
    );
    return this;
  }

  /** O servidor confirma (ack) a emissão da posição `indice` de `emitidos`. */
  confirmar(indice: number, resposta: unknown): void {
    this.confirmacoes[indice]?.(resposta);
  }

  connect(): this {
    this.conexoesPedidas++;
    return this;
  }

  disconnect(): this {
    this.connected = false;
    this.active = false;
    this.desconectado = true;
    return this;
  }

  removeAllListeners(): this {
    this.ouvintes.clear();
    this.qualquer.clear();
    return this;
  }

  /** O servidor aceitou a conexão (também a cada reconexão). */
  simularConexao(): void {
    this.connected = true;
    this.active = true;
    this.disparar('connect');
  }

  /** A conexão caiu (`transport close`: volta sozinha; `io server disconnect`: derrubada). */
  simularQueda(motivo = 'transport close'): void {
    this.connected = false;
    if (motivo === 'io server disconnect') {
      this.active = false;
    }
    this.disparar('disconnect', motivo);
  }

  /** Falha ao conectar; `recusada` = o servidor recusou (o socket.io não tenta de novo). */
  simularFalha(recusada = false): void {
    this.connected = false;
    this.active = !recusada;
    this.disparar('connect_error', new Error(recusada ? 'sem sessão' : 'xhr poll error'));
  }

  /** Evento do servidor. */
  receber(evento: string, dados?: unknown): void {
    for (const tratar of Array.from(this.qualquer)) {
      (tratar as (evento: string, dados: unknown) => void)(evento, dados);
    }
  }

  private disparar(evento: string, ...args: unknown[]): void {
    for (const tratar of Array.from(this.ouvintes.get(evento) ?? [])) {
      (tratar as (...valores: unknown[]) => void)(...args);
    }
  }
}

/** Fábrica de sockets falsos; `sockets` guarda cada um criado, em ordem. */
export function provideSocketFalso(): {
  readonly providers: Provider[];
  readonly sockets: SocketFalso[];
  readonly ultimo: () => SocketFalso;
} {
  const sockets: SocketFalso[] = [];
  return {
    sockets,
    ultimo: () => {
      const socket = sockets[sockets.length - 1];
      if (!socket) {
        throw new Error('Nenhum socket foi criado ainda.');
      }
      return socket;
    },
    providers: [
      {
        provide: FABRICA_SOCKET,
        useValue: (namespace: string, opcoes: OpcoesSocket) => {
          const socket = new SocketFalso(namespace, opcoes);
          sockets.push(socket);
          return Promise.resolve(socket as unknown as SocketTempoReal);
        },
      },
    ],
  };
}

/** Fábrica inerte (sockets que nunca conectam), aplicada a todos os testes. */
export const FABRICA_SOCKET_INERTE: Provider = {
  provide: FABRICA_SOCKET,
  useValue: () => Promise.resolve(new SocketFalso() as unknown as SocketTempoReal),
};
