import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCopy, LucidePause, LucidePlay, LucidePlus, LucideTrash2 } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora, formatarTempoRelativo } from '../../nucleo/formatos';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { AutomacoesApi } from './automacoes.api';
import { type Automacao, ROTULO_STATUS_EXECUCAO, type StatusExecucao } from './automacoes.tipos';
import { HistoricoAutomacoes } from './historico';
import { ModelosProntos } from './modelos-prontos';

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Automação', noCartao: 'titulo' },
  { id: 'gatilho', rotulo: 'Começa quando' },
  { id: 'situacao', rotulo: 'Situação', largura: '10rem' },
  { id: 'execucoes', rotulo: 'Execuções', largura: '13rem' },
  { id: 'ultima', rotulo: 'Última vez', largura: '9rem' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim', largura: '4rem' },
];

const FILTROS: readonly OpcaoFiltro[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'ativas', rotulo: 'Ligadas' },
  { id: 'pausadas', rotulo: 'Desligadas' },
];

const ABAS: readonly ItemAba[] = [
  { id: 'automacoes', rotulo: 'Minhas automações' },
  { id: 'modelos', rotulo: 'Modelos prontos' },
  { id: 'historico', rotulo: 'Histórico' },
];

/**
 * Automações (`/automacoes`, líderes e direção): regras do tipo "quando acontecer X, faça Y".
 * Três visões — a lista, os modelos prontos e o histórico do que já rodou.
 */
@Component({
  selector: 'app-automacoes',
  imports: [
    Abas,
    Botao,
    CampoBusca,
    Cartao,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    HistoricoAutomacoes,
    MenuAcoes,
    ModelosProntos,
    Paginacao,
    RouterLink,
    Selo,
    Tabela,
  ],
  template: `
    <header class="cabecalho">
      <div>
        <h1 class="texto-display">Automações</h1>
        <p class="cabecalho__frase">
          Regras que trabalham por você: quando algo acontece, o CRM envia mensagens, cria tarefas e
          muda etapas sozinho.
        </p>
      </div>
      <a appBotao variante="marca" routerLink="/automacoes/nova" [icone]="iconeNova">
        Nova automação
      </a>
    </header>

    <app-abas
      rotulo="Visões de automações"
      [abas]="abas"
      [selecionada]="aba()"
      (selecionadaChange)="mudarAba($event)"
    />

    @switch (aba()) {
      @case ('modelos') {
        <app-modelos-prontos />
      }
      @case ('historico') {
        <app-cartao
          titulo="O que já rodou"
          dica="Cada linha é uma execução: uma automação rodando para um contato, negócio ou conversa. Abra uma para ver o passo a passo e, se falhou, tentar de novo."
        >
          <app-historico-automacoes />
        </app-cartao>
      }
      @default {
        <app-cartao>
          <div class="filtros">
            <app-campo-busca
              class="filtros__busca"
              rotulo="Buscar automação"
              placeholder="Buscar pelo nome…"
              [valor]="busca()"
              (valorChange)="busca.set($event)"
              (buscar)="buscar($event)"
            />
            <app-filtros-pilula
              rotulo="Situação"
              [opcoes]="filtros"
              [selecionado]="filtro()"
              (selecionadoChange)="mudarFiltro($event)"
            />
          </div>

          @if (erro(); as falha) {
            <app-estado-vazio
              variante="erro"
              titulo="Não foi possível carregar as automações"
              texto="Tente de novo em instantes."
              [falha]="falha"
              manterAcoes
            >
              <button appBotao type="button" variante="contorno" (click)="carregar()">
                Tentar de novo
              </button>
            </app-estado-vazio>
          } @else if (!carregando() && itens().length === 0) {
            @if (filtro() !== 'todas' || busca()) {
              <app-estado-vazio
                variante="busca"
                titulo="Nenhuma automação com esses filtros"
                texto="Mostre todas ou mude a busca."
              />
            } @else {
              <app-estado-vazio
                titulo="Você ainda não tem automações"
                texto="Comece por um modelo pronto ou crie uma do zero."
              >
                <button appBotao type="button" variante="marca" (click)="mudarAba('modelos')">
                  Ver modelos prontos
                </button>
              </app-estado-vazio>
            }
          } @else {
            <app-tabela
              rotulo="Automações"
              clicavel
              colunaPrincipal="nome"
              [colunas]="colunas"
              [linhas]="itens()"
              [carregando]="carregando()"
              (abrir)="abrir($event)"
            >
              <ng-template appCelula="nome" [appCelulaDe]="itens()" let-a>
                <span class="nome">{{ a.nome }}</span>
                @if (a.descricao) {
                  <span class="descricao">{{ a.descricao }}</span>
                }
              </ng-template>
              <ng-template appCelula="gatilho" [appCelulaDe]="itens()" let-a>{{
                a.gatilhoRotulo
              }}</ng-template>
              <ng-template appCelula="situacao" [appCelulaDe]="itens()" let-a>
                @if (a.ativa) {
                  <app-selo tamanho="sm" variante="menta" ponto>Ligada</app-selo>
                } @else if (a.pendencias.length) {
                  <app-selo tamanho="sm" variante="lima" ponto>Incompleta</app-selo>
                } @else {
                  <app-selo tamanho="sm" variante="neutro" ponto>Desligada</app-selo>
                }
              </ng-template>
              <ng-template appCelula="execucoes" [appCelulaDe]="itens()" let-a>
                {{ resumoExecucoes(a) }}
              </ng-template>
              <ng-template appCelula="ultima" [appCelulaDe]="itens()" let-a>
                @if (a.ultimaExecucaoEm) {
                  <time [title]="dataHora(a.ultimaExecucaoEm)">{{
                    tempo(a.ultimaExecucaoEm)
                  }}</time>
                } @else {
                  —
                }
              </ng-template>
              <ng-template appCelula="acoes" [appCelulaDe]="itens()" let-a>
                <app-menu-acoes
                  [rotulo]="'Ações de ' + a.nome"
                  [itens]="acoes(a)"
                  (escolher)="agir($event.id, a)"
                />
              </ng-template>
            </app-tabela>
            <app-paginacao
              rotulo="Páginas de automações"
              [total]="total()"
              [(pagina)]="pagina"
              [porPagina]="20"
              (paginaChange)="carregar()"
            />
          }
        </app-cartao>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-6);
      max-width: var(--largura-pagina, 1600px);
      min-width: 0;
    }
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--esp-4);
    }
    .cabecalho__frase {
      max-width: 60ch;
      margin: var(--esp-3) 0 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);
    }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--esp-3);
      margin-bottom: var(--esp-4);
    }
    .filtros__busca {
      flex: 1 1 14rem;
      max-width: 28rem;
      min-width: 0;
    }
    .nome {
      display: block;
      font-weight: 600;
    }
    .descricao {
      display: block;
      max-width: 48ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Automacoes {
  private readonly api = inject(AutomacoesApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  protected readonly iconeNova = LucidePlus;
  protected readonly colunas = COLUNAS;
  protected readonly filtros = FILTROS;
  protected readonly abas = ABAS;
  protected readonly aba = signal(this.abaInicial());
  protected readonly busca = signal('');
  protected readonly filtro = signal('todas');
  protected readonly pagina = signal(1);
  protected readonly itens = signal<readonly Automacao[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private sequencia = 0;

  constructor() {
    void this.carregar();
  }

  private abaInicial(): string {
    const aba = this.rota.snapshot.queryParamMap.get('aba');
    return ABAS.some((a) => a.id === aba) ? (aba as string) : 'automacoes';
  }

  protected mudarAba(id: string | null): void {
    const nova = id ?? 'automacoes';
    this.aba.set(nova);
    void this.router.navigate([], {
      queryParams: { aba: nova === 'automacoes' ? null : nova },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected buscar(texto: string): void {
    this.busca.set(texto);
    this.pagina.set(1);
    void this.carregar();
  }

  protected mudarFiltro(id: string | null): void {
    this.filtro.set(id ?? 'todas');
    this.pagina.set(1);
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const minha = ++this.sequencia;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.api.listar({
        ...(this.busca().trim() ? { busca: this.busca().trim() } : {}),
        ...(this.filtro() === 'ativas' ? { ativa: true } : {}),
        ...(this.filtro() === 'pausadas' ? { ativa: false } : {}),
        pagina: this.pagina(),
        porPagina: 20,
      });
      if (minha !== this.sequencia) return;
      this.itens.set(r.itens);
      this.total.set(r.total);
    } catch (falha) {
      if (minha === this.sequencia) this.erro.set(erroDaApi(falha));
    } finally {
      if (minha === this.sequencia) this.carregando.set(false);
    }
  }

  protected abrir(a: Automacao): void {
    void this.router.navigate(['/automacoes', a.id]);
  }

  protected dataHora(v: string): string {
    return formatarDataHora(v);
  }
  protected tempo(v: string): string {
    return formatarTempoRelativo(v);
  }

  protected resumoExecucoes(a: Automacao): string {
    const e = a.execucoes ?? {};
    const partes = (Object.keys(e) as StatusExecucao[])
      .filter((k) => (e[k] ?? 0) > 0)
      .map((k) => `${e[k]} ${ROTULO_STATUS_EXECUCAO[k].toLowerCase()}`);
    return partes.length ? partes.join(' · ') : 'Nenhuma ainda';
  }

  protected acoes(a: Automacao): readonly ItemMenuAcoes[] {
    return [
      a.ativa
        ? { id: 'pausar', rotulo: 'Desligar', icone: LucidePause }
        : {
            id: 'ativar',
            rotulo: 'Ligar',
            icone: LucidePlay,
            desabilitado: a.pendencias.length > 0,
            ...(a.pendencias.length ? { motivo: a.pendencias[0] } : {}),
          },
      { id: 'duplicar', rotulo: 'Duplicar', icone: LucideCopy },
      { id: 'excluir', rotulo: 'Excluir', icone: LucideTrash2, perigo: true, separarAntes: true },
    ];
  }

  protected async agir(acao: string, a: Automacao): Promise<void> {
    try {
      if (acao === 'ativar') {
        await this.api.ativar(a.id);
        this.avisos.sucesso(`“${a.nome}” está ligada.`);
      } else if (acao === 'pausar') {
        await this.api.pausar(a.id);
        this.avisos.sucesso(`“${a.nome}” foi desligada.`);
      } else if (acao === 'duplicar') {
        const copia = await this.api.duplicar(a.id);
        this.avisos.sucesso('Cópia criada, desligada.');
        await this.router.navigate(['/automacoes', copia.id]);
        return;
      } else if (acao === 'excluir') {
        const ok = await this.confirmacao.confirmar({
          titulo: 'Excluir esta automação?',
          mensagem: `“${a.nome}” será apagada e as execuções que ainda estão esperando serão canceladas. Isso não pode ser desfeito.`,
          confirmar: 'Excluir',
          perigo: true,
        });
        if (!ok) return;
        await this.api.excluir(a.id);
        this.avisos.sucesso('Automação excluída.');
      }
      await this.carregar();
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }
}
