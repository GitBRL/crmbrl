import { computed, inject, Injectable, signal } from '@angular/core';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { aoReceber, aoReconectar } from '../../nucleo/tempo-real/auxiliares';
import type { EntidadeTempoReal } from '../../nucleo/tempo-real/eventos';
import { ChatApi } from './chat.api';
import type { ChatCanal, RascunhoChat } from './chat.tipos';

/** O canal que chega pelo tempo real tem a forma do `ChatCanalDto` (o mesmo de `GET /chat/canais`). */
function comoCanal(entidade: EntidadeTempoReal): ChatCanal | null {
  const canal = entidade as unknown as Partial<ChatCanal>;
  return typeof canal.id === 'string' && typeof canal.nome === 'string' && !!canal.tipo
    ? (entidade as unknown as ChatCanal)
    : null;
}

/** Saiu (ou foi tirado) do canal que estava aberto. */
export interface CanalRemovido {
  readonly id: string;
  readonly nome: string | null;
}

/**
 * Estado da página do Chat da equipe, compartilhado pela lista de canais e pelo canal aberto
 * (fornecido pelo componente `Chat`, vive enquanto a página estiver aberta):
 *
 * - a lista de canais da pessoa (`GET /chat/canais`), atualizada ao vivo pelo evento
 *   `chat.atualizado` (prévia, não lidas, nome, membros; `removido` tira o canal da lista) e
 *   buscada de novo a cada reconexão;
 * - o canal aberto, que não mostra "não lidas" enquanto a pessoa está nele.
 */
@Injectable()
export class ChatEstado {
  private readonly api = inject(ChatApi);
  private readonly sessao = inject(SessaoService);

  private readonly _canais = signal<readonly ChatCanal[] | null>(null);
  private readonly _carregando = signal(false);
  private readonly _falha = signal<ErroApi | null>(null);
  private readonly _removido = signal<CanalRemovido | null>(null);

  /** `null` até a primeira resposta. */
  readonly canais = this._canais.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  readonly falha = this._falha.asReadonly();
  /** O canal aberto (a rota filha avisa). */
  readonly aberto = signal<string | null>(null);
  /** O último canal de onde a pessoa saiu ou foi tirada (o canal aberto reage). */
  readonly removido = this._removido.asReadonly();
  readonly eu = computed(() => this.sessao.usuario()?.id ?? null);

  private pedido = 0;
  /** Rascunho de cada canal, enquanto a página estiver aberta (trocar de canal não perde). */
  private readonly rascunhos = new Map<string, RascunhoChat>();

  constructor() {
    aoReceber('chat.atualizado', ({ canalId, canal, removido }) => {
      if (removido) {
        this.remover(canalId);
        return;
      }
      const novo = canal ? comoCanal(canal) : null;
      if (novo) {
        this.guardar(novo);
      }
    });
    aoReconectar(() => void this.carregar(true));
  }

  /** Busca a lista (de novo). `silencioso` não mostra o esqueleto (reconexão, atualização). */
  async carregar(silencioso = false): Promise<void> {
    const pedido = ++this.pedido;
    if (!silencioso || this._canais() === null) {
      this._carregando.set(true);
    }
    this._falha.set(null);
    try {
      const canais = await this.api.canais();
      if (pedido === this.pedido) {
        this._canais.set(canais);
      }
    } catch (falha) {
      if (pedido === this.pedido && this._canais() === null) {
        this._falha.set(erroDaApi(falha));
      }
    } finally {
      if (pedido === this.pedido) {
        this._carregando.set(false);
      }
    }
  }

  canal(id: string | null): ChatCanal | null {
    return (id && this._canais()?.find((canal) => canal.id === id)) || null;
  }

  /** Insere ou troca um canal (resposta da API ou evento). */
  guardar(canal: ChatCanal): void {
    if (this._removido()?.id === canal.id) {
      this._removido.set(null);
    }
    this._canais.update((lista) => {
      if (!lista) {
        return [canal];
      }
      const indice = lista.findIndex((item) => item.id === canal.id);
      if (indice < 0) {
        return [...lista, canal];
      }
      const copia = lista.slice();
      copia[indice] = canal;
      return copia;
    });
  }

  /** Zera as não lidas de um canal na lista (a pessoa acabou de ler). */
  marcarLidoLocalmente(id: string): void {
    const canal = this.canal(id);
    if (canal && (canal.naoLidas > 0 || canal.mencoesNaoLidas > 0)) {
      this.guardar({ ...canal, naoLidas: 0, mencoesNaoLidas: 0 });
    }
  }

  rascunho(canalId: string): RascunhoChat | null {
    return this.rascunhos.get(canalId) ?? null;
  }

  guardarRascunho(canalId: string, rascunho: RascunhoChat): void {
    if (rascunho.texto.trim()) {
      this.rascunhos.set(canalId, rascunho);
    } else {
      this.rascunhos.delete(canalId);
    }
  }

  /** Tira o canal da lista (saiu do grupo, foi tirado, arquivado e removido). */
  remover(id: string): void {
    const canal = this.canal(id);
    this._canais.update((lista) => lista?.filter((item) => item.id !== id) ?? lista);
    if (this.aberto() === id) {
      this._removido.set({ id, nome: canal?.nome ?? null });
    }
  }
}
