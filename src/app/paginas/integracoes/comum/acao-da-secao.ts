import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { LucideIconInput } from '@lucide/angular';

/** A ação principal da seção aberta (TELAS-FASE1: "uma ação principal por tela"). */
export interface AcaoPrincipal {
  /** "Novo webhook de entrada". */
  readonly rotulo: string;
  readonly icone: LucideIconInput;
  readonly executar: () => void;
}

/**
 * Liga a seção aberta no `<router-outlet>` à moldura (Integrações): a seção registra a sua
 * ação principal e a moldura a desenha **sempre no mesmo lugar** — à direita do título no
 * desktop e como botão flutuante circular no celular.
 *
 * A moldura fornece o serviço (`providers: [AcaoDaSecao]`); a seção chama
 * `registrarAcaoPrincipal({...})` no construtor, e a ação some quando a seção sai.
 */
@Injectable()
export class AcaoDaSecao {
  private readonly _atual = signal<AcaoPrincipal | null>(null);

  readonly atual = this._atual.asReadonly();

  definir(acao: AcaoPrincipal): void {
    this._atual.set(acao);
  }

  limpar(acao: AcaoPrincipal): void {
    if (this._atual() === acao) {
      this._atual.set(null);
    }
  }
}

/**
 * Registra a ação principal da seção na moldura (se houver uma) e a retira quando o componente
 * sai. Chame no contexto de injeção (construtor ou inicializador de campo).
 */
export function registrarAcaoPrincipal(acao: AcaoPrincipal): void {
  const secao = inject(AcaoDaSecao, { optional: true });
  if (!secao) {
    return;
  }
  secao.definir(acao);
  inject(DestroyRef).onDestroy(() => secao.limpar(acao));
}
