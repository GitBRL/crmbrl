import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Avatar } from '../../ui/avatar/avatar';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Modal } from '../../ui/modal/modal';
import type { OpcaoResponsavel } from './estado-quadro';

/** Tira acento e caixa para a busca ("jose" acha "José"). */
function comparavel(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

/**
 * Escolher o responsável (R5.15, R5.16): modal com busca e a lista de quem pode ser responsável
 * no funil (as mesmas opções do seletor "Responsável" do detalhe). Serve ao cartão do quadro e à
 * barra de ações em massa. Teclado: a busca já abre focada; seta para baixo desce para a lista,
 * setas movem, Enter escolhe, Esc fecha e devolve o foco a quem abriu (o `<dialog>`).
 *
 * `escolhido` emite a opção, ou `null` para "Sem responsável" (só com `permitirVazio`).
 */
@Component({
  selector: 'app-escolher-responsavel',
  imports: [Avatar, CampoBusca, Modal],
  template: `
    <app-modal [(aberto)]="aberto" [titulo]="titulo()" largura="sm">
      <div class="escolher">
        @if (frase(); as texto) {
          <p class="escolher__frase">{{ texto }}</p>
        }
        <div (keydown)="teclarNaBusca($event)">
          <app-campo-busca
            #busca
            rotulo="Buscar pessoa"
            placeholder="Nome…"
            [(valor)]="termo"
            (buscar)="escolherPrimeira()"
          />
        </div>
        <ul class="escolher__lista" #lista aria-label="Pessoas" (keydown)="teclarNaLista($event)">
          @if (permitirVazio() && mostrarVazio()) {
            <li>
              <button
                type="button"
                class="escolher__opcao"
                [class.escolher__opcao--atual]="atualId() === null"
                [attr.aria-pressed]="atualId() === null"
                (click)="escolher(null)"
              >
                <span class="escolher__nome">Sem responsável</span>
              </button>
            </li>
          }
          @for (opcao of filtradas(); track opcao.id) {
            <li>
              <button
                type="button"
                class="escolher__opcao"
                [class.escolher__opcao--atual]="atualId() === opcao.id"
                [attr.aria-pressed]="atualId() === opcao.id"
                (click)="escolher(opcao)"
              >
                <app-avatar [nome]="opcao.nome" [foto]="opcao.avatarUrl" tamanho="sm" decorativo />
                <span class="escolher__nome">
                  {{ opcao.nome }}{{ opcao.voce ? ' (você)' : '' }}
                  @if (opcao.detalhe) {
                    <span class="escolher__detalhe"> · {{ opcao.detalhe }}</span>
                  }
                </span>
              </button>
            </li>
          } @empty {
            @if (!(permitirVazio() && mostrarVazio())) {
              <li class="escolher__vazio" role="status">Ninguém encontrado com esse nome.</li>
            }
          }
        </ul>
      </div>
    </app-modal>
  `,
  styles: `
    .escolher {
      display: grid;
      gap: var(--esp-3);
    }

    .escolher__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .escolher__lista {
      display: grid;
      gap: var(--esp-1);
      max-height: min(50dvh, 22rem);
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }

    .escolher__opcao {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      width: 100%;
      min-height: var(--altura-md);
      padding: var(--esp-2) var(--esp-3);
      border: 1px solid transparent;
      border-radius: var(--raio-md);
      background: transparent;
      color: var(--cor-texto);
      font: var(--fonte-corpo);
      text-align: start;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: var(--cor-superficie-2);
      }
    }

    .escolher__opcao--atual {
      border-color: var(--cor-destaque);
    }

    .escolher__nome {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .escolher__detalhe,
    .escolher__vazio {
      color: var(--cor-texto-fraco);
    }

    .escolher__vazio {
      padding: var(--esp-3);
      font: var(--fonte-legenda-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscolherResponsavel {
  readonly aberto = model(false);
  readonly titulo = input('Trocar responsável');
  readonly frase = input<string | null>(null);
  readonly opcoes = input.required<readonly OpcaoResponsavel[]>();
  /** O responsável de agora (marcado na lista); nulo = sem responsável. */
  readonly atualId = input<string | null>(null);
  readonly permitirVazio = input(true);

  readonly escolhido = output<OpcaoResponsavel | null>();

  protected readonly termo = signal('');
  private readonly busca = viewChild<CampoBusca>('busca');
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');

  protected readonly filtradas = computed(() => {
    const termo = comparavel(this.termo().trim());
    return termo
      ? this.opcoes().filter((opcao) => comparavel(opcao.nome).includes(termo))
      : this.opcoes();
  });
  /** "Sem responsável" aparece sem busca, ou quando a busca combina com ele. */
  protected readonly mostrarVazio = computed(() => {
    const termo = comparavel(this.termo().trim());
    return !termo || 'sem responsavel'.includes(termo);
  });

  constructor() {
    effect(() => {
      if (this.aberto()) {
        this.termo.set('');
        queueMicrotask(() => this.busca()?.focar());
      }
    });
  }

  protected escolher(opcao: OpcaoResponsavel | null): void {
    this.aberto.set(false);
    this.escolhido.emit(opcao);
  }

  protected escolherPrimeira(): void {
    const primeira = this.filtradas()[0];
    if (primeira) {
      this.escolher(primeira);
    } else if (this.permitirVazio() && this.mostrarVazio() && this.termo().trim()) {
      this.escolher(null);
    }
  }

  protected teclarNaBusca(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      this.botoes()[0]?.focus();
    }
  }

  protected teclarNaLista(evento: KeyboardEvent): void {
    const botoes = this.botoes();
    const indice = botoes.indexOf(evento.target as HTMLButtonElement);
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      botoes[Math.min(botoes.length - 1, indice + 1)]?.focus();
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (indice <= 0) {
        this.busca()?.focar();
      } else {
        botoes[indice - 1]?.focus();
      }
    }
  }

  private botoes(): HTMLButtonElement[] {
    return Array.from(this.lista()?.nativeElement.querySelectorAll('button') ?? []);
  }
}
