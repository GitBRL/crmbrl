import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';

import { gravarArmazenado, lerArmazenado } from '../nucleo/armazenamento';

/** Preferência salva: a navegação lateral fica recolhida (só os círculos) no desktop. */
export const CHAVE_NAVEGACAO_RECOLHIDA = 'crmbrl.navegacao-recolhida';

/** Faixas de largura da casca (DESIGN-SYSTEM.md §2.9 e §5), iguais aos mixins do SCSS. */
export const MIDIA_TABLET = '(min-width: 900px) and (max-width: 1199.98px)';
export const MIDIA_MOBILE = '(max-width: 899.98px)';

/**
 * Estado compartilhado da casca (`layout/`): navegação recolhida, navegação aberta por cima
 * do conteúdo no tablet e gaveta do mobile. É fornecido
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

  private readonly _pedidoNotificacoes = signal(0);
  private fechouNotificacoesEm = 0;
  /** Sobe a cada pedido para abrir o painel de notificações (navegação inferior do celular). */
  readonly pedidoNotificacoes = this._pedidoNotificacoes.asReadonly();

  /** Pede ao sino da barra superior que abra o painel de notificações. */
  pedirNotificacoes(): void {
    this._pedidoNotificacoes.update((n) => n + 1);
  }

  /** O painel de notificações acabou de fechar (toque fora, Esc): serve para o toque no botão
   * que o abre não reabrir o painel que esse mesmo toque fechou. */
  notificacoesFecharam(): void {
    this.fechouNotificacoesEm = Date.now();
  }

  fechouNotificacoesAgora(): boolean {
    return Date.now() - this.fechouNotificacoesEm < 500;
  }

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
