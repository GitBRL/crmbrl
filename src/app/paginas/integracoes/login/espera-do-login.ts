import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  untracked,
} from '@angular/core';

import { Botao } from '../../../ui/botao/botao';
import { LoginJanela } from './login-janela';
import { NOME_DO_SERVICO, type ServicoDeLogin } from './login.tipos';

/**
 * "Aguardando o login na outra janela…": o que o assistente mostra enquanto a janela do Facebook,
 * do Typeform ou do RD Station está aberta (R32.23). Só aparece se a espera é deste serviço.
 *
 * `<app-espera-do-login app="typeform" />`
 */
@Component({
  selector: 'app-espera-do-login',
  imports: [Botao],
  template: `
    @if (espera(); as e) {
      <section class="espera" aria-labelledby="titulo-espera-login" data-teste="espera-do-login">
        <span class="espera__giro" aria-hidden="true"></span>
        <div class="espera__texto">
          <p class="espera__titulo" id="titulo-espera-login" role="status">
            Aguardando o login na outra janela…
          </p>
          <p class="espera__nota">
            Entre com o {{ nome() }} e autorize o acesso na janela que abriu. Esta tela segue
            sozinha quando você terminar.
          </p>
          @if (e.bloqueada) {
            <p class="espera__alerta" role="alert">
              O navegador bloqueou a janela. Libere os pop-ups deste site e clique em “Abrir de
              novo”.
            </p>
          }
        </div>
        <div class="espera__acoes">
          <button appBotao type="button" variante="contorno" tamanho="sm" (click)="abrirDeNovo()">
            Abrir de novo
          </button>
          <button appBotao type="button" variante="neutro" tamanho="sm" (click)="cancelar()">
            Cancelar
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .espera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3) var(--esp-4);
      padding: var(--esp-4) var(--esp-5);
      border: 1px solid var(--cor-borda-forte);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .espera__giro {
      flex: none;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid var(--cor-borda-forte);
      border-top-color: var(--cor-inverso);
      border-radius: 50%;
      animation: girar-espera 0.9s linear infinite;
    }

    .espera__texto {
      display: grid;
      flex: 1 1 14rem;
      gap: var(--esp-1);
      min-width: 0;
    }

    .espera__titulo {
      font: var(--fonte-rotulo);
    }

    .espera__nota {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .espera__alerta {
      color: var(--cor-erro);
      font: var(--fonte-corpo-sm);
      font-weight: 500;
    }

    .espera__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }

    @keyframes girar-espera {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .espera__giro {
        animation: none;
        border-top-color: var(--cor-borda-forte);
        border-style: dotted;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsperaDoLogin {
  private readonly janela = inject(LoginJanela);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly app = input.required<ServicoDeLogin>();

  protected readonly espera = computed(() => {
    const espera = this.janela.espera();
    return espera?.app === this.app() ? espera : null;
  });
  protected readonly nome = computed(() => NOME_DO_SERVICO[this.app()]);

  constructor() {
    // O botão que abriu a janela pode estar longe daqui (no celular, abaixo da dobra): traz o aviso à vista.
    let tinha = false;
    effect(() => {
      const agora = this.espera() !== null;
      untracked(() => {
        if (agora && !tinha) {
          afterNextRender(
            () => this.elemento.nativeElement.scrollIntoView?.({ block: 'nearest' }),
            { injector: this.injector },
          );
        }
        tinha = agora;
      });
    });
  }

  protected abrirDeNovo(): void {
    this.janela.abrirDeNovo();
  }

  protected cancelar(): void {
    this.janela.cancelar();
  }
}
