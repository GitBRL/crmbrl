import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCircleQuestionMark } from '@lucide/angular';

import { gerarId } from '../tipos';

const FOLGA = 8;

/**
 * Dica (DESIGN-SYSTEM.md §4): botão "?" de 28px (alvo de toque de 44px) que abre um balão
 * com o texto. Abre com clique/toque, Enter ou Espaço; fecha com Esc, clique fora, novo
 * clique ou quando o foco sai para outro controle (Tab), para o balão não cobrir o próximo.
 * O botão aponta para o balão em `aria-describedby`: o leitor de tela lê o texto ao focar,
 * mesmo com o balão fechado.
 *
 * Usa a Popover API (camada superior: não é cortado por `overflow` nem fica atrás de nada) e
 * posiciona o balão abaixo do botão, ou acima quando falta espaço. Sem a API, cai para um
 * balão absoluto com os mesmos atalhos.
 */
@Component({
  selector: 'app-dica',
  imports: [LucideCircleQuestionMark],
  template: `
    <button
      #botao
      type="button"
      class="dica__botao"
      [attr.aria-label]="rotulo()"
      [attr.aria-expanded]="aberta()"
      [attr.aria-controls]="id"
      [attr.aria-describedby]="id"
      [attr.popovertarget]="suportaPopover ? id : null"
      (click)="aoClicar()"
    >
      <svg lucideCircleQuestionMark [size]="16" />
    </button>
    <!-- tabindex -1: um clique no balão põe o foco nele (dentro da dica), não no <main>,
         e ele continua aberto; fora da ordem do Tab. -->
    <div
      #balao
      class="dica__balao"
      role="tooltip"
      tabindex="-1"
      [id]="id"
      [attr.popover]="suportaPopover ? 'auto' : null"
      [class.dica__balao--aberto]="aberta()"
      [class.dica__balao--acima]="acima()"
      (toggle)="aoAlternar($event)"
    >
      @if (titulo(); as titulo) {
        <strong class="dica__titulo">{{ titulo }}</strong>
      }
      {{ texto() }}
    </div>
  `,
  styleUrl: './dica.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dica', '(focusout)': 'aoSairDoFoco($event)' },
})
export class Dica {
  /** Texto explicativo. Frases curtas; explique siglas (MQL, SLA, MRR). */
  readonly texto = input.required<string>();
  /** Nome acessível do botão. Diga do que é a dica: "O que é MRR?". */
  readonly rotulo = input('Mais informações');
  /** Título opcional, em destaque no balão. */
  readonly titulo = input<string | null>(null);

  protected readonly id = gerarId('dica');
  protected readonly aberta = signal(false);
  protected readonly acima = signal(false);

  private readonly documento = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly botao = viewChild.required<ElementRef<HTMLButtonElement>>('botao');
  private readonly balao = viewChild.required<ElementRef<HTMLElement>>('balao');
  private removerOuvintes: Array<() => void> = [];

  protected readonly suportaPopover =
    typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limparOuvintes());
  }

  /** O balão está aberto. */
  estaAberta(): boolean {
    return this.aberta();
  }

  /**
   * Abre o balão e põe o foco no "?" (para Esc, Tab e o clique fora fecharem como sempre).
   * Para quem oferece um gatilho maior que o "?", como as pílulas de regra do quadro.
   */
  abrir(): void {
    const botao = this.botao().nativeElement;
    botao.focus({ preventScroll: true });
    if (this.aberta()) {
      return;
    }
    const balao = this.balao().nativeElement;
    if (this.suportaPopover) {
      if (!balao.matches(':popover-open')) {
        balao.showPopover();
      }
    } else {
      this.definirAberta(true);
    }
  }

  /** Com a Popover API o próprio navegador alterna (popovertarget); aqui só o modo reserva. */
  protected aoClicar(): void {
    if (!this.suportaPopover) {
      this.definirAberta(!this.aberta());
    }
  }

  /**
   * O foco foi para outro elemento fora da dica (Tab, Shift+Tab, clique em outro lugar): fecha
   * o balão, que não tem nada interativo e cobriria o controle seguinte (WCAG 2.4.11). Um
   * clique no próprio balão foca o balão (tabindex -1), que está dentro da dica: continua
   * aberto. Sem destino (a janela perdeu o foco) não fecha.
   */
  protected aoSairDoFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || this.host.nativeElement.contains(destino) || !this.aberta()) {
      return;
    }
    const balao = this.balao().nativeElement;
    if (this.suportaPopover) {
      if (balao.matches(':popover-open')) {
        balao.hidePopover();
      }
    } else {
      this.definirAberta(false);
    }
  }

  protected aoAlternar(evento: Event): void {
    const aberta = (evento as Event & { newState?: string }).newState === 'open';
    this.definirAberta(aberta);
  }

  private definirAberta(aberta: boolean): void {
    if (aberta === this.aberta()) {
      return;
    }
    this.aberta.set(aberta);
    this.limparOuvintes();
    if (!aberta) {
      return;
    }
    const janela = this.documento.defaultView;
    if (this.suportaPopover && janela) {
      this.posicionar();
      // Acompanha o botão quando a página (ou qualquer contêiner) rola ou a janela muda.
      let quadro = 0;
      const reposicionar = () => {
        janela.cancelAnimationFrame(quadro);
        quadro = janela.requestAnimationFrame(() => this.posicionar());
      };
      janela.addEventListener('resize', reposicionar, { passive: true });
      this.documento.addEventListener('scroll', reposicionar, { capture: true, passive: true });
      this.removerOuvintes.push(() => {
        janela.cancelAnimationFrame(quadro);
        janela.removeEventListener('resize', reposicionar);
        this.documento.removeEventListener('scroll', reposicionar, { capture: true });
      });
    } else {
      this.removerOuvintes.push(
        this.renderer.listen(this.documento, 'keydown', (evento: KeyboardEvent) => {
          if (evento.key === 'Escape') {
            this.definirAberta(false);
            this.botao().nativeElement.focus();
          }
        }),
      );
      // O clique fora fecha, a partir do próximo clique: o que abriu (um gatilho fora da
      // dica, como a pílula de regra do quadro) ainda está subindo até o documento.
      const espera = setTimeout(() => {
        this.removerOuvintes.push(
          this.renderer.listen(this.documento, 'click', (evento: Event) => {
            if (!this.host.nativeElement.contains(evento.target as Node)) {
              this.definirAberta(false);
            }
          }),
        );
      });
      this.removerOuvintes.push(() => clearTimeout(espera));
    }
  }

  private posicionar(): void {
    const janela = this.documento.defaultView;
    const balao = this.balao().nativeElement;
    if (!janela) {
      return;
    }
    const alvo = this.botao().nativeElement.getBoundingClientRect();
    const largura = balao.offsetWidth;
    const altura = balao.offsetHeight;
    const larguraJanela = janela.innerWidth;
    const alturaJanela = janela.innerHeight;

    const esquerda = Math.min(
      Math.max(FOLGA, alvo.left + alvo.width / 2 - largura / 2),
      Math.max(FOLGA, larguraJanela - largura - FOLGA),
    );
    const abaixo = alvo.bottom + FOLGA;
    const acima = abaixo + altura > alturaJanela - FOLGA && alvo.top - FOLGA - altura >= FOLGA;

    balao.style.left = `${esquerda}px`;
    balao.style.top = `${acima ? alvo.top - FOLGA - altura : abaixo}px`;
    // Seta do balão apontando para o centro do botão.
    balao.style.setProperty('--dica-seta-x', `${alvo.left + alvo.width / 2 - esquerda}px`);
    this.acima.set(acima);
  }

  private limparOuvintes(): void {
    for (const remover of this.removerOuvintes) {
      remover();
    }
    this.removerOuvintes = [];
  }
}
