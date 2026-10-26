import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { urlApi } from '../api/api';
import { erroDaApi } from '../api/erro-api';
import type { Perfil } from '../sessao/perfil';
import { SessaoService } from '../sessao/sessao.service';
import {
  type AlvoDigitando,
  type EventoServidor,
  type EventosServidor,
  lerNaoLidas,
  type NaoLidas,
  nomeDaSala,
  pedidoDaSala,
  type RespostaTempoReal,
  type SalaTempoReal,
  SEM_NAO_LIDAS,
} from './eventos';
import {
  CAMINHO_SOCKET,
  FABRICA_SOCKET,
  NAMESPACE_TEMPO_REAL,
  type OpcoesSocket,
  type SocketTempoReal,
} from './socket';

/**
 * - `desligado`: sem sessão (ou a troca de senha pendente);
 * - `conectando`: primeira conexão desta sessão em andamento;
 * - `conectado`: recebendo eventos;
 * - `reconectando`: a conexão caiu e está voltando sozinha.
 */
export type EstadoConexao = 'desligado' | 'conectando' | 'conectado' | 'reconectando';

/** Espera da primeira tentativa manual (servidor recusou ou derrubou a conexão). */
export const ESPERA_INICIAL_MS = 2_000;
/** Espera máxima entre tentativas manuais. */
export const ESPERA_MAXIMA_MS = 60_000;

/**
 * Reconexão automática do socket.io (queda de rede, API reiniciando): 1 s, 2 s, 4 s… até 15 s,
 * com variação aleatória de ±50% (os clientes não voltam todos no mesmo instante).
 */
export const OPCOES_SOCKET: OpcoesSocket = {
  path: CAMINHO_SOCKET,
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 15_000,
  randomizationFactor: 0.5,
  timeout: 20_000,
};

type Ouvinte = (dados: unknown) => void;

/**
 * Tempo real do CRM (contrato da Onda A, §2.2): um socket só, no namespace `/tempo-real` em
 * `/api/socket.io`, autenticado pelo cookie da sessão (`crmbrl_sessao`, que o navegador manda
 * sozinho). Conecta quando há sessão (sem troca de senha pendente) e desconecta quando ela
 * acaba.
 *
 * - **Reconexão:** quedas de rede voltam sozinhas (`OPCOES_SOCKET`). Quando o servidor recusa
 *   ou derruba a conexão (sessão revogada, desligamento), confere a sessão em `auth/eu`: sem
 *   sessão, o interceptor leva para `/entrar`; com sessão, tenta de novo com espera crescente.
 * - **Salas:** as de usuário, área e papel o servidor põe na conexão; as de conversa e de canal
 *   do chat a tela pede com `entrar()` (ou `acompanharSala()`), e o serviço entra de novo em
 *   todas a cada reconexão.
 * - **Eventos:** `ouvir()`, `eventos()` ou `aoReceber()`; `aoReconectar()` avisa quem precisa
 *   buscar de novo o que pode ter perdido enquanto esteve fora.
 * - **Não lidas do menu:** `naoLidas()` acompanha o evento `nao-lidas` (cada evento traz só o
 *   que mudou).
 *
 * ```ts
 * private readonly tempoReal = inject(TempoRealService);
 * constructor() {
 *   acompanharSala(() => ({ tipo: 'conversa', id: this.conversaId() }));
 *   aoReceber('mensagem.nova', (evento) => this.acrescentar(evento));
 *   aoReconectar(() => this.recarregar());
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class TempoRealService {
  private readonly sessao = inject(SessaoService);
  private readonly http = inject(HttpClient);
  private readonly fabrica = inject(FABRICA_SOCKET);

  private readonly _estado = signal<EstadoConexao>('desligado');
  private readonly _naoLidas = signal<NaoLidas>(SEM_NAO_LIDAS);
  private readonly _reconexoes = signal(0);

  /** Estado da conexão (o indicador "Reconectando…" da casca lê daqui). */
  readonly estado = this._estado.asReadonly();
  readonly conectado = computed(() => this._estado() === 'conectado');
  /** Não lidas do Atendimento e do Chat da equipe (evento `nao-lidas`), para o menu. */
  readonly naoLidas = this._naoLidas.asReadonly();
  /** Quantas vezes a conexão voltou depois de cair (a primeira conexão não conta). */
  readonly reconexoes = this._reconexoes.asReadonly();

  private readonly ouvintes = new Map<string, Set<Ouvinte>>();
  private readonly aoReconectarFns = new Set<() => void>();
  private readonly salas = new Map<string, { readonly sala: SalaTempoReal; contagem: number }>();
  private readonly usuarioId = computed(() => this.sessao.usuario()?.id ?? null);

  private socket: SocketTempoReal | null = null;
  /** Usuário da conexão atual (ou da que está sendo criada). */
  private usuarioConectado: string | null = null;
  /** Cada conexão ganha um número: eventos e respostas de uma conexão velha são ignorados. */
  private geracao = 0;
  private jaConectou = false;
  private tentativa: ReturnType<typeof setTimeout> | undefined;
  private espera = ESPERA_INICIAL_MS;

  constructor() {
    effect(() => {
      const ligar = this.sessao.autenticado() && !this.sessao.deveTrocarSenha();
      const usuario = this.usuarioId();
      untracked(() => (ligar && usuario ? this.conectar(usuario) : this.desconectar()));
    });
    inject(DestroyRef).onDestroy(() => this.desconectar());
  }

  /**
   * Chama `tratar` a cada evento do tipo. Devolve a função que para de ouvir. Num componente,
   * prefira `aoReceber()`, que para sozinho quando ele é destruído.
   */
  ouvir<E extends EventoServidor>(
    evento: E,
    tratar: (dados: EventosServidor[E]) => void,
  ): () => void {
    let lista = this.ouvintes.get(evento);
    if (!lista) {
      lista = new Set();
      this.ouvintes.set(evento, lista);
    }
    const ouvinte = tratar as Ouvinte;
    lista.add(ouvinte);
    return () => {
      lista.delete(ouvinte);
    };
  }

  /** Os eventos de um tipo como `Observable` (para quem prefere RxJS). */
  eventos<E extends EventoServidor>(evento: E): Observable<EventosServidor[E]> {
    return new Observable((assinante) => this.ouvir(evento, (dados) => assinante.next(dados)));
  }

  /** Chama `tratar` toda vez que a conexão volta depois de cair. Devolve a função que para. */
  aoReconectar(tratar: () => void): () => void {
    this.aoReconectarFns.add(tratar);
    return () => {
      this.aoReconectarFns.delete(tratar);
    };
  }

  /**
   * Acompanha uma sala (`conversa:<id>`, `chat:<canalId>`). Várias telas podem pedir a mesma:
   * o serviço conta e só sai quando a última libera. Devolve a função que libera. Num
   * componente, prefira `acompanharSala()`.
   */
  entrar(sala: SalaTempoReal): () => void {
    const nome = nomeDaSala(sala);
    const registro = this.salas.get(nome);
    if (registro) {
      registro.contagem++;
    } else {
      this.salas.set(nome, { sala, contagem: 1 });
      this.pedir(sala, 'entrar');
    }
    let liberou = false;
    return () => {
      if (liberou) {
        return;
      }
      liberou = true;
      const atual = this.salas.get(nome);
      if (!atual) {
        return;
      }
      atual.contagem--;
      if (atual.contagem <= 0) {
        this.salas.delete(nome);
        this.pedir(sala, 'sair');
      }
    };
  }

  /**
   * Avisa que o usuário está (`ativo`) ou parou de estar digitando numa conversa ou canal. O
   * servidor só repassa a quem está na sala, e só se o próprio usuário estiver nela
   * (`entrar()`/`acompanharSala()` antes).
   */
  digitando(alvo: AlvoDigitando, ativo: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('digitando', { ...alvo, ativo });
    }
  }

  private conectar(usuario: string): void {
    if (this.usuarioConectado === usuario) {
      return;
    }
    this.desconectar();
    this.usuarioConectado = usuario;
    const geracao = this.geracao;
    this._estado.set('conectando');
    this.fabrica(NAMESPACE_TEMPO_REAL, OPCOES_SOCKET).then(
      (socket) => {
        if (geracao !== this.geracao) {
          socket.disconnect();
          return;
        }
        this.socket = socket;
        this.ligarEventos(socket, geracao);
      },
      (falha: unknown) => {
        // O pacote não chegou (rede caiu no meio do carregamento): tenta de novo mais tarde.
        if (geracao !== this.geracao) {
          return;
        }
        console.warn('[tempo real] não foi possível carregar o cliente do Socket.IO.', falha);
        this._estado.set('reconectando');
        this.agendar(geracao, () => {
          this.usuarioConectado = null;
          this.conectar(usuario);
        });
      },
    );
  }

  private desconectar(): void {
    this.geracao++;
    clearTimeout(this.tentativa);
    const socket = this.socket;
    this.socket = null;
    this.usuarioConectado = null;
    this.jaConectou = false;
    this.espera = ESPERA_INICIAL_MS;
    socket?.removeAllListeners();
    socket?.disconnect();
    this._estado.set('desligado');
    this._naoLidas.set(SEM_NAO_LIDAS);
  }

  private ligarEventos(socket: SocketTempoReal, geracao: number): void {
    const atual = () => geracao === this.geracao;

    socket.on('connect', () => {
      if (!atual()) {
        return;
      }
      clearTimeout(this.tentativa);
      this.espera = ESPERA_INICIAL_MS;
      const voltou = this.jaConectou;
      this.jaConectou = true;
      this._estado.set('conectado');
      for (const { sala } of this.salas.values()) {
        this.pedir(sala, 'entrar');
      }
      if (voltou) {
        this._reconexoes.update((total) => total + 1);
        // Cópia: quem é avisado pode deixar de ouvir durante a entrega.
        for (const tratar of Array.from(this.aoReconectarFns)) {
          executar(tratar, undefined, 'aoReconectar');
        }
      }
    });

    socket.on('disconnect', (motivo) => {
      if (!atual() || motivo === 'io client disconnect') {
        return;
      }
      this._estado.set('reconectando');
      // O servidor derrubou a conexão (sessão revogada, desligamento): o socket.io não volta
      // sozinho. Nos outros motivos (rede, API reiniciando) ele volta.
      if (motivo === 'io server disconnect') {
        this.conferirSessao(geracao);
      }
    });

    socket.on('connect_error', () => {
      if (!atual()) {
        return;
      }
      this._estado.set(this.jaConectou ? 'reconectando' : 'conectando');
      // `active` falso: o servidor recusou a conexão (sem sessão, origem não permitida) e o
      // socket.io não tenta de novo sozinho.
      if (!socket.active) {
        this.conferirSessao(geracao);
      }
    });

    socket.onAny((evento: string, dados: unknown) => {
      if (atual()) {
        this.despachar(evento, dados);
      }
    });
  }

  private despachar(evento: string, dados: unknown): void {
    if (evento === 'nao-lidas') {
      this._naoLidas.update((atual) => lerNaoLidas(dados, atual));
    }
    const lista = this.ouvintes.get(evento);
    if (!lista) {
      return;
    }
    // Cópia: um ouvinte pode sair (ou outro entrar) durante a entrega.
    for (const ouvinte of Array.from(lista)) {
      executar(ouvinte, dados, evento);
    }
  }

  /**
   * A conexão foi recusada ou derrubada pelo servidor: a sessão ainda vale? Sem sessão (401),
   * o interceptor avisa e leva para `/entrar` (e o `effect` desconecta); com sessão, atualiza
   * o perfil e tenta de novo depois de uma espera crescente.
   */
  private conferirSessao(geracao: number): void {
    firstValueFrom(this.http.get<Perfil>(urlApi('auth', 'eu'))).then(
      (perfil) => {
        if (geracao !== this.geracao) {
          return;
        }
        this.sessao.definirPerfil(perfil);
        this.agendar(geracao, () => this.socket?.connect());
      },
      (falha: unknown) => {
        if (geracao === this.geracao && !erroDaApi(falha).ehSemSessao) {
          this.agendar(geracao, () => this.socket?.connect());
        }
      },
    );
  }

  private agendar(geracao: number, tentar: () => void): void {
    clearTimeout(this.tentativa);
    const espera = this.espera * (0.75 + Math.random() * 0.5);
    this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA_MS);
    this.tentativa = setTimeout(() => {
      if (geracao === this.geracao && !this.socket?.connected) {
        tentar();
      }
    }, espera);
  }

  private pedir(sala: SalaTempoReal, acao: 'entrar' | 'sair'): void {
    if (!this.socket?.connected) {
      return; // ao conectar, entra em todas as salas registradas
    }
    const { evento, dados } = pedidoDaSala(sala, acao);
    this.socket.emit(evento, dados, (resposta?: RespostaTempoReal) => {
      // Recusa (sem permissão, id inválido): a tela já recebe o erro pela API; aqui só fica o
      // registro para quem depura.
      if (resposta && resposta.ok === false) {
        console.warn(`[tempo real] "${evento}" recusado: ${resposta.mensagem}`);
      }
    });
  }
}

/** Um ouvinte com defeito não impede os outros de receberem o evento. */
function executar<T>(tratar: (dados: T) => void, dados: T, evento: string): void {
  try {
    tratar(dados);
  } catch (falha) {
    console.error(`[tempo real] falha ao tratar "${evento}".`, falha);
  }
}
