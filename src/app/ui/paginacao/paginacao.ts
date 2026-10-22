import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideArrowLeft, LucideArrowRight } from '@lucide/angular';

import { BotaoIcone } from '../botao-icone/botao-icone';
import { gerarId } from '../tipos';

type ItemPagina =
  | { readonly tipo: 'pagina'; readonly numero: number }
  | { readonly tipo: 'reticencias'; readonly chave: string };

const numero = new Intl.NumberFormat('pt-BR');

/**
 * Paginação (DESIGN-SYSTEM.md §4.3) das listas `?pagina=&porPagina=` → `{ itens, total,
 * pagina, porPagina }`. Mostra "21–40 de 134", anterior/próxima (botões-ícone) e as páginas
 * em pílulas com reticências (1 … 4 5 6 … 12); a atual fica invertida e tem
 * `aria-current="page"`. Abaixo de 600px, só "Página 2 de 7" entre as setas. Com
 * `opcoesPorPagina`, um seletor "Por página" muda `[(porPagina)]` e volta para a página 1.
 *
 * Anterior/próxima nas pontas ficam `aria-disabled` (não perdem o foco). Listas por cursor
 * (auditoria, logs) usam um botão "Carregar mais", não esta paginação.
 *
 * `<app-paginacao [total]="total()" [porPagina]="20" [(pagina)]="pagina" rotulo="Paginação dos contatos" />`
 */
@Component({
  selector: 'app-paginacao',
  imports: [BotaoIcone],
  template: `
    <nav class="paginacao" [attr.aria-label]="rotulo()">
      <p class="paginacao__resumo" aria-live="polite">{{ resumo() }}</p>
      @if (totalPaginas() > 1) {
        <div class="paginacao__controles">
          <button
            appBotaoIcone
            type="button"
            variante="contorno"
            tamanho="sm"
            rotulo="Página anterior"
            [icone]="iconeAnterior"
            [attr.aria-disabled]="pagina() <= 1 || null"
            (click)="ir(pagina() - 1)"
          ></button>
          <ol class="paginacao__paginas" role="list">
            @for (item of itens(); track item.tipo === 'pagina' ? item.numero : item.chave) {
              <li>
                @if (item.tipo === 'pagina') {
                  <button
                    type="button"
                    class="paginacao__pagina"
                    [attr.aria-current]="item.numero === pagina() ? 'page' : null"
                    [attr.aria-label]="'Página ' + item.numero"
                    (click)="ir(item.numero)"
                  >
                    {{ item.numero }}
                  </button>
                } @else {
                  <span class="paginacao__reticencias" aria-hidden="true">…</span>
                }
              </li>
            }
          </ol>
          <span class="paginacao__compacto">Página {{ pagina() }} de {{ totalPaginas() }}</span>
          <button
            appBotaoIcone
            type="button"
            variante="contorno"
            tamanho="sm"
            rotulo="Próxima página"
            [icone]="iconeProxima"
            [attr.aria-disabled]="pagina() >= totalPaginas() || null"
            (click)="ir(pagina() + 1)"
          ></button>
        </div>
      }
      @if (opcoesPorPagina(); as opcoes) {
        <div class="paginacao__por-pagina">
          <label [for]="id">Por página</label>
          <select [id]="id" class="paginacao__seletor" (change)="mudarPorPagina($event)">
            @for (opcao of opcoes; track opcao) {
              <option [value]="opcao" [selected]="opcao === porPagina()">{{ opcao }}</option>
            }
          </select>
        </div>
      }
    </nav>
  `,
  styleUrl: './paginacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'paginacao-host' },
})
export class Paginacao {
  readonly total = input.required<number>();
  /** Página atual, começando em 1. */
  readonly pagina = model(1);
  readonly porPagina = model(20);
  /** Opções do seletor "Por página" (ex.: `[20, 50, 100]`); sem elas, não aparece. */
  readonly opcoesPorPagina = input<readonly number[] | null>(null);
  /** Nome do marco de navegação ("Paginação dos contatos"). */
  readonly rotulo = input('Paginação');

  protected readonly iconeAnterior = LucideArrowLeft;
  protected readonly iconeProxima = LucideArrowRight;
  protected readonly id = gerarId('por-pagina');

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.porPagina()))),
  );

  protected readonly resumo = computed(() => {
    const total = this.total();
    if (total === 0) {
      return 'Nenhum item';
    }
    const inicio = (this.pagina() - 1) * this.porPagina() + 1;
    const fim = Math.min(total, this.pagina() * this.porPagina());
    return `${numero.format(inicio)}–${numero.format(fim)} de ${numero.format(total)}`;
  });

  /** Até 7 posições: primeira, última, a atual com as vizinhas e reticências. */
  protected readonly itens = computed<readonly ItemPagina[]>(() => {
    const total = this.totalPaginas();
    const atual = Math.min(Math.max(1, this.pagina()), total);
    const pagina = (n: number): ItemPagina => ({ tipo: 'pagina', numero: n });
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => pagina(i + 1));
    }
    const inicio = Math.max(2, Math.min(atual - 1, total - 4));
    const fim = Math.min(total - 1, Math.max(atual + 1, 5));
    const meio = Array.from({ length: fim - inicio + 1 }, (_, i) => pagina(inicio + i));
    return [
      pagina(1),
      ...(inicio > 2 ? [{ tipo: 'reticencias', chave: 'antes' } as const] : []),
      ...meio,
      ...(fim < total - 1 ? [{ tipo: 'reticencias', chave: 'depois' } as const] : []),
      pagina(total),
    ];
  });

  protected ir(destino: number): void {
    const pagina = Math.min(Math.max(1, destino), this.totalPaginas());
    if (pagina !== this.pagina()) {
      this.pagina.set(pagina);
    }
  }

  protected mudarPorPagina(evento: Event): void {
    this.porPagina.set(Number((evento.target as HTMLSelectElement).value));
    this.pagina.set(1);
  }
}
