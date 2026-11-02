import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideCopy, LucidePencil, LucideReply, LucideTrash2 } from '@lucide/angular';

import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { type ChatMensagem, textoDasPartes } from './chat.tipos';

export type TipoAcaoMensagem = 'responder' | 'editar' | 'excluir' | 'copiar';

export interface AcaoMensagem {
  readonly tipo: TipoAcaoMensagem;
  readonly mensagem: ChatMensagem;
}

interface Alvo {
  readonly mensagem: ChatMensagem;
  readonly propria: boolean;
  readonly topo: number;
  readonly esquerda: number;
}

/** Medidas da barra (botões `sm` de 36px, 2px entre eles, 4px de respiro). */
const BOTAO = 36;
const VAO = 2;
const RESPIRO = 4;
const ALTURA = BOTAO + 2 * RESPIRO;
/** Distância da bolha e das bordas da área. */
const FOLGA = 8;

/**
 * Barra de ações de uma mensagem (responder, editar, excluir, copiar), que aparece ao lado da
 * bolha sob o ponteiro — ou num toque longo, no celular. Fica por cima da lista de mensagens
 * (o pai precisa de `position: relative`) e acha a mensagem pelo `data-chave` do item da lista
 * virtual (`m:<id>`, DESIGN-SYSTEM.md §4.6). Editar e excluir só nas próprias; nada nos avisos
 * do sistema nem nas excluídas.
 *
 * Pelo teclado, ↑ com o campo vazio edita a última mensagem própria (Composicao).
 */
@Component({
  selector: 'app-chat-acoes-mensagem',
  imports: [BotaoIcone],
  template: `
    @if (alvo(); as alvo) {
      <div
        class="acoes"
        role="toolbar"
        aria-label="Ações da mensagem"
        [style.top.px]="alvo.topo"
        [style.left.px]="alvo.esquerda"
        (pointerenter)="manter()"
        (pointerleave)="esconderDepois()"
      >
        @if (podeEnviar()) {
          <button
            appBotaoIcone
            type="button"
            tamanho="sm"
            variante="contorno"
            [icone]="icones.responder"
            rotulo="Responder"
            (click)="agir('responder', alvo.mensagem)"
          ></button>
        }
        @if (alvo.propria && podeEnviar()) {
          <button
            appBotaoIcone
            type="button"
            tamanho="sm"
            variante="contorno"
            [icone]="icones.editar"
            rotulo="Editar"
            (click)="agir('editar', alvo.mensagem)"
          ></button>
        }
        @if (temTexto(alvo.mensagem)) {
          <button
            appBotaoIcone
            type="button"
            tamanho="sm"
            variante="contorno"
            [icone]="icones.copiar"
            rotulo="Copiar o texto"
            (click)="agir('copiar', alvo.mensagem)"
          ></button>
        }
        @if (alvo.propria) {
          <button
            appBotaoIcone
            type="button"
            tamanho="sm"
            variante="contorno"
            class="acoes__perigo"
            [icone]="icones.excluir"
            rotulo="Excluir"
            (click)="agir('excluir', alvo.mensagem)"
          ></button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }

    .acoes {
      position: absolute;
      display: flex;
      gap: 2px;
      padding: 4px;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-flutuante);
      box-shadow: var(--sombra-flutuante);
      pointer-events: auto;
    }

    .acoes__perigo {
      color: var(--cor-erro);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcoesMensagem {
  /** As mensagens da API carregadas no canal. */
  readonly mensagens = input.required<readonly ChatMensagem[]>();
  readonly eu = input<string | null>(null);
  /** Responder e editar só quando dá para enviar (grupo arquivado, pessoa desligada: não). */
  readonly podeEnviar = input(true, { transform: booleanAttribute });
  readonly acao = output<AcaoMensagem>();

  protected readonly icones = {
    responder: LucideReply,
    editar: LucidePencil,
    copiar: LucideCopy,
    excluir: LucideTrash2,
  };
  protected readonly alvo = signal<Alvo | null>(null);

  private readonly porId = computed(
    () => new Map(this.mensagens().map((mensagem) => [mensagem.id, mensagem])),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private esconder: ReturnType<typeof setTimeout> | undefined;
  private quadro = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const area = this.host.parentElement;
      if (!area) {
        return;
      }
      const mover = (evento: PointerEvent) => {
        if (evento.pointerType === 'touch' || this.host.contains(evento.target as Node)) {
          return;
        }
        cancelAnimationFrame(this.quadro);
        const alvo = evento.target;
        this.quadro = requestAnimationFrame(() => this.mirar(alvo, area));
      };
      const sair = () => this.esconderDepois();
      const rolar = () => this.alvo.set(null);
      const segurar = (evento: MouseEvent) => {
        if (this.mirar(evento.target, area)) {
          evento.preventDefault();
        }
      };
      const tocar = (evento: PointerEvent) => {
        if (evento.pointerType === 'touch' && !this.host.contains(evento.target as Node)) {
          this.alvo.set(null);
        }
      };
      area.addEventListener('pointermove', mover);
      area.addEventListener('pointerleave', sair);
      area.addEventListener('scroll', rolar, true);
      area.addEventListener('contextmenu', segurar);
      area.addEventListener('pointerdown', tocar);
      destroyRef.onDestroy(() => {
        clearTimeout(this.esconder);
        cancelAnimationFrame(this.quadro);
        area.removeEventListener('pointermove', mover);
        area.removeEventListener('pointerleave', sair);
        area.removeEventListener('scroll', rolar, true);
        area.removeEventListener('contextmenu', segurar);
        area.removeEventListener('pointerdown', tocar);
      });
    });
  }

  /** Esconde a barra (troca de canal, ação feita). */
  esconderAgora(): void {
    clearTimeout(this.esconder);
    this.alvo.set(null);
  }

  protected manter(): void {
    clearTimeout(this.esconder);
  }

  protected esconderDepois(): void {
    clearTimeout(this.esconder);
    this.esconder = setTimeout(() => this.alvo.set(null), 300);
  }

  protected agir(tipo: TipoAcaoMensagem, mensagem: ChatMensagem): void {
    this.esconderAgora();
    this.acao.emit({ tipo, mensagem });
  }

  protected temTexto(mensagem: ChatMensagem): boolean {
    return !!textoDasPartes(mensagem.partes).trim();
  }

  /** Põe a barra ao lado da bolha da mensagem sob `alvo`. Devolve se achou uma mensagem. */
  private mirar(alvo: EventTarget | null, area: HTMLElement): boolean {
    const item = alvo instanceof Element ? alvo.closest<HTMLElement>('[data-chave^="m:"]') : null;
    const mensagem = item ? this.porId().get(item.dataset['chave']!.slice(2)) : undefined;
    if (!item || !mensagem || mensagem.sistema || !mensagem.autor || mensagem.excluida) {
      if (!this.host.contains(alvo as Node | null)) {
        this.esconderDepois();
      }
      return false;
    }
    clearTimeout(this.esconder);
    const propria = mensagem.autor.id === this.eu();
    const total =
      (this.podeEnviar() ? 1 : 0) +
      (propria && this.podeEnviar() ? 1 : 0) +
      (this.temTexto(mensagem) ? 1 : 0) +
      (propria ? 1 : 0);
    if (!total) {
      this.alvo.set(null);
      return false;
    }
    const largura = total * BOTAO + (total - 1) * VAO + 2 * RESPIRO;
    const caixa = area.getBoundingClientRect();
    const bolha = (item.querySelector<HTMLElement>('.bolha') ?? item).getBoundingClientRect();
    const altura = Math.max(0, bolha.height);
    let topo = bolha.top - caixa.top + (altura <= ALTURA + 8 ? (altura - ALTURA) / 2 : 4);
    topo = Math.min(Math.max(topo, FOLGA), Math.max(FOLGA, caixa.height - ALTURA - FOLGA));
    let esquerda: number;
    if (propria) {
      // A própria fica à direita: a barra vai à esquerda da bolha (ou por cima, sem espaço).
      esquerda = bolha.left - caixa.left - largura - FOLGA;
      if (esquerda < FOLGA) {
        esquerda = bolha.left - caixa.left + FOLGA;
      }
    } else {
      esquerda = bolha.right - caixa.left + FOLGA;
      if (esquerda + largura > caixa.width - FOLGA) {
        esquerda = bolha.right - caixa.left - largura - FOLGA;
      }
    }
    esquerda = Math.min(Math.max(esquerda, FOLGA), Math.max(FOLGA, caixa.width - largura - FOLGA));
    const anterior = this.alvo();
    if (
      anterior?.mensagem !== mensagem ||
      anterior.topo !== topo ||
      anterior.esquerda !== esquerda
    ) {
      this.alvo.set({ mensagem, propria, topo, esquerda });
    }
    return true;
  }
}
