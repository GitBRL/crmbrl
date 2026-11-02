import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

import { gerarId } from '../tipos';

/** Um filtro. `contagem` aparece num selo ao lado do rótulo (ex.: quantos negócios). */
export interface OpcaoFiltro {
  readonly id: string;
  readonly rotulo: string;
  readonly icone?: LucideIconInput;
  readonly contagem?: number | null;
  readonly desabilitada?: boolean;
  /** Por que está desabilitada (vira o `title` e a descrição para leitores de tela). */
  readonly motivo?: string;
}

/**
 * Filtros em pílula (DESIGN-SYSTEM.md §4.2): a linha de filtros no topo das listas ("Meus ·
 * Da equipe · Todos", etiquetas). Cada filtro é um botão com `aria-pressed`; o ligado fica
 * **invertido**. No celular a linha rola na horizontal até a borda (`.rolagem-horizontal`).
 *
 * - `multipla` falso (padrão): um ligado por vez; `[(selecionado)]` é o id (ou `null`).
 * - `multipla`: liga e desliga cada um; `[(selecionados)]` é a lista de ids.
 *
 * `<app-filtros-pilula rotulo="Mostrar" [opcoes]="escopos" [(selecionado)]="escopo" />`
 */
@Component({
  selector: 'app-filtros-pilula',
  imports: [LucideDynamicIcon],
  template: `
    <div class="filtros rolagem-horizontal" role="group" [attr.aria-label]="rotulo()">
      @for (opcao of opcoes(); track opcao.id) {
        <button
          type="button"
          class="filtro"
          [class.filtro--com-icone]="!!opcao.icone"
          [attr.aria-pressed]="estaLigado(opcao.id)"
          [attr.aria-disabled]="opcao.desabilitada || null"
          [attr.aria-describedby]="opcao.desabilitada && opcao.motivo ? idMotivo(opcao.id) : null"
          [attr.title]="opcao.desabilitada ? opcao.motivo : null"
          (click)="alternar(opcao)"
        >
          @if (opcao.icone) {
            <span class="filtro__icone" aria-hidden="true">
              <svg [lucideIcon]="opcao.icone" [size]="16" />
            </span>
          }
          {{ opcao.rotulo }}
          @if (opcao.contagem !== undefined && opcao.contagem !== null) {
            <span class="filtro__contagem">{{ opcao.contagem }}</span>
          }
        </button>
        @if (opcao.desabilitada && opcao.motivo) {
          <span class="visualmente-oculto" [id]="idMotivo(opcao.id)">{{ opcao.motivo }}</span>
        }
      }
    </div>
  `,
  styleUrl: './filtros-pilula.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'filtros-pilula' },
})
export class FiltrosPilula {
  readonly opcoes = input.required<readonly OpcaoFiltro[]>();
  /** Nome do grupo para leitores de tela ("Mostrar negócios", "Etiquetas"). */
  readonly rotulo = input.required<string>();
  readonly multipla = input(false, { transform: booleanAttribute });
  /** Escolha única: o id ligado. */
  readonly selecionado = model<string | null>(null);
  /** Escolha múltipla: os ids ligados. */
  readonly selecionados = model<readonly string[]>([]);

  private readonly prefixo = gerarId('filtros');
  private readonly ligados = computed(
    () => new Set(this.multipla() ? this.selecionados() : [this.selecionado()]),
  );

  protected estaLigado(id: string): boolean {
    return this.ligados().has(id);
  }

  protected idMotivo(id: string): string {
    return `${this.prefixo}-${id}-motivo`;
  }

  protected alternar(opcao: OpcaoFiltro): void {
    if (opcao.desabilitada) {
      return;
    }
    if (!this.multipla()) {
      this.selecionado.set(opcao.id);
      return;
    }
    const atuais = this.selecionados();
    this.selecionados.set(
      atuais.includes(opcao.id) ? atuais.filter((id) => id !== opcao.id) : [...atuais, opcao.id],
    );
  }
}
