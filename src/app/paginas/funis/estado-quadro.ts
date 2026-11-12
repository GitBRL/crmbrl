import { computed, inject, Injectable, signal } from '@angular/core';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import type { Area } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { FunisApi } from './funis.api';
import {
  nivelDoFunil,
  podeAgirNoFunil,
  podeAgirNoNegocio,
  podeConfigurarPorNivel,
} from './nivel-funil';
import type {
  Atividade,
  ColunaQuadro,
  Etapa,
  FiltrosQuadro,
  Funil,
  Negocio,
  PedidoEmMassa,
  ResultadoEmMassa,
  ResultadoMovimentacao,
  Usuario,
} from './funis.tipos';
import {
  incluirNegocio,
  type Lugar,
  lugarDoNegocio,
  moverCartao,
  negocioNaEtapa,
  ordenarColunas,
  podeSerResponsavel,
  removerNegocio,
  substituirNegocio,
  vizinhos,
} from './regras-funis';

export type SituacaoQuadro = 'carregando' | 'pronto' | 'erro' | 'sem-funil';

/** Um movimento já aplicado na tela, ainda sem a resposta da API. */
export interface Movimento {
  readonly negocio: Negocio;
  readonly de: Lugar;
  readonly para: Lugar;
  readonly etapa: Etapa;
}

/** Quem pode ser escolhido como responsável (seletor do cartão e da barra de ações em massa). */
export interface OpcaoResponsavel {
  readonly id: string;
  readonly nome: string;
  /** "Líder · Comercial" etc.; nulo para "você". */
  readonly detalhe: string | null;
  readonly avatarUrl: string | null;
  readonly voce: boolean;
}

const FILTROS_PADRAO: FiltrosQuadro = { visao: 'TODOS', busca: '', etiqueta: null };

/**
 * Estado do quadro de um funil (fornecido pelo `QuadroFunil`, que o detalhe do negócio — rota
 * filha, no `<router-outlet>` do quadro — também injeta). Guarda os funis do setor, o funil
 * escolhido, os filtros, as colunas e a próxima atividade de cada cartão, e faz a
 * movimentação **otimista**: o cartão muda de lugar na hora e volta, com a mensagem da API,
 * se ela recusar.
 */
@Injectable()
export class EstadoQuadro {
  private readonly api = inject(FunisApi);
  private readonly sessao = inject(SessaoService);
  private versao = 0;
  private usuariosCarregando: Promise<void> | null = null;

  readonly area = signal<Area | null>(null);
  readonly funis = signal<readonly Funil[]>([]);
  readonly funilId = signal<string | null>(null);
  readonly filtros = signal<FiltrosQuadro>(FILTROS_PADRAO);
  readonly situacao = signal<SituacaoQuadro>('carregando');
  readonly erro = signal<ErroApi | null>(null);
  readonly colunas = signal<readonly ColunaQuadro[]>([]);
  readonly funilAtivo = signal(true);
  /** Próxima atividade pendente de cada negócio (a mais próxima; atrasadas primeiro). */
  readonly proximas = signal<ReadonlyMap<string, Atividade>>(new Map());
  readonly usuarios = signal<readonly Usuario[]>([]);
  readonly etiquetas = signal<readonly string[]>([]);
  /** Modo seleção do quadro (R5.16) e os negócios marcados. Vale só no funil aberto. */
  readonly modoSelecao = signal(false);
  readonly selecao = signal<ReadonlySet<string>>(new Set());
  /** Os negócios marcados que estão carregados no quadro. */
  readonly selecionados = computed(() => {
    const marcados = this.selecao();
    return this.colunas()
      .flatMap((coluna) => coluna.negocios)
      .filter((negocio) => marcados.has(negocio.id));
  });
  /** Etapas carregando "mais cartões". */
  readonly carregandoMais = signal<ReadonlySet<string>>(new Set());

  /** Todos os funis que a pessoa vê (de todos os setores, inclusive por acesso): o seletor do quadro. */
  readonly todosOsFunis = signal<readonly Funil[]>([]);

  /** O nível da pessoa no funil aberto (decide os botões do quadro e do detalhe). */
  readonly nivel = computed(() => nivelDoFunil(this.funil(), this.sessao.perfil()));
  readonly podeAgir = computed(() => podeAgirNoFunil(this.nivel()));
  /** Age neste negócio? (`MEMBRO` que vê todos só age nos seus e nos sem responsável.) */
  podeAgirEm(negocio: Negocio): boolean {
    return podeAgirNoNegocio(this.funil(), this.nivel(), this.sessao.usuario()?.id, negocio);
  }
  readonly podeConfigurar = computed(() => podeConfigurarPorNivel(this.nivel()));

  /** Funis ativos do setor (arquivados não aparecem no quadro). */
  readonly funisAtivos = computed(() => this.funis().filter((funil) => funil.ativo));
  readonly funil = computed(
    () => this.funis().find((funil) => funil.id === this.funilId()) ?? null,
  );
  readonly etapas = computed(() => this.colunas().map((coluna) => coluna.etapa));
  readonly totalAbertos = computed(() =>
    this.colunas()
      .filter((coluna) => coluna.etapa.tipo === 'ABERTA')
      .reduce((soma, coluna) => soma + coluna.total, 0),
  );
  /** Nomes dos funis visíveis (para os avisos das passagens). */
  readonly nomesDosFunis = computed(
    () => new Map(this.funis().map((funil) => [funil.id, funil.nome] as const)),
  );
  /** Quem pode ser responsável por negócio deste funil (que a pessoa enxerga). */
  readonly responsaveisPossiveis = computed(() => {
    const area = this.area();
    return area ? this.usuarios().filter((usuario) => podeSerResponsavel(usuario, area)) : [];
  });

  /** Abre a área: carrega os funis e o quadro do funil pedido (ou o funil-base). */
  async iniciar(area: Area, funilPreferido: string | null): Promise<void> {
    const versao = ++this.versao;
    const mudouDeArea = this.area() !== area;
    this.area.set(area);
    if (mudouDeArea) {
      this.filtros.set(FILTROS_PADRAO);
      this.colunas.set([]);
      this.sairDaSelecao();
      this.proximas.set(new Map());
    }
    this.situacao.set('carregando');
    this.erro.set(null);
    try {
      const funis = await this.api.funisDaArea(area);
      if (versao !== this.versao) {
        return;
      }
      this.funis.set(funis);
      void this.carregarTodosOsFunis();
      const ativos = funis.filter((funil) => funil.ativo);
      const escolhido =
        ativos.find((funil) => funil.id === funilPreferido) ??
        ativos.find((funil) => funil.base) ??
        ativos[0] ??
        null;
      this.funilId.set(escolhido?.id ?? null);
      if (!escolhido) {
        this.situacao.set('sem-funil');
        return;
      }
      await this.carregarQuadro(versao);
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
        this.situacao.set('erro');
      }
    }
    void this.carregarEtiquetas();
  }

  /** Recarrega o quadro com os filtros atuais (sem esqueleto se já havia colunas). */
  async recarregar(): Promise<void> {
    const versao = ++this.versao;
    if (!this.funilId()) {
      const area = this.area();
      if (area) {
        await this.iniciar(area, null);
      }
      return;
    }
    if (!this.colunas().length) {
      this.situacao.set('carregando');
    }
    this.erro.set(null);
    try {
      await this.carregarQuadro(versao);
    } catch (falha) {
      if (versao === this.versao) {
        this.erro.set(erroDaApi(falha));
        this.situacao.set('erro');
      }
    }
  }

  definirFiltros(parcial: Partial<FiltrosQuadro>): void {
    const atual = this.filtros();
    const novo = { ...atual, ...parcial };
    if (
      novo.visao === atual.visao &&
      novo.busca === atual.busca &&
      novo.etiqueta === atual.etiqueta
    ) {
      return;
    }
    this.filtros.set(novo);
    void this.recarregar();
  }

  /** Funil escolhido entre os do setor (quando há funis extras). */
  escolherFunil(funilId: string): void {
    if (funilId === this.funilId()) {
      return;
    }
    this.funilId.set(funilId);
    this.colunas.set([]);
    this.sairDaSelecao();
    void this.recarregar();
  }

  /** Troca o funil pela versão nova (etapas configuradas) e recarrega o quadro. */
  atualizarFunil(funil: Funil): void {
    this.funis.update((funis) => funis.map((item) => (item.id === funil.id ? funil : item)));
    void this.recarregar();
  }

  negocio(id: string): Negocio | null {
    for (const coluna of this.colunas()) {
      const achado = coluna.negocios.find((negocio) => negocio.id === id);
      if (achado) {
        return achado;
      }
    }
    return null;
  }

  // Movimentação -----------------------------------------------------------------------------

  /** Move o cartão na tela (sem falar com a API). `null` se nada mudou. */
  prever(negocioId: string, paraEtapaId: string, indice: number): Movimento | null {
    const colunas = this.colunas();
    const de = lugarDoNegocio(colunas, negocioId);
    const coluna = colunas.find((item) => item.etapa.id === paraEtapaId);
    if (!de || !coluna) {
      return null;
    }
    const negocio = colunas.find((item) => item.etapa.id === de.etapaId)!.negocios[de.indice];
    const limite = coluna.negocios.length - (de.etapaId === paraEtapaId ? 1 : 0);
    const para = { etapaId: paraEtapaId, indice: Math.max(0, Math.min(indice, limite)) };
    if (de.etapaId === para.etapaId && de.indice === para.indice) {
      return null;
    }
    this.colunas.set(moverCartao(colunas, negocioId, para.etapaId, para.indice));
    return { negocio, de, para, etapa: coluna.etapa };
  }

  /** Volta o cartão para onde estava, como era. */
  desfazer(movimento: Pick<Movimento, 'negocio' | 'de'>): void {
    this.colunas.update((colunas) =>
      moverCartao(
        colunas,
        movimento.negocio.id,
        movimento.de.etapaId,
        movimento.de.indice,
        movimento.negocio,
      ),
    );
  }

  /**
   * Manda o movimento à API. Sucesso: o cartão fica com a versão da API. Falha: o cartão
   * volta e a falha sobe (a tela mostra a mensagem).
   */
  async confirmar(movimento: Movimento, motivoPerda?: string): Promise<ResultadoMovimentacao> {
    const lados = vizinhos(this.colunas(), movimento.negocio.id);
    try {
      const resultado = await this.api.mover(movimento.negocio.id, {
        etapaId: movimento.para.etapaId,
        ...(motivoPerda ? { motivoPerda } : {}),
        ...lados,
      });
      // A versão da API (posição, dias na etapa, status) no lugar onde o cartão está agora.
      this.colunas.update((colunas) => substituirNegocio(colunas, resultado.negocio));
      return resultado;
    } catch (falha) {
      this.desfazer(movimento);
      throw erroDaApi(falha);
    }
  }

  /**
   * Põe o cartão (como era antes de sair do lugar) em `para`, só na tela: o teclado move o
   * cartão passo a passo e só fala com a API ao soltar.
   */
  posicionarLocal(original: Negocio, para: Lugar): void {
    const etapa = this.colunas().find((coluna) => coluna.etapa.id === para.etapaId)?.etapa;
    if (etapa) {
      this.colunas.update((colunas) =>
        moverCartao(
          colunas,
          original.id,
          para.etapaId,
          para.indice,
          negocioNaEtapa(original, etapa),
        ),
      );
    }
  }

  /** Move sem arrastar (menu "Mover para…", seletor do detalhe): vai para o topo da etapa. */
  moverPara(negocioId: string, paraEtapaId: string): Movimento | null {
    return this.prever(negocioId, paraEtapaId, 0);
  }

  // Alterações vindas do detalhe ou do cartão ------------------------------------------------

  /** A versão nova de um negócio (salvo no detalhe, assumido, reaberto). */
  atualizarNegocio(negocio: Negocio): void {
    if (negocio.funil.id !== this.funilId()) {
      return;
    }
    this.colunas.update((colunas) =>
      lugarDoNegocio(colunas, negocio.id)
        ? substituirNegocio(colunas, negocio)
        : incluirNegocio(colunas, negocio),
    );
  }

  removerNegocio(negocioId: string): void {
    this.colunas.update((colunas) => removerNegocio(colunas, negocioId));
  }

  async assumir(negocio: Negocio): Promise<Negocio> {
    const atualizado = await this.api.assumir(negocio.id);
    this.atualizarNegocio(atualizado);
    return atualizado;
  }

  /** A próxima atividade de um negócio mudou (criada ou concluída no detalhe). */
  definirProxima(negocioId: string, atividade: Atividade | null): void {
    this.proximas.update((atual) => {
      const nova = new Map(atual);
      if (atividade) {
        nova.set(negocioId, atividade);
      } else {
        nova.delete(negocioId);
      }
      return nova;
    });
  }

  /** Mais cartões de uma etapa (o quadro traz até 50 por etapa). */
  async carregarMais(etapaId: string): Promise<void> {
    const funilId = this.funilId();
    const coluna = this.colunas().find((item) => item.etapa.id === etapaId);
    if (!funilId || !coluna || this.carregandoMais().has(etapaId)) {
      return;
    }
    this.carregandoMais.update((atual) => new Set(atual).add(etapaId));
    try {
      const porPagina = 50;
      const pagina = Math.floor(coluna.negocios.length / porPagina) + 1;
      const resposta = await this.api.negociosDaEtapa(
        funilId,
        etapaId,
        this.filtros(),
        pagina,
        porPagina,
      );
      this.colunas.update((colunas) =>
        colunas.map((item) => {
          if (item.etapa.id !== etapaId) {
            return item;
          }
          const ids = new Set(item.negocios.map((negocio) => negocio.id));
          const negocios = [
            ...item.negocios,
            ...resposta.itens.filter((negocio) => !ids.has(negocio.id)),
          ];
          return { ...item, negocios, temMais: negocios.length < resposta.total };
        }),
      );
    } finally {
      this.carregandoMais.update((atual) => {
        const nova = new Set(atual);
        nova.delete(etapaId);
        return nova;
      });
    }
  }

  /**
   * Responsável pelo cartão (R5.15): troca na hora e volta se a API recusar (a falha sobe para
   * a tela avisar). `novo` nulo deixa o negócio sem responsável.
   */
  async trocarResponsavel(negocio: Negocio, novo: OpcaoResponsavel | null): Promise<Negocio> {
    const otimista: Negocio = {
      ...negocio,
      responsavel: novo ? { id: novo.id, nome: novo.nome, avatarUrl: novo.avatarUrl } : null,
    };
    this.atualizarNegocio(otimista);
    try {
      const atualizado = await this.api.alterarNegocio(negocio.id, {
        responsavelId: novo?.id ?? null,
      });
      this.atualizarNegocio(atualizado);
      return atualizado;
    } catch (falha) {
      this.atualizarNegocio(negocio);
      throw erroDaApi(falha);
    }
  }

  /**
   * As opções do seletor "Responsável" (as mesmas do detalhe do negócio): você, quem é do
   * setor, o C-level e o Admin, e o responsável atual mesmo que já não caiba na regra.
   */
  opcoesDeResponsavel(atual?: { id: string; nome: string; avatarUrl?: string | null } | null) {
    const area = this.area();
    const eu = this.sessao.usuario();
    const opcoes = new Map<string, OpcaoResponsavel>();
    if (area && eu && podeSerResponsavel(eu, area)) {
      opcoes.set(eu.id, {
        id: eu.id,
        nome: eu.nome,
        detalhe: null,
        avatarUrl: eu.avatarUrl ?? null,
        voce: true,
      });
    }
    for (const usuario of this.responsaveisPossiveis()) {
      if (!opcoes.has(usuario.id)) {
        opcoes.set(usuario.id, {
          id: usuario.id,
          nome: usuario.nome,
          detalhe: usuario.rotuloPapel,
          avatarUrl: usuario.avatarUrl ?? null,
          voce: false,
        });
      }
    }
    if (atual && !opcoes.has(atual.id)) {
      opcoes.set(atual.id, {
        id: atual.id,
        nome: atual.nome,
        detalhe: null,
        avatarUrl: atual.avatarUrl ?? null,
        voce: false,
      });
    }
    return [...opcoes.values()];
  }

  // Seleção e ações em massa (R5.16) ---------------------------------------------------------

  entrarNaSelecao(): void {
    this.modoSelecao.set(true);
  }

  /** Sai do modo e limpa a seleção. */
  sairDaSelecao(): void {
    this.modoSelecao.set(false);
    this.selecao.set(new Set());
  }

  alternarSelecao(negocioId: string): void {
    this.selecao.update((atual) => {
      const nova = new Set(atual);
      if (nova.has(negocioId)) {
        nova.delete(negocioId);
      } else {
        nova.add(negocioId);
      }
      return nova;
    });
    this.modoSelecao.set(true);
  }

  /** Marca todos os carregados da etapa (os que a pessoa pode alterar) ou, se já estavam, desmarca. */
  alternarEtapa(etapaId: string): void {
    const coluna = this.colunas().find((item) => item.etapa.id === etapaId);
    if (!coluna) {
      return;
    }
    const ids = coluna.negocios.map((negocio) => negocio.id);
    const todos = ids.length > 0 && ids.every((id) => this.selecao().has(id));
    this.selecao.update((atual) => {
      const nova = new Set(atual);
      ids.forEach((id) => (todos ? nova.delete(id) : nova.add(id)));
      return nova;
    });
    this.modoSelecao.set(true);
  }

  /** A etapa está toda marcada ("todos os carregados")? */
  etapaMarcada(etapaId: string): 'nenhum' | 'alguns' | 'todos' {
    const coluna = this.colunas().find((item) => item.etapa.id === etapaId);
    const marcados = this.selecao();
    const conta = coluna?.negocios.filter((negocio) => marcados.has(negocio.id)).length ?? 0;
    if (!coluna || conta === 0) {
      return 'nenhum';
    }
    return conta === coluna.negocios.length ? 'todos' : 'alguns';
  }

  /**
   * Manda a ação à API e recarrega o quadro (cada negócio passou pelas regras do servidor;
   * o sucesso é parcial). Fica marcado só o que falhou.
   */
  async executarEmMassa(pedido: PedidoEmMassa): Promise<ResultadoEmMassa> {
    const resultado = await this.api.acaoEmMassa(pedido);
    this.selecao.set(new Set(resultado.falhas.map((falha) => falha.negocioId)));
    await this.recarregar();
    return resultado;
  }

  /** Usuários que a pessoa vê (para escolher o responsável), carregados uma vez. */
  carregarUsuarios(): Promise<void> {
    this.usuariosCarregando ??= this.api
      .usuariosAtivos()
      .then((pagina) => this.usuarios.set(pagina.itens))
      .catch((falha) => {
        this.usuariosCarregando = null;
        throw falha;
      });
    return this.usuariosCarregando;
  }

  /** O usuário da sessão como opção de responsável (mesmo antes de a lista chegar). */
  readonly euComoUsuario = computed<Usuario | null>(() => {
    const eu = this.sessao.usuario();
    return eu
      ? {
          id: eu.id,
          nome: eu.nome,
          papel: eu.papel,
          rotuloPapel: eu.rotuloPapel,
          area: eu.area,
          ativo: true,
          nivel: eu.nivel,
          avatarUrl: eu.avatarUrl,
        }
      : null;
  });

  // Carga ------------------------------------------------------------------------------------

  private async carregarTodosOsFunis(): Promise<void> {
    try {
      this.todosOsFunis.set(await this.api.funis());
    } catch {
      // O seletor cai para os funis do setor.
      this.todosOsFunis.set([]);
    }
  }

  private async carregarQuadro(versao: number): Promise<void> {
    const funilId = this.funilId()!;
    const quadro = await this.api.quadro(funilId, this.filtros());
    if (versao !== this.versao) {
      return;
    }
    this.colunas.set(ordenarColunas(quadro.colunas));
    const carregados = new Set(
      quadro.colunas.flatMap((coluna) => coluna.negocios.map((negocio) => negocio.id)),
    );
    this.selecao.update((atual) => new Set([...atual].filter((id) => carregados.has(id))));
    this.funilAtivo.set(quadro.ativo);
    this.situacao.set('pronto');
    void this.carregarProximas(versao);
  }

  private async carregarProximas(versao: number): Promise<void> {
    try {
      const pagina = await this.api.atividadesPendentes();
      if (versao !== this.versao) {
        return;
      }
      const mapa = new Map<string, Atividade>();
      for (const atividade of pagina.itens) {
        const negocioId = atividade.negocio?.id;
        if (negocioId && !mapa.has(negocioId)) {
          mapa.set(negocioId, atividade);
        }
      }
      this.proximas.set(mapa);
    } catch {
      // A próxima atividade é um complemento do cartão: sem ela, o quadro continua útil.
    }
  }

  private async carregarEtiquetas(): Promise<void> {
    try {
      this.etiquetas.set(await this.api.etiquetas());
    } catch {
      // O filtro por etiqueta fica só com "Todas as etiquetas".
    }
  }
}
