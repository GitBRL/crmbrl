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

/**
 * Área de texto (DESIGN-SYSTEM.md §4.2): o campo de várias linhas, com `--raio-md`. Cresce
 * com o texto até `maximoLinhas` (onde o navegador suporta `field-sizing`); com
 * `maximoCaracteres`, mostra a contagem ("120 de 500"). `monoespacado` para JSON e código
 * (mapeamento de webhook, cabeçalhos).
 *
 * `<app-area-texto rotulo="Motivo da perda" formControlName="motivo" [maximoCaracteres]="500" />`
 */
@Component({
  selector: 'app-area-texto',
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
        class="area"
        [class.controle--invalido]="!!mensagemErro()"
        [class.controle--desabilitado]="estaDesabilitado()"
      >
        <textarea
          #campo
          class="area__campo"
          [class.area__campo--mono]="monoespacado()"
          [id]="id"
          [rows]="linhas()"
          [style.--_linhas]="linhas()"
          [style.--_max-linhas]="maximoLinhas()"
          [attr.name]="nome()"
          [attr.placeholder]="placeholder()"
          [attr.maxlength]="maximoCaracteres()"
          [attr.spellcheck]="monoespacado() ? false : null"
          [attr.aria-required]="requerido() || null"
          [disabled]="estaDesabilitado()"
          [readOnly]="somenteLeitura()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (input)="aoDigitar($event)"
          (blur)="tocar()"
        ></textarea>
      </div>
      @if (maximoCaracteres(); as maximo) {
        <p class="area__contagem" aria-hidden="true">{{ valor().length }} de {{ maximo }}</p>
        <p class="visualmente-oculto" [id]="id + '-contagem'">Até {{ maximo }} caracteres.</p>
      }
    </app-moldura-campo>
  `,
  styleUrl: './area-texto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'area-texto' },
})
export class AreaTexto extends CampoBase<string> {
  readonly valor = model('');
  readonly nome = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  /** Altura inicial, em linhas. */
  readonly linhas = input(4);
  /** Até onde cresce antes de rolar. */
  readonly maximoLinhas = input(12);
  readonly maximoCaracteres = input<number | null>(null);
  readonly monoespacado = input(false, { transform: booleanAttribute });
  readonly somenteLeitura = input(false, { transform: booleanAttribute });

  protected readonly temContagem = computed(() => this.maximoCaracteres() !== null);

  constructor() {
    super();
    this.sincronizarTexto((valor) => valor);
  }

  protected override normalizar(valor: unknown): string {
    return valor === null || valor === undefined ? '' : String(valor);
  }

  protected override idsDescricaoExtra(): readonly string[] {
    return this.temContagem() ? [`${this.id}-contagem`] : [];
  }

  protected aoDigitar(evento: Event): void {
    this.lerDoCampo((evento.target as HTMLTextAreaElement).value);
  }
}
