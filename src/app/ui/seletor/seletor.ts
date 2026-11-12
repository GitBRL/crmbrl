import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';

import { CampoBase } from '../campo/campo-base';
import { type MensagensErro } from '../campo/mensagens-erro';
import { MolduraCampo } from '../campo/moldura-campo';

/** Uma opção do seletor. O valor pode ser de qualquer tipo (id, objeto, enum). */
export interface OpcaoSeletor<T = unknown> {
  readonly valor: T;
  readonly rotulo: string;
  readonly desabilitada?: boolean;
  /** Opções seguidas com o mesmo grupo ficam sob um `<optgroup>` com este título. */
  readonly grupo?: string;
}

interface BlocoDeOpcoes<T> {
  readonly grupo: string | null;
  readonly itens: readonly { readonly opcao: OpcaoSeletor<T>; readonly indice: number }[];
}

/**
 * Seletor (DESIGN-SYSTEM.md §4.2): o `<select>` nativo numa pílula com seta. Nativo de
 * propósito: lista do sistema no celular, teclado e leitor de tela completos. O valor é o
 * `valor` da opção (de qualquer tipo; compare objetos com `comparar`), `null` sem escolha.
 *
 * A primeira linha é o `placeholder` ("Escolha uma opção"): não pode ser escolhida de volta,
 * a não ser com `permitirVazio` (então é "nenhum", ex.: "Sem líder").
 *
 * `<app-seletor rotulo="Papel" [opcoes]="papeis" formControlName="papel" />`
 */
@Component({
  selector: 'app-seletor',
  imports: [MolduraCampo, LucideChevronDown],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idDica]="idDica"
      [idErro]="idErro"
      [dica]="dica()"
      [erro]="mensagemErro()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
      [rotuloOculto]="rotuloOculto()"
    >
      <div
        class="controle"
        [class.controle--invalido]="!!mensagemErro()"
        [class.controle--desabilitado]="estaDesabilitado()"
        [class.controle--vazio]="indiceSelecionado() < 0"
      >
        <select
          #campo
          class="controle__campo"
          [id]="id"
          [attr.name]="nome()"
          [attr.aria-required]="requerido() || null"
          [disabled]="estaDesabilitado()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (change)="aoEscolher($event)"
          (blur)="tocar()"
        >
          <option value="" [disabled]="!permitirVazio()" [selected]="indiceSelecionado() < 0">
            {{ placeholder() }}
          </option>
          @for (bloco of blocos(); track $index) {
            @if (bloco.grupo) {
              <optgroup [label]="bloco.grupo">
                @for (item of bloco.itens; track item.indice) {
                  <option
                    [value]="item.indice"
                    [disabled]="!!item.opcao.desabilitada"
                    [selected]="item.indice === indiceSelecionado()"
                  >
                    {{ item.opcao.rotulo }}
                  </option>
                }
              </optgroup>
            } @else {
              @for (item of bloco.itens; track item.indice) {
                <option
                  [value]="item.indice"
                  [disabled]="!!item.opcao.desabilitada"
                  [selected]="item.indice === indiceSelecionado()"
                >
                  {{ item.opcao.rotulo }}
                </option>
              }
            }
          }
        </select>
        <svg lucideChevronDown class="controle__seta" [size]="18" />
      </div>
    </app-moldura-campo>
  `,
  styleUrl: './seletor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'seletor' },
})
export class Seletor<T = unknown> extends CampoBase<T | null> {
  readonly valor = model<T | null>(null);
  readonly opcoes = input.required<readonly OpcaoSeletor<T>[]>();
  readonly nome = input<string | null>(null);
  readonly placeholder = input('Escolha uma opção');
  /** A primeira linha pode ser escolhida e volta o valor a `null` (diga o que ela significa). */
  readonly permitirVazio = input(false, { transform: booleanAttribute });
  /** Compara o valor com o de cada opção (padrão `Object.is`; para objetos, compare ids). */
  readonly comparar = input<(a: T | null, b: T) => boolean>(Object.is);

  protected override readonly mensagensPadrao: MensagensErro = { required: 'Escolha uma opção.' };

  protected readonly blocos = computed<readonly BlocoDeOpcoes<T>[]>(() => {
    const blocos: { grupo: string | null; itens: { opcao: OpcaoSeletor<T>; indice: number }[] }[] =
      [];
    this.opcoes().forEach((opcao, indice) => {
      const grupo = opcao.grupo ?? null;
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.grupo === grupo) {
        ultimo.itens.push({ opcao, indice });
      } else {
        blocos.push({ grupo, itens: [{ opcao, indice }] });
      }
    });
    return blocos;
  });

  protected readonly indiceSelecionado = computed(() => {
    const valor = this.valor();
    if (valor === null) {
      return -1;
    }
    const comparar = this.comparar();
    return this.opcoes().findIndex((opcao) => comparar(valor, opcao.valor));
  });

  protected override normalizar(valor: unknown): T | null {
    return valor === undefined ? null : (valor as T | null);
  }

  protected aoEscolher(evento: Event): void {
    const texto = (evento.target as HTMLSelectElement).value;
    const opcao = texto === '' ? undefined : this.opcoes()[Number(texto)];
    this.definirValor(opcao ? opcao.valor : null);
  }
}
