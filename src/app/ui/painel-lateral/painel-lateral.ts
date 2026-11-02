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
 * Painel lateral (DESIGN-SYSTEM.md §4.4): o detalhe que abre por cima da lista sem tirar a
 * pessoa dela (negócio no kanban, diff da auditoria, entrega de webhook). É um `<dialog>`
 * nativo com `showModal()`: **foco preso** dentro dele, **Esc** fecha, o resto da página fica
 * inerte e o foco volta para quem abriu. Ao abrir, o foco vai para o **título** (h2 em dois
 * tons), que nomeia o painel (`aria-labelledby`); Tab segue para o conteúdo.
 *
 * Encosta na direita como um cartão flutuante (raio grande, 12px de folga); no celular ocupa a
 * tela. Larguras `md` 520 · `lg` 680 · `xl` 880. Ações do cabeçalho em `[painel-acoes]`
 * (ex.: `app-menu-acoes`), rodapé em `[painel-rodape]`. Clique no véu fecha.
 *
 * Com rota (`/funis/:area/:negocioId`): abra quando a rota ativa e, em `(fechado)`, navegue de
 * volta para a lista.
 *
 * `<app-painel-lateral [(aberto)]="aberto" titulo="Escola Horizonte" complemento="· Proposta">…</app-painel-lateral>`
 */
@Component({
  selector: 'app-painel-lateral',
  imports: [BotaoIcone],
  // Menus do CDK no conteúdo abrem dentro do <dialog> (fora dele, tudo fica inerte).
  providers: [provideOverlayNoDialogo()],
  template: `
    <dialog
      #dialogo
      class="painel"
      [class.painel--lg]="largura() === 'lg'"
      [class.painel--xl]="largura() === 'xl'"
      [attr.aria-labelledby]="idTitulo"
      [attr.aria-describedby]="descricao() ? idDescricao : null"
      (close)="aoFechar()"
      (pointerdown)="aoPressionar($event)"
      (click)="aoClicarNoVeu($event)"
    >
      <div class="painel__caixa">
        <header class="painel__cabecalho">
          <div class="painel__titulos">
            <!-- Título em dois tons: as três partes coladas, sem espaço entre elas (§2.3). -->
            <h2 class="painel__titulo" tabindex="-1" autofocus [id]="idTitulo">
              {{ partes().principal }}<span class="tom-fraco">{{ partes().ponto }}</span
              ><span class="tom-fraco sem-quebra">{{ partes().complemento }}</span>
            </h2>
            @if (descricao(); as texto) {
              <p class="painel__descricao" [id]="idDescricao">{{ texto }}</p>
            }
          </div>
          <div class="painel__acoes">
            <ng-content select="[painel-acoes]" />
            <button
              appBotaoIcone
              type="button"
              rotulo="Fechar painel"
              [icone]="iconeFechar"
              (click)="fechar()"
            ></button>
          </div>
        </header>
        <div class="painel__corpo">
          <ng-content />
        </div>
        <footer class="painel__rodape"><ng-content select="[painel-rodape]" /></footer>
      </div>
    </dialog>
  `,
  styleUrl: './painel-lateral.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'painel-lateral' },
})
export class PainelLateral {
  readonly aberto = model(false);
  readonly titulo = input.required<string>();
  /** Segundo tom do título ("· Proposta"). */
  readonly complemento = input<string | null>(null);
  /** Uma linha abaixo do título (contato, empresa, quando). */
  readonly descricao = input<string | null>(null);
  readonly largura = input<'md' | 'lg' | 'xl'>('md');
  /** Emitido sempre que o painel fecha (botão, Esc, véu ou `aberto = false`). */
  readonly fechado = output<void>();

  protected readonly iconeFechar = LucideX;
  protected readonly idTitulo = gerarId('painel-titulo');
  protected readonly idDescricao = `${this.idTitulo}-descricao`;
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

  /** O véu é o próprio <dialog>: clique fora da caixa fecha (se também começou fora). */
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
