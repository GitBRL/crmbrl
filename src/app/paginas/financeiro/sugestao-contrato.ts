import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatarMoeda } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { FinanceiroApi } from './financeiro.api';
import { ROTULO_PERIODICIDADE } from './financeiro.tipos';

/**
 * No negócio ganho: sugere criar o contrato (a API diz se ainda não existe um). Só aparece para
 * quem pode criar contratos; qualquer falha da consulta esconde o aviso.
 */
@Component({
  selector: 'app-sugestao-contrato',
  imports: [RouterLink, Botao, Cartao],
  template: `
    @if (sugestao(); as s) {
      <app-cartao
        titulo="Criar o contrato deste negócio?"
        [nivel]="3"
        dica="O contrato registra o que foi vendido e gera as parcelas a receber. A cobrança da régua começa a partir delas."
      >
        <p class="texto">
          Este negócio foi ganho e ainda não tem contrato: {{ s.produto }}, {{ moeda(s.valor) }} ({{
            periodicidade[s.periodicidade].toLowerCase()
          }}).
        </p>
        <a
          appBotao
          variante="marca"
          routerLink="/financeiro/contratos/novo"
          [queryParams]="{ negocio: s.negocioId }"
        >
          Criar contrato
        </a>
      </app-cartao>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .texto {
      margin: 0 0 var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SugestaoContrato {
  private readonly api = inject(FinanceiroApi);
  private readonly sessao = inject(SessaoService);

  readonly negocioId = input.required<string>();

  protected readonly periodicidade = ROTULO_PERIODICIDADE;
  protected readonly moeda = (v: string) => formatarMoeda(v);

  private readonly dados = resource({
    params: () =>
      this.sessao.temPapel('ADMIN', 'C_LEVEL', 'LIDER_CS', 'CS') ? this.negocioId() : null,
    loader: async ({ params }) => {
      if (!params) {
        return null;
      }
      try {
        return await this.api.sugestaoDeContrato(params);
      } catch {
        return null;
      }
    },
  });

  protected readonly sugestao = computed(() => {
    const s = this.dados.hasValue() ? this.dados.value() : null;
    return s && s.negocioGanho && !s.jaTemContrato ? s.sugestao : null;
  });
}
