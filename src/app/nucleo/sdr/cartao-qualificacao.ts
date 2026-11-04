import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { type ErroApi, erroDaApi } from '../api/erro-api';
import { aoReceber } from '../tempo-real/auxiliares';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Selo } from '../../ui/selo/selo';
import { formatarDataHora } from '../formatos';
import { percentual, ROTULO_SITUACAO, rotuloDaOrigem, VARIANTE_SITUACAO } from './sdr.apresentacao';
import { SdrAtendimentoApi } from './sdr.api';
import type { QualificacaoDoSdr } from './sdr.tipos';
import { SeloTemperatura } from './selo-temperatura';

/**
 * Cartão "Qualificação" do contato ou do negócio: o que a IA do SDR descobriu (critérios, valores,
 * origem e confiança), a nota, a temperatura e o resumo. Carrega sozinho (`contatoId` ou
 * `negocioId`) e acompanha o tempo real. Estados: carregando, vazio (a IA nunca atendeu), erro
 * com "Tentar de novo" e sem acesso.
 */
@Component({
  selector: 'app-cartao-qualificacao',
  imports: [Botao, Cartao, Esqueleto, RouterLink, Selo, SeloTemperatura],
  templateUrl: './cartao-qualificacao.html',
  styleUrl: './cartao-qualificacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoQualificacao {
  private readonly api = inject(SdrAtendimentoApi);

  readonly contatoId = input<string | null>(null);
  readonly negocioId = input<string | null>(null);
  /** Nível do título (o cartão fica numa coluna lateral: 3). */
  readonly nivel = input<2 | 3 | 4>(3);

  protected readonly dados = resource({
    params: () => ({ contato: this.contatoId(), negocio: this.negocioId() }),
    loader: async ({ params }): Promise<QualificacaoDoSdr | null> => {
      if (params.negocio) {
        return firstValueFrom(this.api.qualificacaoDoNegocio(params.negocio));
      }
      return params.contato ? firstValueFrom(this.api.qualificacaoDoContato(params.contato)) : null;
    },
  });

  protected readonly falha = computed<ErroApi | null>(() =>
    this.dados.error() ? erroDaApi(this.dados.error()) : null,
  );
  protected readonly qualificacao = computed(() =>
    this.dados.hasValue() ? this.dados.value() : null,
  );
  protected readonly carregando = computed(() => this.dados.isLoading() && !this.dados.hasValue());

  protected readonly rotuloSituacao = ROTULO_SITUACAO;
  protected readonly varianteSituacao = VARIANTE_SITUACAO;
  protected readonly percentual = percentual;
  protected readonly rotuloDaOrigem = rotuloDaOrigem;
  protected readonly formatarDataHora = formatarDataHora;

  protected readonly descobertos = computed(
    () => this.qualificacao()?.criterios.filter((criterio) => criterio.descoberto).length ?? 0,
  );

  constructor() {
    // A IA descobriu algo ou a situação mudou: confere de novo (só se for a conversa deste cartão).
    aoReceber('sdr.atualizado', ({ conversaId }) => {
      if (conversaId === untracked(this.qualificacao)?.conversaId) {
        untracked(() => this.dados.reload());
      }
    });
  }

  protected tentarDeNovo(): void {
    this.dados.reload();
  }

  protected faltaObrigatorio(chave: string): boolean {
    return this.qualificacao()?.faltamObrigatorios.includes(chave) ?? false;
  }
}
