import {
  CdkDrag,
  type CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  type DragStartDelay,
} from '@angular/cdk/drag-drop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkScrollable } from '@angular/cdk/scrolling';
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
  LOCALE_ID,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  LucideChevronsLeft,
  LucideChevronsRight,
  LucidePlus,
  LucideSettings,
  LucideSlidersHorizontal,
} from '@lucide/angular';

import { gravarArmazenado, lerArmazenado } from '../../nucleo/armazenamento';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarMoedaAbreviada, paraNumero } from '../../nucleo/formatos';
import { type Area, areaDoSlug, ROTULO_AREA, SLUG_AREA } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { type AcaoCartao, CartaoNegocio } from './cartao-negocio';
import { ConfigurarEtapas } from './configurar-etapas';
import { EstadoQuadro, type Movimento } from './estado-quadro';
import type { ColunaQuadro, Funil, Negocio } from './funis.tipos';
import { MotivoPerda } from './motivo-perda';
import { NovoNegocio } from './novo-negocio';
import { RegrasFunil } from './regras-funil';
import {
  ehFechada,
  ehVisao,
  FRASE_DO_FUNIL,
  type Lugar,
  lugarDoNegocio,
  mensagemDaMovimentacao,
  mostraValores,
  nomeDoItem,
  opcoesDeVisao,
  podeConfigurarFunil,
  podeReabrir,
  podeSerResponsavel,
  somarValores,
  textoPrazo,
} from './regras-funis';

const CHAVE_RECOLHIDAS = 'crmbrl.funis.recolhidas';
/** No toque, segurar um pouco antes de arrastar (deslizar o dedo continua rolando a tela). */
const ATRASO_ARRASTE: DragStartDelay = { touch: 250, mouse: 0 };
const ESPERA_BUSCA_MS = 350;

/** Cartão pego pelo teclado: o original e de onde saiu. */
interface Pego {
  readonly negocio: Negocio;
  readonly origem: Lugar;
}

/**
 * Quadro (kanban) do funil — `/funis/:area` (TELAS-FASE1 §3.1). Colunas = etapas, cartões
 * arrastáveis com o CDK (mouse, toque e teclado), filtros "Meus · Da equipe · Todos", busca e
 * etiqueta, "Novo negócio" e "Configurar etapas". O detalhe do negócio abre no
 * `<router-outlet>` (rota filha `:negocioId`), num painel sobre o quadro.
 *
 * Movimentação otimista: o cartão muda de lugar na hora; soltar na perda pede o motivo (R5.5,
 * cancelar desfaz); a API recusando, o cartão volta e o aviso diz por quê. Teclado: Espaço
 * pega, setas movem, Espaço solta, Esc cancela — com anúncios pelo `LiveAnnouncer`.
 */
@Component({
  selector: 'app-quadro-funil',
  imports: [
    Botao,
    BotaoIcone,
    CampoBusca,
    CartaoNegocio,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    CdkScrollable,
    ConfigurarEtapas,
    Dica,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    MotivoPerda,
    NovoNegocio,
    RegrasFunil,
    RouterOutlet,
    Seletor,
    Selo,
  ],
  providers: [EstadoQuadro],
  templateUrl: './quadro.html',
  styleUrl: './quadro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuadroFunil {
  /** `marketing`, `comercial` ou `cs` (parâmetro `:area`). */
  readonly area = input.required<string>();
  /** Funil específico da área (query `funil`), quando há mais de um. */
  readonly funil = input<string | null>(null);

  protected readonly estado = inject(EstadoQuadro);
  protected readonly sessao = inject(SessaoService);
  private readonly avisos = inject(AvisosService);
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);

  protected readonly icones = {
    mais: LucidePlus,
    configurar: LucideSettings,
    recolher: LucideChevronsRight,
    expandir: LucideChevronsLeft,
    filtros: LucideSlidersHorizontal,
  };
  protected readonly atrasoArraste = ATRASO_ARRASTE;

  protected readonly areaAtual = computed<Area>(() => areaDoSlug(this.area()) ?? 'COMERCIAL');
  protected readonly slug = computed(() => SLUG_AREA[this.areaAtual()]);
  protected readonly frase = computed(() => FRASE_DO_FUNIL[this.areaAtual()]);
  protected readonly mostrarValores = computed(() => mostraValores(this.areaAtual()));
  protected readonly itens = computed(() => nomeDoItem(this.areaAtual(), true));
  protected readonly titulo = computed(() => this.estado.funil()?.nome ?? this.rotuloArea());
  protected readonly complemento = computed(() =>
    this.estado.situacao() === 'pronto' ? `${this.estado.totalAbertos()} em aberto` : null,
  );
  protected readonly podeConfigurar = computed(() =>
    podeConfigurarFunil(this.sessao.perfil(), this.areaAtual()),
  );
  protected readonly podeReabrir = computed(() =>
    podeReabrir(this.sessao.perfil(), this.areaAtual()),
  );
  protected readonly podeAssumir = computed(() =>
    podeSerResponsavel(this.sessao.usuario(), this.areaAtual()),
  );
  protected readonly opcoesVisao = computed(() => opcoesDeVisao(this.sessao.perfil()));
  protected readonly opcoesFunil = computed<OpcaoFiltro[]>(() =>
    this.estado.funisAtivos().map((funil) => ({ id: funil.id, rotulo: funil.nome })),
  );
  protected readonly opcoesEtiqueta = computed<OpcaoSeletor<string>[]>(() =>
    this.estado.etiquetas().map((etiqueta) => ({ valor: etiqueta, rotulo: etiqueta })),
  );
  protected readonly valorEmAberto = computed(() => {
    const abertas = this.estado.colunas().filter((coluna) => coluna.etapa.tipo === 'ABERTA');
    return formatarMoedaAbreviada(
      paraNumero(somarValores(abertas.map((coluna) => coluna.valorTotal))) ?? 0,
      this.locale,
    );
  });
  protected readonly queryParams = computed<Record<string, string> | null>(() => {
    const funil = this.estado.funil();
    return funil && !funil.base ? { funil: funil.id } : null;
  });
  protected readonly filtrando = computed(() => {
    const { visao, busca, etiqueta } = this.estado.filtros();
    return visao !== 'TODOS' || !!busca || !!etiqueta;
  });
  protected readonly semResultados = computed(
    () => this.filtrando() && this.estado.colunas().every((coluna) => coluna.total === 0),
  );
  protected readonly nomeItemSingular = computed(() => nomeDoItem(this.areaAtual()));

  protected readonly termo = signal('');
  /** No celular, a busca e a etiqueta abertas (atrás do botão "Filtros"). */
  protected readonly filtrosAbertos = signal(false);
  /** Quantos desses filtros estão ligados (o número no botão). */
  protected readonly quantosFiltros = computed(() => {
    const { busca, etiqueta } = this.estado.filtros();
    return (busca ? 1 : 0) + (etiqueta ? 1 : 0);
  });
  protected readonly recolhidas = signal<ReadonlySet<string>>(lerRecolhidas());
  protected readonly pego = signal<Pego | null>(null);
  protected readonly assumindo = signal<ReadonlySet<string>>(new Set());
  protected readonly novoAberto = signal(false);
  protected readonly configurarAberto = signal(false);
  /** Movimento esperando o motivo da perda. */
  protected readonly aguardandoMotivo = signal<Movimento | null>(null);

  private esperaBusca: ReturnType<typeof setTimeout> | null = null;
  private iniciado: { area: Area; funil: string | null } | null = null;

  constructor() {
    effect(() => {
      const area = this.areaAtual();
      const funil = this.funil();
      untracked(() => this.abrir(area, funil));
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.esperaBusca) {
        clearTimeout(this.esperaBusca);
      }
    });
  }

  protected rotuloArea(): string {
    return ROTULO_AREA[this.areaAtual()];
  }

  // Filtros -----------------------------------------------------------------------------------

  protected escolherVisao(visao: string | null): void {
    if (ehVisao(visao)) {
      this.estado.definirFiltros({ visao });
    }
  }

  protected escolherFunil(funilId: string | null): void {
    if (!funilId) {
      return;
    }
    const funil = this.estado.funisAtivos().find((item) => item.id === funilId);
    void this.router.navigate(['/funis', this.slug()], {
      queryParams: funil && !funil.base ? { funil: funil.id } : {},
    });
  }

  protected digitar(valor: string): void {
    this.termo.set(valor);
    if (this.esperaBusca) {
      clearTimeout(this.esperaBusca);
    }
    this.esperaBusca = setTimeout(() => this.buscar(valor), ESPERA_BUSCA_MS);
  }

  protected buscar(valor: string): void {
    if (this.esperaBusca) {
      clearTimeout(this.esperaBusca);
      this.esperaBusca = null;
    }
    this.estado.definirFiltros({ busca: valor.trim() });
  }

  protected escolherEtiqueta(etiqueta: string | null): void {
    this.estado.definirFiltros({ etiqueta });
  }

  protected limparFiltros(): void {
    this.termo.set('');
    this.estado.definirFiltros({ visao: 'TODOS', busca: '', etiqueta: null });
  }

  // Colunas ---------------------------------------------------------------------------------

  protected idColuna(coluna: ColunaQuadro): string {
    return `coluna-${coluna.etapa.id}`;
  }

  protected ehFechada(coluna: ColunaQuadro): boolean {
    return ehFechada(coluna.etapa.tipo);
  }

  protected recolhida(coluna: ColunaQuadro): boolean {
    return this.ehFechada(coluna) && this.recolhidas().has(coluna.etapa.id);
  }

  protected alternarColuna(coluna: ColunaQuadro): void {
    const nova = new Set(this.recolhidas());
    if (nova.has(coluna.etapa.id)) {
      nova.delete(coluna.etapa.id);
    } else {
      nova.add(coluna.etapa.id);
    }
    this.recolhidas.set(nova);
    gravarArmazenado(CHAVE_RECOLHIDAS, JSON.stringify([...nova]));
  }

  protected valorDaColuna(coluna: ColunaQuadro): string {
    return formatarMoedaAbreviada(paraNumero(coluna.valorTotal) ?? 0, this.locale);
  }

  protected prazoDaColuna(coluna: ColunaQuadro): string | null {
    return textoPrazo(coluna.etapa);
  }

  protected restantes(coluna: ColunaQuadro): number {
    return Math.max(0, coluna.total - coluna.negocios.length);
  }

  protected linkDoNegocio(negocio: Negocio): readonly unknown[] {
    return ['/funis', this.slug(), negocio.id];
  }

  protected podeSair(negocio: Negocio): boolean {
    return negocio.status === 'ABERTO' || this.podeReabrir();
  }

  /** Ganho/perdido só sai da etapa para quem pode reabrir (R5.5); reordenar vale para todos. */
  protected readonly podeEntrar = (arrastado: CdkDrag<Negocio>, lista: CdkDropList<string>) =>
    arrastado.dropContainer.data === lista.data || this.podeSair(arrastado.data);

  // Arrastar com mouse e toque ----------------------------------------------------------------

  protected aoComecarArrastar(negocio: Negocio): void {
    this.cancelarPego();
    this.anunciar(`Arrastando “${negocio.titulo}”.`);
  }

  protected aoEntrarNaColuna(coluna: ColunaQuadro): void {
    this.anunciar(`Sobre a etapa ${coluna.etapa.nome}.`);
  }

  protected aoSoltar(evento: CdkDragDrop<string, string, Negocio>): void {
    const negocio = evento.item.data;
    const movimento = this.estado.prever(negocio.id, evento.container.data, evento.currentIndex);
    if (movimento) {
      void this.concluir(movimento);
    }
  }

  // Cartão: menu e assumir ------------------------------------------------------------------

  protected agir(negocio: Negocio, acao: AcaoCartao): void {
    if (acao.tipo === 'abrir') {
      void this.router.navigate(this.linkDoNegocio(negocio), {
        queryParams: this.queryParams() ?? {},
      });
    } else if (acao.tipo === 'assumir') {
      void this.assumir(negocio);
    } else {
      const movimento = this.estado.moverPara(negocio.id, acao.etapaId);
      if (movimento) {
        void this.concluir(movimento);
      }
    }
  }

  private async assumir(negocio: Negocio): Promise<void> {
    this.assumindo.update((atual) => new Set(atual).add(negocio.id));
    try {
      await this.estado.assumir(negocio);
      this.avisos.sucesso(`Você assumiu “${negocio.titulo}”.`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.assumindo.update((atual) => {
        const nova = new Set(atual);
        nova.delete(negocio.id);
        return nova;
      });
    }
  }

  // Teclado: pegar, mover e soltar -----------------------------------------------------------

  protected teclar(evento: KeyboardEvent, negocio: Negocio): void {
    const pego = this.pego();
    const tecla = evento.key;
    if (!pego || pego.negocio.id !== negocio.id) {
      if (tecla === ' ' || tecla === 'Enter') {
        evento.preventDefault();
        this.pegar(negocio);
      }
      return;
    }
    switch (tecla) {
      case 'ArrowLeft':
      case 'ArrowRight':
        evento.preventDefault();
        this.moverEntreEtapas(pego, tecla === 'ArrowRight' ? 1 : -1);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        evento.preventDefault();
        this.moverNaEtapa(pego, tecla === 'ArrowDown' ? 1 : -1);
        break;
      case 'Home':
      case 'End':
        evento.preventDefault();
        this.moverNaEtapa(pego, tecla === 'End' ? Infinity : -Infinity);
        break;
      case ' ':
      case 'Enter':
        evento.preventDefault();
        this.soltarPego();
        break;
      case 'Escape':
        evento.preventDefault();
        evento.stopPropagation();
        this.cancelarPego(true);
        break;
      case 'Tab':
        this.cancelarPego(true);
        break;
    }
  }

  /**
   * O foco saiu da alça do cartão pego (clique fora, outro cartão, o menu): o movimento não
   * terminou, então o cartão volta para onde estava. Mover entre colunas recria o elemento
   * (e o foco vai para a alça nova), por isso a conferência é depois de desenhar.
   */
  protected aoSairDoMover(negocio: Negocio): void {
    if (this.pego()?.negocio.id !== negocio.id) {
      return;
    }
    afterNextRender(
      () => {
        const pego = this.pego();
        if (pego?.negocio.id !== negocio.id) {
          return;
        }
        const ativo = this.elemento.nativeElement.ownerDocument.activeElement;
        if (ativo?.getAttribute('data-mover') !== negocio.id) {
          this.cancelarPego(true, false);
        }
      },
      { injector: this.injector },
    );
  }

  private pegar(negocio: Negocio): void {
    // Outro cartão já estava pego: volta para o lugar antes de pegar este.
    this.cancelarPego(false, false);
    const origem = lugarDoNegocio(this.estado.colunas(), negocio.id);
    if (!origem) {
      return;
    }
    this.pego.set({ negocio, origem });
    const coluna = this.colunaDe(origem.etapaId)!;
    this.anunciar(
      `“${negocio.titulo}” pego, na etapa ${coluna.etapa.nome}, posição ${origem.indice + 1} de ${coluna.negocios.length}. ` +
        'Setas para os lados trocam a etapa; para cima e para baixo, a posição. Espaço solta, Esc cancela.',
    );
  }

  private moverEntreEtapas(pego: Pego, passo: 1 | -1): void {
    const colunas = this.estado.colunas();
    const atual = lugarDoNegocio(colunas, pego.negocio.id);
    if (!atual) {
      return;
    }
    const indiceColuna = colunas.findIndex((coluna) => coluna.etapa.id === atual.etapaId);
    let destino: ColunaQuadro | undefined;
    for (let i = indiceColuna + passo; i >= 0 && i < colunas.length; i += passo) {
      if (
        pego.negocio.status === 'ABERTO' ||
        this.podeReabrir() ||
        colunas[i].etapa.id === pego.origem.etapaId
      ) {
        destino = colunas[i];
        break;
      }
    }
    if (!destino) {
      this.anunciar(passo > 0 ? 'Esta é a última etapa.' : 'Esta é a primeira etapa.');
      return;
    }
    const indice = Math.min(atual.indice, destino.negocios.length);
    this.posicionarPego(pego, { etapaId: destino.etapa.id, indice });
    this.anunciar(
      `Etapa ${destino.etapa.nome}, posição ${indice + 1} de ${destino.negocios.length + 1}.`,
    );
  }

  private moverNaEtapa(pego: Pego, passo: number): void {
    const atual = lugarDoNegocio(this.estado.colunas(), pego.negocio.id);
    const coluna = atual ? this.colunaDe(atual.etapaId) : null;
    if (!atual || !coluna) {
      return;
    }
    const ultimo = coluna.negocios.length - 1;
    const indice = Math.max(0, Math.min(ultimo, atual.indice + passo));
    if (indice === atual.indice) {
      this.anunciar(indice === 0 ? 'Já está no topo da etapa.' : 'Já está no fim da etapa.');
      return;
    }
    this.posicionarPego(pego, { etapaId: atual.etapaId, indice });
    this.anunciar(`Posição ${indice + 1} de ${coluna.negocios.length} em ${coluna.etapa.nome}.`);
  }

  private posicionarPego(pego: Pego, para: Lugar): void {
    this.estado.posicionarLocal(pego.negocio, para);
    this.focarAlca(pego.negocio.id);
  }

  private soltarPego(): void {
    const pego = this.pego();
    if (!pego) {
      return;
    }
    this.pego.set(null);
    const para = lugarDoNegocio(this.estado.colunas(), pego.negocio.id);
    if (!para || (para.etapaId === pego.origem.etapaId && para.indice === pego.origem.indice)) {
      this.anunciar(`“${pego.negocio.titulo}” solto no mesmo lugar.`);
      return;
    }
    const etapa = this.colunaDe(para.etapaId)!.etapa;
    this.focarAlca(pego.negocio.id);
    void this.concluir({ negocio: pego.negocio, de: pego.origem, para, etapa });
  }

  /** Devolve o cartão pego ao lugar de onde saiu; `focar` leva o foco de volta à alça dele. */
  private cancelarPego(anunciar = false, focar = true): void {
    const pego = this.pego();
    if (!pego) {
      return;
    }
    this.pego.set(null);
    const para = lugarDoNegocio(this.estado.colunas(), pego.negocio.id);
    if (para) {
      this.estado.desfazer({ negocio: pego.negocio, de: pego.origem });
      if (focar) {
        this.focarAlca(pego.negocio.id);
      }
    }
    if (anunciar) {
      this.anunciar(`Movimento cancelado. “${pego.negocio.titulo}” voltou para onde estava.`);
    }
  }

  // Concluir um movimento (todos os caminhos passam aqui) --------------------------------------

  private async concluir(movimento: Movimento): Promise<void> {
    const mudouDeEtapa = movimento.de.etapaId !== movimento.para.etapaId;
    if (mudouDeEtapa && movimento.etapa.tipo === 'PERDIDO') {
      this.aguardandoMotivo.set(movimento);
      return;
    }
    await this.enviar(movimento);
  }

  protected confirmarMotivo(motivo: string): void {
    const movimento = this.aguardandoMotivo();
    this.aguardandoMotivo.set(null);
    if (movimento) {
      void this.enviar(movimento, motivo);
    }
  }

  protected cancelarMotivo(): void {
    const movimento = this.aguardandoMotivo();
    this.aguardandoMotivo.set(null);
    if (movimento) {
      this.estado.desfazer(movimento);
      this.avisos.info('Movimento cancelado: o negócio continua onde estava.');
      this.focarAlca(movimento.negocio.id);
    }
  }

  private async enviar(movimento: Movimento, motivoPerda?: string): Promise<void> {
    const mudouDeEtapa = movimento.de.etapaId !== movimento.para.etapaId;
    try {
      const resultado = await this.estado.confirmar(movimento, motivoPerda);
      const aviso = mensagemDaMovimentacao(resultado, mudouDeEtapa, this.estado.nomesDosFunis());
      const verDestino =
        aviso.destino && (this.sessao.permissoes()?.areasVisiveis.length ?? 0) > 1
          ? aviso.destino
          : null;
      const desfazivel =
        mudouDeEtapa &&
        !verDestino &&
        movimento.negocio.status === 'ABERTO' &&
        movimento.etapa.tipo === 'ABERTA';
      this.avisos.mostrar(aviso.tipo, aviso.mensagem, {
        chave: `mover-${movimento.negocio.id}`,
        acao: verDestino
          ? {
              rotulo: 'Ver negócio',
              executar: () =>
                void this.router.navigate(['/funis', verDestino.funilId], {
                  queryParams: { negocio: verDestino.negocioId },
                }),
            }
          : desfazivel
            ? { rotulo: 'Desfazer', executar: () => void this.voltar(movimento) }
            : undefined,
      });
    } catch (falha) {
      this.avisos.erro(falha, { titulo: `Não deu para mover “${movimento.negocio.titulo}”` });
    }
  }

  /** "Desfazer" do aviso: leva o negócio de volta à etapa e à posição de antes. */
  private async voltar(movimento: Movimento): Promise<void> {
    const volta = this.estado.prever(
      movimento.negocio.id,
      movimento.de.etapaId,
      movimento.de.indice,
    );
    if (!volta) {
      return;
    }
    try {
      await this.estado.confirmar(volta);
      this.avisos.info(`“${movimento.negocio.titulo}” voltou para ${volta.etapa.nome}.`, {
        chave: `mover-${movimento.negocio.id}`,
      });
      // Desfeito pelo teclado (F8 → "Desfazer"): o cartão foi redesenhado na etapa de antes e o
      // foco ficou sem lugar; volta para a alça dele.
      const ativo = this.elemento.nativeElement.ownerDocument.activeElement;
      if (!ativo || ativo === ativo.ownerDocument.body) {
        this.focarAlca(movimento.negocio.id);
      }
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  // Novo negócio e etapas ----------------------------------------------------------------------

  protected aoCriar(negocio: Negocio): void {
    this.estado.atualizarNegocio(negocio);
    this.avisos.sucesso(`Negócio “${negocio.titulo}” criado em ${negocio.etapa.nome}.`, {
      acao: {
        rotulo: 'Abrir',
        executar: () =>
          void this.router.navigate(this.linkDoNegocio(negocio), {
            queryParams: this.queryParams() ?? {},
          }),
      },
    });
  }

  protected aoConfigurar(funil: Funil): void {
    this.estado.atualizarFunil(funil);
  }

  // Apoio -------------------------------------------------------------------------------------

  private abrir(area: Area, funil: string | null): void {
    const anterior = this.iniciado;
    this.iniciado = { area, funil };
    this.cancelarPego();
    if (anterior?.area === area && this.estado.funis().length) {
      const ativos = this.estado.funisAtivos();
      const escolhido =
        ativos.find((item) => item.id === funil) ?? ativos.find((item) => item.base) ?? ativos[0];
      if (escolhido) {
        this.estado.escolherFunil(escolhido.id);
      }
      return;
    }
    this.termo.set('');
    void this.estado.iniciar(area, funil);
  }

  private colunaDe(etapaId: string): ColunaQuadro | undefined {
    return this.estado.colunas().find((coluna) => coluna.etapa.id === etapaId);
  }

  private anunciar(texto: string): void {
    void this.anunciador.announce(texto, 'assertive');
  }

  /** Depois de o cartão mudar de lugar (o Angular recria o elemento), o foco volta à alça. */
  private focarAlca(negocioId: string): void {
    afterNextRender(
      () => {
        const alca = this.elemento.nativeElement.querySelector<HTMLElement>(
          `[data-mover="${negocioId}"]`,
        );
        alca?.focus({ preventScroll: false });
        alca?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      },
      { injector: this.injector },
    );
  }
}

function lerRecolhidas(): ReadonlySet<string> {
  try {
    const lista = JSON.parse(lerArmazenado(CHAVE_RECOLHIDAS) ?? '[]') as unknown;
    return new Set(Array.isArray(lista) ? lista.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}
