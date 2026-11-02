import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCopy, LucideExternalLink } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { copiarTexto } from '../../nucleo/copiar';
import { formatarData, formatarDataHora, formatarMoeda } from '../../nucleo/formatos';
import { aoReceber } from '../../nucleo/tempo-real/auxiliares';
import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Selo } from '../../ui/selo/selo';
import { FinanceiroApi } from './financeiro.api';
import {
  type EnvioDaLinhaDoTempo,
  ROTULO_CANAL_REGUA,
  ROTULO_FORMA,
  ROTULO_RESULTADO_LIGACAO,
  ROTULO_SITUACAO_ENVIO,
  ROTULO_STATUS_PARCELA,
  ROTULO_TIPO_ENVIO,
  rotuloDoMarco,
  VARIANTE_SITUACAO_ENVIO,
  VARIANTE_STATUS_PARCELA,
} from './financeiro.tipos';
import { ModalBaixa, ModalParcela, ModalRenegociar } from './modais-parcela';

/**
 * Painel de uma parcela: situação, links de pagamento, ações (baixa, editar, renegociar, cancelar)
 * e a linha do tempo da régua (cada envio e o histórico de mudanças).
 */
@Component({
  selector: 'app-painel-parcela',
  imports: [
    RouterLink,
    Botao,
    EstadoVazio,
    Esqueleto,
    ModalBaixa,
    ModalParcela,
    ModalRenegociar,
    PainelLateral,
    Selo,
  ],
  template: `
    <app-painel-lateral
      [titulo]="'Parcela ' + (parcela()?.numero ?? '')"
      [complemento]="parcela() ? statusRotulo[parcela()!.status] : null"
      largura="lg"
      [aberto]="parcelaId() !== null"
      (abertoChange)="!$event && parcelaId.set(null)"
    >
      @if (dados.error(); as falha) {
        <app-estado-vazio
          variante="erro"
          [falha]="erro()!"
          titulo="Não conseguimos abrir esta parcela"
          [texto]="erro()!.resumo"
        >
          <button appBotao type="button" variante="invertido" (click)="dados.reload()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else if (parcela(); as p) {
        <div class="painel">
          <section class="bloco" aria-label="Resumo">
            <div class="resumo">
              <span class="resumo__valor numero">{{ moeda(p.valor) }}</span>
              <app-selo ponto [variante]="statusVariante[p.status]">
                {{ statusRotulo[p.status] }}
              </app-selo>
            </div>
            <dl class="dados">
              <div>
                <dt>Vencimento</dt>
                <dd>
                  {{ data(p.vencimento) }}
                  @if (p.diasEmAtraso > 0 && p.status !== 'PAGO') {
                    <span class="nota">· {{ p.diasEmAtraso }} dias em atraso</span>
                  }
                </dd>
              </div>
              @if (p.pagoEm) {
                <div>
                  <dt>Pago em</dt>
                  <dd>
                    {{ data(p.pagoEm) }}
                    @if (p.valorPago) {
                      <span class="nota">· {{ moeda(p.valorPago) }}</span>
                    }
                    @if (p.formaPagamento) {
                      <span class="nota">· {{ forma[p.formaPagamento] }}</span>
                    }
                  </dd>
                </div>
              }
              @if (p.promessaAte) {
                <div>
                  <dt>Promessa de pagamento</dt>
                  <dd>até {{ data(p.promessaAte) }}</dd>
                </div>
              }
              <div>
                <dt>Cliente</dt>
                <dd>
                  @if (p.contato) {
                    <a [routerLink]="['/contatos', p.contato.id]">{{ p.contato.nome }}</a>
                  }
                  @if (p.empresa) {
                    <span class="nota">
                      @if (p.contato) {
                        ·
                      }
                      {{ p.empresa.nome }}
                    </span>
                  }
                  @if (!p.contato && !p.empresa) {
                    —
                  }
                </dd>
              </div>
              @if (p.contrato) {
                <div>
                  <dt>Contrato</dt>
                  <dd>
                    <a [routerLink]="['/financeiro/contratos', p.contrato.id]">
                      {{ p.contrato.codigo }} · {{ p.contrato.produto }}
                    </a>
                  </dd>
                </div>
              }
              @if (p.descricao) {
                <div>
                  <dt>Descrição</dt>
                  <dd>{{ p.descricao }}</dd>
                </div>
              }
            </dl>
          </section>

          @if (p.linkBoleto || p.linkPagamento || p.pix) {
            <section class="bloco" aria-label="Como pagar">
              <h3 class="bloco__titulo">Como pagar</h3>
              <div class="acoes-linha">
                @if (p.linkBoleto) {
                  <a
                    appBotao
                    variante="contorno"
                    tamanho="sm"
                    [href]="p.linkBoleto"
                    target="_blank"
                    rel="noopener noreferrer"
                    [icone]="icones.externo"
                  >
                    Abrir boleto
                  </a>
                }
                @if (p.linkPagamento) {
                  <a
                    appBotao
                    variante="contorno"
                    tamanho="sm"
                    [href]="p.linkPagamento"
                    target="_blank"
                    rel="noopener noreferrer"
                    [icone]="icones.externo"
                  >
                    Abrir link de pagamento
                  </a>
                }
                @if (p.pix) {
                  <button
                    appBotao
                    type="button"
                    variante="contorno"
                    tamanho="sm"
                    [icone]="icones.copiar"
                    (click)="copiarPix(p.pix)"
                  >
                    Copiar Pix
                  </button>
                }
              </div>
            </section>
          }

          @if (p.podeEditar && (p.status === 'ABERTO' || p.status === 'ATRASADO')) {
            <section class="bloco" aria-label="Ações">
              <div class="acoes-linha">
                <button appBotao type="button" variante="marca" (click)="baixaAberta.set(true)">
                  Dar baixa
                </button>
                <button appBotao type="button" variante="contorno" (click)="edicaoAberta.set(true)">
                  Editar
                </button>
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  (click)="renegociarAberto.set(true)"
                >
                  Renegociar
                </button>
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  (click)="cancelar(p.id, p.numero)"
                >
                  Cancelar parcela
                </button>
              </div>
              <p class="nota">
                Mudar o vencimento reinicia a régua de cobrança deste título. Dar baixa a encerra.
              </p>
            </section>
          }

          <section class="bloco" aria-label="Linha do tempo da régua">
            <h3 class="bloco__titulo">Linha do tempo da cobrança</h3>
            @if (envios().length === 0) {
              <p class="nota">Nenhuma mensagem ou ligação da régua para esta parcela ainda.</p>
            } @else {
              <ol class="linha">
                @for (e of envios(); track $index) {
                  <li class="linha__item">
                    <span class="linha__marco">{{ marco(e.marco) }}</span>
                    <div class="linha__corpo">
                      <p class="linha__titulo">
                        {{ canais[e.canal] }}
                        @if (e.etapa) {
                          · {{ e.etapa }}
                        }
                        @if (e.tipo !== 'ETAPA') {
                          · {{ tipos[e.tipo] ?? e.tipo }}
                        }
                      </p>
                      <p class="nota">
                        <app-selo tamanho="sm" [variante]="situacaoVariante[e.situacao]">
                          {{ situacaoRotulo[e.situacao] }}
                        </app-selo>
                        {{ quandoDoEnvio(e) }}
                        @if (e.destino) {
                          · {{ e.destino }}
                        }
                      </p>
                      @if (e.erro || e.motivo) {
                        <p class="nota">{{ e.erro ?? e.motivo }}</p>
                      }
                      @if (e.resultado) {
                        <p class="nota">
                          Resultado: {{ resultados[e.resultado] }}
                          @if (e.promessaAte) {
                            (até {{ data(e.promessaAte) }})
                          }
                          @if (e.observacao) {
                            · {{ e.observacao }}
                          }
                        </p>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </section>

          <section class="bloco" aria-label="Histórico">
            <h3 class="bloco__titulo">Histórico da parcela</h3>
            @if (historico().length === 0) {
              <p class="nota">Sem registros.</p>
            } @else {
              <ul class="historico">
                @for (h of historico(); track h.id) {
                  <li>
                    <span>{{ h.resumo }}</span>
                    <span class="nota">
                      {{ dataHora(h.em)
                      }}{{
                        h.tipoAtor === 'AUTOMACAO'
                          ? ' · Régua de cobrança'
                          : h.ator
                            ? ' · ' + h.ator
                            : ''
                      }}
                    </span>
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      } @else if (parcelaId()) {
        <div class="carregando" aria-busy="true">
          <p class="visualmente-oculto" role="status">Abrindo a parcela…</p>
          <app-esqueleto largura="50%" />
          <app-esqueleto altura="6rem" />
          <app-esqueleto altura="8rem" />
        </div>
      }
    </app-painel-lateral>

    <app-modal-baixa [(aberto)]="baixaAberta" [parcela]="parcela()" (concluido)="aoMudar()" />
    <app-modal-renegociar
      [(aberto)]="renegociarAberto"
      [parcela]="parcela()"
      (concluido)="aoMudar()"
    />
    <app-modal-parcela [(aberto)]="edicaoAberta" [parcela]="parcela()" (concluido)="aoMudar()" />
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .painel {
      display: grid;
      gap: var(--esp-5);
      min-width: 0;
    }

    .bloco {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
    }

    .bloco__titulo {
      font: var(--fonte-titulo-3, var(--fonte-rotulo));
    }

    .resumo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3);
    }

    .resumo__valor {
      font: var(--fonte-numero-pequeno, var(--fonte-lead));
    }

    .dados {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
    }

    .dados dt {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .dados dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .acoes-linha {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }

    .linha,
    .historico {
      display: grid;
      gap: var(--esp-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .linha__item {
      display: grid;
      grid-template-columns: 3.25rem minmax(0, 1fr);
      gap: var(--esp-3);
    }

    .linha__marco {
      font: var(--fonte-rotulo);
      font-variant-numeric: tabular-nums;
    }

    .linha__titulo {
      font-weight: 600;
    }

    .historico li {
      display: grid;
      gap: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelParcela {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  /** Id da parcela aberta (`null` fecha o painel). */
  readonly parcelaId = model<string | null>(null);
  /** Avisa a tela dona que algo mudou (para recarregar a lista). */
  readonly alterada = output<void>();

  protected readonly icones = { copiar: LucideCopy, externo: LucideExternalLink };
  protected readonly statusRotulo = ROTULO_STATUS_PARCELA;
  protected readonly statusVariante = VARIANTE_STATUS_PARCELA;
  protected readonly situacaoRotulo = ROTULO_SITUACAO_ENVIO;
  protected readonly situacaoVariante = VARIANTE_SITUACAO_ENVIO;
  protected readonly canais = ROTULO_CANAL_REGUA;
  protected readonly resultados = ROTULO_RESULTADO_LIGACAO;
  protected readonly tipos = ROTULO_TIPO_ENVIO;
  protected readonly forma = ROTULO_FORMA;
  protected readonly marco = rotuloDoMarco;
  protected readonly moeda = (v: string) => formatarMoeda(v);
  protected readonly data = (v: string) => formatarData(v);
  protected readonly dataHora = (v: string) => formatarDataHora(v);

  protected readonly baixaAberta = signal(false);
  protected readonly renegociarAberto = signal(false);
  protected readonly edicaoAberta = signal(false);

  protected readonly dados = resource({
    params: () => this.parcelaId(),
    loader: ({ params }) => (params ? this.api.linhaDoTempo(params) : Promise.resolve(null)),
  });
  protected readonly parcela = computed(() =>
    this.dados.hasValue() ? (this.dados.value()?.parcela ?? null) : null,
  );
  protected readonly envios = computed(() =>
    this.dados.hasValue() ? (this.dados.value()?.envios ?? []) : [],
  );
  protected readonly historico = computed(() =>
    this.dados.hasValue() ? (this.dados.value()?.historico ?? []) : [],
  );
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  constructor() {
    aoReceber('parcela.atualizada', (evento) => {
      if (evento.parcelaId === this.parcelaId()) {
        this.dados.reload();
      }
    });
  }

  protected quandoDoEnvio(e: EnvioDaLinhaDoTempo): string {
    const quando = e.enviadoEm ?? e.agendadoPara;
    return quando ? formatarDataHora(quando) : formatarData(e.dia);
  }

  protected async copiarPix(pix: string): Promise<void> {
    const copiou = await copiarTexto(pix);
    if (copiou) {
      this.avisos.sucesso('Pix copiado.');
    } else {
      this.avisos.atencao('Não deu para copiar. Selecione o código e copie à mão.');
    }
  }

  protected async cancelar(id: string, numero: string): Promise<void> {
    await this.confirmacao.confirmar({
      titulo: `Cancelar a parcela ${numero}?`,
      mensagem: 'A cobrança deste título para: nenhuma mensagem da régua será enviada.',
      confirmar: 'Cancelar parcela',
      cancelar: 'Voltar',
      perigo: true,
      executar: async () => {
        await this.api.cancelarParcela(id);
        this.avisos.sucesso(`Parcela ${numero} cancelada.`);
        this.aoMudar();
      },
    });
  }

  protected aoMudar(): void {
    this.dados.reload();
    this.alterada.emit();
  }
}
