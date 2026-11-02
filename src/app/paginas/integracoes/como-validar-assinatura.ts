import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { Abas, type ItemAba } from '../../ui/abas/abas';
import { BlocoCodigo } from './comum/bloco-codigo';
import { EXEMPLO_ASSINATURA_NODE, EXEMPLO_ASSINATURA_PYTHON } from './exemplos';

const LINGUAGENS: readonly ItemAba[] = [
  { id: 'node', rotulo: 'Node.js' },
  { id: 'python', rotulo: 'Python' },
];

/**
 * Como o sistema de destino confere a assinatura de um webhook de saída (R9.3, R9.6): os
 * passos e um exemplo de código em Node.js e em Python.
 */
@Component({
  selector: 'app-como-validar-assinatura',
  imports: [Abas, BlocoCodigo],
  template: `
    <ol class="passos">
      <li>
        Leia o corpo <strong>bruto</strong> da requisição (os bytes exatos, antes de transformar em
        JSON).
      </li>
      <li>
        Calcule o HMAC-SHA256 de <code>X-CRM-Timestamp + "." + corpo</code> com o segredo do destino
        e compare, em tempo constante, com <code>X-CRM-Assinatura</code> (que vem como
        <code>sha256=&lt;hex&gt;</code>).
      </li>
      <li>
        Recuse horários com mais de 5 minutos de diferença (<code>X-CRM-Timestamp</code> é em
        segundos) para que uma chamada copiada não possa ser repetida.
      </li>
      <li>
        Responda 2xx em até 10 segundos. Use o <code>id</code> do envelope para não processar o
        mesmo evento duas vezes: a ordem não é garantida e pode haver novas tentativas.
      </li>
    </ol>
    <app-abas
      rotulo="Linguagem do exemplo"
      tamanho="sm"
      [abas]="linguagens"
      [(selecionada)]="linguagem"
    >
      @if (linguagem() === 'python') {
        <app-bloco-codigo
          rotulo="Python (Flask)"
          oQue="Exemplo"
          alturaMaxima="none"
          [codigo]="exemploPython"
        />
      } @else {
        <app-bloco-codigo
          rotulo="Node.js (Express)"
          oQue="Exemplo"
          alturaMaxima="none"
          [codigo]="exemploNode"
        />
      }
    </app-abas>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .passos {
      display: grid;
      gap: var(--esp-2);
      max-width: 60rem;
      margin: 0;
      padding-left: var(--esp-5);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);

      strong {
        color: var(--cor-texto);
        font-weight: 600;
      }

      code {
        color: var(--cor-texto);
        font-family: var(--familia-mono);
        font-size: 0.92em;
      }
    }

    app-abas {
      min-width: 0;
    }

    app-bloco-codigo {
      margin-top: var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComoValidarAssinatura {
  protected readonly linguagens = LINGUAGENS;
  protected readonly linguagem = signal<string | null>('node');
  protected readonly exemploNode = EXEMPLO_ASSINATURA_NODE;
  protected readonly exemploPython = EXEMPLO_ASSINATURA_PYTHON;
}
