import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { LucidePencil, LucidePower } from '@lucide/angular';

import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { Selo } from '../../ui/selo/selo';
import { Recebimentos } from './recebimentos';
import { ROTULO_ESTRATEGIA, ROTULO_MODELO, rotuloDoDestino, type WebhookEntrada } from './tipos';

export type AbaEntrada = 'recebimentos' | 'configuracao';

const ABAS: readonly ItemAba[] = [
  { id: 'recebimentos', rotulo: 'Recebimentos' },
  { id: 'configuracao', rotulo: 'Configuração' },
];

/**
 * Corpo do painel de um webhook de entrada: o resumo (endereço mascarado, assinatura, volume
 * das últimas 24 h) e as abas Recebimentos e Configuração (TELAS-FASE1 §7).
 */
@Component({
  selector: 'app-detalhe-entrada',
  imports: [Abas, Botao, Dica, Selo, Recebimentos],
  template: `
    @let w = webhook();
    @if (!w.ativo) {
      <div class="detalhe__alerta" role="status">
        <p>
          <strong>Desativado.</strong> O endereço responde 410 e nada do que chegar é registrado.
        </p>
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [icone]="icones.ativar"
          (click)="ativar.emit()"
        >
          Ativar
        </button>
      </div>
    }

    <dl class="detalhe__resumo">
      <div class="detalhe__fato detalhe__fato--largo">
        <dt>
          Endereço
          <app-dica
            rotulo="Por que o endereço está cortado"
            texto="O endereço completo só aparece ao criar o webhook ou ao gerar um novo endereço (menu de ações). O CRM guarda só uma impressão dele."
          />
        </dt>
        <dd>
          <code>{{ w.enderecoMascarado }}</code>
        </dd>
      </div>
      <div class="detalhe__fato">
        <dt>Assinatura</dt>
        <dd>
          @if (w.exigeAssinatura) {
            Exigida <span class="detalhe__fraco">· {{ w.segredoMascarado }}</span>
          } @else {
            Não exigida
          }
        </dd>
      </div>
      <div class="detalhe__fato">
        <dt>Últimas 24 h</dt>
        <dd>
          {{ volume() }}
          @if (w.recebimentos24h.erros) {
            <app-selo variante="coral" tamanho="sm">
              {{ w.recebimentos24h.erros }} com erro
            </app-selo>
          }
        </dd>
      </div>
      <div class="detalhe__fato">
        <dt>Último recebimento</dt>
        <dd [title]="ultimoCompleto()">{{ ultimo() }}</dd>
      </div>
    </dl>

    <app-abas rotulo="Seções do webhook" [abas]="abas" [(selecionada)]="aba">
      @switch (aba()) {
        @case ('configuracao') {
          <div class="detalhe__config">
            <dl class="detalhe__dados">
              <div>
                <dt>Entra em</dt>
                <dd>{{ w.funil.nome }} · {{ w.etapa.nome }}</dd>
              </div>
              <div>
                <dt>Quem fica com o lead</dt>
                <dd>{{ distribuicao() }}</dd>
              </div>
              <div>
                <dt>Etiquetas fixas</dt>
                <dd class="detalhe__selos">
                  @for (etiqueta of w.etiquetasFixas; track etiqueta) {
                    <app-selo variante="contorno" tamanho="sm">{{ etiqueta }}</app-selo>
                  } @empty {
                    <span class="detalhe__fraco">Nenhuma</span>
                  }
                </dd>
              </div>
              <div>
                <dt>Criado</dt>
                <dd>{{ criado() }}</dd>
              </div>
            </dl>

            <section class="detalhe__mapeamento" aria-labelledby="detalhe-mapeamento">
              <h3 class="detalhe__subtitulo" id="detalhe-mapeamento">
                Mapeamento&nbsp;<span class="tom-fraco">· </span
                ><span class="tom-fraco sem-quebra">{{ modelo() }}</span>
              </h3>
              <table class="detalhe__tabela">
                <caption class="visualmente-oculto">
                  Regras do mapeamento
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Caminho no envio</th>
                    <th scope="col">Vai para</th>
                  </tr>
                </thead>
                <tbody>
                  @for (regra of w.mapeamento.campos; track $index) {
                    <tr>
                      <td>
                        <code>{{ regra.caminho }}</code>
                      </td>
                      <td>{{ rotuloDestino(regra.destino) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              @for (condicao of w.mapeamento.ignorarQuando; track $index) {
                <p class="detalhe__fraco">
                  Ignora o envio quando <code>{{ condicao.caminho }}</code> vier igual a
                  <code>{{ condicao.valor }}</code
                  >.
                </p>
              }
            </section>

            <div>
              <button
                appBotao
                type="button"
                variante="contorno"
                [icone]="icones.editar"
                (click)="editar.emit()"
              >
                Editar configuração
              </button>
            </div>
          </div>
        }
        @default {
          <app-recebimentos [webhook]="w" />
        }
      }
    </app-abas>
  `,
  styleUrl: './detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheEntrada {
  readonly webhook = input.required<WebhookEntrada>();
  readonly aba = model<string | null>('recebimentos');
  readonly editar = output<void>();
  readonly ativar = output<void>();

  protected readonly abas = ABAS;
  protected readonly icones = { editar: LucidePencil, ativar: LucidePower };

  protected readonly volume = computed(() => {
    const total = this.webhook().recebimentos24h.total;
    return total === 1 ? '1 recebimento' : `${total} recebimentos`;
  });

  protected readonly ultimo = computed(() => {
    const em = this.webhook().ultimoRecebimentoEm;
    return em ? formatarTempoRelativo(em) : 'Nunca recebeu';
  });

  protected readonly ultimoCompleto = computed(() => {
    const em = this.webhook().ultimoRecebimentoEm;
    return em ? formatarDataHora(em) : '';
  });

  protected readonly distribuicao = computed(() => {
    const w = this.webhook();
    return w.estrategia === 'RESPONSAVEL_FIXO' && w.responsavelFixo
      ? `Responsável fixo: ${w.responsavelFixo.nome}`
      : ROTULO_ESTRATEGIA[w.estrategia];
  });

  protected readonly modelo = computed(() => ROTULO_MODELO[this.webhook().modeloMapeamento]);

  protected readonly criado = computed(() => {
    const w = this.webhook();
    const quando = formatarDataHora(w.criadoEm);
    return w.criadoPor ? `${quando}, por ${w.criadoPor.nome}` : quando;
  });

  protected rotuloDestino(destino: string): string {
    return rotuloDoDestino(destino);
  }
}
