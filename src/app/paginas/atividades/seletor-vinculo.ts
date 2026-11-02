import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideBriefcase,
  LucideContact,
  LucideDynamicIcon,
  LucideHandshake,
  LucideSearch,
  LucideX,
  type LucideIcon,
} from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { MolduraCampo } from '../../ui/campo/moldura-campo';
import { gerarId } from '../../ui/tipos';
import { AtividadesApi, type Vinculo } from './atividades.api';

/** Espera depois da última tecla antes de buscar. */
export const ESPERA_BUSCA_MS = 250;
/** A busca começa com duas letras. */
export const MINIMO_BUSCA = 2;

const GRUPOS: readonly { readonly tipo: Vinculo['tipo']; readonly rotulo: string }[] = [
  { tipo: 'contato', rotulo: 'Contatos' },
  { tipo: 'empresa', rotulo: 'Empresas' },
  { tipo: 'negocio', rotulo: 'Negócios' },
];

export const ICONE_DO_VINCULO: Readonly<Record<Vinculo['tipo'], LucideIcon>> = {
  contato: LucideContact,
  empresa: LucideBriefcase,
  negocio: LucideHandshake,
};

export const ROTULO_DO_VINCULO: Readonly<Record<Vinculo['tipo'], string>> = {
  contato: 'Contato',
  empresa: 'Empresa',
  negocio: 'Negócio',
};

/**
 * Vínculo da atividade com um contato, uma empresa ou um negócio (R6.1): uma caixa de
 * combinação (padrão ARIA "combobox" com lista) que busca nos três ao mesmo tempo, agrupando
 * os resultados. Escolhido, o vínculo vira uma pílula com o nome e o botão de tirar.
 *
 * Teclado: setas percorrem os resultados, Enter escolhe, Esc fecha a lista (sem fechar o
 * painel em volta). A quantidade de resultados é anunciada.
 */
@Component({
  selector: 'app-seletor-vinculo',
  imports: [LucideDynamicIcon, LucideSearch, LucideX, MolduraCampo],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [opcional]="opcional()"
      [dica]="dica()"
      [idDica]="idDica"
      [erro]="erro()"
      [idErro]="idErro"
    >
      @if (vinculo(); as escolhido) {
        <div class="vinculo__escolhido">
          <span class="vinculo__icone" aria-hidden="true">
            <svg [lucideIcon]="icone(escolhido.tipo)" [size]="16" />
          </span>
          <span class="vinculo__texto">
            <span class="vinculo__nome">{{ escolhido.nome }}</span>
            <span class="vinculo__tipo">{{ rotuloTipo(escolhido.tipo) }}</span>
          </span>
          <button
            #tirar
            type="button"
            class="vinculo__tirar"
            [id]="id"
            [attr.aria-label]="'Tirar o vínculo com ' + escolhido.nome"
            [attr.aria-describedby]="descricao()"
            (click)="tirarVinculo()"
          >
            <svg lucideX [size]="16" />
          </button>
        </div>
      } @else {
        <div class="vinculo__campo">
          <svg lucideSearch [size]="18" class="vinculo__lupa" />
          <input
            #campo
            type="text"
            class="vinculo__input"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            [id]="id"
            [placeholder]="placeholder()"
            [value]="texto()"
            [attr.aria-expanded]="aberto()"
            [attr.aria-controls]="aberto() ? idLista : null"
            [attr.aria-activedescendant]="idAtivo()"
            [attr.aria-describedby]="descricao()"
            (input)="digitar($event)"
            (keydown)="teclar($event)"
            (blur)="fecharDepois()"
          />
        </div>
        @if (aberto()) {
          <div class="vinculo__lista" [id]="idLista" role="listbox" [attr.aria-label]="rotulo()">
            @if (carregando() && !resultados().length) {
              <p class="vinculo__aviso" role="presentation">Buscando…</p>
            } @else if (falhou()) {
              <p class="vinculo__aviso" role="presentation">{{ falhou() }}</p>
            } @else {
              @for (grupo of grupos(); track grupo.tipo) {
                <div
                  class="vinculo__grupo"
                  role="group"
                  [attr.aria-labelledby]="id + '-' + grupo.tipo"
                >
                  <p class="vinculo__grupo-titulo" role="presentation" [id]="id + '-' + grupo.tipo">
                    {{ grupo.rotulo }}
                  </p>
                  @for (item of grupo.itens; track item.vinculo.id) {
                    <div
                      class="vinculo__opcao"
                      role="option"
                      [id]="idOpcao(item.indice)"
                      [class.vinculo__opcao--ativa]="item.indice === ativo()"
                      [attr.aria-selected]="item.indice === ativo()"
                      (pointerdown)="$event.preventDefault()"
                      (click)="escolher(item.vinculo)"
                    >
                      <span class="vinculo__icone" aria-hidden="true">
                        <svg [lucideIcon]="icone(item.vinculo.tipo)" [size]="16" />
                      </span>
                      <span class="vinculo__texto">
                        <span class="vinculo__nome">{{ item.vinculo.nome }}</span>
                        @if (item.vinculo.detalhe) {
                          <span class="vinculo__tipo">{{ item.vinculo.detalhe }}</span>
                        }
                      </span>
                    </div>
                  }
                </div>
              } @empty {
                <p class="vinculo__aviso" role="presentation">
                  Nada encontrado para “{{ texto().trim() }}”.
                </p>
              }
            }
          </div>
        }
      }
    </app-moldura-campo>
    <span class="visualmente-oculto" aria-live="polite">{{ anuncio() }}</span>
  `,
  styleUrl: './seletor-vinculo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'seletor-vinculo' },
})
export class SeletorVinculo {
  private readonly api = inject(AtividadesApi);
  private readonly injector = inject(Injector);

  readonly vinculo = model<Vinculo | null>(null);
  readonly rotulo = input('Contato, empresa ou negócio');
  readonly placeholder = input('Buscar pelo nome');
  readonly dica = input<string | null>(null);
  readonly erro = input<string | null>(null);
  readonly opcional = input(true, { transform: booleanAttribute });

  protected readonly id = gerarId('vinculo');
  protected readonly idLista = `${this.id}-lista`;
  protected readonly idDica = `${this.id}-dica`;
  protected readonly idErro = `${this.id}-erro`;

  protected readonly texto = signal('');
  protected readonly aberto = signal(false);
  protected readonly carregando = signal(false);
  protected readonly falhou = signal<string | null>(null);
  protected readonly resultados = signal<readonly Vinculo[]>([]);
  protected readonly ativo = signal(-1);
  protected readonly anuncio = signal('');

  /** Os resultados agrupados por tipo, com o índice de cada um na lista inteira. */
  protected readonly grupos = computed(() => {
    let indice = 0;
    return GRUPOS.map((grupo) => ({
      ...grupo,
      itens: this.resultados()
        .filter((vinculo) => vinculo.tipo === grupo.tipo)
        .map((vinculo) => ({ vinculo, indice: indice++ })),
    })).filter((grupo) => grupo.itens.length > 0);
  });
  /** A ordem visível (por grupo), que é a das setas. */
  private readonly ordem = computed(() =>
    this.grupos().flatMap((grupo) => grupo.itens.map((item) => item.vinculo)),
  );
  protected readonly idAtivo = computed(() =>
    this.aberto() && this.ativo() >= 0 ? this.idOpcao(this.ativo()) : null,
  );
  protected readonly descricao = computed(
    () =>
      [this.erro() ? this.idErro : null, this.dica() ? this.idDica : null]
        .filter(Boolean)
        .join(' ') || null,
  );

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly botaoTirar = viewChild<ElementRef<HTMLButtonElement>>('tirar');
  private espera: ReturnType<typeof setTimeout> | undefined;
  private esperaFechar: ReturnType<typeof setTimeout> | undefined;
  private consulta = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.espera);
      clearTimeout(this.esperaFechar);
    });
  }

  /** Põe o foco no campo (ou no botão de tirar, com vínculo escolhido). */
  focar(): void {
    (this.campo() ?? this.botaoTirar())?.nativeElement.focus();
  }

  protected icone(tipo: Vinculo['tipo']): LucideIcon {
    return ICONE_DO_VINCULO[tipo];
  }

  protected rotuloTipo(tipo: Vinculo['tipo']): string {
    return ROTULO_DO_VINCULO[tipo];
  }

  protected idOpcao(indice: number): string {
    return `${this.id}-opcao-${indice}`;
  }

  protected digitar(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.texto.set(texto);
    clearTimeout(this.espera);
    if (texto.trim().length < MINIMO_BUSCA) {
      this.consulta++;
      this.fechar();
      return;
    }
    this.espera = setTimeout(() => this.buscar(texto.trim()), ESPERA_BUSCA_MS);
  }

  protected teclar(evento: KeyboardEvent): void {
    const total = this.ordem().length;
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!this.aberto() || total === 0) {
          return;
        }
        evento.preventDefault();
        const passo = evento.key === 'ArrowDown' ? 1 : -1;
        this.ativo.update((atual) => (atual + passo + total) % total);
        return;
      }
      case 'Enter': {
        const escolhido = this.ordem()[this.ativo()];
        if (this.aberto() && escolhido) {
          evento.preventDefault();
          this.escolher(escolhido);
        }
        return;
      }
      case 'Escape':
        if (this.aberto()) {
          // Fecha só a lista: o painel ou o modal em volta continuam abertos.
          evento.preventDefault();
          evento.stopPropagation();
          this.fechar();
        }
        return;
    }
  }

  /** O clique numa opção vem antes do blur (pointerdown cancelado); fechar dá esse tempo. */
  protected fecharDepois(): void {
    clearTimeout(this.esperaFechar);
    this.esperaFechar = setTimeout(() => this.fechar(), 150);
  }

  protected escolher(vinculo: Vinculo): void {
    clearTimeout(this.espera);
    this.consulta++;
    this.vinculo.set(vinculo);
    this.texto.set('');
    this.fechar();
    this.anuncio.set(
      `Vinculado a ${ROTULO_DO_VINCULO[vinculo.tipo].toLowerCase()} ${vinculo.nome}.`,
    );
    afterNextRender(() => this.botaoTirar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected tirarVinculo(): void {
    const anterior = this.vinculo();
    this.vinculo.set(null);
    this.anuncio.set(anterior ? `Vínculo com ${anterior.nome} retirado.` : '');
    afterNextRender(() => this.campo()?.nativeElement.focus(), { injector: this.injector });
  }

  private async buscar(texto: string): Promise<void> {
    const consulta = ++this.consulta;
    this.aberto.set(true);
    this.carregando.set(true);
    this.falhou.set(null);
    try {
      const resultados = await this.api.buscarVinculos(texto);
      if (consulta !== this.consulta) {
        return;
      }
      this.resultados.set(resultados);
      this.ativo.set(resultados.length ? 0 : -1);
      this.anuncio.set(
        resultados.length === 0
          ? 'Nenhum resultado.'
          : resultados.length === 1
            ? '1 resultado. Use as setas para escolher.'
            : `${resultados.length} resultados. Use as setas para escolher.`,
      );
    } catch (falha) {
      if (consulta !== this.consulta) {
        return;
      }
      this.resultados.set([]);
      this.falhou.set(erroDaApi(falha).resumo);
    } finally {
      if (consulta === this.consulta) {
        this.carregando.set(false);
      }
    }
  }

  private fechar(): void {
    this.aberto.set(false);
    this.ativo.set(-1);
    this.resultados.set([]);
    this.falhou.set(null);
  }
}
