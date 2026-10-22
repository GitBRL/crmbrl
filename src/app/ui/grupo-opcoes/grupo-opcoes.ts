import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';

import { CampoBase } from '../campo/campo-base';
import { type MensagensErro } from '../campo/mensagens-erro';
import { Dica } from '../dica/dica';

/** Uma opção do grupo. `dica` é a descrição curta abaixo do rótulo. */
export interface OpcaoGrupo<T = unknown> {
  readonly valor: T;
  readonly rotulo: string;
  readonly dica?: string;
  readonly icone?: LucideIconInput;
  readonly desabilitada?: boolean;
}

/**
 * Grupo de opções (DESIGN-SYSTEM.md §4.2): escolha **uma** entre poucas opções visíveis
 * (até ~6; mais que isso, `app-seletor`). Rádios nativos com o mesmo `name` (setas mudam a
 * escolha, Tab entra e sai do grupo) num `role="radiogroup"` nomeado pelo rótulo.
 *
 * - `disposicao="lista"`: uma opção por linha, com círculo e descrição (tipo de passagem,
 *   modelo de mapeamento);
 * - `disposicao="pilulas"`: pílulas lado a lado, com ícone opcional; a escolhida fica
 *   invertida (tipo de atividade: Ligação, Reunião, Tarefa).
 *
 * `<app-grupo-opcoes rotulo="Tipo" [opcoes]="tipos" disposicao="pilulas" formControlName="tipo" />`
 */
@Component({
  selector: 'app-grupo-opcoes',
  imports: [Dica, LucideDynamicIcon],
  template: `
    <div
      #campo
      class="grupo"
      role="radiogroup"
      [attr.aria-labelledby]="id + '-rotulo'"
      [attr.aria-required]="requerido() || null"
      [attr.aria-invalid]="mensagemErro() ? true : null"
      [attr.aria-describedby]="descricao()"
    >
      <div class="grupo__topo" [class.visualmente-oculto]="rotuloOculto()">
        <span class="grupo__rotulo" [id]="id + '-rotulo'"
          >{{ rotulo() }}
          @if (opcional()) {
            <span class="grupo__opcional"> (opcional)</span>
          }
        </span>
        @if (ajuda(); as texto) {
          <app-dica [rotulo]="'Sobre ' + rotulo()" [texto]="texto" />
        }
      </div>
      @if (dica(); as texto) {
        <p class="grupo__dica" [id]="idDica">{{ texto }}</p>
      }
      <div class="grupo__opcoes" [class.grupo__opcoes--pilulas]="disposicao() === 'pilulas'">
        @for (opcao of opcoes(); track $index) {
          <label
            class="opcao"
            [class.opcao--marcada]="$index === indiceSelecionado()"
            [class.opcao--desabilitada]="estaDesabilitado() || !!opcao.desabilitada"
          >
            <input
              type="radio"
              class="opcao__input"
              [attr.name]="id"
              [value]="$index"
              [checked]="$index === indiceSelecionado()"
              [disabled]="estaDesabilitado() || !!opcao.desabilitada"
              [attr.aria-labelledby]="id + '-op-' + $index"
              [attr.aria-describedby]="opcao.dica ? id + '-op-' + $index + '-dica' : null"
              (change)="definirValor(opcao.valor)"
              (blur)="tocar()"
            />
            @if (opcao.icone) {
              <span class="opcao__icone" aria-hidden="true">
                <svg [lucideIcon]="opcao.icone" [size]="18" />
              </span>
            }
            <span class="opcao__textos">
              <span class="opcao__rotulo" [id]="id + '-op-' + $index">{{ opcao.rotulo }}</span>
              @if (opcao.dica) {
                <span class="opcao__dica" [id]="id + '-op-' + $index + '-dica'">{{
                  opcao.dica
                }}</span>
              }
            </span>
          </label>
        }
      </div>
      @if (mensagemErro(); as mensagem) {
        <p class="grupo__erro" [id]="idErro">{{ mensagem }}</p>
      }
    </div>
  `,
  styleUrl: './grupo-opcoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grupo-opcoes' },
})
export class GrupoOpcoes<T = unknown> extends CampoBase<T | null> {
  readonly valor = model<T | null>(null);
  readonly opcoes = input.required<readonly OpcaoGrupo<T>[]>();
  readonly disposicao = input<'lista' | 'pilulas'>('lista');
  /** Compara o valor com o de cada opção (padrão `Object.is`). */
  readonly comparar = input<(a: T | null, b: T) => boolean>(Object.is);

  protected override readonly mensagensPadrao: MensagensErro = { required: 'Escolha uma opção.' };

  protected readonly indiceSelecionado = computed(() => {
    const valor = this.valor();
    if (valor === null) {
      return -1;
    }
    const comparar = this.comparar();
    return this.opcoes().findIndex((opcao) => comparar(valor, opcao.valor));
  });

  /** Foca a opção escolhida (ou a primeira). */
  override focar(): void {
    const opcoes = this.campoGrupo();
    const alvo =
      opcoes?.querySelector<HTMLInputElement>('input:checked') ??
      opcoes?.querySelector<HTMLInputElement>('input:not(:disabled)');
    alvo?.focus();
  }

  protected override normalizar(valor: unknown): T | null {
    return valor === undefined ? null : (valor as T | null);
  }

  private campoGrupo(): HTMLElement | null {
    return (this.campo()?.nativeElement ?? null) as HTMLElement | null;
  }
}
