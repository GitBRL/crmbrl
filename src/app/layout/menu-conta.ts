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
import { LucideCheck, LucideChevronDown, LucideFlaskConical } from '@lucide/angular';

import { PerfilDemoService, type PersonaDemo } from '../nucleo/perfil-demo.service';
import { Avatar } from '../ui/avatar/avatar';
import { Selo } from '../ui/selo/selo';
import { gerarId } from '../ui/tipos';
import { EstadoCasca } from './estado-casca';
import { fecharAoTocarFora, focoSaiuDe } from './suspenso';

type FocoInicial = 'atual' | 'ultimo';

/**
 * Menu da conta (avatar na barra superior). Enquanto não há login, ele é o **"Ver como"** do
 * modo demonstração: escolher uma persona troca o papel e a navegação passa a mostrar só os
 * módulos que esse papel acessa (`PerfilDemoService`).
 *
 * Segue o padrão de botão de menu do WAI-ARIA: `aria-haspopup="menu"`, itens
 * `menuitemradio` com `aria-checked`, setas/Home/End para navegar, Enter ou Espaço para
 * escolher, Esc para fechar (o foco volta ao botão) e Tab para sair.
 */
@Component({
  selector: 'app-menu-conta',
  imports: [Avatar, Selo, LucideCheck, LucideChevronDown],
  templateUrl: './menu-conta.html',
  styleUrl: './menu-conta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'conta',
    '(focusout)': 'aoPerderFoco($event)',
  },
})
export class MenuConta {
  protected readonly perfil = inject(PerfilDemoService);
  protected readonly iconeDemo = LucideFlaskConical;
  protected readonly aberto = signal(false);
  /** Mensagem para leitores de tela depois de trocar a persona. */
  protected readonly anuncio = signal('');
  protected readonly idMenu = gerarId('menu-conta');
  protected readonly idAviso = gerarId('menu-conta-aviso');

  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly botao = viewChild.required<ElementRef<HTMLButtonElement>>('botao');
  private readonly itens = viewChildren<ElementRef<HTMLButtonElement>>('item');
  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // "Ver como" em outro ponto da casca (aviso de demonstração) abre este menu.
    const estado = inject(EstadoCasca, { optional: true });
    if (estado) {
      destroyRef.onDestroy(estado.registrarAbrirMenuConta(() => this.abrir()));
    }
    destroyRef.onDestroy(() => this.pararDeOuvir?.());
  }

  /** Abre o menu com o foco na persona atual (ou no último item). */
  abrir(foco: FocoInicial = 'atual'): void {
    const focar = () => {
      const atual = this.perfil.personas.findIndex((p) => p.papel === this.perfil.papel());
      this.focarItem(foco === 'ultimo' ? this.itens().length - 1 : Math.max(atual, 0));
    };
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

  protected escolher(persona: PersonaDemo): void {
    this.perfil.verComo(persona.papel);
    this.anuncio.set(`Agora você vê o CRM como ${persona.nome}, ${persona.rotuloPapel}.`);
    this.fechar();
  }

  protected aoTeclarNoBotao(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.abrir(evento.key === 'ArrowUp' ? 'ultimo' : 'atual');
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
