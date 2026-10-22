import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideChevronDown,
  LucideDynamicIcon,
  LucideKeyRound,
  LucideLogOut,
  LucideUserRound,
  type LucideIcon,
} from '@lucide/angular';

import { SessaoService } from '../nucleo/sessao/sessao.service';
import { Avatar } from '../ui/avatar/avatar';
import { gerarId } from '../ui/tipos';
import { fecharAoTocarFora, focoSaiuDe } from './suspenso';

type FocoInicial = 'primeiro' | 'ultimo';

interface ItemConta {
  readonly id: 'perfil' | 'senha' | 'sair';
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** Rota do item; sem rota, é uma ação (Sair). */
  readonly rota: string | null;
}

export const ITENS_CONTA: readonly ItemConta[] = [
  { id: 'perfil', rotulo: 'Meu perfil', icone: LucideUserRound, rota: '/configuracoes/perfil' },
  { id: 'senha', rotulo: 'Trocar senha', icone: LucideKeyRound, rota: '/trocar-senha' },
  { id: 'sair', rotulo: 'Sair', icone: LucideLogOut, rota: null },
];

/**
 * Menu da conta (avatar na barra superior): quem está logado (nome, papel e e-mail) e as
 * ações "Meu perfil", "Trocar senha" e "Sair".
 *
 * Segue o padrão de botão de menu do WAI-ARIA: `aria-haspopup="menu"`, itens `menuitem`,
 * setas/Home/End para navegar, Enter ou Espaço para escolher, Esc para fechar (o foco volta
 * ao botão) e Tab para sair.
 */
@Component({
  selector: 'app-menu-conta',
  imports: [Avatar, LucideChevronDown, LucideDynamicIcon],
  templateUrl: './menu-conta.html',
  styleUrl: './menu-conta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'conta',
    '(focusout)': 'aoPerderFoco($event)',
  },
})
export class MenuConta {
  protected readonly sessao = inject(SessaoService);
  protected readonly itensConta = ITENS_CONTA;
  protected readonly aberto = signal(false);
  protected readonly saindo = signal(false);
  protected readonly idMenu = gerarId('menu-conta');
  protected readonly idQuem = gerarId('menu-conta-quem');

  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly botao = viewChild.required<ElementRef<HTMLButtonElement>>('botao');
  private readonly itens = viewChildren<ElementRef<HTMLButtonElement>>('item');
  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  /** Abre o menu com o foco no primeiro (ou no último) item. */
  abrir(foco: FocoInicial = 'primeiro'): void {
    const focar = () => this.focarItem(foco === 'ultimo' ? this.itens().length - 1 : 0);
    if (this.aberto()) {
      focar();
      return;
    }
    this.aberto.set(true);
    this.pararDeOuvir = fecharAoTocarFora(this.documento, this.host, () => this.fechar(false));
    afterNextRender(focar, { injector: this.injector });
  }

  fechar(devolverFoco = true): void {
    if (!this.aberto()) {
      return;
    }
    this.aberto.set(false);
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
    if (devolverFoco) {
      this.botao().nativeElement.focus();
    }
  }

  protected alternar(): void {
    if (this.aberto()) {
      this.fechar();
    } else {
      this.abrir();
    }
  }

  protected async escolher(item: ItemConta): Promise<void> {
    if (item.rota) {
      this.fechar(false);
      await this.router.navigateByUrl(item.rota);
      return;
    }
    // Sair: o botão mostra que está saindo; a página recarrega em /entrar.
    this.saindo.set(true);
    await this.sessao.sair();
  }

  protected aoTeclarNoBotao(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.abrir(evento.key === 'ArrowUp' ? 'ultimo' : 'primeiro');
    }
  }

  protected aoTeclarNoMenu(evento: KeyboardEvent): void {
    const itens = this.itens().map((item) => item.nativeElement);
    const atual = itens.indexOf(this.documento.activeElement as HTMLButtonElement);
    const total = itens.length;
    switch (evento.key) {
      case 'ArrowDown':
        this.focarItem((atual + 1) % total);
        break;
      case 'ArrowUp':
        this.focarItem((atual - 1 + total) % total);
        break;
      case 'Home':
        this.focarItem(0);
        break;
      case 'End':
        this.focarItem(total - 1);
        break;
      case 'Escape':
        this.fechar();
        break;
      case 'Tab':
        this.fechar(false);
        return;
      default:
        return;
    }
    evento.preventDefault();
    evento.stopPropagation();
  }

  protected aoPerderFoco(evento: FocusEvent): void {
    if (this.aberto() && focoSaiuDe(this.host, evento)) {
      this.fechar(false);
    }
  }

  private focarItem(indice: number): void {
    this.itens()[indice]?.nativeElement.focus();
  }
}
