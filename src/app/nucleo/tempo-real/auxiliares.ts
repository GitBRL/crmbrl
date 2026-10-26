import {
  computed,
  DestroyRef,
  effect,
  inject,
  type Signal,
  signal,
  untracked,
} from '@angular/core';

import { SessaoService } from '../sessao/sessao.service';
import type {
  AlvoDigitando,
  EventoDigitando,
  EventoServidor,
  EventosServidor,
  SalaTempoReal,
} from './eventos';
import { TempoRealService } from './tempo-real.service';

/**
 * Atalhos do tempo real para componentes (chame no construtor ou num inicializador de campo:
 * usam o contexto de injeção e param sozinhos quando o componente é destruído).
 */

/** Ouve um evento enquanto o componente existir. */
export function aoReceber<E extends EventoServidor>(
  evento: E,
  tratar: (dados: EventosServidor[E]) => void,
): void {
  const parar = inject(TempoRealService).ouvir(evento, tratar);
  inject(DestroyRef).onDestroy(parar);
}

/** Chama `tratar` quando a conexão volta depois de cair (para buscar o que se perdeu). */
export function aoReconectar(tratar: () => void): void {
  const parar = inject(TempoRealService).aoReconectar(tratar);
  inject(DestroyRef).onDestroy(parar);
}

/**
 * Acompanha a sala que `sala()` disser (reage a signals: trocar de conversa sai da anterior e
 * entra na nova; `null` não acompanha nenhuma) e sai ao destruir o componente.
 *
 * ```ts
 * acompanharSala(() => (this.conversaId() ? { tipo: 'conversa', id: this.conversaId()! } : null));
 * ```
 */
export function acompanharSala(sala: () => SalaTempoReal | null): void {
  const tempoReal = inject(TempoRealService);
  const atual = computed(sala, {
    equal: (a, b) => a?.tipo === b?.tipo && a?.id === b?.id,
  });
  effect((aoLimpar) => {
    const alvo = atual();
    if (alvo) {
      aoLimpar(untracked(() => tempoReal.entrar(alvo)));
    }
  });
}

/** Sem novo "digitando" por este tempo, a pessoa sai da lista (o cliente repete a cada 3 s). */
export const EXPIRA_DIGITANDO_MS = 6_000;

/** Quem está digitando: a chave é `usuario:<id>` ou `contato`. */
export interface PessoaDigitando {
  readonly chave: string;
  readonly nome: string;
  /** `true` quando é o contato (cliente), não alguém da equipe. */
  readonly contato: boolean;
}

export interface OpcoesDigitando {
  /** Nome do contato da conversa, para "Maria está digitando…" (a API não manda o nome). */
  readonly nomeDoContato?: () => string | null | undefined;
}

/**
 * Quem está digitando na conversa ou no canal de `alvo()` (evento `digitando`), sem o próprio
 * usuário. Cada pessoa sai da lista quando avisa que parou (`ativo: false`) ou depois de
 * `EXPIRA_DIGITANDO_MS` sem novo aviso; trocar de alvo limpa a lista.
 *
 * ```ts
 * protected readonly digitando = digitandoEm(() => ({ conversaId: this.conversaId() }), {
 *   nomeDoContato: () => this.conversa()?.contato.nome,
 * });
 * // <app-lista-mensagens [digitando]="nomes(digitando())" />
 * ```
 */
export function digitandoEm(
  alvo: () => AlvoDigitando | null,
  opcoes: OpcoesDigitando = {},
): Signal<readonly PessoaDigitando[]> {
  const tempoReal = inject(TempoRealService);
  const sessao = inject(SessaoService);
  const pessoas = signal<readonly PessoaDigitando[]>([]);
  const prazos = new Map<string, ReturnType<typeof setTimeout>>();
  const atual = computed(alvo, { equal: mesmoAlvo });

  const limpar = () => {
    for (const prazo of prazos.values()) {
      clearTimeout(prazo);
    }
    prazos.clear();
    pessoas.set([]);
  };
  const remover = (chave: string) => {
    clearTimeout(prazos.get(chave));
    prazos.delete(chave);
    pessoas.update((lista) => lista.filter((pessoa) => pessoa.chave !== chave));
  };

  effect(() => {
    atual();
    untracked(limpar);
  });

  const parar = tempoReal.ouvir('digitando', (evento) => {
    const destino = untracked(atual);
    if (!destino || !eventoDoAlvo(evento, destino)) {
      return;
    }
    const usuarioId = evento.usuario?.id ?? null;
    if (usuarioId && usuarioId === untracked(sessao.usuario)?.id) {
      return;
    }
    const chave = usuarioId ? `usuario:${usuarioId}` : 'contato';
    if (evento.ativo === false) {
      remover(chave);
      return;
    }
    clearTimeout(prazos.get(chave));
    prazos.set(
      chave,
      setTimeout(() => remover(chave), EXPIRA_DIGITANDO_MS),
    );
    const nome =
      evento.usuario?.nome ||
      evento.nome ||
      untracked(() => opcoes.nomeDoContato?.()) ||
      'O contato';
    pessoas.update((lista) =>
      lista.some((pessoa) => pessoa.chave === chave)
        ? lista
        : [...lista, { chave, nome, contato: !usuarioId }],
    );
  });
  inject(DestroyRef).onDestroy(() => {
    parar();
    limpar();
  });
  return pessoas.asReadonly();
}

function mesmoAlvo(a: AlvoDigitando | null, b: AlvoDigitando | null): boolean {
  if (!a || !b) {
    return a === b;
  }
  return 'conversaId' in a
    ? 'conversaId' in b && a.conversaId === b.conversaId
    : 'canalId' in b && a.canalId === b.canalId;
}

function eventoDoAlvo(evento: EventoDigitando, alvo: AlvoDigitando): boolean {
  return 'conversaId' in alvo
    ? evento.conversaId === alvo.conversaId
    : evento.canalId === alvo.canalId;
}
