import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { filter, map } from 'rxjs';

import {
  agruparModulos,
  MODULOS,
  moduloPorRota,
  type IdGrupo,
  type Modulo,
} from '../nucleo/navegacao';
import { SessaoService } from '../nucleo/sessao/sessao.service';
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
 * Navegação principal (DESIGN-SYSTEM.md §5): os módulos que o usuário logado acessa (papel e
 * permissões do `auth/eu`), agrupados como em `nucleo/navegacao.ts`. Cada item é uma pílula
 * com o ícone num círculo; o item do módulo da página atual (inclusive as rotas relacionadas,
 * como `/empresas/:id` em Contatos e empresas) tem o círculo invertido e
 * `aria-current="page"`. Módulos "em breve" levam um selo.
 *
 * `recolhida` mostra só os círculos: os rótulos continuam para leitores de tela e aparecem
 * numa dica ao passar o mouse ou focar pelo teclado. A dica segue a WCAG 1.4.13: fecha com
 * Esc e continua aberta enquanto o ponteiro vai do item até ela. A mesma navegação é usada na
 * coluna lateral e na gaveta do mobile.
 */
@Component({
  selector: 'app-menu-lateral',
  imports: [RouterLink, LucideDynamicIcon, Selo],
  templateUrl: './menu-lateral.html',
  styleUrl: './menu-lateral.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuLateral {
  private readonly sessao = inject(SessaoService);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly balao = viewChild.required<ElementRef<HTMLElement>>('balao');
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Só os círculos (desktop recolhido e tablet). */
  readonly recolhida = input(false, { transform: booleanAttribute });

  protected readonly secoes = computed(() =>
    agruparModulos(MODULOS.filter((modulo) => this.sessao.pode(modulo))),
  );
  /** Id do módulo da página atual. */
  protected readonly ativo = computed(() => moduloPorRota(this.url())?.id ?? null);
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
    // A lista pode ser maior que a área visível: mostra o item da página atual, se preciso.
    effect(() => {
      if (!this.ativo()) {
        return;
      }
      untracked(() =>
        afterNextRender(
          () => {
            const link = this.host.querySelector<HTMLElement>('.menu__item--ativo');
            if (link) {
              trazerParaVista(link);
            }
          },
          { injector: this.injector },
        ),
      );
    });
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

  private dentroDoBalao(alvo: EventTarget | null): boolean {
    return alvo instanceof Node && this.balao().nativeElement.contains(alvo);
  }
}
