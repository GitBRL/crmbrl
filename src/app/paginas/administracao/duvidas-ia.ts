import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideSparkles } from '@lucide/angular';

import { Cartao } from '../../ui/cartao/cartao';
import { Dica } from '../../ui/dica/dica';
import { Selo } from '../../ui/selo/selo';

/**
 * Dúvidas à IA (`/administracao/ia`) — TELAS-FASE1 §8: aba "em breve" (Fase 5). Explica o que
 * vai existir e o que já dá para fazer hoje.
 */
@Component({
  selector: 'app-duvidas-ia',
  imports: [Cartao, Dica, Selo, LucideSparkles],
  template: `
    <app-cartao class="ia">
      <div class="ia__conteudo">
        <span class="ia__icone" aria-hidden="true"><svg lucideSparkles [size]="28" /></span>
        <div class="ia__texto">
          <p class="ia__selos">
            <app-selo variante="lima" tamanho="sm">em breve</app-selo>
            <app-selo variante="contorno" tamanho="sm">Fase 5</app-selo>
          </p>
          <h2 class="ia__titulo">
            Pergunte ao CRM em português
            <app-dica
              rotulo="Como vai funcionar"
              texto="A IA vai consultar a auditoria e os logs técnicos para responder, sempre mostrando de onde tirou cada informação. Ela só vê o que o seu papel já pode ver."
            />
          </h2>
          <p class="ia__frase">
            “Quem mudou o valor do negócio da Escola Horizonte?”, “Por que o webhook do site deu
            erro ontem?”. A resposta vem com os registros que a explicam.
          </p>
          <p class="ia__nota">
            Enquanto isso, use os filtros da Auditoria (pessoa, ação, período, texto) e o id da
            requisição, que liga um evento aos logs técnicos da mesma chamada.
          </p>
        </div>
      </div>
    </app-cartao>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }

    .ia__conteudo {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--esp-6);
      align-items: start;
      max-width: 56rem;
      padding: var(--esp-4) 0;
    }

    .ia__icone {
      display: inline-grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--cor-marca);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
      color: var(--cor-sobre-marca);
    }

    .ia__texto {
      display: grid;
      gap: var(--esp-3);
    }

    .ia__selos {
      display: flex;
      gap: var(--esp-2);
    }

    .ia__titulo {
      display: flex;
      align-items: center;
      gap: var(--esp-1);
      font: var(--fonte-h2);
    }

    .ia__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .ia__nota {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    @include m.abaixo(m.$sm) {
      .ia__conteudo {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--esp-4);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuvidasIa {}
