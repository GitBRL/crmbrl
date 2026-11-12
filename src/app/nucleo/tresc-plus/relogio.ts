import { effect, type Signal, signal } from '@angular/core';

/**
 * Um relógio de 1 segundo (`Date.now()` em ms) que só corre enquanto `ativo()` for verdadeiro
 * (chame no contexto de injeção: construtor ou inicializador de campo).
 */
export function usarRelogio(ativo: () => boolean): Signal<number> {
  const agora = signal(Date.now());
  effect((aoLimpar) => {
    if (!ativo()) {
      return;
    }
    agora.set(Date.now());
    const id = setInterval(() => agora.set(Date.now()), 1000);
    aoLimpar(() => clearInterval(id));
  });
  return agora.asReadonly();
}
