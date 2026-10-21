import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

import { gerarId } from '../tipos';

export interface ItemAba {
  readonly id: string;
  readonly rotulo: string;
  readonly icone?: LucideIconInput;
}

export type VarianteAbas = 'pilulas' | 'entalhe';
export type ModoAbas = 'abas' | 'opcoes';

/** Folga entre a aba selecionada e a borda da lista quando a lista rola até ela. */
const FOLGA_ROLAGEM = 16;

/**
 * Abas em pílula (DESIGN-SYSTEM.md §4), com teclado (setas, Home, End) e ativação automática.
 *
 * - `modo="abas"` (padrão): `role="tablist"` + um `role="tabpanel"` que projeta o conteúdo
 *   (`<ng-content>`); renderize o conteúdo da aba ativa com `@switch`.
 * - `modo="opcoes"`: controle segmentado (`role="radiogroup"`), sem painel — para filtros
 *   como "7 dias · 30 dias · Trimestre".
 * - `variante="entalhe"`: a aba ativa se funde ao painel com cantos invertidos, como na
 *   referência. Cor do conjunto em `--abas-entalhe-fundo` (sólida; padrão `--cor-superficie`).
 *   Abaixo de 600px o entalhe vira pílulas (a ativa invertida) sobre o mesmo painel.
 *
 * Quando as abas não cabem, a lista rola na horizontal: a borda com conteúdo escondido
 * esmaece e a aba selecionada é trazida para dentro da área visível.
 */
@Component({
  selector: 'app-abas',
  imports: [LucideDynamicIcon],
  template: `
    <div
      #lista
      class="abas__lista"
      [class.abas__lista--mais-inicio]="maisNoInicio()"
      [class.abas__lista--mais-fim]="maisNoFim()"
      [attr.role]="ehOpcoes() ? 'radiogroup' : 'tablist'"
      [attr.aria-label]="rotulo()"
      (keydown)="aoTeclar($event)"
    >
      @for (aba of abas(); track aba.id) {
        <button
          #botao
          type="button"
          class="abas__aba"
          [id]="idAba(aba.id)"
          [class.abas__aba--ativa]="aba.id === ativa()"
          [attr.role]="ehOpcoes() ? 'radio' : 'tab'"
          [attr.aria-selected]="ehOpcoes() ? null : aba.id === ativa()"
          [attr.aria-checked]="ehOpcoes() ? aba.id === ativa() : null"
          [attr.aria-controls]="!ehOpcoes() && aba.id === ativa() ? idPainel : null"
          [tabIndex]="aba.id === ativa() ? 0 : -1"
          (click)="selecionar(aba.id)"
        >
          @if (aba.icone; as icone) {
            <svg [lucideIcon]="icone" [size]="tamanho() === 'sm' ? 16 : 18" />
          }
          <span>{{ aba.rotulo }}</span>
        </button>
      }
    </div>
    @if (!ehOpcoes()) {
      <div
        class="abas__painel"
        role="tabpanel"
        tabindex="0"
        [id]="idPainel"
        [attr.aria-labelledby]="idAbaAtiva()"
      >
        <ng-content />
      </div>
    }
  `,
  styleUrl: './abas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'abas',
    '[class.abas--entalhe]': "variante() === 'entalhe' && !ehOpcoes()",
    '[class.abas--opcoes]': 'ehOpcoes()',
    '[class.abas--sm]': "tamanho() === 'sm'",
    '[class.abas--primeira-ativa]': 'ativa() === abas()[0]?.id',
  },
})
export class Abas {
  readonly abas = input.required<readonly ItemAba[]>();
  /** Id da aba selecionada (two-way: `[(selecionada)]`). Sem valor válido, vale a primeira. */
  readonly selecionada = model<string | null>(null);
  /** Nome acessível do grupo ("Visões do painel", "Período"). */
  readonly rotulo = input.required<string>();
  readonly variante = input<VarianteAbas>('pilulas');
  readonly modo = input<ModoAbas>('abas');
  readonly tamanho = input<'sm' | 'md'>('md');

  private readonly injector = inject(Injector);
  private readonly lista = viewChild.required<ElementRef<HTMLElement>>('lista');
  private readonly botoes = viewChildren<ElementRef<HTMLButtonElement>>('botao');
  private readonly prefixo = gerarId('abas');
  protected readonly idPainel = `${this.prefixo}-painel`;

  /** Há abas escondidas antes/depois da área visível da lista (esmaece aquela borda). */
  protected readonly maisNoInicio = signal(false);
  protected readonly maisNoFim = signal(false);

  protected readonly ehOpcoes = computed(() => this.modo() === 'opcoes');
  protected readonly ativa = computed(() => {
    const lista = this.abas();
    const escolhida = this.selecionada();
    return lista.some((aba) => aba.id === escolhida) ? escolhida : (lista[0]?.id ?? null);
  });
  protected readonly idAbaAtiva = computed(() => {
    const ativa = this.ativa();
    return ativa === null ? null : this.idAba(ativa);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const lista = this.lista().nativeElement;
      this.mostrarAtiva(true);
      this.medirRolagem();
      // Ouvinte passivo fora do template: a rolagem só muda os signals quando cruza uma borda.
      const aoRolar = () => this.medirRolagem();
      lista.addEventListener('scroll', aoRolar, { passive: true });
      destroyRef.onDestroy(() => lista.removeEventListener('scroll', aoRolar));
      // A largura disponível muda com a janela e com a navegação recolhida; a das abas, quando
      // a fonte termina de carregar.
      if (typeof ResizeObserver !== 'undefined') {
        const observador = new ResizeObserver(aoRolar);
        observador.observe(lista);
        for (const botao of this.botoes()) {
          observador.observe(botao.nativeElement);
        }
        destroyRef.onDestroy(() => observador.disconnect());
      }
    });
  }

  protected idAba(id: string): string {
    return `${this.prefixo}-${id}`;
  }

  protected selecionar(id: string): void {
    this.selecionada.set(id);
    afterNextRender(() => this.mostrarAtiva(false), { injector: this.injector });
  }

  /** Atualiza o esmaecimento das bordas conforme a rolagem da lista. */
  private medirRolagem(): void {
    const lista = this.lista().nativeElement;
    const fim = lista.scrollWidth - lista.clientWidth;
    this.maisNoInicio.set(lista.scrollLeft > 1);
    this.maisNoFim.set(fim - lista.scrollLeft > 1);
  }

  /**
   * Traz a aba selecionada para dentro da área visível da lista, com uma folga de 16px.
   * Mexe só no `scrollLeft` da lista: `scrollIntoView` também rolaria a página e mudaria o
   * ponto de partida do Tab no Chrome.
   */
  private mostrarAtiva(instantaneo: boolean): void {
    const lista = this.lista().nativeElement;
    if (lista.scrollWidth <= lista.clientWidth) {
      return;
    }
    const indice = this.abas().findIndex((aba) => aba.id === this.ativa());
    const botao = this.botoes()[indice]?.nativeElement;
    if (!botao) {
      return;
    }
    const caixaLista = lista.getBoundingClientRect();
    const caixaBotao = botao.getBoundingClientRect();
    let deslocamento = 0;
    if (caixaBotao.left < caixaLista.left + FOLGA_ROLAGEM) {
      deslocamento = caixaBotao.left - caixaLista.left - FOLGA_ROLAGEM;
    } else if (caixaBotao.right > caixaLista.right - FOLGA_ROLAGEM) {
      deslocamento = caixaBotao.right - caixaLista.right + FOLGA_ROLAGEM;
    }
    if (deslocamento === 0) {
      return;
    }
    const destino = lista.scrollLeft + deslocamento;
    if (typeof lista.scrollTo === 'function') {
      // 'auto' segue o `scroll-behavior` do CSS (suave, ou instantâneo com movimento reduzido).
      lista.scrollTo({ left: destino, behavior: instantaneo ? 'instant' : 'auto' });
    } else {
      lista.scrollLeft = destino;
    }
    this.medirRolagem();
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    const lista = this.abas();
    if (!lista.length) {
      return;
    }
    const atual = Math.max(
      0,
      lista.findIndex((aba) => aba.id === this.ativa()),
    );
    let proximo: number;
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        proximo = (atual + 1) % lista.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        proximo = (atual - 1 + lista.length) % lista.length;
        break;
      case 'Home':
        proximo = 0;
        break;
      case 'End':
        proximo = lista.length - 1;
        break;
      default:
        return;
    }
    evento.preventDefault();
    this.selecionar(lista[proximo].id);
    // `preventScroll`: quem traz a aba para a área visível é `mostrarAtiva`, só na lista.
    this.botoes()[proximo]?.nativeElement.focus({ preventScroll: true });
  }
}
