import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';

import { BotaoIcone } from '../botao-icone/botao-icone';
import { CamadaModal } from '../camada-modal';
import { provideOverlayNoDialogo } from '../overlay-no-dialogo';
import { gerarId, partirTitulo } from '../tipos';

/**
 * Modal (DESIGN-SYSTEM.md §4) sobre o `<dialog>` nativo com `showModal()`: foco preso, Esc e
 * camada superior vêm do navegador; o foco volta para quem abriu ao fechar.
 *
 * `[(aberto)]` controla a abertura. Fecha pelo botão "Fechar", por Esc ou por clique no véu.
 * Título h2 em dois tons (`titulo` + `complemento`; com "· " no início, o ponto fica no fim
 * da primeira linha e o complemento desce inteiro); rodapé em `<div modal-rodape>`.
 */
@Component({
  selector: 'app-modal',
  imports: [BotaoIcone],
  // Menus do CDK no conteúdo abrem dentro do <dialog> (fora dele, tudo fica inerte).
  providers: [provideOverlayNoDialogo()],
  template: `
    <dialog
      #dialogo
      class="modal__dialogo"
      [class.modal__dialogo--sm]="largura() === 'sm'"
      [class.modal__dialogo--lg]="largura() === 'lg'"
      [class.modal__dialogo--xl]="largura() === 'xl'"
      [attr.aria-labelledby]="idTitulo"
      (close)="aoFechar()"
      (pointerdown)="aoPressionar($event)"
      (click)="aoClicarNoVeu($event)"
    >
      <div class="modal__caixa">
        <header class="modal__cabecalho">
          <!-- Título em dois tons: as três partes coladas, sem espaço entre elas (§2.3). -->
          <h2 class="modal__titulo" [id]="idTitulo">
            {{ partes().principal }}<span class="tom-fraco">{{ partes().ponto }}</span
            ><span class="tom-fraco sem-quebra">{{ partes().complemento }}</span>
          </h2>
          <button
            appBotaoIcone
            type="button"
            class="modal__fechar"
            [icone]="iconeFechar"
            rotulo="Fechar"
            (click)="fechar()"
          ></button>
        </header>
        <div class="modal__corpo">
          <ng-content />
        </div>
        <footer class="modal__rodape"><ng-content select="[modal-rodape]" /></footer>
      </div>
    </dialog>
  `,
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'modal' },
})
export class Modal {
  readonly aberto = model(false);
  readonly titulo = input.required<string>();
  /** Segundo tom do título ("· beta"). */
  readonly complemento = input<string | null>(null);
  /** Largura máxima: sm 420px · md 560px · lg 720px · xl 1120px (tela cheia no celular). */
  readonly largura = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  /** Emitido sempre que o modal fecha (botão, Esc, véu ou `aberto = false`). */
  readonly fechado = output<void>();

  protected readonly iconeFechar = LucideX;
  protected readonly idTitulo = gerarId('modal-titulo');
  protected readonly partes = computed(() => partirTitulo(this.titulo(), this.complemento()));
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly camada = inject(CamadaModal);
  private elementoDialogo: HTMLDialogElement | null = null;
  private pressionouNoVeu = false;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.aberto() && !dialogo.open) {
        if (typeof dialogo.showModal === 'function') {
          dialogo.showModal();
          // Avisos e anúncios passam a morar aqui dentro (fora, tudo fica inerte).
          this.camada.abriu(dialogo);
          this.elementoDialogo = dialogo;
        } else {
          dialogo.setAttribute('open', '');
        }
      } else if (!this.aberto() && dialogo.open) {
        this.fecharDialogo(dialogo);
      }
    });
    // Destruído ainda aberto (troca de página): o diálogo sai do DOM e devolve o que hospedava.
    inject(DestroyRef).onDestroy(() => {
      if (this.elementoDialogo) {
        this.camada.fechou(this.elementoDialogo);
      }
    });
  }

  fechar(): void {
    this.fecharDialogo(this.dialogo().nativeElement);
  }

  protected aoFechar(): void {
    this.camada.fechou(this.dialogo().nativeElement);
    this.aberto.set(false);
    this.fechado.emit();
  }

  protected aoPressionar(evento: Event): void {
    this.pressionouNoVeu = evento.target === this.dialogo().nativeElement;
  }

  /**
   * O véu faz parte do próprio <dialog>: clique fora da caixa fecha. Só conta se o clique
   * também começou no véu (arrastar uma seleção de texto para fora não fecha).
   */
  protected aoClicarNoVeu(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement && this.pressionouNoVeu) {
      this.fechar();
    }
    this.pressionouNoVeu = false;
  }

  private fecharDialogo(dialogo: HTMLDialogElement): void {
    if (!dialogo.open) {
      return;
    }
    if (typeof dialogo.close === 'function') {
      dialogo.close(); // dispara "close" → aoFechar()
      this.camada.fechou(dialogo); // já, sem esperar o evento
    } else {
      dialogo.removeAttribute('open');
      this.aoFechar();
    }
  }
}
