import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideCheck, LucideDynamicIcon, LucideX } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { ChatApi } from './chat.api';
import { type ChatPessoa, filtrarPessoas } from './chat.tipos';

/** Espera da digitação antes de perguntar à API (equipes grandes). */
export const ESPERA_PESSOAS_MS = 250;

/**
 * Escolha de pessoas ativas do CRM (`GET /chat/pessoas`): busca por nome ou e-mail e a lista
 * com avatar, papel e se está online. `multipla`: cada pessoa liga e desliga
 * (`[(selecionados)]`), e as escolhidas aparecem em pílulas com remover acima da busca; sem
 * `multipla`, escolher emite `(escolher)` (abrir uma conversa direta).
 */
@Component({
  selector: 'app-chat-seletor-pessoas',
  imports: [LucideDynamicIcon, Avatar, Botao, BotaoIcone, CampoBusca, Esqueleto],
  template: `
    @if (multipla() && selecionados().length) {
      <ul class="seletor__escolhidas" [attr.aria-label]="'Escolhidas: ' + selecionados().length">
        @for (pessoa of selecionados(); track pessoa.id) {
          <li class="seletor__escolhida">
            <app-avatar tamanho="sm" decorativo [nome]="pessoa.nome" [foto]="pessoa.avatarUrl" />
            <span class="seletor__escolhida-nome">{{ pessoa.nome }}</span>
            <button
              appBotaoIcone
              type="button"
              tamanho="sm"
              variante="contorno"
              [icone]="icones.remover"
              [rotulo]="'Tirar ' + pessoa.nome"
              (click)="alternar(pessoa)"
            ></button>
          </li>
        }
      </ul>
    }

    <app-campo-busca
      [rotulo]="rotulo()"
      placeholder="Buscar pelo nome ou e-mail"
      [(valor)]="busca"
    />

    <div class="seletor__lista" [attr.aria-busy]="carregando() || null">
      @if (falha(); as mensagem) {
        <div class="seletor__aviso" role="alert">
          <p>{{ mensagem }}</p>
          <button appBotao type="button" tamanho="sm" variante="contorno" (click)="buscar()">
            Tentar de novo
          </button>
        </div>
      } @else if (pessoas() === null) {
        @for (largura of [62, 48, 56]; track $index) {
          <div class="seletor__esqueleto" aria-hidden="true">
            <app-esqueleto forma="circulo" largura="32px" altura="32px" />
            <app-esqueleto forma="texto" [linhas]="2" [largura]="largura + '%'" />
          </div>
        }
        <p class="visualmente-oculto" role="status">Carregando as pessoas…</p>
      } @else if (!visiveis().length) {
        <p class="seletor__aviso" role="status">
          {{
            busca().trim()
              ? 'Ninguém com “' + busca().trim() + '”.'
              : 'Não há outras pessoas ativas para escolher.'
          }}
        </p>
      } @else {
        <ul class="seletor__pessoas" [attr.aria-label]="rotulo()">
          @for (pessoa of visiveis(); track pessoa.id) {
            @let marcada = estaSelecionada(pessoa);
            <li>
              <button
                type="button"
                class="pessoa"
                [class.pessoa--marcada]="marcada"
                [attr.aria-pressed]="multipla() ? marcada : null"
                (click)="multipla() ? alternar(pessoa) : escolher.emit(pessoa)"
              >
                <span class="pessoa__avatar">
                  <app-avatar
                    tamanho="sm"
                    decorativo
                    [nome]="pessoa.nome"
                    [foto]="pessoa.avatarUrl"
                  />
                  @if (pessoa.online) {
                    <span class="pessoa__online" aria-hidden="true"></span>
                  }
                </span>
                <span class="pessoa__textos">
                  <span class="pessoa__nome">{{ pessoa.nome }}</span>
                  <span class="pessoa__papel">
                    {{ pessoa.rotuloPapel }}{{ pessoa.online ? ' · online' : '' }}
                  </span>
                </span>
                @if (multipla()) {
                  <span class="pessoa__marca" aria-hidden="true">
                    @if (marcada) {
                      <svg [lucideIcon]="icones.marcada" [size]="16" />
                    }
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
    }

    .seletor__escolhidas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .seletor__escolhida {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      min-height: var(--altura-md);
      padding: 4px 4px 4px 4px;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      font: var(--fonte-rotulo);
    }

    .seletor__escolhida-nome {
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .seletor__lista {
      max-height: min(18rem, 40dvh);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
      padding: var(--esp-1);
    }

    .seletor__pessoas {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .seletor__aviso {
      display: grid;
      justify-items: start;
      gap: var(--esp-2);
      padding: var(--esp-3);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .seletor__esqueleto {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      align-items: center;
      gap: var(--esp-3);
      padding: var(--esp-2) var(--esp-3);
    }

    .pessoa {
      display: flex;
      align-items: center;
      gap: var(--esp-3);
      width: 100%;
      min-height: 52px;
      padding: var(--esp-2) var(--esp-3);
      border: 0;
      border-radius: var(--raio-md);
      background: transparent;
      color: var(--cor-texto);
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--cor-vidro);
      }

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: -2px;
      }
    }

    .pessoa--marcada {
      background: var(--cor-superficie-2);
    }

    .pessoa__avatar {
      position: relative;
      display: grid;
      flex: none;
    }

    .pessoa__online {
      position: absolute;
      right: -2px;
      bottom: -2px;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--dado-2);
      box-shadow:
        0 0 0 2px var(--cor-superficie),
        inset 0 0 0 1px var(--cor-contorno-dado);
    }

    .pessoa__textos {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .pessoa__nome {
      overflow: hidden;
      font: var(--fonte-rotulo);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pessoa__papel {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    // A caixa da escolha: círculo vazio com contorno; marcada, invertida com o visto.
    .pessoa__marca {
      display: grid;
      flex: none;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 2px solid var(--cor-texto-fraco);
      border-radius: 50%;
    }

    .pessoa--marcada .pessoa__marca {
      border-color: var(--cor-inverso);
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    @media (forced-colors: active) {
      .pessoa--marcada {
        outline: 2px solid Highlight;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorPessoas {
  /** Nome do campo de busca e da lista ("Quem participa", "Com quem conversar"). */
  readonly rotulo = input('Buscar pessoa');
  readonly multipla = input(false, { transform: booleanAttribute });
  /** Quem não aparece para escolher (você, quem já está no grupo). */
  readonly excluir = input<readonly string[]>([]);
  readonly selecionados = model<readonly ChatPessoa[]>([]);
  readonly escolher = output<ChatPessoa>();

  protected readonly icones = { remover: LucideX, marcada: LucideCheck };
  protected readonly busca = signal('');
  protected readonly pessoas = signal<readonly ChatPessoa[] | null>(null);
  protected readonly carregando = signal(false);
  protected readonly falha = signal<string | null>(null);
  /** A primeira resposta (sem busca) trouxe todo mundo: filtra aqui mesmo, sem perguntar. */
  private readonly todos = signal(false);

  protected readonly visiveis = computed(() => {
    const fora = new Set(this.excluir());
    const lista = (this.pessoas() ?? []).filter((pessoa) => !fora.has(pessoa.id));
    return this.todos() ? filtrarPessoas(lista, this.busca(), lista.length) : lista;
  });

  private readonly api = inject(ChatApi);
  private pedido = 0;

  constructor() {
    let espera: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const termo = this.busca().trim();
      clearTimeout(espera);
      if (untracked(this.todos)) {
        return;
      }
      espera = setTimeout(() => this.buscar(termo), termo ? ESPERA_PESSOAS_MS : 0);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(espera));
  }

  protected async buscar(termo = this.busca().trim()): Promise<void> {
    const pedido = ++this.pedido;
    this.carregando.set(true);
    this.falha.set(null);
    try {
      const pagina = await this.api.pessoas(termo);
      if (pedido !== this.pedido) {
        return;
      }
      if (!termo && pagina.total <= pagina.itens.length) {
        this.todos.set(true);
      }
      this.pessoas.set(pagina.itens);
    } catch (falha) {
      if (pedido === this.pedido) {
        this.falha.set(erroDaApi(falha).mensagem);
      }
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  protected estaSelecionada(pessoa: ChatPessoa): boolean {
    return this.selecionados().some((item) => item.id === pessoa.id);
  }

  protected alternar(pessoa: ChatPessoa): void {
    this.selecionados.update((lista) =>
      lista.some((item) => item.id === pessoa.id)
        ? lista.filter((item) => item.id !== pessoa.id)
        : [...lista, pessoa],
    );
  }
}
