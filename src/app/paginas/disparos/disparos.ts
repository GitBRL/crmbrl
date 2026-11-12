import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucidePlus, LucideRefreshCw } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import type { ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { type AcaoCampanha, AcoesCampanha } from './acoes-campanha';
import { BarraProgresso } from './barra-progresso';
import { DisparosApi } from './disparos.api';
import {
  aplicarProgresso,
  type CanalCampanha,
  type ConsultaCampanhas,
  type EventoCampanhaProgresso,
  ROTULO_CANAL_CAMPANHA,
  ROTULO_STATUS_CAMPANHA,
  type ResumoCampanha,
  STATUS_CAMPANHA,
  type StatusCampanha,
  VARIANTE_STATUS_CAMPANHA,
} from './disparos.tipos';
import { aoReceberProgresso, aoVoltarConexao } from './progresso-ao-vivo';

const CONSULTA_INICIAL: ConsultaCampanhas = {
  pagina: 1,
  porPagina: 20,
  status: [],
  canal: null,
  busca: '',
  minhas: false,
};

const OPCOES_STATUS: readonly OpcaoFiltro[] = STATUS_CAMPANHA.map((id) => ({
  id,
  rotulo: ROTULO_STATUS_CAMPANHA[id],
}));

const OPCOES_CANAL: readonly OpcaoSeletor<CanalCampanha>[] = [
  { valor: 'WHATSAPP', rotulo: 'WhatsApp' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
];

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Campanha', noCartao: 'titulo' },
  { id: 'status', rotulo: 'Situação' },
  { id: 'andamento', rotulo: 'Andamento', largura: '14rem' },
  { id: 'resultado', rotulo: 'Resultado' },
  { id: 'quando', rotulo: 'Quando' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim', fixa: true },
];

/**
 * Lista de campanhas (`/disparos`): filtros por situação e canal, busca, andamento ao vivo
 * (evento `campanha.progresso`) e as ações rápidas de cada linha.
 */
@Component({
  selector: 'app-disparos',
  imports: [
    RouterLink,
    Alternador,
    Botao,
    CampoBusca,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    MenuAcoes,
    Paginacao,
    Selo,
    Seletor,
    Tabela,
    BarraProgresso,
  ],
  template: `
    <header class="cabecalho">
      <div class="cabecalho__linha">
        <h1 class="texto-display">Disparos</h1>
        <a appBotao variante="destaque" routerLink="/disparos/novo" [icone]="icones.novo">
          Nova campanha
        </a>
      </div>
      <p class="cabecalho__frase">
        Envie uma mensagem de WhatsApp ou e-mail para vários contatos de uma vez, no ritmo certo
        para não ser bloqueado.
      </p>
    </header>

    <div class="barra">
      <app-campo-busca
        class="barra__busca"
        rotulo="Buscar campanhas"
        placeholder="Nome da campanha"
        [valor]="buscaDigitada()"
        (valorChange)="buscaDigitada.set($event)"
        (buscar)="mudar({ busca: $event })"
      />
      <app-seletor
        class="barra__canal"
        rotulo="Canal"
        [rotuloOculto]="true"
        placeholder="Todos os canais"
        permitirVazio
        [opcoes]="opcoesCanal"
        [valor]="consulta().canal"
        (valorChange)="mudar({ canal: $event })"
      />
      @if (veMaisQueAsProprias()) {
        <app-alternador
          rotulo="Só as minhas"
          [valor]="consulta().minhas"
          (valorChange)="mudar({ minhas: $event })"
        />
      }
    </div>

    <app-filtros-pilula
      rotulo="Situação"
      multipla
      [opcoes]="opcoesStatus"
      [selecionados]="consulta().status"
      (selecionadosChange)="mudarStatus($event)"
    />

    <p class="resultado" aria-live="polite">{{ resultado() }}</p>

    @if (erro(); as falha) {
      @if (falha.ehSemPermissao) {
        <app-estado-vazio
          variante="sem-acesso"
          titulo="Você não tem acesso aos Disparos"
          texto="Peça ao líder do seu setor para liberar o acesso."
        />
      } @else {
        <app-estado-vazio
          variante="erro"
          [falha]="falha"
          titulo="Não conseguimos carregar as campanhas"
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
      }
    } @else if (dados.hasValue() && itens().length === 0 && !dados.isLoading()) {
      @if (filtrando()) {
        <app-estado-vazio
          variante="busca"
          titulo="Nenhuma campanha com esses filtros"
          texto="Tire um filtro ou mude a busca para ver mais campanhas."
        >
          <button appBotao type="button" variante="contorno" (click)="limpar()">
            Limpar filtros
          </button>
        </app-estado-vazio>
      } @else {
        <app-estado-vazio
          titulo="Nenhuma campanha ainda"
          texto="Crie a primeira: escolha quem recebe, escreva a mensagem e confira o ritmo antes de enviar."
        >
          <a appBotao variante="invertido" routerLink="/disparos/novo" [icone]="icones.novo">
            Criar campanha
          </a>
        </app-estado-vazio>
      }
    } @else {
      <app-tabela
        rotulo="Campanhas"
        [colunas]="colunas"
        [linhas]="itens()"
        [carregando]="dados.isLoading() && !dados.hasValue()"
        [linhasEsqueleto]="6"
        [link]="linkDaCampanha"
      >
        <ng-template appCelula="nome" [appCelulaDe]="itens()" let-campanha>
          <span class="nome">
            <span class="nome__titulo">{{ campanha.nome }}</span>
            <span class="nome__sub">
              {{ rotuloCanal[campanha.canal] }}
              @if (campanha.criadoPor) {
                · {{ campanha.criadoPor.nome }}
              }
            </span>
          </span>
        </ng-template>
        <ng-template appCelula="status" [appCelulaDe]="itens()" let-campanha>
          <app-selo ponto [variante]="varianteStatus[campanha.status]">
            {{ rotuloStatus[campanha.status] }}
          </app-selo>
        </ng-template>
        <ng-template appCelula="andamento" [appCelulaDe]="itens()" let-campanha>
          @if (campanha.contadores.total > 0) {
            <span class="andamento">
              <app-barra-progresso
                [valor]="campanha.progresso"
                [rotulo]="'Andamento de ' + campanha.nome"
              />
              <span class="andamento__texto">
                {{ campanha.progresso }}% · {{ campanha.contadores.enviados }} de
                {{ campanha.contadores.total }}
              </span>
            </span>
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
        <ng-template appCelula="resultado" [appCelulaDe]="itens()" let-campanha>
          @if (campanha.contadores.enviados > 0) {
            {{ campanha.contadores.respondidos }}
            {{ campanha.contadores.respondidos === 1 ? 'resposta' : 'respostas' }}
            @if (campanha.contadores.falhas > 0) {
              · {{ campanha.contadores.falhas }}
              {{ campanha.contadores.falhas === 1 ? 'falha' : 'falhas' }}
            }
          } @else {
            <span class="vazio">—</span>
          }
        </ng-template>
        <ng-template appCelula="quando" [appCelulaDe]="itens()" let-campanha>
          {{ quando(campanha) }}
        </ng-template>
        <ng-template appCelula="acoes" [appCelulaDe]="itens()" let-campanha>
          <app-menu-acoes
            [rotulo]="'Ações de ' + campanha.nome"
            [itens]="itensDoMenu(campanha)"
            (escolher)="agir($event.id, campanha)"
          />
        </ng-template>
      </app-tabela>

      @if (total() > 0) {
        <app-paginacao
          rotulo="Paginação das campanhas"
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
      max-width: var(--largura-pagina, 1600px);
      min-width: 0;
    }

    .cabecalho {
      display: grid;
      gap: var(--esp-3);
    }

    .cabecalho__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--esp-3) var(--esp-4);
    }

    .cabecalho__frase {
      max-width: 60ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }

    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-3) var(--esp-4);
      min-width: 0;
    }

    .barra__busca {
      flex: 1 1 18rem;
      max-width: 32rem;
    }

    .barra__canal {
      flex: 0 1 14rem;
      min-width: 10rem;
    }

    .resultado {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      min-height: 1.25rem;
    }

    .nome {
      display: grid;
      min-width: 0;
    }

    .nome__titulo {
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .nome__sub,
    .andamento__texto,
    .vazio {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .andamento {
      display: grid;
      gap: var(--esp-1);
    }

    @media (max-width: 599px) {
      .barra__canal,
      .barra__busca {
        flex: 1 1 100%;
        max-width: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Disparos {
  private readonly api = inject(DisparosApi);
  private readonly sessao = inject(SessaoService);
  private readonly acoes = inject(AcoesCampanha);

  protected readonly icones = { novo: LucidePlus, tentar: LucideRefreshCw };
  protected readonly colunas = COLUNAS;
  protected readonly opcoesStatus = OPCOES_STATUS;
  protected readonly opcoesCanal = OPCOES_CANAL;
  protected readonly rotuloStatus = ROTULO_STATUS_CAMPANHA;
  protected readonly varianteStatus = VARIANTE_STATUS_CAMPANHA;
  protected readonly rotuloCanal = ROTULO_CANAL_CAMPANHA;

  protected readonly consulta = signal<ConsultaCampanhas>(CONSULTA_INICIAL);
  protected readonly buscaDigitada = signal('');
  /** Membro só vê as próprias; o filtro "Só as minhas" é para quem vê mais. */
  protected readonly veMaisQueAsProprias = computed(
    () => this.sessao.ehDiretoria() || this.sessao.ehLider(),
  );

  protected readonly dados = resource({
    params: () => this.consulta(),
    loader: ({ params }) => this.api.listar(params),
  });

  /** Eventos de progresso recebidos, por campanha (valem até a próxima carga). */
  private readonly vivos = signal<ReadonlyMap<string, EventoCampanhaProgresso>>(new Map());

  protected readonly itens = computed<readonly ResumoCampanha[]>(() => {
    if (!this.dados.hasValue()) {
      return [];
    }
    const vivos = this.vivos();
    return this.dados.value().itens.map((c) => {
      const evento = vivos.get(c.id);
      return evento ? aplicarProgresso(c, evento) : c;
    });
  });

  protected readonly total = computed(() => (this.dados.hasValue() ? this.dados.value().total : 0));
  protected readonly erro = computed(() => {
    const falha = this.dados.error();
    return falha ? erroDaApi(falha) : null;
  });
  protected readonly filtrando = computed(() => {
    const c = this.consulta();
    return c.busca.trim() !== '' || c.status.length > 0 || c.canal !== null || c.minhas;
  });
  protected readonly resultado = computed(() => {
    if (!this.dados.hasValue()) {
      return '';
    }
    const total = this.dados.value().total;
    return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'campanha' : 'campanhas'}`;
  });

  protected readonly linkDaCampanha = (campanha: ResumoCampanha) => ['/disparos', campanha.id];

  constructor() {
    aoReceberProgresso((evento) => {
      const linha = this.dados.hasValue()
        ? this.dados.value().itens.find((c) => c.id === evento.campanhaId)
        : undefined;
      if (!linha) {
        return;
      }
      this.vivos.update((atual) => new Map(atual).set(evento.campanhaId, evento));
      // A situação mudou (pausou, concluiu…): os botões de cada linha dependem dela.
      if (linha.status !== evento.status) {
        this.dados.reload();
      }
    });
    aoVoltarConexao(() => this.dados.reload());
    // Carga nova: os eventos antigos já estão incluídos nela.
    effect(() => {
      if (this.dados.hasValue() && !this.dados.isLoading()) {
        this.vivos.set(new Map());
      }
    });
  }

  protected mudar(parcial: Partial<ConsultaCampanhas>, voltarAoInicio = true): void {
    this.consulta.update((c) => ({ ...c, ...(voltarAoInicio ? { pagina: 1 } : {}), ...parcial }));
  }

  protected mudarStatus(ids: readonly string[]): void {
    this.mudar({ status: ids as readonly StatusCampanha[] });
  }

  protected limpar(): void {
    this.buscaDigitada.set('');
    this.consulta.update((c) => ({ ...CONSULTA_INICIAL, porPagina: c.porPagina }));
  }

  protected quando(campanha: ResumoCampanha): string {
    if (campanha.status === 'AGENDADA' && campanha.agendadaPara) {
      return `Começa ${formatarDataHora(campanha.agendadaPara)}`;
    }
    if (campanha.status === 'EM_ANDAMENTO' && campanha.iniciadaEm) {
      return `Iniciada ${formatarTempoRelativo(campanha.iniciadaEm)}`;
    }
    if (campanha.status === 'CONCLUIDA' && campanha.concluidaEm) {
      return `Concluída ${formatarTempoRelativo(campanha.concluidaEm)}`;
    }
    if (campanha.status === 'PAUSADA' && campanha.pausadaEm) {
      return `Pausada ${formatarTempoRelativo(campanha.pausadaEm)}`;
    }
    if (campanha.status === 'CANCELADA' && campanha.canceladaEm) {
      return `Cancelada ${formatarTempoRelativo(campanha.canceladaEm)}`;
    }
    return `Criada ${formatarTempoRelativo(campanha.criadoEm)}`;
  }

  protected itensDoMenu(campanha: ResumoCampanha): readonly ItemMenuAcoes[] {
    const a = campanha.acoes;
    const itens: ItemMenuAcoes[] = [{ id: 'abrir', rotulo: 'Abrir' }];
    if (a.editar && campanha.status === 'RASCUNHO') {
      itens.push({ id: 'editar', rotulo: 'Continuar editando' });
    }
    if (a.pausar) {
      itens.push({ id: 'pausar', rotulo: 'Pausar' });
    }
    if (a.retomar) {
      itens.push({ id: 'retomar', rotulo: 'Retomar' });
    }
    if (a.duplicar) {
      itens.push({ id: 'duplicar', rotulo: 'Duplicar' });
    }
    if (a.cancelar) {
      itens.push({ id: 'cancelar', rotulo: 'Cancelar campanha', perigo: true, separarAntes: true });
    }
    if (a.excluir) {
      itens.push({ id: 'excluir', rotulo: 'Excluir', perigo: true, separarAntes: !a.cancelar });
    }
    return itens;
  }

  protected async agir(id: string, campanha: ResumoCampanha): Promise<void> {
    if (id === 'abrir' || id === 'editar') {
      await this.navegar(campanha.id, id === 'editar');
      return;
    }
    const resultado = await this.acoes.executar(id as AcaoCampanha, campanha);
    if (resultado && id !== 'duplicar') {
      this.dados.reload();
    }
  }

  private readonly roteador = inject(Router);

  private navegar(id: string, editar: boolean): Promise<boolean> {
    return this.roteador.navigate(editar ? ['/disparos', id, 'editar'] : ['/disparos', id]);
  }
}
