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
import { RouterLink } from '@angular/router';
import { LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { type ConsultaDestinatarios, DisparosApi } from './disparos.api';
import {
  type Destinatario,
  ROTULO_STATUS_DESTINATARIO,
  type StatusDestinatario,
  VARIANTE_STATUS_DESTINATARIO,
} from './disparos.tipos';

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'ENVIADO', rotulo: 'Enviados' },
  { id: 'PENDENTE', rotulo: 'Na fila' },
  { id: 'FALHOU', rotulo: 'Falharam' },
  { id: 'INVALIDO', rotulo: 'Sem WhatsApp' },
  { id: 'EXCLUIDO', rotulo: 'Fora da campanha' },
  { id: 'RESPONDEU', rotulo: 'Responderam' },
];

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'contato', rotulo: 'Contato', noCartao: 'titulo' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'destino', rotulo: 'Enviado para' },
  { id: 'etapas', rotulo: 'Entrega' },
  { id: 'motivo', rotulo: 'Observação' },
];

/** Aba "Quem recebeu": um destinatário por linha, com filtros por situação e busca. */
@Component({
  selector: 'app-destinatarios-campanha',
  imports: [
    RouterLink,
    Botao,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    Paginacao,
    Selo,
    Tabela,
  ],
  template: `
    <div class="filtros">
      <app-campo-busca
        class="filtros__busca"
        rotulo="Buscar destinatários"
        placeholder="Nome, e-mail ou telefone"
        [valor]="buscaDigitada()"
        (valorChange)="buscaDigitada.set($event)"
        (buscar)="mudar({ busca: $event })"
      />
      <app-filtros-pilula
        rotulo="Situação dos destinatários"
        multipla
        [opcoes]="opcoes"
        [selecionados]="selecionados()"
        (selecionadosChange)="escolher($event)"
      />
    </div>

    @if (erro(); as falha) {
      <app-estado-vazio
        variante="erro"
        [falha]="falha"
        titulo="Não conseguimos carregar os destinatários"
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
    } @else if (dados.hasValue() && itens().length === 0 && !dados.isLoading()) {
      <app-estado-vazio
        [variante]="filtrando() ? 'busca' : 'vazio'"
        [titulo]="filtrando() ? 'Ninguém com esses filtros' : 'Ainda não há destinatários'"
        [texto]="
          filtrando()
            ? 'Tire um filtro ou mude a busca.'
            : 'A lista aparece quando a campanha começa a montar a fila de envio.'
        "
      />
    } @else {
      <app-tabela
        rotulo="Destinatários da campanha"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="dados.isLoading() && !dados.hasValue()"
        [linhasEsqueleto]="6"
      >
        <ng-template appCelula="contato" [appCelulaDe]="itens()" let-d>
          @if (d.contato; as contato) {
            <a class="contato" [routerLink]="['/contatos', contato.id]">{{ contato.nome }}</a>
          } @else {
            <span class="suave">Contato removido</span>
          }
        </ng-template>
        <ng-template appCelula="status" [appCelulaDe]="itens()" let-d>
          <app-selo ponto [variante]="variantes[d.status]">{{ rotulos[d.status] }}</app-selo>
          @if (d.respondeuEm) {
            <app-selo variante="ciano">Respondeu</app-selo>
          }
          @if (d.optOutEm) {
            <app-selo variante="coral">Pediu para sair</app-selo>
          }
        </ng-template>
        <ng-template appCelula="destino" [appCelulaDe]="itens()" let-d>
          {{ d.destino || '—' }}
          @if (d.canal) {
            <span class="suave"> · {{ d.canal.nome }}</span>
          }
        </ng-template>
        <ng-template appCelula="etapas" [appCelulaDe]="itens()" let-d>
          <span class="etapas">
            @if (d.enviadoEm) {
              <span>Enviado {{ hora(d.enviadoEm) }}</span>
            }
            @if (d.lidoEm) {
              <span>Lido {{ hora(d.lidoEm) }}</span>
            } @else if (d.entregueEm) {
              <span>Entregue {{ hora(d.entregueEm) }}</span>
            }
            @if (d.respondeuEm) {
              <span>Respondeu {{ hora(d.respondeuEm) }}</span>
            }
            @if (!d.enviadoEm && !d.falhouEm) {
              <span class="suave">—</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="motivo" [appCelulaDe]="itens()" let-d>
          @if (d.motivo) {
            {{ d.motivo }}
          } @else {
            <span class="suave">—</span>
          }
        </ng-template>
      </app-tabela>

      @if (total() > 0) {
        <app-paginacao
          rotulo="Paginação dos destinatários"
          [total]="total()"
          [pagina]="consulta().pagina"
          (paginaChange)="mudar({ pagina: $event }, false)"
          [porPagina]="consulta().porPagina"
          (porPaginaChange)="mudar({ porPagina: $event })"
        />
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .filtros {
      display: grid;
      gap: var(--esp-3);
    }

    .filtros__busca {
      max-width: 32rem;
    }

    .contato {
      color: inherit;
      font-weight: 600;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .contato:hover {
      text-decoration: underline;
    }

    .suave {
      color: var(--cor-texto-suave);
    }

    .etapas {
      display: grid;
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinatariosCampanha {
  /** Muda quando chegam novos números pelo tempo real: a lista recarrega. */
  readonly campanhaId = input.required<string>();
  readonly versao = input<unknown>(null);

  private readonly api = inject(DisparosApi);

  protected readonly opcoes = FILTROS;
  protected readonly colunas = COLUNAS;
  protected readonly rotulos = ROTULO_STATUS_DESTINATARIO;
  protected readonly variantes = VARIANTE_STATUS_DESTINATARIO;
  protected readonly icones = { tentar: LucideRefreshCw };

  protected readonly consulta = signal<ConsultaDestinatarios>({
    pagina: 1,
    porPagina: 20,
    status: [],
    busca: '',
    respondeu: null,
  });
  protected readonly selecionados = signal<readonly string[]>([]);
  protected readonly buscaDigitada = signal('');

  protected readonly dados = resource({
    params: () => ({ id: this.campanhaId(), consulta: this.consulta() }),
    loader: ({ params }) => this.api.destinatarios(params.id, params.consulta),
  });

  protected readonly itens = computed<readonly Destinatario[]>(() =>
    this.dados.hasValue() ? this.dados.value().itens : [],
  );
  protected readonly total = computed(() => (this.dados.hasValue() ? this.dados.value().total : 0));
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly filtrando = computed(() => {
    const c = this.consulta();
    return c.busca.trim() !== '' || c.status.length > 0 || c.respondeu !== null;
  });

  constructor() {
    // O andamento mudou (envios novos): atualiza a página aberta sem piscar.
    let anterior: unknown = null;
    effect(() => {
      const atual = this.versao();
      if (anterior !== null && atual !== anterior && !this.dados.isLoading()) {
        this.dados.reload();
      }
      anterior = atual;
    });
  }

  protected hora(valor: string): string {
    return formatarDataHora(valor);
  }

  protected escolher(ids: readonly string[]): void {
    this.selecionados.set(ids);
    const respondeu = ids.includes('RESPONDEU') ? true : null;
    this.mudar({
      status: ids.filter((id) => id !== 'RESPONDEU') as readonly StatusDestinatario[],
      respondeu,
    });
  }

  protected mudar(parcial: Partial<ConsultaDestinatarios>, voltarAoInicio = true): void {
    this.consulta.update((c) => ({ ...c, ...(voltarAoInicio ? { pagina: 1 } : {}), ...parcial }));
  }
}
