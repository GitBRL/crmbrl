import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { LucideCheck, LucideMinus } from '@lucide/angular';

import { CampoBase } from '../campo/campo-base';
import { type MensagensErro } from '../campo/mensagens-erro';
import { Dica } from '../dica/dica';

/**
 * Caixa de seleção (DESIGN-SYSTEM.md §4.2): o `<input type="checkbox">` nativo desenhado
 * como um quadrado de cantos bem redondos (ou círculo, `forma="circulo"`). Marcada, fica
 * **invertida** (branca no escuro) com o visto; `indeterminado` mostra um traço ("alguns").
 * O rótulo fica à direita e a linha inteira tem 44px de alvo; `dica` vira a descrição abaixo
 * (ex.: o que cada evento do webhook faz). `tamanho="lg"` (28px) para "concluir" uma
 * atividade; com `rotuloOculto`, o rótulo fica só para leitores de tela.
 *
 * `<app-caixa-selecao rotulo="Aceito receber novidades" formControlName="optIn" />`
 */
@Component({
  selector: 'app-caixa-selecao',
  imports: [Dica, LucideCheck, LucideMinus],
  template: `
    <div class="caixa">
      <!-- O quadro também é rótulo do campo: os 44px em volta dele marcam e desmarcam. -->
      <label class="caixa__quadro" [for]="id">
        <input
          #campo
          type="checkbox"
          class="caixa__input"
          [id]="id"
          [attr.name]="nome()"
          [checked]="valor()"
          [indeterminate]="indeterminado()"
          [disabled]="estaDesabilitado()"
          [attr.aria-required]="requerido() || null"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (change)="aoMudar($event)"
          (blur)="tocar()"
        />
        <span class="caixa__marca" aria-hidden="true">
          @if (indeterminado()) {
            <svg lucideMinus [size]="tamanho() === 'lg' ? 18 : 14" [strokeWidth]="3" />
          } @else {
            <svg lucideCheck [size]="tamanho() === 'lg' ? 18 : 14" [strokeWidth]="3" />
          }
        </span>
      </label>
      <span class="caixa__topo" [class.visualmente-oculto]="rotuloOculto()">
        <label class="caixa__rotulo" [for]="id">{{ rotulo() }}</label>
        @if (ajuda(); as texto) {
          <app-dica [rotulo]="'Sobre ' + rotulo()" [texto]="texto" />
        }
      </span>
      @if (dica(); as texto) {
        <p class="caixa__dica" [id]="idDica">{{ texto }}</p>
      }
      @if (mensagemErro(); as mensagem) {
        <p class="caixa__erro" [id]="idErro">{{ mensagem }}</p>
      }
    </div>
  `,
  styleUrl: './caixa-selecao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'caixa-selecao',
    '[class.caixa-selecao--lg]': "tamanho() === 'lg'",
    '[class.caixa-selecao--circulo]': "forma() === 'circulo'",
    '[class.caixa-selecao--desabilitada]': 'estaDesabilitado()',
    '[class.caixa-selecao--oculto]': 'rotuloOculto()',
  },
})
export class CaixaSelecao extends CampoBase<boolean> {
  readonly valor = model(false);
  readonly nome = input<string | null>(null);
  /** "Alguns marcados" (ex.: selecionar todos). Some quando o usuário clica. */
  readonly indeterminado = model(false);
  /** `md` 22px · `lg` 28px. A linha tem sempre 44px de alvo. */
  readonly tamanho = input<'md' | 'lg'>('md');
  readonly forma = input<'quadrado' | 'circulo'>('quadrado');

  // `Validators.requiredTrue` também devolve a chave `required`.
  protected override readonly mensagensPadrao: MensagensErro = {
    required: 'Marque esta opção para continuar.',
  };

  protected override normalizar(valor: unknown): boolean {
    return valor === true;
  }

  protected aoMudar(evento: Event): void {
    this.indeterminado.set(false);
    this.definirValor((evento.target as HTMLInputElement).checked);
  }
}
