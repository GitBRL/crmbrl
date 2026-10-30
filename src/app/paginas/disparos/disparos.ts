import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';

/**
 * Esqueleto da Onda B (`base-front-b`): Em breve você cria e acompanha campanhas aqui. O agente da fatia troca este conteúdo pela tela
 * de verdade, mantendo a classe, o seletor e a rota.
 */
@Component({
  selector: 'app-disparos',
  imports: [Cartao, EstadoVazio],
  template: `
    <header class="cabecalho">
      <h1 class="texto-display">Disparos</h1>
      <p class="cabecalho__frase">Campanhas de WhatsApp e e-mail para segmentos de contatos.</p>
    </header>
    <app-cartao>
      <app-estado-vazio
        titulo="Esta tela está sendo construída"
        texto="Em breve você cria e acompanha campanhas aqui."
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
export class Disparos {}
