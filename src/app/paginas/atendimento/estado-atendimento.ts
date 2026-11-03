import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { lerArmazenado, gravarArmazenado } from '../../nucleo/armazenamento';
import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { aoReceber, aoReconectar } from '../../nucleo/tempo-real/auxiliares';
import { AtendimentoApi, CONVERSAS_POR_PAGINA } from './atendimento.api';
import type {
  CanalDoAtendimento,
  ContadoresDeConversas,
  ConversaResumo,
  EscopoConversas,
  Fila,
  FiltrosConversas,
  RespostaRapida,
  StatusConversa,
  TipoCanal,
} from './atendimento.tipos';
import { cabeNoFiltro, ordenarConversas } from './apresentacao';

/** Situação das conversas em aberto ou resolvidas (as pílulas de status). */
export type SituacaoLista = 'EM_ABERTO' | 'PENDENTE' | 'RESOLVIDA';

export const STATUS_DA_SITUACAO: Readonly<Record<SituacaoLista, readonly StatusConversa[]>> = {
  EM_ABERTO: ['ABERTA', 'PENDENTE'],
  PENDENTE: ['PENDENTE'],
  RESOLVIDA: ['RESOLVIDA'],
};

/** Os filtros da lista como a tela os guarda (viram `FiltrosConversas` para a API). */
export interface FiltrosLista {
  readonly escopo: EscopoConversas;
  readonly situacao: SituacaoLista;
  readonly canais: readonly TipoCanal[];
  readonly filaId: string | null;
  readonly canalId: string | null;
  readonly etiqueta: string | null;
  readonly naoLidas: boolean;
  readonly slaEstourado: boolean;
  /** Só as conversas em que a IA (SDR) está atendendo; o filtro é feito na tela. */
  readonly atendidasPelaIa: boolean;
  readonly busca: string;
}

export const FILTROS_PADRAO: FiltrosLista = {
  escopo: 'TODAS',
  situacao: 'EM_ABERTO',
  canais: [],
  filaId: null,
  canalId: null,
  etiqueta: null,
  naoLidas: false,
  slaEstourado: false,
  atendidasPelaIa: false,
  busca: '',
};

/** Pedido de foco entre as partes da página (atalhos de teclado). */
export type AlvoFoco = 'lista' | 'busca' | 'compositor' | 'contato';

/** Depois de um evento do tempo real, a lista é conferida na API (contadores, paginação). */
export const ESPERA_CONFERENCIA_MS = 1_200;
/** O relógio da página (espera, SLA, "há 5 min") anda a cada 30 s. */
export const INTERVALO_RELOGIO_MS = 30_000;
/** A lista é conferida na API a cada minuto (prazos que estouram sem nenhum evento novo). */
export const INTERVALO_CONFERENCIA_MS = 60_000;

const CHAVE_FILTROS = 'crmbrl.atendimento.filtros';

export function paraFiltrosDaApi(
  filtros: FiltrosLista,
  porPagina = CONVERSAS_POR_PAGINA,
  pagina = 1,
): FiltrosConversas {
  return {
    escopo: filtros.escopo,
    status: STATUS_DA_SITUACAO[filtros.situacao],
    tipoCanal: filtros.canais,
    etiqueta: filtros.etiqueta ? [filtros.etiqueta] : [],
    naoLidas: filtros.naoLidas || undefined,
    slaEstourado: filtros.slaEstourado || undefined,
    // "Atendidas pela IA" = a IA está falando com o lead agora (situação ATIVA).
    ...(filtros.atendidasPelaIa ? { atendidasPelaIa: true, sdrSituacao: 'ATIVA' } : {}),
    busca: filtros.busca.trim() || undefined,
    ...(filtros.filaId ? { filaId: filtros.filaId } : {}),
    ...(filtros.canalId ? { canalId: filtros.canalId } : {}),
    pagina,
    porPagina,
  };
}

/** Quantos filtros além do escopo e da busca estão ligados (o número do botão "Filtros"). */
export function filtrosLigados(filtros: FiltrosLista): number {
  return (
    (filtros.situacao !== 'EM_ABERTO' ? 1 : 0) +
    (filtros.canais.length ? 1 : 0) +
    (filtros.filaId ? 1 : 0) +
    (filtros.canalId ? 1 : 0) +
    (filtros.etiqueta ? 1 : 0) +
    (filtros.naoLidas ? 1 : 0) +
    (filtros.slaEstourado ? 1 : 0) +
    (filtros.atendidasPelaIa ? 1 : 0)
  );
}

function lerFiltrosSalvos(chave: string): FiltrosLista {
  try {
    const salvo = JSON.parse(lerArmazenado(chave) ?? 'null') as Partial<FiltrosLista> | null;
    if (!salvo || typeof salvo !== 'object') {
      return FILTROS_PADRAO;
    }
    return {
      ...FILTROS_PADRAO,
      escopo: ['MINHAS', 'SEM_RESPONSAVEL', 'TODAS'].includes(salvo.escopo as string)
        ? (salvo.escopo as EscopoConversas)
        : FILTROS_PADRAO.escopo,
      situacao: ['EM_ABERTO', 'PENDENTE', 'RESOLVIDA'].includes(salvo.situacao as string)
        ? (salvo.situacao as SituacaoLista)
        : FILTROS_PADRAO.situacao,
    };
  } catch {
    return FILTROS_PADRAO;
  }
}

/**
 * Estado da caixa de entrada, compartilhado pela lista (`app-lista-conversas`) e pela conversa
 * aberta (rota filha): filtros, a lista com os contadores, os dados de apoio (canais, filas,
 * etiquetas, respostas rápidas) e o tempo real da lista. Fornecido pela página
 * (`providers: [EstadoAtendimento]`).
 */
@Injectable()
export class EstadoAtendimento {
  private readonly api = inject(AtendimentoApi);
  private readonly sessao = inject(SessaoService);

  readonly agora = signal(new Date());

  /**
   * O Atendimento não é do Marketing (R12; a API recusa pela área do papel, inclusive a
   * liderança): a página explica em vez de pedir dados que viriam com 403.
   */
  readonly semAcesso = computed(
    () => this.sessao.usuario()?.area === 'MARKETING' || !!this.falha()?.ehSemPermissao,
  );
  private readonly daArea = computed(() => this.sessao.usuario()?.area !== 'MARKETING');

  /** Os filtros ficam salvos por pessoa (o mesmo navegador pode ser usado por mais de uma). */
  private readonly chaveFiltros = `${CHAVE_FILTROS}:${this.sessao.usuario()?.id ?? 'anonimo'}`;
  readonly filtros = signal<FiltrosLista>(lerFiltrosSalvos(this.chaveFiltros));
  readonly conversas = signal<readonly ConversaResumo[]>([]);
  readonly contadores = signal<ContadoresDeConversas | null>(null);
  readonly total = signal(0);
  readonly situacao = signal<'carregando' | 'pronta' | 'erro'>('carregando');
  readonly falha = signal<ErroApi | null>(null);
  readonly carregandoMais = signal(false);
  readonly temMais = computed(() => this.conversas().length < this.total());

  /** A conversa aberta na rota filha (para a lista marcar e os atalhos andarem). */
  readonly selecionadaId = signal<string | null>(null);
  /** O painel do contato está visível ao lado da conversa (desktop). */
  readonly painelContato = signal(lerArmazenado('crmbrl.atendimento.painel') !== 'fechado');

  readonly canais = signal<readonly CanalDoAtendimento[]>([]);
  readonly filas = signal<readonly Fila[]>([]);
  readonly etiquetasEmUso = signal<readonly string[]>([]);
  readonly respostas = signal<readonly RespostaRapida[]>([]);

  /** Pedido de foco vindo dos atalhos (a parte que tem o alvo reage e zera). */
  readonly foco = signal<{ readonly alvo: AlvoFoco; readonly vez: number } | null>(null);

  private pagina = 1;
  private ultimoPedido = '';
  private carga: Subscription | null = null;
  private conferencia: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const filtros = this.filtros();
      untracked(() => {
        gravarArmazenado(
          this.chaveFiltros,
          JSON.stringify({ escopo: filtros.escopo, situacao: filtros.situacao }),
        );
        const pedido = JSON.stringify(paraFiltrosDaApi(filtros));
        if (pedido !== this.ultimoPedido) {
          this.ultimoPedido = pedido;
          this.carregar(filtros);
        }
      });
    });
    effect(() =>
      gravarArmazenado('crmbrl.atendimento.painel', this.painelContato() ? 'aberto' : 'fechado'),
    );

    aoReceber('conversa.nova', ({ conversa }) =>
      this.receber(conversa as unknown as ConversaResumo),
    );
    aoReceber('conversa.atualizada', ({ conversa }) =>
      this.receber(conversa as unknown as ConversaResumo),
    );
    aoReceber('mensagem.nova', ({ conversaId }) => {
      if (this.conversas().some((conversa) => conversa.id === conversaId)) {
        this.conferirDepois();
      }
    });
    aoReconectar(() => {
      this.conferirDepois(0);
      this.carregarApoio();
    });

    const relogio = setInterval(() => this.agora.set(new Date()), INTERVALO_RELOGIO_MS);
    const conferencia = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        this.conferirDepois(0);
      }
    }, INTERVALO_CONFERENCIA_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(relogio);
      clearInterval(conferencia);
      clearTimeout(this.conferencia);
      this.carga?.unsubscribe();
    });
    this.carregarApoio();
  }

  // Filtros ----------------------------------------------------------------------------------

  mudarFiltros(mudanca: Partial<FiltrosLista>): void {
    this.filtros.update((atuais) => ({ ...atuais, ...mudanca }));
  }

  /** Pedido de abrir o painel de filtros da lista (quando o link já chega filtrado). */
  readonly abrirFiltros = signal(false);

  /**
   * Aplica os filtros de um link de fora (`/atendimento?canalId=…&filaId=…`, os cliques do BI):
   * a lista começa pelo escopo "Todas" e abre o painel para a pessoa ver o que está filtrado.
   */
  aplicarDoLink(link: { readonly canalId?: string | null; readonly filaId?: string | null }): void {
    const canalId = link.canalId || null;
    const filaId = link.filaId || null;
    if (!canalId && !filaId) {
      return;
    }
    this.filtros.update(() => ({
      ...FILTROS_PADRAO,
      escopo: 'TODAS',
      situacao: 'EM_ABERTO',
      canalId,
      filaId,
    }));
    this.abrirFiltros.set(true);
  }

  limparFiltros(): void {
    this.filtros.update((atuais) => ({ ...FILTROS_PADRAO, escopo: atuais.escopo }));
  }

  // Lista ------------------------------------------------------------------------------------

  recarregar(): void {
    this.carregar(this.filtros());
  }

  private carregar(filtros: FiltrosLista): void {
    this.carga?.unsubscribe();
    if (!this.daArea()) {
      this.situacao.set('pronta');
      return;
    }
    this.pagina = 1;
    this.situacao.set('carregando');
    this.falha.set(null);
    this.carga = this.api.conversas(paraFiltrosDaApi(filtros)).subscribe({
      next: (pagina) => {
        this.conversas.set(pagina.itens);
        this.total.set(pagina.total);
        this.contadores.set(pagina.contadores);
        this.situacao.set('pronta');
      },
      error: (falha: unknown) => {
        this.falha.set(erroDaApi(falha));
        this.situacao.set('erro');
      },
    });
  }

  carregarMais(): void {
    if (this.carregandoMais() || !this.temMais()) {
      return;
    }
    this.carregandoMais.set(true);
    const proxima = this.pagina + 1;
    this.api.conversas(paraFiltrosDaApi(this.filtros(), CONVERSAS_POR_PAGINA, proxima)).subscribe({
      next: (pagina) => {
        this.pagina = proxima;
        const ids = new Set(this.conversas().map((conversa) => conversa.id));
        this.conversas.update((atuais) => [
          ...atuais,
          ...pagina.itens.filter((conversa) => !ids.has(conversa.id)),
        ]);
        this.total.set(pagina.total);
        this.contadores.set(pagina.contadores);
        this.carregandoMais.set(false);
      },
      error: () => this.carregandoMais.set(false),
    });
  }

  /**
   * Confere a lista na API sem piscar (contadores, quem entrou ou saiu do filtro): busca de
   * novo as páginas já mostradas e troca a lista quando chega.
   */
  conferirDepois(espera = ESPERA_CONFERENCIA_MS): void {
    clearTimeout(this.conferencia);
    this.conferencia = setTimeout(() => {
      if (this.situacao() !== 'pronta' || !this.daArea()) {
        return;
      }
      const porPagina = Math.min(100, Math.max(CONVERSAS_POR_PAGINA, this.conversas().length));
      this.api.conversas(paraFiltrosDaApi(this.filtros(), porPagina)).subscribe({
        next: (pagina) => {
          this.conversas.set(pagina.itens);
          this.total.set(pagina.total);
          this.contadores.set(pagina.contadores);
          this.pagina = Math.max(1, Math.ceil(pagina.itens.length / CONVERSAS_POR_PAGINA));
        },
        error: () => undefined,
      });
    }, espera);
  }

  /**
   * Uma conversa nova ou alterada (tempo real ou resposta de uma ação): entra, muda ou sai da
   * lista conforme os filtros, e a lista é conferida na API logo depois.
   */
  receber(conversa: ConversaResumo): void {
    if (!conversa?.id || !conversa.canal || !conversa.contato) {
      this.conferirDepois();
      return;
    }
    const usuarioId = this.sessao.usuario()?.id ?? null;
    const cabe = cabeNoFiltro(conversa, paraFiltrosDaApi(this.filtros()), usuarioId);
    this.conversas.update((atuais) => {
      const sem = atuais.filter((item) => item.id !== conversa.id);
      return cabe ? ordenarConversas([...sem, conversa]) : sem;
    });
    this.conferirDepois();
  }

  /** Zera as não lidas de uma conversa na lista (ao abrir), sem esperar a API. */
  marcarLidaNaLista(id: string): void {
    this.conversas.update((atuais) =>
      atuais.map((conversa) => (conversa.id === id ? { ...conversa, naoLidas: 0 } : conversa)),
    );
  }

  // Apoio ------------------------------------------------------------------------------------

  carregarApoio(): void {
    if (!this.daArea()) {
      return;
    }
    this.api
      .canais()
      .subscribe({ next: (canais) => this.canais.set(canais), error: () => undefined });
    this.api.filas().subscribe({ next: (filas) => this.filas.set(filas), error: () => undefined });
    this.recarregarEtiquetas();
    this.api.respostasRapidas().subscribe({
      next: (respostas) => this.respostas.set(respostas.filter((resposta) => resposta.ativa)),
      error: () => undefined,
    });
  }

  recarregarEtiquetas(): void {
    this.api.etiquetas().subscribe({
      next: (etiquetas) => this.etiquetasEmUso.set(etiquetas),
      error: () => undefined,
    });
  }

  // Navegação e foco -------------------------------------------------------------------------

  /** A conversa vizinha da aberta na lista (`+1` próxima, `-1` anterior). */
  vizinha(passo: 1 | -1): ConversaResumo | null {
    const lista = this.conversas();
    if (!lista.length) {
      return null;
    }
    const atual = lista.findIndex((conversa) => conversa.id === this.selecionadaId());
    if (atual === -1) {
      return passo === 1 ? lista[0] : lista[lista.length - 1];
    }
    return lista[atual + passo] ?? null;
  }

  pedirFoco(alvo: AlvoFoco): void {
    this.foco.set({ alvo, vez: Date.now() });
  }
}
