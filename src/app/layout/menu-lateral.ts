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
  moduloDaNavegacaoPorRota,
  modulosDaNavegacao,
  type IdGrupo,
  type Modulo,
} from '../nucleo/navegacao';
import { SessaoService } from '../nucleo/sessao/sessao.service';
import { TempoRealService } from '../nucleo/tempo-real/tempo-real.service';
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
 * permissões do `auth/eu`), agrupados como em `nucleo/navegacao.ts`; no grupo Funis, um item por
 * setor ativo (`GET /setores`, carregado pela casca), inclusive os criados depois. Cada item é uma pílula
 * com o ícone num círculo; o item do módulo da página atual (inclusive as rotas relacionadas,
 * como `/empresas/:id` em Contatos e empresas) tem o círculo invertido e
 * `aria-current="page"`. Módulos "em breve" levam um selo.
 *
 * Atendimento e Chat da equipe mostram as não lidas (evento `nao-lidas` do tempo real) num
 * contador ao lado do nome, ou no canto do círculo com a navegação recolhida; o nome acessível
 * do item diz quantas ("Atendimento, 3 não lidas").
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
  private readonly tempoReal = inject(TempoRealService);
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

  /** Setores da pessoa (o funil do próprio setor aparece antes de a lista de setores chegar). */
  private readonly areas = computed(() => this.sessao.permissoes()?.areasVisiveis ?? []);
  /** Um item por funil de setor ativo (os criados depois também), com o que a pessoa acessa. */
  protected readonly secoes = computed(() =>
    agruparModulos(modulosDaNavegacao(this.areas()).filter((modulo) => this.sessao.pode(modulo))),
  );
  /** Id do módulo da página atual. */
  protected readonly ativo = computed(
    () => moduloDaNavegacaoPorRota(this.url(), this.areas())?.id ?? null,
  );
  /** Não lidas por módulo (só Atendimento e Chat da equipe têm contador). */
  protected readonly contagens = computed<Readonly<Record<string, number>>>(() => {
    const naoLidas = this.tempoReal.naoLidas();
    return { atendimento: naoLidas.atendimento, chat: naoLidas.chat };
  });
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

  /** "9", "99+". */
  protected textoContagem(contagem: number): string {
    return contagem > 99 ? '99+' : String(contagem);
  }

  /** Nome acessível do item quando o nome visível não basta (em breve, não lidas). */
  protected rotuloAcessivel(modulo: Modulo, contagem: number): string | null {
    if (modulo.status === 'em-breve') {
      return `${modulo.rotulo} (em breve)`;
    }
    return contagem > 0 ? `${modulo.rotulo}, ${descreverNaoLidas(contagem)}` : null;
  }

  /** Dica do item recolhido: ao lado do círculo, fora do cartão (não é cortada pela rolagem). */
  protected mostrarDica(evento: Event, modulo: Modulo): void {
    if (!this.recolhida() || (evento as PointerEvent).pointerType === 'touch') {
      return;
    }
    const link = evento.currentTarget as HTMLElement;
    const caixa = link.getBoundingClientRect();
    const contagem = this.contagens()[modulo.id] ?? 0;
    const sufixo =
      modulo.status === 'em-breve'
        ? ' · em breve'
        : contagem > 0
          ? ` · ${descreverNaoLidas(contagem)}`
          : '';
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

/** "1 não lida", "3 não lidas". */
export function descreverNaoLidas(contagem: number): string {
  return contagem === 1 ? '1 não lida' : `${contagem} não lidas`;
}
