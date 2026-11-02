import { effect, signal, untracked, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs';

/** Espera depois da última tecla antes de buscar. */
export const ATRASO_DA_BUSCA_MS = 350;

export interface BuscaComAtraso {
  /** O texto do campo (ligue em `[(valor)]` do `app-campo-busca`). */
  readonly termo: WritableSignal<string>;
  /** Enter: aplica na hora, sem esperar. */
  aplicarAgora(termo: string): void;
  /** Esvazia o campo sem pedir nada (quem chama já aplica a mudança, ex.: "Limpar filtros"). */
  esvaziar(): void;
}

/**
 * Campo de busca ligado a um valor externo (a busca da URL): o que a pessoa digita é aplicado
 * depois de uma pausa (`aplicar`), e uma mudança vinda de fora (a busca da barra superior,
 * voltar no navegador) atualiza o campo — sem apagar o que a pessoa acabou de digitar quando
 * a URL só confirma o que ela mesma pediu. Chame num contexto de injeção (construtor).
 */
export function buscaComAtraso(
  externo: () => string,
  aplicar: (termo: string) => void,
  atrasoMs = ATRASO_DA_BUSCA_MS,
): BuscaComAtraso {
  // Os inputs ainda não existem na construção: o efeito traz o valor externo no primeiro ciclo.
  const termo = signal('');
  let ultimo: string | null = null;

  effect(() => {
    const valor = externo();
    untracked(() => {
      if (valor !== ultimo) {
        ultimo = valor;
        termo.set(valor);
      }
    });
  });

  const aplicarAgora = (texto: string): void => {
    const limpo = texto.trim();
    if (limpo !== ultimo) {
      ultimo = limpo;
      aplicar(limpo);
    }
  };

  toObservable(termo)
    .pipe(
      map((texto) => texto.trim()),
      debounceTime(atrasoMs),
      takeUntilDestroyed(),
    )
    .subscribe(aplicarAgora);

  const esvaziar = (): void => {
    ultimo = '';
    termo.set('');
  };

  return { termo, aplicarAgora, esvaziar };
}
