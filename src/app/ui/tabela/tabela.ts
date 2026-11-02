import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  model,
  output,
  signal,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowDown, LucideArrowUp, LucideArrowUpDown } from '@lucide/angular';

import { Esqueleto } from '../esqueleto/esqueleto';
import { gerarId } from '../tipos';
import { CelulaTabela, type ContextoCelula } from './celula-tabela';

/** Uma coluna da tabela. */
export interface ColunaTabela {
  readonly id: string;
  readonly rotulo: string;
  readonly ordenavel?: boolean;
  /** Números e valores à direita (`fim`). */
  readonly alinhar?: 'inicio' | 'centro' | 'fim';
  /** Largura em CSS ("12rem", "20%"); sem ela, a coluna se ajusta ao conteúdo. */
  readonly largura?: string;
  /**
   * Na lista de cartões (tela estreita): `titulo` abre o cartão (padrão da coluna principal),
   * `mostrar` vira "rótulo: valor" (padrão), `ocultar` some.
   */
  readonly noCartao?: 'titulo' | 'mostrar' | 'ocultar';
  /** Cabeçalho só para leitores de tela (coluna de ações). */
  readonly rotuloOculto?: boolean;
  /**
   * Fica presa na borda direita quando a tabela rola na horizontal (a coluna de ações "⋯",
   * para nunca sumir em telas de notebook). O fundo dela é o de onde a tabela está: o da página
   * ou, dentro de um `app-cartao`, a superfície do cartão (`--tabela-fundo` define à mão).
   */
  readonly fixa?: boolean;
}

export type DirecaoOrdenacao = 'asc' | 'desc';

export interface Ordenacao {
  readonly coluna: string;
  readonly direcao: DirecaoOrdenacao;
}

interface ColunaVisual extends ColunaTabela {
  readonly classes: string;
  readonly ariaSort: 'ascending' | 'descending' | null;
  readonly direcao: DirecaoOrdenacao | null;
}

const NOME_DIRECAO: Readonly<Record<DirecaoOrdenacao, string>> = {
  asc: 'crescente',
  desc: 'decrescente',
};

/**
 * Tabela (DESIGN-SYSTEM.md §4.3): cabeçalho com ordenação (`aria-sort`), linhas que abrem o
 * detalhe e, em contêiner estreito (< 40rem, por container query), **lista de cartões** — a
 * coluna principal vira o título do cartão e as outras, "rótulo: valor"; a ordenação passa a
 * um seletor acima dos cartões.
 *
 * - Células: texto de `linha[coluna.id]` ou um modelo `<ng-template appCelula="id" let-linha>`.
 * - Abrir: com `link` (função → `routerLink`) ou `clicavel` + `(abrir)`, o conteúdo da coluna
 *   principal vira o link/botão e a linha inteira responde ao clique (o link se estica sobre
 *   ela); pelo teclado, Tab chega no link e Enter abre. Outros botões da linha continuam
 *   clicáveis por cima.
 * - `carregando`: linhas-esqueleto, `aria-busy` e "Carregando…" para leitores de tela.
 * - Vazia: mostra o conteúdo projetado com o atributo `tabela-vazio` (um `app-estado-vazio`).
 * - `[(ordenacao)]`: a tela ordena (na API ou na memória); a tabela só mostra e pede.
 *
 * `<app-tabela rotulo="Contatos" [colunas]="colunas" [linhas]="contatos()" [link]="linkDoContato" />`
 */
@Component({
  selector: 'app-tabela',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    Esqueleto,
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
  ],
  templateUrl: './tabela.html',
  styleUrl: './tabela.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabela-host' },
})
export class Tabela<T = unknown> {
  /** Nome da tabela (legenda para leitores de tela): "Contatos", "Usuários". */
  readonly rotulo = input.required<string>();
  readonly colunas = input.required<readonly ColunaTabela[]>();
  readonly linhas = input<readonly T[]>([]);
  /** Identidade de cada linha para o `@for` (padrão: `linha.id`, ou a posição). */
  readonly chave = input<(linha: T, indice: number) => unknown>(
    (linha, indice) => (linha as { id?: unknown } | null)?.id ?? indice,
  );
  readonly ordenacao = model<Ordenacao | null>(null);
  readonly carregando = input(false, { transform: booleanAttribute });
  readonly linhasEsqueleto = input(5);
  /** Linhas de 44px (auditoria, logs) em vez de 56px. */
  readonly densa = input(false, { transform: booleanAttribute });
  /** Linha que abre uma rota: devolve o `routerLink` da linha. */
  readonly link = input<((linha: T) => string | readonly unknown[]) | null>(null);
  /** Linha que abre por evento (painel lateral sem rota): emite `(abrir)`. */
  readonly clicavel = input(false, { transform: booleanAttribute });
  /** Coluna cujo conteúdo vira o link/botão da linha (padrão: a primeira). */
  readonly colunaPrincipal = input<string | null>(null);
  readonly abrir = output<T>();

  private readonly celulas = contentChildren(CelulaTabela);
  protected readonly id = gerarId('tabela');
  /** Frase do `role="status"`: carregando ou a ordenação escolhida. */
  private readonly anuncioOrdem = signal('');

  protected readonly modelos = computed(
    () =>
      new Map<string, TemplateRef<ContextoCelula<unknown>>>(
        this.celulas().map((celula) => [celula.coluna(), celula.modelo]),
      ),
  );

  protected readonly principal = computed(
    () => this.colunaPrincipal() ?? this.colunas()[0]?.id ?? null,
  );

  protected readonly temAbrir = computed(() => this.link() !== null || this.clicavel());

  protected readonly colunasVisuais = computed<readonly ColunaVisual[]>(() => {
    const ordem = this.ordenacao();
    const principal = this.principal();
    return this.colunas().map((coluna) => {
      const noCartao = coluna.noCartao ?? (coluna.id === principal ? 'titulo' : 'mostrar');
      const direcao = ordem?.coluna === coluna.id ? ordem.direcao : null;
      const classes = [
        'tabela__celula',
        coluna.alinhar === 'fim' ? 'tabela__celula--fim' : '',
        coluna.alinhar === 'centro' ? 'tabela__celula--centro' : '',
        noCartao === 'titulo' ? 'tabela__celula--titulo' : '',
        noCartao === 'ocultar' ? 'tabela__celula--ocultar-cartao' : '',
        coluna.rotuloOculto ? 'tabela__celula--sem-rotulo' : '',
        coluna.fixa ? 'tabela__celula--fixa' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return {
        ...coluna,
        classes,
        direcao,
        ariaSort: direcao === 'asc' ? 'ascending' : direcao === 'desc' ? 'descending' : null,
      };
    });
  });

  protected readonly vazia = computed(() => !this.carregando() && this.linhas().length === 0);

  /** Larguras variadas para as linhas-esqueleto não parecerem uma grade. */
  protected readonly esqueleto = computed(() =>
    Array.from({ length: this.linhasEsqueleto() }, (_, linha) =>
      this.colunas().map((_coluna, coluna) => `${45 + ((linha * 17 + coluna * 31) % 45)}%`),
    ),
  );

  /** Ordenação no modo cartões: as colunas ordenáveis nos dois sentidos. */
  protected readonly opcoesOrdenacao = computed(() =>
    this.colunas()
      .filter((coluna) => coluna.ordenavel)
      .flatMap((coluna) =>
        (['asc', 'desc'] as const).map((direcao) => ({
          valor: `${coluna.id}:${direcao}`,
          rotulo: `${coluna.rotulo} · ${NOME_DIRECAO[direcao]}`,
        })),
      ),
  );

  protected readonly valorOrdenacao = computed(() => {
    const ordem = this.ordenacao();
    return ordem ? `${ordem.coluna}:${ordem.direcao}` : '';
  });

  protected readonly anuncio = computed(() =>
    this.carregando() ? `Carregando ${this.rotulo().toLowerCase()}…` : this.anuncioOrdem(),
  );

  protected rastrear(indice: number, linha: T): unknown {
    return this.chave()(linha, indice);
  }

  protected contexto(linha: T, indice: number): ContextoCelula<T> {
    return { $implicit: linha, linha, indice };
  }

  protected textoPadrao(linha: T, coluna: string): string {
    const valor = (linha as Record<string, unknown> | null)?.[coluna];
    return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
  }

  protected ordenarPor(coluna: ColunaVisual): void {
    const direcao: DirecaoOrdenacao = coluna.direcao === 'asc' ? 'desc' : 'asc';
    this.definirOrdenacao({ coluna: coluna.id, direcao });
  }

  protected ordenarPeloSeletor(evento: Event): void {
    const [coluna, direcao] = (evento.target as HTMLSelectElement).value.split(':');
    this.definirOrdenacao(
      coluna && (direcao === 'asc' || direcao === 'desc') ? { coluna, direcao } : null,
    );
  }

  private definirOrdenacao(ordem: Ordenacao | null): void {
    this.ordenacao.set(ordem);
    const coluna = ordem && this.colunas().find((item) => item.id === ordem.coluna);
    this.anuncioOrdem.set(
      coluna && ordem
        ? `Ordenado por ${coluna.rotulo}, ${NOME_DIRECAO[ordem.direcao]}.`
        : 'Ordem padrão.',
    );
  }
}
