import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Cartao } from '../../ui/cartao/cartao';
import { Selo } from '../../ui/selo/selo';
import { FinanceiroApi } from './financeiro.api';
import { ROTULO_NIVEL_RISCO, type RiscoChurn, VARIANTE_NIVEL_RISCO } from './financeiro.tipos';

const ROTULO_FATOR: Readonly<Record<string, string>> = {
  ATRASO: 'Pagamento em atraso',
  SATISFACAO: 'Satisfação baixa',
  SEM_INTERACAO: 'Sem contato recente',
};

/**
 * Risco de cancelamento (churn) de um cliente, para o contato e para o negócio de CS. Não mostra
 * nada quando o usuário não vê o cliente (a API devolve `risco: null`) ou quando a consulta falha:
 * é um apoio, não pode atrapalhar a tela.
 */
@Component({
  selector: 'app-risco-churn',
  imports: [Cartao, Selo],
  template: `
    @if (risco(); as r) {
      <app-cartao
        titulo="Risco de cancelamento"
        [nivel]="3"
        dica="Nota de 0 a 100 que soma pagamentos atrasados, satisfação baixa e falta de contato recente. Quanto maior, mais atenção o cliente precisa."
      >
        <p class="risco__linha">
          <app-selo ponto [variante]="variante[r.nivel]">{{ rotulo[r.nivel] }}</app-selo>
          <span class="risco__nota">{{ r.pontuacao }} de 100</span>
        </p>
        @if (r.fatores.length > 0) {
          <ul class="risco__fatores">
            @for (f of r.fatores; track f.tipo) {
              <li>
                <strong>{{ rotuloFator(f.tipo) }}</strong>
                <span class="risco__nota">{{ f.detalhe }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="risco__nota">Nenhum sinal de alerta neste momento.</p>
        }
      </app-cartao>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .risco__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2) var(--esp-3);
      margin: 0;
    }

    .risco__fatores {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .risco__fatores li {
      display: grid;
      gap: 2px;
    }

    .risco__nota {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiscoChurnCartao {
  private readonly api = inject(FinanceiroApi);
  private readonly sessao = inject(SessaoService);

  readonly contatoId = input<string | null>(null);
  readonly negocioId = input<string | null>(null);

  protected readonly rotulo = ROTULO_NIVEL_RISCO;
  protected readonly variante = VARIANTE_NIVEL_RISCO;

  private readonly dados = resource({
    params: () =>
      // Marketing não tem acesso ao Financeiro: nem pergunta.
      this.sessao.temPapel('MARKETING', 'LIDER_MARKETING')
        ? { contato: null, negocio: null }
        : { contato: this.contatoId(), negocio: this.negocioId() },
    loader: async ({ params }): Promise<RiscoChurn | null> => {
      try {
        if (params.contato) {
          return await this.api.riscoDoContato(params.contato);
        }
        return params.negocio ? await this.api.riscoDoNegocio(params.negocio) : null;
      } catch {
        return null;
      }
    },
  });
  protected readonly risco = computed(() => (this.dados.hasValue() ? this.dados.value() : null));

  protected rotuloFator(tipo: string): string {
    return ROTULO_FATOR[tipo] ?? tipo;
  }
}
