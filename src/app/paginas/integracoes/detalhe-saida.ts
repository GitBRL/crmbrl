import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { LucideKeyRound, LucidePencil, LucidePower } from '@lucide/angular';

import { formatarDataHora } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { ComoValidarAssinatura } from './como-validar-assinatura';
import { Entregas } from './entregas';
import { rotuloDoEvento, TOTAL_EVENTOS_ASSINAVEIS, type WebhookSaida } from './tipos';

export type AbaSaida = 'entregas' | 'configuracao';

const ABAS: readonly ItemAba[] = [
  { id: 'entregas', rotulo: 'Entregas' },
  { id: 'configuracao', rotulo: 'Configuração' },
];

/** Selos de saúde de um destino (últimas entregas e falhas seguidas, R9.4). */
export function saudeDoDestino(
  w: Pick<
    WebhookSaida,
    'ativo' | 'desativadoAutomaticamenteEm' | 'falhasConsecutivas' | 'entregas'
  >,
): readonly { readonly variante: VarianteSelo; readonly texto: string }[] {
  if (!w.ativo && w.desativadoAutomaticamenteEm) {
    return [{ variante: 'coral', texto: 'Desativado após falhas' }];
  }
  const selos: { variante: VarianteSelo; texto: string }[] = [];
  if (w.falhasConsecutivas > 0) {
    selos.push({
      variante: 'coral',
      texto:
        w.falhasConsecutivas === 1 ? '1 falha seguida' : `${w.falhasConsecutivas} falhas seguidas`,
    });
  }
  if (w.entregas.falhas > 0) {
    selos.push({
      variante: 'coral',
      texto: w.entregas.falhas === 1 ? '1 falhou' : `${w.entregas.falhas} falharam`,
    });
  }
  if (w.entregas.pendentes > 0) {
    selos.push({
      variante: 'lima',
      texto: w.entregas.pendentes === 1 ? '1 pendente' : `${w.entregas.pendentes} pendentes`,
    });
  }
  return selos.length ? selos : [{ variante: 'menta', texto: 'Entregando' }];
}

/**
 * Corpo do painel de um webhook de saída: alerta de desativação (automática, R9.4), o resumo
 * (URL, eventos, saúde, segredo) e as abas Entregas e Configuração (TELAS-FASE1 §7).
 */
@Component({
  selector: 'app-detalhe-saida',
  imports: [Abas, Botao, Selo, Entregas, ComoValidarAssinatura],
  template: `
    @let w = webhook();
    @if (!w.ativo) {
      <div
        class="detalhe__alerta"
        [class.detalhe__alerta--perigo]="!!w.desativadoAutomaticamenteEm"
        role="status"
      >
        <p>
          @if (w.desativadoAutomaticamenteEm) {
            <strong>Desativado automaticamente</strong> em {{ desativadoEm() }}, depois de
            {{ w.falhasConsecutivas }} falhas seguidas. Nada é enviado até você reativá-lo; confira
            a URL e as últimas entregas antes.
          } @else {
            <strong>Desativado.</strong> Nenhum evento é enviado a este destino.
          }
        </p>
        <button
          appBotao
          type="button"
          variante="contorno"
          tamanho="sm"
          [icone]="icones.ativar"
          (click)="ativar.emit()"
        >
          Reativar
        </button>
      </div>
    }

    <dl class="detalhe__resumo">
      <div class="detalhe__fato detalhe__fato--largo">
        <dt>URL</dt>
        <dd>
          <code>{{ w.url }}</code>
        </dd>
      </div>
      <div class="detalhe__fato">
        <dt>Eventos</dt>
        <dd>{{ resumoEventos() }}</dd>
      </div>
      <div class="detalhe__fato">
        <dt>Saúde</dt>
        <dd>
          @for (selo of saude(); track selo.texto) {
            <app-selo tamanho="sm" [variante]="selo.variante">{{ selo.texto }}</app-selo>
          }
        </dd>
      </div>
      <div class="detalhe__fato">
        <dt>Segredo</dt>
        <dd>
          <code>{{ w.segredoMascarado }}</code>
        </dd>
      </div>
    </dl>

    <app-abas rotulo="Seções do destino" [abas]="abas" [(selecionada)]="aba">
      @switch (aba()) {
        @case ('configuracao') {
          <div class="detalhe__config">
            <section class="detalhe__secao" aria-labelledby="saida-eventos">
              <h3 class="detalhe__subtitulo" id="saida-eventos">Eventos assinados</h3>
              <ul class="detalhe__eventos">
                @for (evento of w.eventos; track evento) {
                  <li>
                    <span>{{ rotuloEvento(evento) }}</span>
                    <code>{{ evento }}</code>
                  </li>
                }
              </ul>
            </section>

            <dl class="detalhe__dados">
              <div>
                <dt>Cabeçalhos extras</dt>
                <dd>
                  @for (cabecalho of w.cabecalhos; track cabecalho.nome) {
                    <code class="detalhe__cabecalho"
                      >{{ cabecalho.nome }}: {{ cabecalho.valorMascarado }}</code
                    >
                  } @empty {
                    <span class="detalhe__fraco">Nenhum</span>
                  }
                </dd>
              </div>
              <div>
                <dt>Segredo das assinaturas</dt>
                <dd>
                  <code>{{ w.segredoMascarado }}</code>
                </dd>
              </div>
              <div>
                <dt>Cadastrado</dt>
                <dd>{{ criado() }}</dd>
              </div>
            </dl>

            <div class="detalhe__botoes">
              <button
                appBotao
                type="button"
                variante="contorno"
                [icone]="icones.editar"
                (click)="editar.emit()"
              >
                Editar destino
              </button>
              <button
                appBotao
                type="button"
                variante="contorno"
                [icone]="icones.segredo"
                (click)="novoSegredo.emit()"
              >
                Gerar novo segredo
              </button>
            </div>

            <section class="detalhe__secao" aria-labelledby="saida-assinatura">
              <h3 class="detalhe__subtitulo" id="saida-assinatura">Como validar a assinatura</h3>
              <app-como-validar-assinatura />
            </section>
          </div>
        }
        @default {
          <app-entregas [destino]="w" [versao]="versaoEntregas()" />
        }
      }
    </app-abas>
  `,
  styleUrl: './detalhe.scss',
  styles: `
    .detalhe__eventos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: grid;
        gap: 2px;
        padding: var(--esp-3) var(--esp-4);
        border-radius: var(--raio-lg);
        background: var(--cor-superficie-2);
        font: var(--fonte-corpo-sm);
      }

      code {
        color: var(--cor-texto-suave);
        font-size: 12px;
      }
    }

    .detalhe__cabecalho {
      display: block;
    }

    .detalhe__botoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheSaida {
  readonly webhook = input.required<WebhookSaida>();
  readonly aba = model<string | null>('entregas');
  /** Muda depois de "Enviar teste", para a lista de entregas recarregar. */
  readonly versaoEntregas = input(0);
  readonly editar = output<void>();
  readonly ativar = output<void>();
  readonly novoSegredo = output<void>();

  protected readonly abas = ABAS;
  protected readonly icones = {
    editar: LucidePencil,
    ativar: LucidePower,
    segredo: LucideKeyRound,
  };

  protected readonly saude = computed(() => saudeDoDestino(this.webhook()));

  protected readonly resumoEventos = computed(() => {
    const eventos = this.webhook().eventos;
    if (eventos.length >= TOTAL_EVENTOS_ASSINAVEIS) {
      return 'Todos os eventos';
    }
    return eventos.length <= 2
      ? eventos.map((evento) => rotuloDoEvento(evento)).join(' e ')
      : `${eventos.length} eventos`;
  });

  protected readonly desativadoEm = computed(() => {
    const em = this.webhook().desativadoAutomaticamenteEm;
    return em ? formatarDataHora(em) : '';
  });

  protected readonly criado = computed(() => {
    const w = this.webhook();
    const quando = formatarDataHora(w.criadoEm);
    return w.criadoPor ? `${quando}, por ${w.criadoPor.nome}` : quando;
  });

  protected rotuloEvento(evento: string): string {
    return rotuloDoEvento(evento);
  }
}
