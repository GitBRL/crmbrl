import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { PainelLigacao } from './painel-ligacao/painel-ligacao';

/**
 * Uma ligação aberta no Atendimento (`/atendimento/ligacoes/:ligacaoId`): a gravação, a
 * transcrição e o resumo (Onda E, E3). A tela com a lista e os filtros chega na E4.
 */
@Component({
  selector: 'app-ligacao-aberta',
  imports: [PainelLigacao],
  template: `
    <article class="ligacao" aria-label="Ligação">
      <h2 class="ligacao__titulo">Ligação</h2>
      @if (ligacaoId(); as id) {
        <app-painel-ligacao [ligacaoId]="id" />
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      border-radius: var(--raio-cartao);
      background: var(--gradiente-palco);
      box-shadow: var(--sombra-cartao);
    }
    .ligacao {
      display: grid;
      gap: var(--esp-4);
      padding: var(--esp-5);
    }
    .ligacao__titulo {
      margin: 0;
      font-size: 1.125rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigacaoAberta {
  private readonly rota = inject(ActivatedRoute);
  private readonly parametros = toSignal(this.rota.paramMap.pipe(map((p) => p.get('ligacaoId'))), {
    initialValue: this.rota.snapshot.paramMap.get('ligacaoId'),
  });
  protected readonly ligacaoId = computed(() => this.parametros());
}
