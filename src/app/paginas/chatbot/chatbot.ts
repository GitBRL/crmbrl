import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCopy,
  LucideExternalLink,
  LucidePlay,
  LucidePlus,
  LucidePause,
  LucideRefreshCw,
  LucideTrash2,
} from '@lucide/angular';

import { type Pagina } from '../../nucleo/api/api';
import { AvisosService } from '../../nucleo/avisos.service';
import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarTempoRelativo } from '../../nucleo/formatos';
import { Botao } from '../../ui/botao/botao';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { type ColunaTabela, Tabela } from '../../ui/tabela/tabela';
import { ChatbotApi } from './chatbot.api';
import { type FluxoResumo, type GatilhoFluxo, ROTULO_GATILHO } from './chatbot.tipos';

const SITUACOES: readonly OpcaoFiltro[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'inativos', rotulo: 'Desligados' },
];

const GATILHOS: readonly OpcaoSeletor<GatilhoFluxo>[] = (
  Object.keys(ROTULO_GATILHO) as GatilhoFluxo[]
).map((valor) => ({ valor, rotulo: ROTULO_GATILHO[valor] }));

const COLUNAS: readonly ColunaTabela[] = [
  { id: 'nome', rotulo: 'Fluxo', noCartao: 'titulo' },
  { id: 'gatilho', rotulo: 'Começa quando' },
  { id: 'situacao', rotulo: 'Situação' },
  { id: 'conversas', rotulo: 'Conversas' },
  { id: 'atualizado', rotulo: 'Alterado' },
  { id: 'acoes', rotulo: 'Ações', rotuloOculto: true, alinhar: 'fim', fixa: true },
];

/**
 * Chatbot (`/chatbot`, líderes e direção): os fluxos que recebem o cliente antes de uma pessoa.
 * Lista com busca e filtros, e ações rápidas (ligar, desligar, duplicar, excluir).
 */
@Component({
  selector: 'app-chatbot',
  imports: [
    Botao,
    CampoBusca,
    Cartao,
    CelulaTabela,
    EstadoVazio,
    FiltrosPilula,
    MenuAcoes,
    Paginacao,
    RouterLink,
    Selo,
    Seletor,
    Tabela,
  ],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chatbot {
  private readonly api = inject(ChatbotApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  protected readonly iconeNovo = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly situacoes = SITUACOES;
  protected readonly gatilhos = GATILHOS;
  protected readonly colunas = COLUNAS;
  protected nomeDoGatilho(gatilho: GatilhoFluxo): string {
    return ROTULO_GATILHO[gatilho];
  }

  protected readonly busca = signal('');
  protected readonly situacao = signal<string | null>('todos');
  protected readonly gatilho = signal<GatilhoFluxo | null>(null);
  protected readonly pagina = signal(1);
  protected readonly porPagina = signal(20);

  protected readonly dados = signal<Pagina<FluxoResumo> | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  private pedido = 0;
  private ocupados = new Set<string>();

  protected readonly linhas = computed(() => this.dados()?.itens ?? []);
  protected readonly filtrando = computed(
    () => this.busca().trim() !== '' || this.situacao() !== 'todos' || this.gatilho() !== null,
  );

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    const atual = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const situacao = this.situacao();
      const resposta = await this.api.listar({
        busca: this.busca().trim() || undefined,
        ativo: situacao === 'ativos' ? true : situacao === 'inativos' ? false : null,
        gatilho: this.gatilho(),
        pagina: this.pagina(),
        porPagina: this.porPagina(),
      });
      if (atual === this.pedido) {
        this.dados.set(resposta);
      }
    } catch (falha) {
      if (atual === this.pedido) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (atual === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  protected filtrou(): void {
    this.pagina.set(1);
    void this.carregar();
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.situacao.set('todos');
    this.gatilho.set(null);
    this.filtrou();
  }

  protected abrir(fluxo: FluxoResumo): void {
    void this.router.navigate(['/chatbot', fluxo.id]);
  }

  protected linkDoFluxo = (fluxo: FluxoResumo): readonly string[] => ['/chatbot', fluxo.id];

  protected quando(data: string): string {
    return formatarTempoRelativo(data);
  }

  protected acoesDe(fluxo: FluxoResumo): readonly ItemMenuAcoes[] {
    const semEdicao = fluxo.podeEditar ? undefined : 'Só quem cuida da área edita este fluxo.';
    return [
      { id: 'abrir', rotulo: 'Abrir', icone: LucideExternalLink },
      fluxo.ativo
        ? {
            id: 'desligar',
            rotulo: 'Desligar',
            icone: LucidePause,
            desabilitado: !fluxo.podeEditar,
            motivo: semEdicao,
          }
        : {
            id: 'ligar',
            rotulo: 'Ligar',
            icone: LucidePlay,
            desabilitado: !fluxo.podeEditar || !fluxo.versaoPublicada,
            motivo: !fluxo.podeEditar
              ? semEdicao
              : !fluxo.versaoPublicada
                ? 'Publique o fluxo antes de ligar.'
                : undefined,
          },
      {
        id: 'duplicar',
        rotulo: 'Duplicar',
        icone: LucideCopy,
        desabilitado: !fluxo.podeEditar,
        motivo: semEdicao,
      },
      {
        id: 'excluir',
        rotulo: 'Excluir',
        icone: LucideTrash2,
        perigo: true,
        desabilitado: !fluxo.podeEditar,
        motivo: semEdicao,
      },
    ];
  }

  protected async executar(fluxo: FluxoResumo, item: ItemMenuAcoes): Promise<void> {
    if (this.ocupados.has(fluxo.id)) {
      return;
    }
    this.ocupados.add(fluxo.id);
    try {
      switch (item.id) {
        case 'abrir':
          this.abrir(fluxo);
          break;
        case 'ligar':
          await this.api.ativar(fluxo.id);
          this.avisos.sucesso(`“${fluxo.nome}” está ligado e atende as conversas novas.`);
          await this.carregar();
          break;
        case 'desligar':
          await this.api.desativar(fluxo.id);
          this.avisos.sucesso(
            `“${fluxo.nome}” foi desligado. As conversas em andamento terminam normalmente.`,
          );
          await this.carregar();
          break;
        case 'duplicar': {
          const copia = await this.api.duplicar(fluxo.id);
          this.avisos.sucesso('Cópia criada, desligada e só com o rascunho.');
          await this.router.navigate(['/chatbot', copia.id]);
          break;
        }
        case 'excluir': {
          const ok = await this.confirmacao.confirmar({
            titulo: `Excluir “${fluxo.nome}”?`,
            mensagem:
              'O fluxo some da lista e as conversas que ele ainda atende deixam de ser atendidas pelo robô.',
            detalhes:
              fluxo.contadores.emAndamento > 0
                ? [`${fluxo.contadores.emAndamento} conversas em andamento serão canceladas.`]
                : undefined,
            confirmar: 'Excluir fluxo',
            perigo: true,
            executar: () => this.api.excluir(fluxo.id),
          });
          if (ok) {
            this.avisos.sucesso('Fluxo excluído.');
            await this.carregar();
          }
          break;
        }
      }
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.ocupados.delete(fluxo.id);
    }
  }
}
