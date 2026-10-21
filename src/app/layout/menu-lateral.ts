import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';

import { agruparModulos, type IdGrupo, type Modulo } from '../nucleo/navegacao';
import { PerfilDemoService } from '../nucleo/perfil-demo.service';
import { Selo } from '../ui/selo/selo';
import { gerarId } from '../ui/tipos';
import { trazerParaVista } from './rolagem';

interface DicaMenu {
  readonly texto: string;
  readonly topo: number;
  readonly esquerda: number;
  /** O item que abriu a dica: clicar no balão é o mesmo que clicar nele. */
  readonly link: HTMLElement;
}

/**
 * Navegação principal (DESIGN-SYSTEM.md §5): os módulos que a persona do modo demonstração
 * enxerga, agrupados como em `nucleo/navegacao.ts`. Cada item é uma pílula com o ícone num
 * círculo; o item da página atual tem o círculo invertido e `aria-current="page"`. Módulos
 * "em breve" levam um selo.
 *
 * `recolhida` mostra só os círculos: os rótulos continuam para leitores de tela e aparecem
 * numa dica ao passar o mouse ou focar pelo teclado. A dica segue a WCAG 1.4.13: fecha com
 * Esc e continua aberta enquanto o ponteiro vai do item até ela. A mesma navegação é usada na
 * coluna lateral e na gaveta do mobile.
 */
@Component({
  selector: 'app-menu-lateral',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon, Selo],
  templateUrl: './menu-lateral.html',
  styleUrl: './menu-lateral.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuLateral {
  private readonly perfil = inject(PerfilDemoService);
  private readonly documento = inject(DOCUMENT);
  private readonly balao = viewChild.required<ElementRef<HTMLElement>>('balao');

  /** Só os círculos (desktop recolhido e tablet). */
  readonly recolhida = input(false, { transform: booleanAttribute });

  protected readonly secoes = computed(() => agruparModulos(this.perfil.modulosVisiveis()));
  /** A dica só existe com a navegação recolhida: expandir ou recolher a descarta. */
  protected readonly dica = linkedSignal<boolean, DicaMenu | null>({
    source: this.recolhida,
    computation: () => null,
  });
  private readonly prefixo = gerarId('menu');

  /** Esc fecha a dica mesmo quando ela abriu pelo mouse e o foco está em outro lugar. */
  private readonly aoTeclar = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape') {
      this.esconderDica();
    }
  };

  constructor() {
    inject(DestroyRef).onDestroy(() =>
      this.documento.removeEventListener('keydown', this.aoTeclar),
    );
  }

  protected idGrupo(grupo: IdGrupo): string {
    return `${this.prefixo}-${grupo}`;
  }

  /** Dica do item recolhido: ao lado do círculo, fora do cartão (não é cortada pela rolagem). */
  protected mostrarDica(evento: Event, modulo: Modulo): void {
    if (!this.recolhida() || (evento as PointerEvent).pointerType === 'touch') {
      return;
    }
    const link = evento.currentTarget as HTMLElement;
    const caixa = link.getBoundingClientRect();
    const sufixo = modulo.status === 'em-breve' ? ' · em breve' : '';
    this.dica.set({
      texto: `${modulo.rotulo}${sufixo}`,
      topo: caixa.top + caixa.height / 2,
      esquerda: caixa.right + 4,
      link,
    });
    this.documento.removeEventListener('keydown', this.aoTeclar);
    this.documento.addEventListener('keydown', this.aoTeclar);
  }

  protected esconderDica(): void {
    this.dica.set(null);
    this.documento.removeEventListener('keydown', this.aoTeclar);
  }

  /** O ponteiro saiu do item: a dica fica se ele foi para o balão (pela ponte invisível). */
  protected aoSairDoItem(evento: PointerEvent): void {
    if (!this.dentroDoBalao(evento.relatedTarget)) {
      this.esconderDica();
    }
  }

  /** O ponteiro saiu do balão: a dica fica se ele voltou para o item que a abriu. */
  protected aoSairDaDica(evento: PointerEvent): void {
    const destino = evento.relatedTarget;
    const link = this.dica()?.link;
    if (!(link && destino instanceof Node && link.contains(destino))) {
      this.esconderDica();
    }
  }

  /** A lista pode ser maior que a área visível: mostra o item da página atual, se preciso. */
  protected aoMudarAtivo(ativo: boolean, link: HTMLElement): void {
    if (ativo) {
      trazerParaVista(link);
    }
  }

  private dentroDoBalao(alvo: EventTarget | null): boolean {
    return alvo instanceof Node && this.balao().nativeElement.contains(alvo);
  }
}
