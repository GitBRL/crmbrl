import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideGripVertical,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { Botao } from '../../../ui/botao/botao';
import { BotaoIcone } from '../../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../../ui/campo-busca/campo-busca';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Dica } from '../../../ui/dica/dica';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import {
  FiltrosIndicador,
  limparFiltros,
  type OpcoesDosFiltrosIndicador,
} from './filtros-indicador';
import { IndicadoresApi } from './indicadores.api';
import { parametrosPadrao, reordenarWidgets } from './indicadores.formatos';
import {
  ROTULO_VISUALIZACAO,
  type Catalogo,
  type FiltrosDoIndicador,
  type IndicadorDoCatalogo,
  type PainelDeIndicadores,
  type ParametroDoIndicador,
  type Visualizacao,
  type Widget,
} from './indicadores.tipos';

/** Meta digitada → valor da API (duração em minutos na tela, segundos na API). */
export function metaParaApi(unidade: string, digitado: string | number | null): number | null {
  if (digitado === null || digitado === '') {
    return null;
  }
  const numero = Number(String(digitado).replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) {
    return null;
  }
  return unidade === 'DURACAO' ? Math.round(numero * 60) : numero;
}

/** Valor da API → o que aparece no campo da meta. */
export function metaParaTela(unidade: string, valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(unidade === 'DURACAO' ? Math.round((valor / 60) * 100) / 100 : valor);
}

/**
 * Editor de painel (R33.8): catálogo agrupado com busca, lista de indicadores que se reordena
 * arrastando ou pelos botões Subir e Descer, e, para cada um, visualização, parâmetros, título,
 * largura, meta e filtros próprios. Salva pelo `PATCH`/`POST /indicadores/paineis`.
 */
@Component({
  selector: 'app-editor-painel',
  imports: [
    Botao,
    BotaoIcone,
    CampoBusca,
    CampoTexto,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Dica,
    EstadoVazio,
    FiltrosIndicador,
    Selo,
    Seletor,
  ],
  templateUrl: './editor-painel.html',
  styleUrl: './editor-painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPainel {
  private readonly api = inject(IndicadoresApi);
  private readonly avisos = inject(AvisosService);
  private readonly anunciador = inject(LiveAnnouncer);

  /** `null` = painel novo. */
  readonly painel = input<PainelDeIndicadores | null>(null);
  readonly catalogo = input.required<Catalogo>();
  readonly opcoes = input.required<OpcoesDosFiltrosIndicador>();
  readonly diretoria = input(false);
  readonly salvo = output<PainelDeIndicadores>();
  readonly cancelado = output<void>();

  protected readonly icones = {
    arrastar: LucideGripVertical,
    sobe: LucideArrowUp,
    desce: LucideArrowDown,
    editar: LucidePencil,
    remover: LucideTrash2,
    adicionar: LucidePlus,
  };
  protected readonly visualizacoesRotulo = ROTULO_VISUALIZACAO;

  protected readonly nome = linkedSignal(() => this.painel()?.nome ?? '');
  protected readonly descricao = linkedSignal(() => this.painel()?.descricao ?? '');
  protected readonly filtrosPadrao = linkedSignal<FiltrosDoIndicador>(
    () => this.painel()?.filtrosPadrao ?? {},
  );
  protected readonly widgets = linkedSignal<readonly Widget[]>(() => this.painel()?.widgets ?? []);
  protected readonly aberto = signal<string | null>(null);
  protected readonly busca = signal('');
  protected readonly salvando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroNome = signal<string | null>(null);
  protected readonly erroWidget = signal<{ id: string; mensagem: string } | null>(null);

  protected readonly indicadoresPorChave = computed(
    () => new Map(this.catalogo().indicadores.map((i) => [i.chave, i])),
  );

  /** Catálogo agrupado e filtrado pela busca (nome, descrição e grupo). */
  protected readonly grupos = computed(() => {
    const termo = normalizar(this.busca());
    const { grupos, indicadores } = this.catalogo();
    return grupos
      .map((grupo) => ({
        ...grupo,
        itens: indicadores.filter(
          (i) =>
            i.grupo === grupo.chave &&
            (!termo || normalizar(`${i.nome} ${i.descricao} ${grupo.rotulo}`).includes(termo)),
        ),
      }))
      .filter((grupo) => grupo.itens.length > 0);
  });

  protected readonly opcoesEtapa = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.opcoes().funis.flatMap((f) =>
      f.etapas.map((e) => ({ valor: e.id, rotulo: e.nome, grupo: f.nome })),
    ),
  );
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.opcoes().funis.map((f) => ({ valor: f.id, rotulo: f.nome })),
  );
  protected readonly opcoesLargura: readonly OpcaoSeletor<number>[] = [
    { valor: 1, rotulo: '1 coluna' },
    { valor: 2, rotulo: '2 colunas' },
    { valor: 3, rotulo: '3 colunas (largura toda)' },
  ];

  protected definicao(widget: Widget): IndicadorDoCatalogo | undefined {
    return this.indicadoresPorChave().get(widget.indicador);
  }

  protected opcoesDeVisualizacao(widget: Widget): readonly OpcaoSeletor<Visualizacao>[] {
    return (this.definicao(widget)?.visualizacoes ?? []).map((valor) => ({
      valor,
      rotulo: ROTULO_VISUALIZACAO[valor],
    }));
  }

  protected parametrosVisiveis(widget: Widget): readonly ParametroDoIndicador[] {
    return (this.definicao(widget)?.parametros ?? []).filter(
      (p) => !p.vale || p.vale.includes(widget.visualizacao),
    );
  }

  protected opcoesDoParametro(p: ParametroDoIndicador): readonly OpcaoSeletor<string>[] {
    if (p.tipo === 'ETAPA') {
      return this.opcoesEtapa();
    }
    if (p.tipo === 'FUNIL') {
      return this.opcoesFunil();
    }
    return (p.opcoes ?? []).map((o) => ({ valor: o.valor, rotulo: o.rotulo }));
  }

  protected obrigatorio(p: ParametroDoIndicador, widget: Widget): boolean {
    return !!p.obrigatorioEm?.includes(widget.visualizacao);
  }

  protected aceitaVazio(p: ParametroDoIndicador, widget: Widget): boolean {
    return !this.obrigatorio(p, widget) && !(p.tipo === 'POR' || p.tipo === 'AGRUPAMENTO');
  }

  protected tituloDoWidget(widget: Widget): string {
    return widget.titulo?.trim() || this.definicao(widget)?.nome || widget.indicador;
  }

  protected comMeta(widget: Widget): boolean {
    return widget.visualizacao === 'NUMERO' || widget.visualizacao === 'RANKING';
  }

  protected unidadeDaMeta(widget: Widget): { prefixo: string | null; sufixo: string | null } {
    switch (this.definicao(widget)?.unidade) {
      case 'MOEDA':
        return { prefixo: 'R$', sufixo: null };
      case 'PERCENTUAL':
        return { prefixo: null, sufixo: '%' };
      case 'DURACAO':
        return { prefixo: null, sufixo: 'min' };
      default:
        return { prefixo: null, sufixo: null };
    }
  }

  protected valorDaMeta(widget: Widget, chave: 'geral' | 'porPessoa'): string {
    return metaParaTela(this.definicao(widget)?.unidade ?? 'NUMERO', widget.meta?.[chave]);
  }

  // Edição -----------------------------------------------------------------------------

  protected adicionar(indicador: IndicadorDoCatalogo): void {
    const visualizacao = indicador.visualizacoes[0];
    const widget: Widget = {
      id: crypto.randomUUID(),
      indicador: indicador.chave,
      visualizacao,
      parametros: parametrosPadrao(indicador, visualizacao),
      largura: 1,
      ordem: this.widgets().length,
    };
    this.widgets.update((lista) => [...lista, widget]);
    this.aberto.set(widget.id);
    this.anunciar(`${indicador.nome} adicionado ao painel.`);
  }

  protected alterar(id: string, mudanca: (w: Widget) => Widget): void {
    this.widgets.update((lista) => lista.map((w) => (w.id === id ? mudanca(w) : w)));
    if (this.erroWidget()?.id === id) {
      this.erroWidget.set(null);
    }
  }

  protected trocarVisualizacao(widget: Widget, visualizacao: Visualizacao | null): void {
    const def = this.definicao(widget);
    if (!visualizacao || !def) {
      return;
    }
    this.alterar(widget.id, (w) => ({
      ...w,
      visualizacao,
      parametros: {
        ...parametrosPadrao(def, visualizacao),
        ...this.parametrosQueValem(def, visualizacao, w),
      },
      meta: visualizacao === 'NUMERO' || visualizacao === 'RANKING' ? w.meta : undefined,
    }));
  }

  private parametrosQueValem(
    def: IndicadorDoCatalogo,
    visualizacao: Visualizacao,
    widget: Widget,
  ): Record<string, string> {
    const resultado: Record<string, string> = {};
    for (const p of def.parametros) {
      const valor = widget.parametros[p.chave];
      if (valor && (!p.vale || p.vale.includes(visualizacao))) {
        resultado[p.chave] = valor;
      }
    }
    return resultado;
  }

  protected definirParametro(widget: Widget, chave: string, valor: string | null): void {
    const parametros = { ...widget.parametros };
    if (valor) {
      parametros[chave] = valor;
    } else {
      delete parametros[chave];
    }
    this.alterar(widget.id, (w) => ({ ...w, parametros }));
  }

  protected definirTitulo(widget: Widget, texto: string | number | null): void {
    const titulo = String(texto ?? '').trim();
    this.alterar(widget.id, (w) => ({ ...w, titulo: titulo || undefined }));
  }

  protected definirLargura(widget: Widget, largura: number | null): void {
    if (largura === 1 || largura === 2 || largura === 3) {
      this.alterar(widget.id, (w) => ({ ...w, largura }));
    }
  }

  protected definirMeta(
    widget: Widget,
    chave: 'geral' | 'porPessoa',
    digitado: string | number | null,
  ): void {
    const valor = metaParaApi(this.definicao(widget)?.unidade ?? 'NUMERO', digitado);
    this.alterar(widget.id, (w) => {
      const meta = { ...w.meta, [chave]: valor };
      const vazio = (meta.geral ?? null) === null && (meta.porPessoa ?? null) === null;
      return { ...w, meta: vazio ? undefined : meta };
    });
  }

  protected definirFiltros(widget: Widget, filtros: FiltrosDoIndicador): void {
    const limpos = limparFiltros(filtros);
    this.alterar(widget.id, (w) => ({
      ...w,
      filtros: Object.keys(limpos).length > 0 ? limpos : undefined,
    }));
  }

  protected remover(widget: Widget): void {
    this.widgets.update((lista) =>
      lista.filter((w) => w.id !== widget.id).map((w, ordem) => ({ ...w, ordem })),
    );
    if (this.aberto() === widget.id) {
      this.aberto.set(null);
    }
    this.anunciar(`${this.tituloDoWidget(widget)} removido do painel.`);
  }

  protected alternar(id: string): void {
    this.aberto.update((atual) => (atual === id ? null : id));
  }

  // Ordem (arrastar e teclado) ---------------------------------------------------------

  protected soltar(evento: CdkDragDrop<readonly Widget[]>): void {
    this.mover(evento.previousIndex, evento.currentIndex);
  }

  protected mover(de: number, para: number): void {
    const antes = this.widgets();
    const depois = reordenarWidgets(antes, de, para);
    if (depois === antes) {
      return;
    }
    this.widgets.set(depois);
    this.anunciar(
      `${this.tituloDoWidget(depois[para])} agora é o ${para + 1}º de ${depois.length}.`,
    );
  }

  private anunciar(texto: string): void {
    void this.anunciador.announce(texto, 'polite');
  }

  // Salvar -----------------------------------------------------------------------------

  protected async salvar(): Promise<void> {
    this.erro.set(null);
    this.erroNome.set(null);
    this.erroWidget.set(null);
    const nome = this.nome().trim();
    if (!nome) {
      this.erroNome.set('Dê um nome ao painel.');
      return;
    }
    for (const w of this.widgets()) {
      const faltando = this.parametrosVisiveis(w).find(
        (p) => this.obrigatorio(p, w) && !w.parametros[p.chave],
      );
      if (faltando) {
        this.aberto.set(w.id);
        this.erroWidget.set({ id: w.id, mensagem: `Escolha: ${faltando.rotulo}.` });
        return;
      }
    }
    this.salvando.set(true);
    const entrada = {
      nome,
      descricao: this.descricao().trim() || null,
      filtrosPadrao: limparFiltros(this.filtrosPadrao()),
      widgets: this.widgets().map((w, ordem) => ({ ...w, ordem })),
    };
    try {
      const atual = this.painel();
      const resultado = atual
        ? await this.api.atualizar(atual.id, entrada)
        : await this.api.criar(entrada);
      this.avisos.sucesso('Painel salvo.');
      this.salvo.emit(resultado);
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.salvando.set(false);
    }
  }
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
