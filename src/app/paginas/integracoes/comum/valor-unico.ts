import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

import { gerarId } from '../../../ui/tipos';
import { BotaoCopiar } from './botao-copiar';

/**
 * Um valor que a API mostra **uma única vez** (endereço de um webhook de entrada, segredo
 * HMAC): rótulo, o valor numa pílula monoespaçada que pode ser selecionada e o botão
 * "Copiar", com o aviso de que depois ele só aparece mascarado.
 *
 * `<app-valor-unico rotulo="Endereço do webhook" [valor]="url" oQue="Endereço" />`
 */
@Component({
  selector: 'app-valor-unico',
  imports: [BotaoCopiar, LucideTriangleAlert],
  template: `
    <div class="valor">
      <span class="valor__rotulo" [id]="id">{{ rotulo() }}</span>
      <div class="valor__linha">
        <output #campoValor class="valor__texto" [attr.aria-labelledby]="id">{{ valor() }}</output>
        <app-botao-copiar
          [texto]="valor()"
          [oQue]="oQue()"
          variante="invertido"
          (falhou)="selecionarValor()"
        />
      </div>
      @if (aviso(); as texto) {
        <p class="valor__aviso">
          <svg lucideTriangleAlert [size]="16" />
          <span>{{ texto }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .valor {
      display: grid;
      gap: var(--esp-2);
    }

    .valor__rotulo {
      font: var(--fonte-rotulo);
    }

    .valor__linha {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      min-width: 0;
      min-height: var(--altura-md);
      padding: var(--esp-1) var(--esp-1) var(--esp-1) var(--esp-4);
      border: 1px solid var(--cor-borda-forte);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    /* Quebra em qualquer ponto: o valor aparece uma vez só e precisa ser lido inteiro. */
    .valor__texto {
      flex: 1;
      min-width: 0;
      padding-block: var(--esp-2);
      font-family: var(--familia-mono);
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      word-break: break-all;
      user-select: all;
    }

    .valor__aviso {
      display: flex;
      align-items: flex-start;
      gap: var(--esp-2);
      color: var(--cor-aviso);
      font: var(--fonte-legenda-lg);
      font-weight: 500;

      svg {
        flex: none;
        margin-top: 1px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValorUnico {
  readonly rotulo = input.required<string>();
  readonly valor = input.required<string>();
  /** Para o botão e o aviso: "Endereço", "Segredo". */
  readonly oQue = input('Valor');
  readonly aviso = input<string | null>('Copie agora: depois ele só aparece mascarado.');

  protected readonly id = gerarId('valor-unico');
  private readonly campoValor = viewChild.required<ElementRef<HTMLElement>>('campoValor');

  /** Sem cópia automática: deixa o valor selecionado, pronto para o Ctrl+C. */
  protected selecionarValor(): void {
    const elemento = this.campoValor().nativeElement;
    const selecao = elemento.ownerDocument.defaultView?.getSelection();
    if (!selecao) {
      return;
    }
    const trecho = elemento.ownerDocument.createRange();
    trecho.selectNodeContents(elemento);
    selecao.removeAllRanges();
    selecao.addRange(trecho);
  }
}
