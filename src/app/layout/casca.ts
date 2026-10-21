import { ViewportScroller } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import {
  LucideChevronsLeft,
  LucideChevronsRight,
  LucideDynamicIcon,
  LucideMoon,
  LucideSun,
  LucideX,
} from '@lucide/angular';

import { TemaService } from '../nucleo/tema.service';
import { BotaoIcone } from '../ui/botao-icone/botao-icone';
import { Logo } from '../ui/logo/logo';
import { AvisoDemo } from './aviso-demo';
import { BarraSuperior } from './barra-superior';
import { EstadoCasca } from './estado-casca';
import { MenuLateral } from './menu-lateral';
import { ancestralRolavel, RolagemEsmaecida, trazerParaVista } from './rolagem';

/** Para onde o foco vai quando a gaveta fecha. */
type FocoAposGaveta = 'anterior' | 'conteudo' | 'nenhum';

/** Navegações mais rápidas que isto não mostram a barra de progresso (sem piscar). */
export const ATRASO_PROGRESSO_MS = 150;

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Casca do CRM (DESIGN-SYSTEM.md §5), presente em toda tela: link "Pular para o conteúdo",
 * barra superior fixa, navegação lateral em cartão e o conteúdo.
 *
 * - Desktop: a navegação pode ser recolhida para só os círculos (escolha salva). A lista rola
 *   dentro do cartão, com as bordas esmaecidas quando há mais módulos acima ou abaixo; o aviso
 *   do modo demonstração fica fixo no pé.
 * - Tablet: o trilho de círculos; o «/» abre a navegação inteira por cima do conteúdo (fecha
 *   com Esc, toque fora ou troca de página).
 * - Mobile: a navegação abre numa gaveta (`<dialog>` modal: foco preso, Esc fecha, o foco volta
 *   para o botão que abriu).
 *
 * A cada troca de página a gaveta fecha e o foco vai para o `<main>`, para o leitor de tela
 * anunciar a página nova (troca só de âncora, `#secao`, não mexe no foco). Navegações que
 * demoram mostram uma barra de progresso no topo e marcam o `<main>` como ocupado.
 */
@Component({
  selector: 'app-casca',
  imports: [
    RouterOutlet,
    RouterLink,
    BarraSuperior,
    MenuLateral,
    AvisoDemo,
    BotaoIcone,
    Logo,
    LucideDynamicIcon,
    RolagemEsmaecida,
  ],
  templateUrl: './casca.html',
  styleUrl: './casca.scss',
  providers: [EstadoCasca],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Casca {
  protected readonly estado = inject(EstadoCasca);
  protected readonly tema = inject(TemaService);
  protected readonly icones = { fechar: LucideX, sol: LucideSun, lua: LucideMoon };
  protected readonly alternador = computed(() =>
    this.estado.recolhida()
      ? { icone: LucideChevronsRight, rotulo: 'Expandir a navegação' }
      : { icone: LucideChevronsLeft, rotulo: 'Recolher a navegação' },
  );
  /** Uma navegação está demorando (mais de `ATRASO_PROGRESSO_MS`). */
  protected readonly navegando = signal(false);

  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly gaveta = viewChild<ElementRef<HTMLDialogElement>>('gaveta');
  private readonly conteudo = viewChild<ElementRef<HTMLElement>>('conteudo');
  private readonly lateral = viewChild<ElementRef<HTMLElement>>('lateral');
  private readonly botaoAlternar = viewChild('alternar', { read: ElementRef<HTMLButtonElement> });
  private focoAntesDaGaveta: HTMLElement | null = null;
  private focoAposGaveta: FocoAposGaveta = 'anterior';
  private pressionouNoVeu = false;
  private esperaProgresso: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // O <dialog> da gaveta acompanha o estado (aberta pelo botão da barra superior).
    effect(() => {
      const aberta = this.estado.gavetaAberta();
      untracked(() => (aberta ? this.mostrarGaveta() : this.esconderGaveta()));
    });

    // Progresso das navegações e, ao terminar: fecha a gaveta e a navegação sobreposta e leva
    // o foco ao conteúdo.
    let caminhoAnterior: string | null = null;
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((evento) => {
        if (evento instanceof NavigationStart) {
          this.iniciarProgresso();
          return;
        }
        if (
          evento instanceof NavigationCancel ||
          evento instanceof NavigationError ||
          evento instanceof NavigationSkipped
        ) {
          this.pararProgresso();
          return;
        }
        if (!(evento instanceof NavigationEnd)) {
          return;
        }
        this.pararProgresso();
        this.estado.recolherSobreposta();
        const caminho = evento.urlAfterRedirects.split(/[?#]/)[0];
        const trocouDePagina = caminhoAnterior !== null && caminho !== caminhoAnterior;
        caminhoAnterior = caminho;
        if (this.estado.gavetaAberta()) {
          this.focoAposGaveta = trocouDePagina ? 'conteudo' : 'anterior';
          this.estado.fecharGaveta();
        } else if (trocouDePagina) {
          this.focarConteudo();
        }
      });

    // Tablet: tocar ou clicar fora da navegação aberta por cima do conteúdo a fecha.
    const aoPressionar = (evento: Event) => {
      const lateral = this.lateral()?.nativeElement;
      if (this.estado.sobreposta() && lateral && !lateral.contains(evento.target as Node)) {
        this.estado.recolherSobreposta();
      }
    };
    this.documento.addEventListener('pointerdown', aoPressionar, true);
    inject(DestroyRef).onDestroy(() => {
      this.documento.removeEventListener('pointerdown', aoPressionar, true);
      clearTimeout(this.esperaProgresso);
    });

    // Âncoras (/design-system#cores) param abaixo da barra superior, que é fixa.
    inject(ViewportScroller).setOffset(() => [0, this.alturaDoTopo()]);
  }

  /** O link usa href="#conteudo" por acessibilidade; o foco vai para o <main> sem recarregar. */
  protected pularParaConteudo(evento: Event): void {
    evento.preventDefault();
    this.focarConteudo();
  }

  /** "Ver como": abre o menu da conta. Na gaveta, fecha-a antes (a barra fica inerte). */
  protected trocarPersona(daGaveta = false): void {
    if (daGaveta) {
      this.focoAposGaveta = 'nenhum';
      this.esconderGaveta();
      this.estado.fecharGaveta();
    }
    this.estado.recolherSobreposta();
    this.estado.pedirMenuConta();
  }

  /** Esc dentro da navegação aberta por cima do conteúdo (tablet): fecha e volta ao «/». */
  protected recolherComEsc(): void {
    if (!this.estado.sobreposta()) {
      return;
    }
    this.estado.recolherSobreposta();
    this.botaoAlternar()?.nativeElement.focus();
  }

  protected aoFecharGaveta(): void {
    this.estado.fecharGaveta();
    const destino = this.focoAposGaveta;
    this.focoAposGaveta = 'anterior';
    if (destino === 'conteudo') {
      this.focarConteudo();
    } else if (destino === 'anterior' && this.focoAntesDaGaveta?.isConnected) {
      this.focoAntesDaGaveta.focus();
    }
    this.focoAntesDaGaveta = null;
  }

  protected aoPressionarGaveta(evento: Event): void {
    this.pressionouNoVeu = evento.target === evento.currentTarget;
  }

  /** O véu faz parte do <dialog>: clique fora da caixa fecha (se começou no véu). */
  protected aoClicarNaGaveta(evento: Event): void {
    if (evento.target === evento.currentTarget && this.pressionouNoVeu) {
      this.estado.fecharGaveta();
    }
    this.pressionouNoVeu = false;
  }

  /** Esc fecha; Tab e Shift+Tab dão a volta dentro da gaveta (foco preso). */
  protected aoTeclarNaGaveta(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.estado.fecharGaveta();
      return;
    }
    const dialogo = this.gaveta()?.nativeElement;
    if (evento.key !== 'Tab' || !dialogo) {
      return;
    }
    const focaveis = [...dialogo.querySelectorAll<HTMLElement>(FOCAVEIS)];
    if (!focaveis.length) {
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const ativo = this.documento.activeElement;
    if (evento.shiftKey && (ativo === primeiro || ativo === dialogo)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && ativo === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  private mostrarGaveta(): void {
    const dialogo = this.gaveta()?.nativeElement;
    if (!dialogo || dialogo.open) {
      return;
    }
    this.focoAntesDaGaveta = this.documento.activeElement as HTMLElement | null;
    if (typeof dialogo.showModal === 'function') {
      dialogo.showModal(); // foca o botão com `autofocus` (Fechar)
    } else {
      dialogo.setAttribute('open', '');
      dialogo.querySelector<HTMLElement>('[autofocus]')?.focus();
    }
    // A lista pode ser maior que a tela: mostra o item da página atual. Só quando a lista rola
    // sozinha; com a tela baixa a gaveta inteira rola, e o "Fechar", que tem o foco, sairia
    // da vista.
    const ativo = dialogo.querySelector<HTMLElement>('.menu__item--ativo');
    if (ativo && ancestralRolavel(ativo)?.classList.contains('gaveta__menu')) {
      trazerParaVista(ativo);
    }
  }

  private esconderGaveta(): void {
    const dialogo = this.gaveta()?.nativeElement;
    if (!dialogo?.open) {
      return;
    }
    if (typeof dialogo.close === 'function') {
      dialogo.close(); // dispara "close" → aoFecharGaveta()
    } else {
      dialogo.removeAttribute('open');
      this.aoFecharGaveta();
    }
  }

  private iniciarProgresso(): void {
    clearTimeout(this.esperaProgresso);
    this.esperaProgresso = setTimeout(() => this.navegando.set(true), ATRASO_PROGRESSO_MS);
  }

  private pararProgresso(): void {
    clearTimeout(this.esperaProgresso);
    this.navegando.set(false);
  }

  private focarConteudo(): void {
    this.conteudo()?.nativeElement.focus({ preventScroll: true });
  }

  private alturaDoTopo(): number {
    const topo = this.host.querySelector<HTMLElement>('.topo');
    return topo ? topo.offsetHeight + 16 : 0;
  }
}
