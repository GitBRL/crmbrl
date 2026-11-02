import { DestroyRef, inject, InjectionToken, signal, type Signal } from '@angular/core';

/**
 * Relógio em signal, para tempos relativos ("há 5 min") que envelhecem com a página aberta.
 * Chame num contexto de injeção: o intervalo para sozinho quando quem o criou é destruído.
 */
export function criarRelogio(intervaloMs = 30_000): Signal<Date> {
  const agora = signal(new Date());
  const id = setInterval(() => agora.set(new Date()), intervaloMs);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return agora.asReadonly();
}

/**
 * O relógio do painel: um só para os blocos da visão geral (atividades, status, período).
 * A página `Inicio` fornece o dela (`providers`), que para quando ela sai da tela; fora dela
 * (um bloco usado sozinho, nos testes), vale o da aplicação.
 */
export const RELOGIO = new InjectionToken<Signal<Date>>('Relógio do painel', {
  providedIn: 'root',
  factory: () => criarRelogio(),
});

/** Fornece um relógio próprio a um componente e aos filhos dele. */
export function fornecerRelogio() {
  return { provide: RELOGIO, useFactory: () => criarRelogio() };
}
