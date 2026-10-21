import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Moldura de um componente no catálogo: nome, seletor, "quando usar" e as demonstrações
 * (projetadas). Uso interno de paginas/design-system.
 */
@Component({
  selector: 'app-ds-exemplo',
  template: `
    <header class="exemplo__cabecalho">
      <h3 class="exemplo__titulo">{{ titulo() }}</h3>
      @if (seletor(); as seletor) {
        <code class="exemplo__seletor">{{ seletor }}</code>
      }
    </header>
    <p class="exemplo__quando"><span class="exemplo__rotulo">Quando usar</span> {{ quando() }}</p>
    <div class="exemplo__conteudo"><ng-content /></div>
  `,
  styles: `
    :host {
      /* Anéis de recorte da cor do cartão (ponto do sino, pilha, grupo de botões). */
      --botao-icone-anel: var(--cor-superficie);
      --pilha-anel: var(--cor-superficie);
      --recorte-cor: var(--cor-superficie);

      display: flex;
      flex-direction: column;
      gap: var(--esp-3);
      min-width: 0;
      padding: var(--esp-cartao);
      border-radius: var(--raio-cartao);
      background: var(--cor-superficie);
      box-shadow: var(--sombra-cartao);
    }

    .exemplo__cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
    }

    .exemplo__titulo {
      font: var(--fonte-h3);
      letter-spacing: var(--tracking-titulo);
    }

    .exemplo__seletor {
      padding: 3px 10px;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      font-family: var(--familia-mono);
    }

    .exemplo__quando {
      max-width: 62ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .exemplo__rotulo {
      margin-right: var(--esp-1);
      color: var(--cor-texto);
      font-weight: 600;
    }

    .exemplo__conteudo {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--esp-5);
      margin-top: var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Exemplo {
  readonly titulo = input.required<string>();
  /** Seletor/uso curto: `button[appBotao]`, `app-abas`. */
  readonly seletor = input<string | null>(null);
  /** Uma linha dizendo quando usar o componente. */
  readonly quando = input.required<string>();
}
