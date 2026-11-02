import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucidePlus, LucideSearch, LucideX } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { MolduraCampo } from '../../ui/campo/moldura-campo';
import { gerarId } from '../../ui/tipos';

const ESPERA_MS = 250;
const MINIMO_CARACTERES = 2;

/**
 * Campo de busca com sugestões (combobox do WAI-ARIA, lista com `aria-activedescendant`), para
 * escolher um contato ou uma empresa existente — e, com `textoCriar`, oferecer a criação ali
 * mesmo ("Criar contato “Maria”"). Usa a moldura dos campos de `ui/` (rótulo, ajuda e erro).
 *
 * Setas navegam, Enter escolhe, Esc fecha a lista (ou limpa o texto). Escolhido, o item vira
 * uma pílula com "Trocar".
 */
@Component({
  selector: 'app-busca-entidade',
  imports: [LucidePlus, LucideSearch, LucideX, MolduraCampo],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idErro]="id + '-erro'"
      [idDica]="id + '-dica'"
      [erro]="erro()"
      [dica]="dica()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
    >
      @if (valor(); as escolhido) {
        <div class="escolhido">
          <span class="escolhido__texto">
            <span class="escolhido__nome" [id]="id">{{ rotuloDe()(escolhido) }}</span>
            @if (detalheDe()(escolhido); as detalhe) {
              <span class="escolhido__detalhe">{{ detalhe }}</span>
            }
          </span>
          <button
            #trocar
            type="button"
            class="escolhido__trocar"
            [attr.aria-label]="'Trocar ' + rotulo().toLowerCase() + ': ' + rotuloDe()(escolhido)"
            (click)="limpar()"
          >
            <svg lucideX [size]="16" />
            Trocar
          </button>
        </div>
      } @else {
        <div class="caixa">
          <div class="busca" [class.busca--invalida]="!!erro()">
            <svg lucideSearch [size]="18" class="busca__icone" />
            <input
              #campo
              class="busca__campo"
              type="text"
              role="combobox"
              autocomplete="off"
              aria-autocomplete="list"
              [id]="id"
              [attr.aria-expanded]="listaAberta()"
              [attr.aria-controls]="id + '-lista'"
              [attr.aria-activedescendant]="ativo() >= 0 ? id + '-opcao-' + ativo() : null"
              [attr.aria-describedby]="descricao()"
              [attr.aria-invalid]="erro() ? 'true' : null"
              [attr.aria-required]="obrigatorio() || null"
              [placeholder]="placeholder()"
              [value]="termo()"
              (input)="digitar($any($event.target).value)"
              (keydown)="teclar($event)"
              (focus)="aoFocar()"
              (blur)="aoSair()"
            />
          </div>
          <div
            class="lista"
            role="listbox"
            [id]="id + '-lista'"
            [attr.aria-label]="'Sugestões de ' + rotulo().toLowerCase()"
            [hidden]="!listaAberta()"
          >
            @for (item of itens(); track $index; let i = $index) {
              <div
                class="opcao"
                role="option"
                [id]="id + '-opcao-' + i"
                [class.opcao--ativa]="ativo() === i"
                [attr.aria-selected]="ativo() === i"
                (pointerdown)="$event.preventDefault()"
                (click)="escolher(item)"
              >
                <span class="opcao__nome">{{ rotuloDe()(item) }}</span>
                @if (detalheDe()(item); as detalhe) {
                  <span class="opcao__detalhe">{{ detalhe }}</span>
                }
              </div>
            }
            @if (podeCriar()) {
              <div
                class="opcao opcao--criar"
                role="option"
                [id]="id + '-opcao-' + itens().length"
                [class.opcao--ativa]="ativo() === itens().length"
                [attr.aria-selected]="ativo() === itens().length"
                (pointerdown)="$event.preventDefault()"
                (click)="pedirCriacao()"
              >
                <span class="opcao__circulo" aria-hidden="true"
                  ><svg lucidePlus [size]="16"
                /></span>
                {{ textoCriar()!(termo().trim()) }}
              </div>
            }
          </div>
          <p class="visualmente-oculto" role="status">{{ situacao() }}</p>
          @if (aberta() && situacaoVisivel()) {
            <p class="busca__situacao" aria-hidden="true">{{ situacao() }}</p>
          }
        </div>
      }
    </app-moldura-campo>
  `,
  styleUrl: './busca-entidade.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscaEntidade<T> {
  readonly rotulo = input.required<string>();
  readonly placeholder = input('Digite para buscar…');
  readonly buscar = input.required<(termo: string) => Promise<readonly T[]>>();
  readonly rotuloDe = input.required<(item: T) => string>();
  readonly detalheDe = input<(item: T) => string | null>(() => null);
  /** Com texto, a última opção cria a partir do termo ("Criar contato “Maria”"). */
  readonly textoCriar = input<((termo: string) => string) | null>(null);
  readonly erro = input<string | null>(null);
  readonly dica = input<string | null>(null);
  readonly ajuda = input<string | null>(null);
  readonly opcional = input(false, { transform: booleanAttribute });
  readonly obrigatorio = input(false, { transform: booleanAttribute });
  /** Nome da coisa no plural, para "Nenhum contato encontrado". */
  readonly nomeDoItem = input('resultado');

  readonly valor = model<T | null>(null);
  /** "Criar…" escolhido, com o termo digitado. */
  readonly criar = output<string>();

  protected readonly id = gerarId('busca-entidade');
  protected readonly termo = signal('');
  protected readonly itens = signal<readonly T[]>([]);
  protected readonly ativo = signal(-1);
  protected readonly aberta = signal(false);
  protected readonly buscando = signal(false);
  protected readonly falha = signal<string | null>(null);
  protected readonly buscou = signal(false);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly botaoTrocar = viewChild<ElementRef<HTMLButtonElement>>('trocar');
  private espera: ReturnType<typeof setTimeout> | null = null;
  private versao = 0;

  protected readonly podeCriar = computed(
    () =>
      !!this.textoCriar() && this.termo().trim().length >= MINIMO_CARACTERES && !this.buscando(),
  );
  protected readonly listaAberta = computed(
    () => this.aberta() && (this.itens().length > 0 || this.podeCriar()),
  );
  protected readonly descricao = computed(() => {
    const ids = [this.erro() ? `${this.id}-erro` : null, this.dica() ? `${this.id}-dica` : null];
    return ids.filter(Boolean).join(' ') || null;
  });
  protected readonly situacao = computed(() => {
    if (this.falha()) {
      return this.falha()!;
    }
    if (this.buscando()) {
      return 'Buscando…';
    }
    if (!this.buscou() || !this.aberta()) {
      return '';
    }
    const total = this.itens().length;
    if (total === 0) {
      return `Nenhum ${this.nomeDoItem()} encontrado.`;
    }
    return total === 1
      ? '1 sugestão. Use as setas para escolher.'
      : `${total} sugestões. Use as setas para escolher.`;
  });
  protected readonly situacaoVisivel = computed(
    () => this.buscando() || !!this.falha() || (this.buscou() && this.itens().length === 0),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.espera) {
        clearTimeout(this.espera);
      }
    });
  }

  focar(): void {
    (this.campo() ?? this.botaoTrocar())?.nativeElement.focus();
  }

  protected digitar(texto: string): void {
    this.termo.set(texto);
    this.aberta.set(true);
    this.ativo.set(-1);
    if (this.espera) {
      clearTimeout(this.espera);
    }
    if (texto.trim().length < MINIMO_CARACTERES) {
      this.itens.set([]);
      this.buscou.set(false);
      this.buscando.set(false);
      return;
    }
    this.buscando.set(true);
    this.espera = setTimeout(() => void this.pesquisar(texto.trim()), ESPERA_MS);
  }

  protected teclar(evento: KeyboardEvent): void {
    const total = this.itens().length + (this.podeCriar() ? 1 : 0);
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        this.aberta.set(true);
        if (total) {
          this.ativo.set((this.ativo() + 1) % total);
        }
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (total) {
          this.ativo.set(this.ativo() <= 0 ? total - 1 : this.ativo() - 1);
        }
        break;
      case 'Enter': {
        const indice = this.ativo();
        if (this.listaAberta() && indice >= 0) {
          evento.preventDefault();
          if (indice < this.itens().length) {
            this.escolher(this.itens()[indice]);
          } else {
            this.pedirCriacao();
          }
        } else if (this.listaAberta() && this.itens().length === 1) {
          evento.preventDefault();
          this.escolher(this.itens()[0]);
        }
        break;
      }
      case 'Escape':
        if (this.listaAberta()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.aberta.set(false);
        } else if (this.termo()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.digitar('');
        }
        break;
    }
  }

  protected aoFocar(): void {
    if (this.termo().trim().length >= MINIMO_CARACTERES) {
      this.aberta.set(true);
    }
  }

  protected aoSair(): void {
    this.aberta.set(false);
  }

  protected escolher(item: T): void {
    this.valor.set(item);
    this.aberta.set(false);
    this.termo.set('');
    this.itens.set([]);
    this.buscou.set(false);
    queueMicrotask(() => this.botaoTrocar()?.nativeElement.focus());
  }

  protected pedirCriacao(): void {
    const termo = this.termo().trim();
    this.aberta.set(false);
    this.criar.emit(termo);
  }

  protected limpar(): void {
    this.valor.set(null);
    queueMicrotask(() => this.campo()?.nativeElement.focus());
  }

  private async pesquisar(termo: string): Promise<void> {
    const versao = ++this.versao;
    this.falha.set(null);
    try {
      const itens = await this.buscar()(termo);
      if (versao !== this.versao) {
        return;
      }
      this.itens.set(itens);
      this.buscou.set(true);
    } catch (falha) {
      if (versao === this.versao) {
        this.itens.set([]);
        this.falha.set(erroDaApi(falha).resumo);
      }
    } finally {
      if (versao === this.versao) {
        this.buscando.set(false);
      }
    }
  }
}
