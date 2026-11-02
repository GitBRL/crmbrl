import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideBell, LucidePlus } from '@lucide/angular';

import type { Pagina } from '../../nucleo/api/api';
import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { Cartao } from '../../ui/cartao/cartao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { GRUPOS_PENDENTES, ROTULO_GRUPO, TIPOS, TIPOS_DA_AGENDA } from './apresentacao';
import {
  AtividadesApi,
  LIMITE_POR_GRUPO,
  type Atividade,
  type AtividadesAgrupadas,
  type EscopoAtividades,
  type FiltrosAtividades,
  type GrupoAtividade,
  type GrupoDeAtividades,
  type TipoAtividade,
} from './atividades.api';
import { CriacaoRapida } from './criacao-rapida';
import { DetalheAtividade, type MudancaAtividade } from './detalhe-atividade';
import { ItemAtividade, type AcaoItem } from './item-atividade';

type Estado = 'carregando' | 'pronto' | 'erro';
type IdAba = 'pendentes' | 'concluidas';

/** Concluídas por página, na aba "Concluídas". */
export const CONCLUIDAS_POR_PAGINA = 20;
/** O relógio da página (rótulos "hoje", "amanhã", "há 5 min") anda de minuto em minuto. */
const INTERVALO_RELOGIO_MS = 60_000;
/** Quanto tempo o destaque de uma atividade nova fica. */
const DURACAO_DESTAQUE_MS = 2400;

const ROTULO_ESCOPO: Readonly<Record<EscopoAtividades, string>> = {
  MINHAS: 'Minhas',
  EQUIPE: 'Da equipe',
  TODAS: 'Todas',
};

/**
 * Atividades (`/atividades`, TELAS-FASE1 §5): criação rápida no topo; filtros por escopo
 * (minhas · da equipe para líderes e C-level · todas para C-level e Admin) e por tipo; a
 * agenda agrupada — Atrasadas (coral), Hoje, Próximos 7 dias, Mais tarde e Sem data — e a aba
 * Concluídas, paginada. Concluir é a caixa grande de cada linha, com "Desfazer" no aviso. O
 * painel de detalhe abre por `?atividade=<id>` (também o link das notificações). Ao lado, o
 * resumo por grupo e as atividades recebidas por desligamento (R7.3).
 */
@Component({
  selector: 'app-atividades',
  imports: [
    Abas,
    Botao,
    BotaoIcone,
    Cartao,
    CriacaoRapida,
    DetalheAtividade,
    EstadoVazio,
    Esqueleto,
    FiltrosPilula,
    ItemAtividade,
    LucideBell,
    Paginacao,
    Selo,
  ],
  templateUrl: './atividades.html',
  styleUrl: './atividades.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Atividades {
  private readonly api = inject(AtividadesApi);
  private readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Atividade a abrir no painel (query `atividade`, vinda das notificações). */
  readonly atividade = input<string | null>(null);

  protected readonly iconeNova = LucidePlus;
  /** Linhas dos dois cartões-esqueleto da agenda. */
  protected readonly esqueleto = [
    [1, 2, 3],
    [1, 2],
  ];
  protected readonly rotuloGrupo = ROTULO_GRUPO;
  protected readonly agora = signal(new Date());
  /** "21 de outubro": o segundo tom do título. */
  protected readonly hoje = computed(() =>
    new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(this.agora()),
  );

  // Filtros --------------------------------------------------------------------------------

  protected readonly escopo = signal<EscopoAtividades>('MINHAS');
  protected readonly tipos = signal<readonly TipoAtividade[]>([]);
  protected readonly filtros = computed<FiltrosAtividades>(() => ({
    escopo: this.escopo(),
    tipos: this.tipos(),
  }));

  /** Da equipe: quem lidera alguém (líderes e o C-level, que lidera os líderes). */
  private readonly temEquipe = computed(
    () => this.sessao.ehLider() || this.sessao.papel() === 'C_LEVEL',
  );
  private readonly veTodas = computed(() =>
    this.sessao.permite((permissoes) => permissoes.verAtividades === 'TODOS'),
  );
  protected readonly opcoesEscopo = computed<readonly OpcaoFiltro[]>(() => [
    { id: 'MINHAS', rotulo: ROTULO_ESCOPO.MINHAS },
    {
      id: 'EQUIPE',
      rotulo: ROTULO_ESCOPO.EQUIPE,
      desabilitada: !this.temEquipe(),
      motivo: 'Só líderes e C-level têm equipe.',
    },
    {
      id: 'TODAS',
      rotulo: ROTULO_ESCOPO.TODAS,
      desabilitada: !this.veTodas(),
      motivo: 'Só C-level e Admin veem as atividades de todos.',
    },
  ]);
  protected readonly opcoesTipo: readonly OpcaoFiltro[] = TIPOS_DA_AGENDA.map((tipo) => ({
    id: tipo,
    rotulo: TIPOS[tipo].rotulo,
    icone: TIPOS[tipo].icone,
  }));
  protected readonly comFiltroDeTipo = computed(() => this.tipos().length > 0);

  // Abas -----------------------------------------------------------------------------------

  protected readonly abas: readonly ItemAba[] = [
    { id: 'pendentes', rotulo: 'Pendentes' },
    { id: 'concluidas', rotulo: 'Concluídas' },
  ];
  protected readonly aba = signal<IdAba>('pendentes');

  // Agenda (pendentes) ---------------------------------------------------------------------

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly agenda = signal<AtividadesAgrupadas | null>(null);
  /**
   * A agenda não carregou (na aba Pendentes): o estado de erro sobe para o topo da coluna, antes
   * da criação rápida, e os filtros e as abas saem até "Tentar de novo" dar certo.
   */
  protected readonly falhaDaAgenda = computed(() =>
    this.aba() === 'pendentes' && this.estado() === 'erro' ? this.erro() : null,
  );
  /** Grupos com "Mostrar mais": quantas atividades cada um mostra. */
  private readonly limites = signal<Partial<Record<GrupoAtividade, number>>>({});
  protected readonly carregandoMais = signal<GrupoAtividade | null>(null);

  protected readonly gruposPendentes = computed<readonly GrupoDeAtividades[]>(() => {
    const agenda = this.agenda();
    if (!agenda) {
      return [];
    }
    return GRUPOS_PENDENTES.map((id) => agenda.grupos.find((grupo) => grupo.grupo === id)).filter(
      (grupo): grupo is GrupoDeAtividades => !!grupo && grupo.total > 0,
    );
  });
  protected readonly totalPendentes = computed(() =>
    this.gruposPendentes().reduce((soma, grupo) => soma + grupo.total, 0),
  );
  /** O resumo ao lado: todos os grupos, inclusive os vazios. */
  protected readonly resumo = computed(() => {
    const agenda = this.agenda();
    return [...GRUPOS_PENDENTES, 'CONCLUIDAS' as const].map((id) => ({
      grupo: id,
      rotulo: ROTULO_GRUPO[id],
      total: agenda?.grupos.find((grupo) => grupo.grupo === id)?.total ?? 0,
    }));
  });
  protected readonly rotuloEscopo = computed(() =>
    ROTULO_ESCOPO[this.escopo()].toLocaleLowerCase('pt-BR'),
  );

  // Concluídas -----------------------------------------------------------------------------

  protected readonly concluidas = signal<Pagina<Atividade> | null>(null);
  protected readonly estadoConcluidas = signal<Estado>('carregando');
  protected readonly erroConcluidas = signal<ErroApi | null>(null);
  protected readonly paginaConcluidas = signal(1);
  protected readonly porPaginaConcluidas = CONCLUIDAS_POR_PAGINA;

  // Encaminhadas por desligamento (R7.3) ---------------------------------------------------

  protected readonly encaminhadas = signal<{ readonly total: number; readonly nomes: string }>({
    total: 0,
    nomes: '',
  });

  // Ações em andamento ---------------------------------------------------------------------

  /** Marcação otimista da caixa enquanto a API responde. */
  protected readonly marcadas = signal<ReadonlyMap<string, boolean>>(new Map());
  protected readonly destacada = signal<string | null>(null);
  /** "Editar" no menu da lista: o painel abre já no formulário. */
  protected readonly editarId = signal<string | null>(null);

  private readonly criacao = viewChild.required(CriacaoRapida);
  private versao = 0;
  private versaoConcluidas = 0;
  private esperaDestaque: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const relogio = setInterval(() => this.agora.set(new Date()), INTERVALO_RELOGIO_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(relogio);
      clearTimeout(this.esperaDestaque);
    });

    // Filtros novos: a agenda recomeça (sem os "mostrar mais"), e a aba aberta também.
    effect(() => {
      this.filtros();
      untracked(() => {
        this.limites.set({});
        void this.carregar();
        void this.carregarEncaminhadas();
        this.concluidas.set(null);
        if (this.aba() === 'concluidas') {
          this.paginaConcluidas.set(1);
          void this.carregarConcluidas();
        }
      });
    });
  }

  /** Ação principal: leva o foco ao campo da criação rápida. */
  protected focarCriacao(): void {
    this.criacao().focar();
  }

  protected escolherAba(id: string | null): void {
    const aba: IdAba = id === 'concluidas' ? 'concluidas' : 'pendentes';
    this.aba.set(aba);
    if (aba === 'concluidas' && !this.concluidas()) {
      void this.carregarConcluidas();
    }
  }

  protected escolherEscopo(id: string | null): void {
    if (id === 'MINHAS' || id === 'EQUIPE' || id === 'TODAS') {
      this.escopo.set(id);
    }
  }

  protected escolherTipos(ids: readonly string[]): void {
    this.tipos.set(ids.filter((id): id is TipoAtividade => id in TIPOS));
  }

  protected limparFiltros(): void {
    this.tipos.set([]);
  }

  protected mostrarResponsavel(atividade: Atividade): boolean {
    return this.escopo() !== 'MINHAS' || atividade.responsavel.id !== this.sessao.usuario()?.id;
  }

  protected tentarDeNovo(): void {
    void this.carregar();
  }

  /** Clique numa linha do resumo: abre a aba certa e leva até o grupo. */
  protected irParaGrupo(grupo: GrupoAtividade): void {
    if (grupo === 'CONCLUIDAS') {
      this.escolherAba('concluidas');
      return;
    }
    this.aba.set('pendentes');
    afterNextRender(
      () => {
        const titulo = this.host.nativeElement.querySelector<HTMLElement>(`#titulo-grupo-${grupo}`);
        titulo?.scrollIntoView({ block: 'start' });
        titulo?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected async mostrarMais(grupo: GrupoDeAtividades): Promise<void> {
    const limite = Math.min(100, grupo.itens.length + LIMITE_POR_GRUPO);
    this.carregandoMais.set(grupo.grupo);
    try {
      const pagina = await this.api.listar(this.filtros(), {
        grupo: grupo.grupo,
        porPagina: limite,
      });
      this.limites.update((limites) => ({ ...limites, [grupo.grupo]: limite }));
      this.substituirItens(grupo.grupo, pagina.itens, pagina.total);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.carregandoMais.set(null);
    }
  }

  /** A caixa da linha: concluir (com "Desfazer" no aviso) ou reabrir. */
  protected async alternar(atividade: Atividade, concluir: boolean): Promise<void> {
    if (this.marcadas().has(atividade.id)) {
      return;
    }
    const proxima = this.vizinha(atividade.id);
    this.marcar(atividade.id, concluir);
    try {
      if (concluir) {
        const concluida = await this.api.concluir(atividade.id);
        this.avisos.sucesso('Atividade concluída.', {
          chave: `conclusao-${atividade.id}`,
          acao: { rotulo: 'Desfazer', executar: () => void this.desfazer(concluida) },
        });
      } else {
        await this.api.reabrir(atividade.id);
        this.avisos.sucesso('Atividade reaberta.', { chave: `conclusao-${atividade.id}` });
      }
      await this.recarregarTudo();
      this.focarLinha(proxima);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.desmarcar(atividade.id);
    }
  }

  protected agir(atividade: Atividade, acao: AcaoItem): void {
    switch (acao) {
      case 'editar':
        this.editarId.set(atividade.id);
        this.abrir(atividade.id);
        break;
      case 'cancelar':
        void this.cancelar(atividade);
        break;
      case 'reabrir':
        void this.alternar(atividade, false);
        break;
    }
  }

  protected aoCriar(atividade: Atividade): void {
    this.destacar(atividade.id);
    if (this.aba() !== 'pendentes') {
      this.aba.set('pendentes');
    }
    void this.recarregarTudo();
  }

  protected aoMudarNoPainel(mudanca: MudancaAtividade): void {
    if (mudanca.acao === 'alterada' || mudanca.acao === 'reaberta') {
      this.destacar(mudanca.atividade.id);
    }
    void this.recarregarTudo();
  }

  protected fecharPainel(): void {
    this.editarId.set(null);
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { atividade: null },
      queryParamsHandling: 'merge',
    });
  }

  protected irParaPaginaConcluidas(pagina: number): void {
    this.paginaConcluidas.set(pagina);
    void this.carregarConcluidas();
  }

  // Carregamento ---------------------------------------------------------------------------

  /** Agenda (com os "mostrar mais" abertos). `silencioso`: sem esqueleto, mantém a lista. */
  private async carregar(silencioso = false): Promise<void> {
    const versao = ++this.versao;
    const filtros = this.filtros();
    const limites = this.limites();
    if (!silencioso) {
      this.estado.set('carregando');
      this.erro.set(null);
    }
    try {
      const [agenda, ...extras] = await Promise.all([
        this.api.agrupadas(filtros),
        ...Object.entries(limites).map(([grupo, porPagina]) =>
          this.api
            .listar(filtros, { grupo: grupo as GrupoAtividade, porPagina })
            .then((pagina) => ({ grupo: grupo as GrupoAtividade, pagina })),
        ),
      ]);
      if (versao !== this.versao) {
        return;
      }
      this.agenda.set({
        ...agenda,
        grupos: agenda.grupos.map((grupo) => {
          const extra = extras.find((item) => item.grupo === grupo.grupo);
          return extra ? { ...grupo, itens: extra.pagina.itens, total: extra.pagina.total } : grupo;
        }),
      });
      this.estado.set('pronto');
    } catch (falha) {
      if (versao !== this.versao) {
        return;
      }
      if (silencioso && this.agenda()) {
        this.avisos.erro(falha);
      } else {
        this.erro.set(erroDaApi(falha));
        this.estado.set('erro');
      }
    }
  }

  private async carregarConcluidas(): Promise<void> {
    const versao = ++this.versaoConcluidas;
    if (!this.concluidas()) {
      this.estadoConcluidas.set('carregando');
    }
    this.erroConcluidas.set(null);
    try {
      const pagina = await this.api.listar(this.filtros(), {
        grupo: 'CONCLUIDAS',
        pagina: this.paginaConcluidas(),
        porPagina: CONCLUIDAS_POR_PAGINA,
      });
      if (versao !== this.versaoConcluidas) {
        return;
      }
      // A página ficou vazia (a última atividade dela foi reaberta): volta uma.
      if (pagina.itens.length === 0 && pagina.pagina > 1) {
        this.paginaConcluidas.set(pagina.pagina - 1);
        return this.carregarConcluidas();
      }
      this.concluidas.set(pagina);
      this.estadoConcluidas.set('pronto');
    } catch (falha) {
      if (versao !== this.versaoConcluidas) {
        return;
      }
      this.erroConcluidas.set(erroDaApi(falha));
      this.estadoConcluidas.set('erro');
    }
  }

  /** Quantas pendentes vieram de desligamentos, e de quem (o cartão ao lado). */
  private async carregarEncaminhadas(): Promise<void> {
    try {
      const pagina = await this.api.listar(this.filtros(), {
        encaminhadas: true,
        status: ['PENDENTE'],
        porPagina: 50,
      });
      const nomes = [
        ...new Set(pagina.itens.map((atividade) => atividade.encaminhadaDe?.nome).filter(Boolean)),
      ] as string[];
      this.encaminhadas.set({ total: pagina.total, nomes: listarNomes(nomes) });
    } catch {
      // O cartão é um complemento: sem ele a página continua inteira.
      this.encaminhadas.set({ total: 0, nomes: '' });
    }
  }

  private async recarregarTudo(): Promise<void> {
    await Promise.all([
      this.carregar(true),
      this.carregarEncaminhadas(),
      this.concluidas() ? this.carregarConcluidas() : Promise.resolve(),
    ]);
  }

  // Apoio ----------------------------------------------------------------------------------

  private abrir(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { atividade: id },
      queryParamsHandling: 'merge',
    });
  }

  private async cancelar(atividade: Atividade): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: `Cancelar “${atividade.titulo}”?`,
      mensagem:
        'A atividade sai da agenda e não gera mais lembretes. Ela continua na linha do tempo e pode ser reaberta depois.',
      confirmar: 'Cancelar atividade',
      cancelar: 'Manter',
      perigo: true,
      executar: () => this.api.cancelar(atividade.id),
    });
    if (!confirmou) {
      return;
    }
    this.avisos.sucesso('Atividade cancelada.', {
      acao: { rotulo: 'Desfazer', executar: () => void this.desfazer(atividade) },
    });
    const proxima = this.vizinha(atividade.id);
    await this.recarregarTudo();
    this.focarLinha(proxima);
  }

  /** "Desfazer" dos avisos: reabre e destaca a atividade de volta na lista. */
  private async desfazer(atividade: Atividade): Promise<void> {
    try {
      await this.api.reabrir(atividade.id);
      this.avisos.sucesso('Atividade reaberta.', { chave: `conclusao-${atividade.id}` });
      this.destacar(atividade.id);
      await this.recarregarTudo();
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  private substituirItens(grupo: GrupoAtividade, itens: readonly Atividade[], total: number) {
    this.agenda.update((agenda) =>
      agenda
        ? {
            ...agenda,
            grupos: agenda.grupos.map((item) =>
              item.grupo === grupo ? { ...item, itens, total } : item,
            ),
          }
        : agenda,
    );
  }

  /** A linha que recebe o foco quando esta sair da lista: a seguinte, ou a anterior. */
  private vizinha(id: string): string | null {
    const visiveis =
      this.aba() === 'concluidas'
        ? (this.concluidas()?.itens ?? [])
        : this.gruposPendentes().flatMap((grupo) => grupo.itens);
    const indice = visiveis.findIndex((atividade) => atividade.id === id);
    if (indice < 0) {
      return null;
    }
    return visiveis[indice + 1]?.id ?? visiveis[indice - 1]?.id ?? null;
  }

  /** Foco na caixa de uma linha (ou no começo da lista, se ela não existe mais). */
  private focarLinha(id: string | null): void {
    afterNextRender(
      () => {
        const raiz = this.host.nativeElement;
        const caixa = id
          ? raiz.querySelector<HTMLInputElement>(`[data-atividade="${id}"] input[type="checkbox"]`)
          : null;
        const alvo = caixa ?? raiz.querySelector<HTMLElement>('.lista__ancora');
        alvo?.focus();
      },
      { injector: this.injector },
    );
  }

  private marcar(id: string, valor: boolean): void {
    this.marcadas.update((mapa) => new Map(mapa).set(id, valor));
  }

  private desmarcar(id: string): void {
    this.marcadas.update((mapa) => {
      const novo = new Map(mapa);
      novo.delete(id);
      return novo;
    });
  }

  private destacar(id: string): void {
    clearTimeout(this.esperaDestaque);
    this.destacada.set(id);
    this.esperaDestaque = setTimeout(() => this.destacada.set(null), DURACAO_DESTAQUE_MS);
  }
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export function listarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) {
    return nomes[0] ?? '';
  }
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
