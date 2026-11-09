import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';

import { CampoBase } from '../campo/campo-base';
import { MolduraCampo } from '../campo/moldura-campo';

export type TipoCampoTexto = 'text' | 'email' | 'tel' | 'url' | 'number';

/** Valor do campo: texto, ou número (`null` vazio) quando `tipo="number"`. */
export type ValorCampoTexto = string | number | null;

/**
 * Campo de texto (DESIGN-SYSTEM.md §4.2): pílula 44px com rótulo, ajuda e erro ligados por
 * `aria-describedby`. Com `tipo="number"` o valor é número (vazio vira `null`); prefixo e
 * sufixo ("R$", "%", "dias") ficam dentro da pílula e também são lidos pelo leitor de tela.
 *
 * `<app-campo-texto rotulo="E-mail" tipo="email" autocomplete="email" formControlName="email" />`
 */
@Component({
  selector: 'app-campo-texto',
  imports: [MolduraCampo],
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
      >
        @if (prefixo(); as texto) {
          <span class="controle__afixo" [id]="id + '-prefixo'">{{ texto }}</span>
        }
        <input
          #campo
          class="controle__campo"
          [id]="id"
          [type]="tipo()"
          [attr.name]="nome()"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.data-1p-ignore]="autocomplete() === 'off' ? '' : null"
          [attr.data-lpignore]="autocomplete() === 'off' ? 'true' : null"
          [attr.inputmode]="modoTeclado()"
          [attr.maxlength]="maximoCaracteres()"
          [attr.min]="minimo()"
          [attr.max]="maximo()"
          [attr.step]="passo()"
          [attr.spellcheck]="tipo() === 'text' ? null : false"
          [attr.aria-required]="requerido() || null"
          [disabled]="estaDesabilitado()"
          [readOnly]="somenteLeitura()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (input)="aoDigitar($event)"
          (blur)="tocar()"
        />
        @if (sufixo(); as texto) {
          <span class="controle__afixo" [id]="id + '-sufixo'">{{ texto }}</span>
        }
      </div>
    </app-moldura-campo>
  `,
  styleUrl: './campo-texto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-texto' },
})
export class CampoTexto extends CampoBase<ValorCampoTexto> {
  readonly valor = model<ValorCampoTexto>('');
  readonly tipo = input<TipoCampoTexto>('text');
  readonly nome = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  /** `email`, `name`, `tel`, `off`… (ajuda o navegador a preencher). */
  readonly autocomplete = input<string | null>(null);
  /** Teclado no celular (`numeric`, `decimal`, `tel`…). Padrão: o do `tipo`. */
  readonly teclado = input<string | null>(null);
  readonly prefixo = input<string | null>(null);
  readonly sufixo = input<string | null>(null);
  readonly maximoCaracteres = input<number | null>(null);
  readonly minimo = input<number | null>(null);
  readonly maximo = input<number | null>(null);
  readonly passo = input<number | 'any' | null>(null);
  readonly somenteLeitura = input(false, { transform: booleanAttribute });

  protected readonly modoTeclado = computed(
    () => this.teclado() ?? (this.tipo() === 'number' ? 'decimal' : null),
  );

  constructor() {
    super();
    this.sincronizarTexto((valor) => (valor === null ? '' : String(valor)));
  }

  protected override normalizar(valor: unknown): ValorCampoTexto {
    if (valor === null || valor === undefined) {
      return this.tipo() === 'number' ? null : '';
    }
    return typeof valor === 'number' ? valor : String(valor);
  }

  protected override idsDescricaoExtra(): readonly string[] {
    return [
      this.prefixo() ? `${this.id}-prefixo` : null,
      this.sufixo() ? `${this.id}-sufixo` : null,
    ].filter((id): id is string => id !== null);
  }

  protected aoDigitar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (this.tipo() !== 'number') {
      this.lerDoCampo(campo.value);
      return;
    }
    // Número pela metade ("1,"): o navegador ainda não tem valor; não mexe no texto.
    this.lerDoCampo(campo.value === '' || campo.validity?.badInput ? null : Number(campo.value));
  }
}
