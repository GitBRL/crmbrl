import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

import { erroDaApi } from '../nucleo/api/erro-api';
import { AvisosService } from '../nucleo/avisos.service';
import {
  type ConfirmacaoAberta,
  ConfirmacaoService,
  type PedidoConfirmacao,
  textoConfere,
} from '../nucleo/confirmacao.service';
import { Botao } from '../ui/botao/botao';
import { Modal } from '../ui/modal/modal';
import { gerarId } from '../ui/tipos';

/**
 * Host do `ConfirmacaoService`: um `app-modal` pequeno com a pergunta, o que vai acontecer,
 * a confirmação forte (digitar o texto) quando pedida e os botões "Cancelar" e o da ação.
 * O foco começa em "Cancelar" (ou no campo da confirmação forte); fechar por Esc, véu ou
 * "Fechar" conta como cancelar.
 */
@Component({
  selector: 'app-confirmacao',
  imports: [Modal, Botao, LucideTriangleAlert],
  template: `
    <app-modal
      largura="sm"
      [titulo]="pedido()?.titulo ?? ''"
      [aberto]="aberta() !== null"
      (fechado)="cancelar()"
    >
      @if (pedido(); as pedido) {
        <div class="confirmacao">
          @if (pedido.perigo) {
            <p class="confirmacao__perigo">
              <svg lucideTriangleAlert [size]="18" />
              <span>Atenção: isso não pode ser desfeito.</span>
            </p>
          }
          <p class="confirmacao__mensagem">{{ pedido.mensagem }}</p>
          @if (pedido.detalhes?.length) {
            <ul class="confirmacao__detalhes">
              @for (detalhe of pedido.detalhes; track $index) {
                <li>{{ detalhe }}</li>
              }
            </ul>
          }
          @if (pedido.exigirTexto; as esperado) {
            <div class="confirmacao__campo">
              <label class="confirmacao__rotulo" [for]="idCampo">{{
                pedido.rotuloTexto ?? 'Digite “' + esperado + '” para confirmar'
              }}</label>
              <input
                #campo
                class="confirmacao__entrada"
                type="text"
                autocomplete="off"
                spellcheck="false"
                [id]="idCampo"
                [value]="digitado()"
                [attr.aria-describedby]="erro() ? idErro : null"
                (input)="digitado.set(campo.value)"
                (keydown.enter)="confirmar()"
              />
            </div>
          }
          @if (erro(); as mensagem) {
            <p class="confirmacao__erro" role="alert" [id]="idErro">{{ mensagem }}</p>
          }
        </div>
      }
      <div modal-rodape class="confirmacao__acoes">
        <button #cancelarBotao appBotao type="button" variante="contorno" (click)="cancelar()">
          {{ pedido()?.cancelar ?? 'Cancelar' }}
        </button>
        <button
          appBotao
          type="button"
          variante="invertido"
          [carregando]="executando()"
          [disabled]="!podeConfirmar()"
          (click)="confirmar()"
        >
          {{ pedido()?.confirmar ?? 'Confirmar' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: contents;
    }

    .confirmacao {
      display: grid;
      gap: var(--esp-3);
    }

    .confirmacao__perigo {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      color: var(--cor-erro);
      font: var(--fonte-rotulo);
    }

    .confirmacao__mensagem {
      color: var(--cor-texto-suave);
    }

    .confirmacao__detalhes {
      display: grid;
      gap: var(--esp-1);
      padding-left: var(--esp-5);
      color: var(--cor-texto-suave);
      list-style: disc;
    }

    .confirmacao__campo {
      display: grid;
      gap: var(--esp-2);
    }

    .confirmacao__rotulo {
      font: var(--fonte-rotulo);
    }

    .confirmacao__entrada {
      min-height: var(--altura-md);
      padding: 0 var(--esp-4);
      border: 1px solid var(--cor-borda-forte);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      color: var(--cor-texto);
      font: var(--fonte-corpo);
    }

    .confirmacao__erro {
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm, 400 0.875rem/1.5 var(--familia));
    }

    .confirmacao__acoes {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirmacao {
  private readonly servico = inject(ConfirmacaoService);
  private readonly avisos = inject(AvisosService);
  private readonly injector = inject(Injector);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly cancelarBotao = viewChild('cancelarBotao', {
    read: ElementRef<HTMLButtonElement>,
  });

  protected readonly aberta = this.servico.aberta;
  /** O último pedido continua desenhado enquanto o modal fecha. */
  protected readonly pedido = linkedSignal<ConfirmacaoAberta | null, PedidoConfirmacao | null>({
    source: this.aberta,
    computation: (atual, anterior) => atual?.pedido ?? anterior?.value ?? null,
  });
  protected readonly digitado = linkedSignal({ source: this.aberta, computation: () => '' });
  protected readonly erro = linkedSignal<unknown, string | null>({
    source: this.aberta,
    computation: () => null,
  });
  protected readonly executando = signal(false);
  /** O modal fechou (Esc) com a ação em andamento: o resultado vai para um aviso. */
  private fechouDuranteAcao = false;
  protected readonly podeConfirmar = computed(() => {
    const esperado = this.pedido()?.exigirTexto;
    return !this.executando() && (!esperado || textoConfere(this.digitado(), esperado));
  });
  protected readonly idCampo = gerarId('confirmacao-campo');
  protected readonly idErro = gerarId('confirmacao-erro');

  constructor() {
    // Ao abrir: foco no campo da confirmação forte ou em "Cancelar" (nunca na ação).
    effect(() => {
      if (!this.aberta()) {
        return;
      }
      untracked(() =>
        afterNextRender(() => (this.campo() ?? this.cancelarBotao())?.nativeElement.focus(), {
          injector: this.injector,
        }),
      );
    });
  }

  protected async confirmar(): Promise<void> {
    const atual = this.aberta();
    if (!atual || !this.podeConfirmar()) {
      return;
    }
    if (!atual.pedido.executar) {
      atual.responder(true);
      return;
    }
    this.executando.set(true);
    this.erro.set(null);
    this.fechouDuranteAcao = false;
    try {
      await atual.pedido.executar();
      atual.responder(true);
    } catch (falha) {
      const mensagem = erroDaApi(falha).mensagem;
      if (this.fechouDuranteAcao) {
        this.avisos.erro(mensagem);
        atual.responder(false);
      } else {
        this.erro.set(mensagem);
      }
    } finally {
      this.executando.set(false);
    }
  }

  protected cancelar(): void {
    if (this.executando()) {
      // Esc com a ação em andamento: o modal já fechou; quem responde é o fim da ação.
      this.fechouDuranteAcao = true;
      return;
    }
    this.aberta()?.responder(false);
  }
}
