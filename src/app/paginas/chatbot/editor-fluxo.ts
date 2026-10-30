import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';

/**
 * Esqueleto da Onda B (`base-front-b`): O editor em passos e o simulador chegam nesta tela. O agente da fatia troca este conteúdo pela tela
 * de verdade, mantendo a classe, o seletor e a rota.
 */
@Component({
  selector: 'app-editor-fluxo',
  imports: [Cartao, EstadoVazio],
  template: `
    <header class="cabecalho">
      <h1 class="texto-display">Fluxo do chatbot</h1>
      <p class="cabecalho__frase">Passos, perguntas, ações e simulador.</p>
    </header>
    <app-cartao>
      <app-estado-vazio
        titulo="Esta tela está sendo construída"
        texto="O editor em passos e o simulador chegam nesta tela."
      />
    </app-cartao>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-6);
      max-width: var(--largura-pagina, 1600px);
    }

    .cabecalho {
      display: grid;
      gap: var(--esp-3);
    }

    .cabecalho__frase {
      max-width: 60ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorFluxo {}
