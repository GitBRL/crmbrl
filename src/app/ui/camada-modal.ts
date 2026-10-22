import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT, inject, Injectable } from '@angular/core';

/** Um elemento que precisa continuar vivo (clicável, focável, lido) com um modal aberto. */
interface Inquilino {
  /** Onde ele mora quando não há diálogo modal aberto. */
  readonly casa: Node;
  /** Chamado depois de cada mudança de lugar (ex.: reabrir o popover). */
  readonly aoMudar?: () => void;
}

/**
 * A pilha dos `<dialog>` abertos com `showModal()` (modal, painel lateral, gaveta) e o que
 * precisa morar **dentro** do diálogo do topo.
 *
 * Com um diálogo modal aberto, tudo fora dele fica inerte: não recebe clique nem foco e some
 * da árvore de acessibilidade. Por isso:
 *
 * - o host dos avisos (`app-avisos`) entra no diálogo do topo enquanto ele estiver aberto, e o
 *   "Desfazer" ou o "×" continuam funcionando sem fechar o diálogo;
 * - a região viva do `LiveAnnouncer` do CDK (`.cdk-live-announcer-element`, no `<body>`)
 *   também entra: sem isso, os anúncios dados de dentro de um modal não chegam ao leitor de
 *   tela (o CDK só a expõe aos modais do próprio overlay).
 *
 * Quem abre um diálogo modal avisa `abriu(dialogo)` logo depois do `showModal()` e
 * `fechou(dialogo)` ao fechar e ao ser destruído (o diálogo pode sair do DOM ainda aberto,
 * levando junto o que estava dentro dele: ao fechar, cada inquilino volta para a casa).
 */
@Injectable({ providedIn: 'root' })
export class CamadaModal {
  private readonly documento = inject(DOCUMENT);
  private readonly anunciador = inject(LiveAnnouncer, { optional: true });
  private readonly pilha: HTMLDialogElement[] = [];
  private readonly inquilinos = new Map<HTMLElement, Inquilino>();

  /** O diálogo modal de cima, ou `null` sem nenhum aberto. */
  topo(): HTMLDialogElement | null {
    this.limparPilha();
    return this.pilha.at(-1) ?? null;
  }

  abriu(dialogo: HTMLDialogElement): void {
    const indice = this.pilha.indexOf(dialogo);
    if (indice >= 0) {
      this.pilha.splice(indice, 1);
    }
    this.pilha.push(dialogo);
    this.realocar();
  }

  fechou(dialogo: HTMLDialogElement): void {
    const indice = this.pilha.indexOf(dialogo);
    if (indice < 0) {
      return;
    }
    this.pilha.splice(indice, 1);
    this.realocar();
  }

  /**
   * Faz `elemento` acompanhar o diálogo modal do topo (e voltar ao lugar de hoje sem modal).
   * Devolve a função que para de acompanhar (chame ao destruir quem pediu).
   */
  acompanhar(elemento: HTMLElement, aoMudar?: () => void): () => void {
    this.inquilinos.set(elemento, {
      casa: elemento.parentNode ?? this.documento.body,
      aoMudar,
    });
    this.realocar();
    return () => {
      this.inquilinos.delete(elemento);
    };
  }

  private limparPilha(): void {
    for (let i = this.pilha.length - 1; i >= 0; i--) {
      const dialogo = this.pilha[i];
      if (!dialogo.isConnected || !dialogo.open) {
        this.pilha.splice(i, 1);
      }
    }
  }

  private realocar(): void {
    const topo = this.topo();
    for (const [elemento, { casa, aoMudar }] of this.inquilinos) {
      if (this.mover(elemento, topo ?? casa)) {
        aoMudar?.();
      }
    }
    // A região viva do CDK nasce no <body> quando o LiveAnnouncer é criado (já foi: injetado).
    if (this.anunciador) {
      const regiao = this.documento.querySelector<HTMLElement>('.cdk-live-announcer-element');
      if (regiao) {
        this.mover(regiao, topo ?? this.documento.body);
      }
    }
  }

  /** Põe `elemento` no fim de `destino`; devolve se mudou de lugar. */
  private mover(elemento: HTMLElement, destino: Node): boolean {
    if (elemento.parentNode === destino) {
      return false;
    }
    destino.appendChild(elemento);
    return true;
  }
}
