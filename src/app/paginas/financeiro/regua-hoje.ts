import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { FinanceiroApi } from './financeiro.api';
import {
  type EnvioRegua,
  hojeIso,
  ROTULO_CANAL_REGUA,
  ROTULO_SITUACAO_ENVIO,
  ROTULO_TIPO_ENVIO,
  rotuloDoMarco,
  type ResumoRegua,
  VARIANTE_SITUACAO_ENVIO,
  type SituacaoEnvio,
} from './financeiro.tipos';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'parcela', rotulo: 'Parcela', noCartao: 'titulo' },
  { id: 'etapa', rotulo: 'Etapa' },
  { id: 'canal', rotulo: 'Canal' },
  { id: 'situacao', rotulo: 'Situação' },
  { id: 'quando', rotulo: 'Quando' },
  { id: 'detalhe', rotulo: 'Detalhe' },
];

const FILTROS_CANAL = [
  { id: 'TODOS', rotulo: 'Todos os canais' },
  { id: 'WHATSAPP', rotulo: 'WhatsApp' },
  { id: 'EMAIL', rotulo: 'E-mail' },
  { id: 'LIGACAO', rotulo: 'Ligação' },
];

/** Acompanhamento do dia: contagem por canal e a lista de envios, com "Reenviar falhas". */
@Component({
  selector: 'app-regua-hoje',
  imports: [
    RouterLink,
    Botao,
    Cartao,
    CampoData,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    Paginacao,
    Selo,
    Tabela,
  ],
  template: `
    <section class="cartoes" aria-label="Resumo do dia">
      @for (c of canaisResumo(); track c.id) {
        <app-cartao [titulo]="c.rotulo" [nivel]="3">
          @if (c.itens.length === 0) {
            <p class="nota">Nada neste dia.</p>
          } @else {
            <ul class="contagens">
              @for (i of c.itens; track i.situacao) {
                <li>
                  <app-selo tamanho="sm" [variante]="variante[i.situacao]">
                    {{ rotulo[i.situacao] }}
                  </app-selo>
                  <span class="numero">{{ i.quantidade }}</span>
                </li>
              }
            </ul>
          }
        </app-cartao>
      }
      <app-cartao
        titulo="Próximo envio"
        [nivel]="3"
        dica="O WhatsApp sai em fila, com um intervalo entre as mensagens, para não ser bloqueado."
      >
        <p class="numero">
          {{
            resumo().proximoEnvioWhatsapp
              ? dataHora(resumo().proximoEnvioWhatsapp!)
              : 'Nada na fila'
          }}
        </p>
        @if (resumo().ligacoesPendentes > 0) {
          <p class="nota">
            <a routerLink="/financeiro/regua/ligacoes">
              {{ resumo().ligacoesPendentes }} ligações para fazer
            </a>
          </p>
        }
      </app-cartao>
    </section>

    <div class="barra">
      <app-campo-data
        class="barra__campo"
        rotulo="Dia"
        [maximo]="hoje"
        [valor]="dia()"
        (valorChange)="mudarDia($event)"
      />
      @if (resumo().podeGerenciar && falhas() > 0) {
        <button
          appBotao
          type="button"
          variante="contorno"
          [carregando]="reenviando()"
          (click)="reenviar()"
        >
          Reenviar {{ falhas() }} {{ falhas() === 1 ? 'falha' : 'falhas' }}
        </button>
      }
    </div>
    <app-filtros-pilula
      rotulo="Canal"
      [opcoes]="filtrosCanal"
      [selecionado]="canal() ?? 'TODOS'"
      (selecionadoChange)="mudarCanal($event)"
    />

    @if (envios.error()) {
      <app-estado-vazio
        variante="erro"
        titulo="Não conseguimos carregar os envios"
        [texto]="erro()?.resumo ?? null"
      >
        <button appBotao type="button" variante="invertido" (click)="envios.reload()">
          Tentar de novo
        </button>
      </app-estado-vazio>
    } @else if (envios.hasValue() && itens().length === 0) {
      <app-estado-vazio
        titulo="Nenhum envio neste dia"
        texto="A régua só envia para parcelas que estão numa das etapas (por exemplo, 3 dias antes ou 7 dias depois do vencimento)."
      />
    } @else {
      <app-tabela
        rotulo="Envios da régua"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="envios.isLoading() && !envios.hasValue()"
        [linhasEsqueleto]="5"
        clicavel
        (abrir)="abrirParcela($event)"
      >
        <ng-template appCelula="parcela" [appCelulaDe]="itens()" let-e>
          <span class="nome">
            <span class="nome__titulo">{{ e.parcela.numero }}</span>
            <span class="nota">{{
              e.parcela.contato?.nome ?? e.parcela.empresa?.nome ?? '—'
            }}</span>
          </span>
        </ng-template>
        <ng-template appCelula="etapa" [appCelulaDe]="itens()" let-e>
          <span class="nome">
            {{ marco(e.marco) }} · {{ e.etapa ?? '—' }}
            @if (e.tipo !== 'ETAPA') {
              <span class="nota">{{ tipos[e.tipo] ?? e.tipo }}</span>
            }
          </span>
        </ng-template>
        <ng-template appCelula="canal" [appCelulaDe]="itens()" let-e>{{
          canais[e.canal]
        }}</ng-template>
        <ng-template appCelula="situacao" [appCelulaDe]="itens()" let-e>
          <app-selo [variante]="variante[e.situacao]">{{ rotulo[e.situacao] }}</app-selo>
        </ng-template>
        <ng-template appCelula="quando" [appCelulaDe]="itens()" let-e>
          @if (e.enviadoEm ?? e.agendadoPara; as q) {
            {{ dataHora(q) }}
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
        <ng-template appCelula="detalhe" [appCelulaDe]="itens()" let-e>
          @if (e.erro ?? e.motivo; as d) {
            <span class="nota">{{ d }}</span>
          } @else if (e.destino) {
            <span class="nota">{{ e.destino }}</span>
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
      </app-tabela>
      @if (total() > 0) {
        <app-paginacao
          rotulo="Paginação dos envios"
          [total]="total()"
          [pagina]="pagina()"
          (paginaChange)="pagina.set($event)"
          [porPagina]="20"
        />
      }
    }
  `,
  styleUrl: './financeiro-comum.scss',
  styles: `
    .contagens {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .contagens li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReguaHoje {
  private readonly api = inject(FinanceiroApi);
  private readonly avisos = inject(AvisosService);

  readonly resumo = input.required<ResumoRegua>();
  readonly recarga = input(0);
  readonly alterada = output<void>();

  protected readonly colunas = COLUNAS;
  protected readonly filtrosCanal = FILTROS_CANAL;
  protected readonly rotulo = ROTULO_SITUACAO_ENVIO;
  protected readonly variante = VARIANTE_SITUACAO_ENVIO;
  protected readonly canais = ROTULO_CANAL_REGUA;
  protected readonly tipos = ROTULO_TIPO_ENVIO;
  protected readonly marco = rotuloDoMarco;
  protected readonly dataHora = formatarDataHora;
  protected readonly hoje = hojeIso();
  protected readonly dia = signal<string | null>(hojeIso());
  protected readonly canal = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly reenviando = signal(false);

  protected readonly envios = resource({
    params: () => ({
      dia: this.dia() ?? hojeIso(),
      canal: this.canal(),
      pagina: this.pagina(),
      recarga: this.recarga(),
    }),
    loader: ({ params }) =>
      this.api.enviosRegua({
        dia: params.dia,
        canal: params.canal,
        pagina: params.pagina,
        porPagina: 20,
      }),
  });
  protected readonly itens = computed<readonly EnvioRegua[]>(() =>
    this.envios.hasValue() ? this.envios.value().itens : [],
  );
  protected readonly total = computed(() =>
    this.envios.hasValue() ? this.envios.value().total : 0,
  );
  protected readonly erro = computed(() => {
    const falha = this.envios.error();
    return falha ? erroDaApi(falha) : null;
  });

  /** Resumo do dia de hoje (vem da casca); em outro dia, só a lista abaixo vale. */
  protected readonly canaisResumo = computed(() => {
    const r = this.resumo();
    const montar = (id: string, rotulo: string, mapa: Readonly<Record<string, number>>) => ({
      id,
      rotulo,
      itens: Object.entries(mapa)
        .filter(([, quantidade]) => quantidade > 0)
        .map(([situacao, quantidade]) => ({ situacao: situacao as SituacaoEnvio, quantidade })),
    });
    return [
      montar('whatsapp', 'WhatsApp hoje', r.whatsapp),
      montar('email', 'E-mail hoje', r.email),
      montar('ligacoes', 'Ligações hoje', r.ligacoes),
    ];
  });
  protected readonly falhas = computed(
    () => (this.resumo().whatsapp['FALHOU'] ?? 0) + (this.resumo().email['FALHOU'] ?? 0),
  );

  private readonly roteador = inject(Router);

  protected abrirParcela(e: EnvioRegua): void {
    void this.roteador.navigate(['/financeiro/parcelas'], {
      queryParams: { parcela: e.parcela.id },
    });
  }

  protected mudarDia(valor: string | null): void {
    this.dia.set(valor);
    this.pagina.set(1);
  }

  protected mudarCanal(id: string | null): void {
    this.canal.set(!id || id === 'TODOS' ? null : id);
    this.pagina.set(1);
  }

  protected async reenviar(): Promise<void> {
    this.reenviando.set(true);
    try {
      const r = await this.api.reenviar({ dia: this.dia() ?? hojeIso() });
      this.avisos.sucesso(
        r.reenviados === 0
          ? 'Nada para reenviar.'
          : `${r.reenviados} ${r.reenviados === 1 ? 'mensagem volta' : 'mensagens voltam'} para a fila.`,
      );
      this.envios.reload();
      this.alterada.emit();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.reenviando.set(false);
    }
  }
}
