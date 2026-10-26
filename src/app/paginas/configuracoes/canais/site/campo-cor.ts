import { ChangeDetectionStrategy, Component, model, signal } from '@angular/core';

import { CampoBase } from '../../../../ui/campo/campo-base';
import { MolduraCampo } from '../../../../ui/campo/moldura-campo';
import { ehCor } from './widget';

/**
 * Cor `#RRGGBB`: o seletor de cor do sistema (o círculo à esquerda) e o código ao lado, para
 * colar a cor da marca. Funciona com `formControlName`; um código pela metade fica no campo
 * até virar uma cor válida.
 */
@Component({
  selector: 'app-campo-cor',
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
      <div class="cor" [class.cor--invalida]="!!mensagemErro()">
        <span class="cor__amostra" [style.background]="amostra()">
          <input
            class="cor__seletor"
            type="color"
            tabindex="-1"
            aria-hidden="true"
            [value]="amostra()"
            [disabled]="estaDesabilitado()"
            (input)="escolher($event)"
          />
        </span>
        <input
          #campo
          class="cor__codigo"
          type="text"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          [id]="id"
          [value]="texto()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          [disabled]="estaDesabilitado()"
          (input)="digitar($event)"
          (blur)="tocar()"
        />
      </div>
    </app-moldura-campo>
  `,
  styles: `
    @use '../../../../ui/campo/campo' as c;

    :host {
      display: block;
      min-width: 0;
    }

    .cor {
      @include c.controle;

      padding-inline-start: var(--esp-1);

      &.cor--invalida {
        border-color: var(--cor-erro);
      }
    }

    .cor__amostra {
      position: relative;
      flex: none;
      width: 36px;
      height: 36px;
      overflow: hidden;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px var(--cor-borda-forte);
    }

    .cor__seletor {
      position: absolute;
      inset: -8px;
      width: calc(100% + 16px);
      height: calc(100% + 16px);
      padding: 0;
      border: 0;
      opacity: 0;
      cursor: pointer;
    }

    .cor__codigo {
      flex: 1;
      min-width: 0;
      height: calc(var(--altura-md) - 2px);
      padding: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: inherit;
      font-family: var(--familia-mono);
      font-size: 14px;
      text-transform: uppercase;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-cor' },
})
export class CampoCor extends CampoBase<string> {
  readonly valor = model('#2563EB');

  protected readonly texto = signal('#2563EB');

  constructor() {
    super();
  }

  protected amostra(): string {
    return ehCor(this.valor()) ? this.valor() : '#000000';
  }

  protected override normalizar(valor: unknown): string {
    const texto = typeof valor === 'string' ? valor.toUpperCase() : '';
    this.texto.set(texto);
    return texto;
  }

  protected escolher(evento: Event): void {
    const cor = (evento.target as HTMLInputElement).value.toUpperCase();
    this.texto.set(cor);
    this.definirValor(cor);
  }

  protected digitar(evento: Event): void {
    let texto = (evento.target as HTMLInputElement).value.trim().toUpperCase();
    if (texto && !texto.startsWith('#')) {
      texto = `#${texto}`;
    }
    this.texto.set(texto);
    // Sempre avisa o formulário (o validador diz se a cor está pela metade).
    this.definirValor(texto);
  }
}
