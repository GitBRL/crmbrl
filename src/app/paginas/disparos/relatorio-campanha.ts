import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { LucideDownload, LucideRefreshCw } from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarData, formatarHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { DisparosApi } from './disparos.api';
import { formatarPercentual, type RelatorioCampanha } from './disparos.tipos';

type Agrupamento = 'hora' | 'dia';

interface Barra {
  readonly x: number;
  readonly largura: number;
  readonly alturaEnviados: number;
  readonly alturaRespostas: number;
  readonly rotulo: string;
  readonly texto: string;
}

const LARGURA = 640;
const ALTURA = 180;

/** Aba "Resultados": taxas, funil, envios ao longo do tempo, por número e exportação. */
@Component({
  selector: 'app-relatorio-campanha',
  imports: [Botao, Cartao, EstadoVazio, GrupoOpcoes, Indicador, Legenda, Esqueleto],
  template: `
    @if (erro(); as falha) {
      <app-estado-vazio
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar os resultados"
        [texto]="falha.resumo"
        [codigo]="falha.requisicaoId"
      >
        <button
          appBotao
          type="button"
          variante="invertido"
          [icone]="icones.tentar"
          (click)="dados.reload()"
        >
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (!dados.hasValue()) {
      <app-esqueleto forma="bloco" altura="12rem" />
    } @else {
      @let r = dados.value();
      <div class="exportar">
        <p class="exportar__texto">
          A planilha traz uma linha por contato, com a situação, as datas e os motivos de falha.
        </p>
        <div class="exportar__botoes">
          <button
            appBotao
            type="button"
            variante="contorno"
            [icone]="icones.baixar"
            [carregando]="exportando() === 'xlsx'"
            [disabled]="exportando() !== null"
            (click)="exportar('xlsx')"
          >
            Baixar Excel
          </button>
          <button
            appBotao
            type="button"
            variante="contorno"
            [icone]="icones.baixar"
            [carregando]="exportando() === 'csv'"
            [disabled]="exportando() !== null"
            (click)="exportar('csv')"
          >
            Baixar CSV
          </button>
        </div>
      </div>

      <div class="taxas">
        <app-indicador
          [valor]="r.taxas.entrega"
          unidade="%"
          legenda="Entregues"
          dica="De cada 100 mensagens enviadas, quantas chegaram ao aparelho do contato."
        />
        <app-indicador
          [valor]="r.taxas.leitura"
          unidade="%"
          legenda="Lidas"
          dica="Quantas foram abertas. No WhatsApp, só conta quem deixou a confirmação de leitura ligada."
        />
        <app-indicador
          [valor]="r.taxas.resposta"
          unidade="%"
          legenda="Responderam"
          dica="Quem respondeu a mensagem. As respostas caem no Atendimento."
        />
        <app-indicador
          [valor]="r.taxas.falha"
          unidade="%"
          legenda="Falharam"
          [quedaEhBoa]="true"
          dica="Envios que não saíram (número inválido, aparelho desconectado…)."
        />
        <app-indicador
          [valor]="r.taxas.optOut"
          unidade="%"
          legenda="Pediram para sair"
          [quedaEhBoa]="true"
          dica="Responderam SAIR, PARAR ou CANCELAR e não recebem mais campanhas."
        />
      </div>

      <app-cartao titulo="Do envio à resposta">
        <ul class="funil" aria-label="Funil da campanha">
          @for (etapa of funil(); track etapa.rotulo) {
            <li class="funil__linha">
              <span class="funil__rotulo">{{ etapa.rotulo }}</span>
              <span class="funil__trilho" aria-hidden="true">
                <span class="funil__barra" [style.width.%]="etapa.largura"></span>
              </span>
              <span class="funil__valor">
                {{ etapa.valor.toLocaleString('pt-BR') }}
                <span class="funil__pct">{{ etapa.percentual }}</span>
              </span>
            </li>
          }
        </ul>
      </app-cartao>

      <app-cartao titulo="Envios ao longo do tempo">
        <div class="serie__controles">
          <app-grupo-opcoes
            rotulo="Agrupar por"
            disposicao="pilulas"
            [opcoes]="opcoesAgrupar"
            [valor]="agrupar()"
            (valorChange)="agrupar.set($event ?? 'hora')"
          />
          <app-legenda [series]="['Enviadas', 'Respondidas']" />
        </div>
        @if (barras().length === 0) {
          <app-estado-vazio
            compacto
            titulo="Nada enviado ainda"
            texto="O gráfico aparece quando os primeiros envios saírem."
          />
        } @else {
          <svg
            class="serie"
            [attr.viewBox]="'0 0 ' + largura + ' ' + (altura + 22)"
            role="img"
            [attr.aria-label]="'Envios por ' + (agrupar() === 'hora' ? 'hora' : 'dia')"
            preserveAspectRatio="none"
          >
            <line
              class="serie__base"
              x1="0"
              [attr.x2]="largura"
              [attr.y1]="altura"
              [attr.y2]="altura"
            />
            @for (b of barras(); track b.x) {
              <rect
                class="serie__enviados"
                [attr.x]="b.x"
                [attr.y]="altura - b.alturaEnviados"
                [attr.width]="b.largura"
                [attr.height]="b.alturaEnviados"
                rx="2"
              >
                <title>{{ b.texto }}</title>
              </rect>
              @if (b.alturaRespostas > 0) {
                <rect
                  class="serie__respostas"
                  [attr.x]="b.x + b.largura * 0.2"
                  [attr.y]="altura - b.alturaRespostas"
                  [attr.width]="b.largura * 0.6"
                  [attr.height]="b.alturaRespostas"
                  rx="2"
                />
              }
            }
          </svg>
          <div class="serie__eixo" aria-hidden="true" [style.width.%]="usadoPct()">
            <span>{{ barras()[0].rotulo }}</span>
            <span>{{ barras()[barras().length - 1].rotulo }}</span>
          </div>
          <ul class="visualmente-oculto" aria-label="Envios por período">
            @for (b of barras(); track b.x) {
              <li>{{ b.texto }}</li>
            }
          </ul>
        }
      </app-cartao>

      @if (r.porNumero.length > 0) {
        <app-cartao titulo="Por número">
          <div class="numeros" role="table" aria-label="Resultados por número">
            <div class="numeros__linha numeros__linha--cab" role="row">
              <span role="columnheader">Número</span>
              <span role="columnheader">Enviadas</span>
              <span role="columnheader">Entregues</span>
              <span role="columnheader">Lidas</span>
              <span role="columnheader">Respostas</span>
              <span role="columnheader">Falhas</span>
            </div>
            @for (n of r.porNumero; track n.canalId) {
              <div class="numeros__linha" role="row">
                <span role="cell" class="numeros__nome" data-rotulo="Número">
                  {{ n.nome }}
                  @if (n.telefone) {
                    <span class="suave">{{ n.telefone }}</span>
                  }
                </span>
                <span role="cell" data-rotulo="Enviadas">{{ n.enviados }}</span>
                <span role="cell" data-rotulo="Entregues">{{ n.entregues }}</span>
                <span role="cell" data-rotulo="Lidas">{{ n.lidos }}</span>
                <span role="cell" data-rotulo="Respostas">{{ n.respondidos }}</span>
                <span role="cell" data-rotulo="Falhas">{{ n.falhas }}</span>
              </div>
            }
          </div>
        </app-cartao>
      }

      @if (r.motivosDeFalha.length > 0 || r.motivosDeExclusao.length > 0) {
        <div class="motivos">
          @if (r.motivosDeFalha.length > 0) {
            <app-cartao
              titulo="Por que falharam"
              dica="Corrija o problema e use “Reenviar falhas” na tela da campanha."
            >
              <ul class="motivos__lista">
                @for (m of r.motivosDeFalha; track m.motivo) {
                  <li>
                    <span>{{ m.motivo }}</span
                    ><strong>{{ m.quantidade }}</strong>
                  </li>
                }
              </ul>
            </app-cartao>
          }
          @if (r.motivosDeExclusao.length > 0) {
            <app-cartao
              titulo="Quem ficou de fora"
              dica="Contatos que não entraram na fila e por quê."
            >
              <ul class="motivos__lista">
                @for (m of r.motivosDeExclusao; track m.motivo) {
                  <li>
                    <span>{{ m.motivo }}</span
                    ><strong>{{ m.quantidade }}</strong>
                  </li>
                }
              </ul>
            </app-cartao>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .exportar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
    }

    .exportar__texto {
      flex: 1 1 18rem;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .exportar__botoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }

    .taxas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--esp-4);
    }

    .funil {
      display: grid;
      gap: var(--esp-3);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .funil__linha {
      display: grid;
      grid-template-columns: 8rem 1fr auto;
      align-items: center;
      gap: var(--esp-3);
    }

    .funil__trilho {
      height: 0.75rem;
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-3);
      overflow: hidden;
    }

    .funil__barra {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--dado-1);
    }

    .funil__valor {
      font-weight: 600;
      text-align: end;
      min-width: 6rem;
    }

    .funil__pct,
    .suave {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      font-weight: 400;
    }

    .serie__controles {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
      margin-bottom: var(--esp-3);
    }

    .serie {
      display: block;
      width: 100%;
      height: 11rem;
    }

    .serie__base {
      stroke: var(--cor-borda-forte);
      stroke-width: 1;
    }

    .serie__enviados {
      fill: var(--dado-1);
    }

    .serie__respostas {
      fill: var(--dado-2);
    }

    .serie__eixo {
      display: flex;
      justify-content: space-between;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .numeros {
      display: grid;
    }

    .numeros__linha {
      display: grid;
      grid-template-columns: minmax(10rem, 2fr) repeat(5, minmax(4rem, 1fr));
      gap: var(--esp-3);
      padding: var(--esp-3) 0;
      border-top: 1px solid var(--cor-borda);
      align-items: center;
    }

    .numeros__linha--cab {
      border-top: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .numeros__nome {
      display: grid;
      overflow-wrap: anywhere;
    }

    .motivos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: var(--esp-4);
    }

    .motivos__lista {
      display: grid;
      gap: var(--esp-2);
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .motivos__lista li {
      display: flex;
      justify-content: space-between;
      gap: var(--esp-3);
    }

    @media (max-width: 599px) {
      .funil__linha {
        grid-template-columns: 1fr auto;
      }

      .funil__trilho {
        grid-column: 1 / -1;
        grid-row: 2;
      }

      .numeros__linha--cab {
        display: none;
      }

      .numeros__linha {
        grid-template-columns: 1fr 1fr;
      }

      .numeros__nome {
        grid-column: 1 / -1;
        font-weight: 600;
      }

      .numeros__linha [data-rotulo]:not(.numeros__nome)::before {
        content: attr(data-rotulo) ': ';
        color: var(--cor-texto-suave);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatorioDaCampanha {
  readonly campanhaId = input.required<string>();
  /** Muda quando o andamento muda: o relatório recarrega. */
  readonly versao = input<unknown>(null);

  private readonly api = inject(DisparosApi);
  private readonly avisos = inject(AvisosService);

  protected readonly icones = { tentar: LucideRefreshCw, baixar: LucideDownload };
  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly opcoesAgrupar = [
    { valor: 'hora' as Agrupamento, rotulo: 'Hora' },
    { valor: 'dia' as Agrupamento, rotulo: 'Dia' },
  ];
  protected readonly agrupar = signal<Agrupamento>('hora');
  protected readonly exportando = signal<'xlsx' | 'csv' | null>(null);

  protected readonly dados = resource({
    params: () => ({ id: this.campanhaId(), agrupar: this.agrupar() }),
    loader: ({ params }) => this.api.relatorio(params.id, params.agrupar),
  });

  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });

  protected readonly funil = computed(() => {
    const r: RelatorioCampanha | undefined = this.dados.hasValue() ? this.dados.value() : undefined;
    if (!r) {
      return [];
    }
    const c = r.contadores;
    const base = Math.max(1, c.enviados);
    const linha = (rotulo: string, valor: number) => ({
      rotulo,
      valor,
      largura: Math.min(100, (valor / base) * 100),
      percentual: c.enviados > 0 ? formatarPercentual((valor / c.enviados) * 100) : '',
    });
    return [
      linha('Enviadas', c.enviados),
      linha('Entregues', c.entregues),
      linha('Lidas', c.lidos),
      linha('Respondidas', c.respondidos),
    ];
  });

  protected readonly barras = computed<readonly Barra[]>(() => {
    const serie = this.dados.hasValue() ? this.dados.value().serie : [];
    if (serie.length === 0) {
      return [];
    }
    const maximo = Math.max(1, ...serie.map((s) => s.enviados));
    // Poucos períodos: barras finas coladas à esquerda, em vez de um bloco que ocupa tudo.
    const passo = Math.min(LARGURA / serie.length, 56);
    const largura = Math.max(2, passo * 0.7);
    return serie.map((s, i) => {
      const rotulo = this.rotuloDoPeriodo(s.inicio);
      return {
        x: i * passo + (passo - largura) / 2,
        largura,
        alturaEnviados: (s.enviados / maximo) * ALTURA,
        alturaRespostas: (s.respondidos / maximo) * ALTURA,
        rotulo,
        texto: `${rotulo}: ${s.enviados} enviadas, ${s.respondidos} respondidas`,
      };
    });
  });

  /** Quanto da largura as barras ocupam (o eixo acompanha). */
  protected readonly usadoPct = computed(() => {
    const n = this.dados.hasValue() ? this.dados.value().serie.length : 0;
    return n === 0 ? 100 : Math.min(100, (Math.min(LARGURA / n, 56) * n * 100) / LARGURA);
  });

  constructor() {
    let anterior: unknown = null;
    effect(() => {
      const atual = this.versao();
      if (anterior !== null && atual !== anterior && !this.dados.isLoading()) {
        this.dados.reload();
      }
      anterior = atual;
    });
  }

  private rotuloDoPeriodo(inicio: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
      return formatarData(`${inicio}T12:00:00-03:00`, 'dia-mes');
    }
    return `${formatarData(inicio, 'dia-mes')} ${formatarHora(inicio)}`;
  }

  protected async exportar(formato: 'xlsx' | 'csv'): Promise<void> {
    this.exportando.set(formato);
    try {
      const arquivo = await this.api.exportar(this.campanhaId(), formato);
      const link = document.createElement('a');
      link.href = arquivo.url;
      link.download = arquivo.nome;
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      this.avisos.sucesso('Planilha pronta. O download começou.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.exportando.set(null);
    }
  }
}
