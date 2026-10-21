import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';

import { gravarArmazenado, lerArmazenado } from '../nucleo/armazenamento';

/** Preferência salva: a navegação lateral fica recolhida (só os círculos) no desktop. */
export const CHAVE_NAVEGACAO_RECOLHIDA = 'crmbrl.navegacao-recolhida';

/** Faixas de largura da casca (DESIGN-SYSTEM.md §2.9 e §5), iguais aos mixins do SCSS. */
export const MIDIA_TABLET = '(min-width: 900px) and (max-width: 1199.98px)';
export const MIDIA_MOBILE = '(max-width: 899.98px)';

/**
 * Estado compartilhado da casca (`layout/`): navegação recolhida, navegação aberta por cima
 * do conteúdo no tablet, gaveta do mobile e o atalho para abrir o menu da conta. É fornecido
 * pela `Casca`, então vale para a barra superior, a navegação lateral e a gaveta — e morre
 * com ela.
 */
@Injectable()
export class EstadoCasca {
  private readonly janela = inject(DOCUMENT).defaultView;
  private readonly destroyRef = inject(DestroyRef);

  private readonly recolhidaEscolhida = signal(lerArmazenado(CHAVE_NAVEGACAO_RECOLHIDA) === 'true');
  /** Tablet: a navegação aberta por cima do conteúdo (momentânea, não fica salva). */
  private readonly expandidaNoTablet = signal(false);
  private readonly gaveta = signal(false);
  private abrirMenuConta: (() => void) | null = null;

  /** Tablet (900–1199px): o trilho de círculos, que se abre por cima do conteúdo. */
  readonly ehTablet = this.acompanharMidia(MIDIA_TABLET, (tablet) => {
    if (!tablet) {
      this.recolherSobreposta();
    }
  });
  /** Mobile (< 900px): sem coluna lateral; a navegação abre numa gaveta. */
  readonly ehMobile = this.acompanharMidia(MIDIA_MOBILE, (mobile) => {
    if (!mobile) {
      this.fecharGaveta();
    }
  });

  /**
   * Como a navegação lateral aparece agora. Desktop: a escolha salva. Tablet: recolhida,
   * a não ser que a pessoa a abra por cima do conteúdo.
   */
  readonly recolhida = computed(() =>
    this.ehTablet() ? !this.expandidaNoTablet() : this.recolhidaEscolhida(),
  );
  /** Tablet com a navegação aberta: o cartão passa por cima do conteúdo (a grade não muda). */
  readonly sobreposta = computed(() => this.ehTablet() && this.expandidaNoTablet());
  readonly gavetaAberta = this.gaveta.asReadonly();

  /** O botão «/»: no desktop recolhe/expande (salvo); no tablet abre/fecha por cima. */
  alternarNavegacao(): void {
    if (this.ehTablet()) {
      this.expandidaNoTablet.update((expandida) => !expandida);
      return;
    }
    const recolhida = !this.recolhidaEscolhida();
    this.recolhidaEscolhida.set(recolhida);
    gravarArmazenado(CHAVE_NAVEGACAO_RECOLHIDA, String(recolhida));
  }

  /** Fecha a navegação aberta por cima do conteúdo (troca de página, Esc, toque fora). */
  recolherSobreposta(): void {
    this.expandidaNoTablet.set(false);
  }

  abrirGaveta(): void {
    this.gaveta.set(true);
  }

  fecharGaveta(): void {
    this.gaveta.set(false);
  }

  /**
   * O menu da conta se registra aqui para outras partes da casca poderem abri-lo ("Ver como"
   * no aviso de demonstração). Devolve a função que desfaz o registro.
   */
  registrarAbrirMenuConta(abrir: () => void): () => void {
    this.abrirMenuConta = abrir;
    return () => {
      if (this.abrirMenuConta === abrir) {
        this.abrirMenuConta = null;
      }
    };
  }

  /** Abre o menu da conta com o foco na persona atual. */
  pedirMenuConta(): void {
    this.abrirMenuConta?.();
  }

  /** Signal que acompanha uma media query (sem `matchMedia`, como no jsdom, fica `false`). */
  private acompanharMidia(midia: string, aoMudar?: (combina: boolean) => void) {
    const consulta = this.janela?.matchMedia?.(midia) ?? null;
    const combina = signal(consulta?.matches ?? false);
    if (consulta) {
      const ouvinte = (evento: MediaQueryListEvent) => {
        combina.set(evento.matches);
        aoMudar?.(evento.matches);
      };
      consulta.addEventListener('change', ouvinte);
      this.destroyRef.onDestroy(() => consulta.removeEventListener('change', ouvinte));
    }
    return combina.asReadonly();
  }
}
