import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideWorkflow } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  paraDecimal,
  paraNumero,
} from '../../nucleo/formatos';
import { type Area, areaDoSlug, ROTULO_AREA, SLUG_AREA } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { RiscoChurnCartao } from '../financeiro/risco-churn';
import { SugestaoContrato } from '../financeiro/sugestao-contrato';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoTexto, type ValorCampoTexto } from '../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { type ItemMenuAcoes, MenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { AtividadesNegocio } from './atividades-negocio';
import { EstadoQuadro } from './estado-quadro';
import { FunisApi } from './funis.api';
import type {
  AlteracaoNegocio,
  Atividade,
  Funil,
  JornadaDoNegocio,
  Negocio,
  OrigemContato,
  ResultadoMovimentacao,
  Usuario,
} from './funis.tipos';
import { LinhaDoTempoNegocio } from './linha-do-tempo-negocio';
import { MOTIVO_MAXIMO, MotivoPerda } from './motivo-perda';
import { formatarTelefone } from './novo-negocio';
import {
  mensagemDaMovimentacao,
  mostraValores,
  ordenarEtapas,
  podeReabrir,
  podeSerResponsavel,
  rotuloDias,
} from './regras-funis';

type IdAba = 'linha' | 'atividades' | 'dados';

const ABAS: readonly ItemAba[] = [
  { id: 'linha', rotulo: 'Linha do tempo' },
  { id: 'atividades', rotulo: 'Atividades' },
  { id: 'dados', rotulo: 'Dados' },
];

export const ROTULO_ORIGEM: Readonly<Record<OrigemContato, string>> = {
  MANUAL: 'Cadastro manual',
  WEBHOOK: 'Webhook de captação',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  INDICACAO: 'Indicação',
  IMPORTACAO: 'Importação',
  PASSAGEM: 'Passagem entre funis',
  OUTRO: 'Outro',
};

/**
 * Um negócio ligado pela jornada (veio de / gerou), com o link quando a pessoa o vê. Sem acesso
 * ao outro funil, só a área: "Gerou: negócio em Customer Success (sem acesso)".
 */
interface Vinculo {
  readonly rotulo: 'Veio de' | 'Gerou';
  readonly funil: string;
  readonly titulo: string | null;
  readonly link: readonly unknown[] | null;
  /** O funil do negócio ligado (a área pode ter mais de um): o quadro por trás é o dele. */
  readonly queryParams?: Record<string, string>;
  /** Negócio num funil que a pessoa não vê, com a área conhecida (a API diz qual é). */
  readonly semAcesso?: boolean;
  /** A pessoa vê o negócio ligado, mas os dados dele ainda não chegaram (só a área). */
  readonly carregando?: boolean;
}

/**
 * Detalhe do negócio — painel lateral sobre o kanban, rota `/funis/:area/:negocioId`
 * (TELAS-FASE1 §3.2): etapa (seletor que move), responsável (trocar ou assumir), valores e
 * previsão, contato e empresa (links), etiquetas, a jornada ("Veio de" / "Gerou") e as abas
 * Linha do tempo, Atividades e Dados (onde se edita título, valores e previsão). Ações
 * secundárias no menu: reabrir (R5.5, só para quem pode) e mover para perda (com motivo).
 */
@Component({
  selector: 'app-detalhe-negocio',
  imports: [
    Abas,
    AreaTexto,
    AtividadesNegocio,
    Botao,
    CampoData,
    CampoTexto,
    Esqueleto,
    EstadoVazio,
    LinhaDoTempoNegocio,
    LucideWorkflow,
    MenuAcoes,
    MotivoPerda,
    PainelLateral,
    RiscoChurnCartao,
    RouterLink,
    Seletor,
    Selo,
    SugestaoContrato,
  ],
  templateUrl: './detalhe-negocio.html',
  styleUrl: './detalhe-negocio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheNegocio {
  readonly area = input.required<string>();
  readonly negocioId = input.required<string>();

  private readonly api = inject(FunisApi);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly avisos = inject(AvisosService);
  protected readonly sessao = inject(SessaoService);
  private readonly estado = inject(EstadoQuadro, { optional: true });

  protected readonly abas = ABAS;
  protected readonly maximoMotivo = MOTIVO_MAXIMO;
  protected readonly aberto = signal(true);
  protected readonly negocio = signal<Negocio | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly funil = signal<Funil | null>(null);
  protected readonly relacionados = signal<readonly Negocio[]>([]);
  /** A jornada que o detalhe da API traz: a área (e a visibilidade) de cada lado. */
  private readonly jornada = signal<JornadaDoNegocio | null>(null);
  private readonly usuariosLocais = signal<readonly Usuario[]>([]);
  protected readonly aba = signal<string | null>('linha');
  protected readonly versaoLinha = signal(0);

  // Etapa e responsável mudam na hora (seletor = ação); voltam se a API recusar.
  protected readonly etapaSelecionada = signal<string | null>(null);
  protected readonly responsavelSelecionado = signal<string | null>(null);
  protected readonly movendo = signal(false);
  protected readonly trocandoResponsavel = signal(false);
  protected readonly assumindo = signal(false);
  /** Etapa de perda esperando o motivo (R5.5). */
  protected readonly aguardandoPerda = signal<string | null>(null);

  // Aba "Dados": rascunho do que se edita e salva junto.
  protected readonly titulo = signal<ValorCampoTexto>('');
  protected readonly valor = signal<ValorCampoTexto>(null);
  protected readonly valorRecorrente = signal<ValorCampoTexto>(null);
  protected readonly previsao = signal<string | null>(null);
  protected readonly motivoPerda = signal('');
  protected readonly enviado = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroSalvar = signal<string | null>(null);
  private readonly campoTitulo = viewChild<CampoTexto>('campoTitulo');

  protected readonly areaAtual = computed<Area>(
    () => this.negocio()?.funil.area ?? areaDoSlug(this.area()) ?? 'COMERCIAL',
  );
  protected readonly mostrarRecorrente = computed(() => mostraValores(this.areaAtual()));
  protected readonly etapas = computed(() => ordenarEtapas(this.funil()?.etapas ?? []));
  protected readonly podeReabrir = computed(() =>
    podeReabrir(this.sessao.perfil(), this.areaAtual()),
  );
  protected readonly negocioFechado = computed(() => {
    const status = this.negocio()?.status;
    return !!status && status !== 'ABERTO';
  });
  protected readonly podeMudarEtapa = computed(() => !this.negocioFechado() || this.podeReabrir());
  protected readonly opcoesEtapa = computed<OpcaoSeletor<string>[]>(() => {
    const atual = this.negocio();
    const etapas = this.etapas();
    if (!etapas.length && atual) {
      return [{ valor: atual.etapa.id, rotulo: atual.etapa.nome }];
    }
    return etapas.map((etapa) => ({ valor: etapa.id, rotulo: etapa.nome }));
  });
  private readonly usuarios = computed(() => this.estado?.usuarios() ?? this.usuariosLocais());
  protected readonly podeAssumir = computed(() =>
    podeSerResponsavel(this.sessao.usuario(), this.areaAtual()),
  );
  protected readonly opcoesResponsavel = computed<OpcaoSeletor<string>[]>(() => {
    const area = this.areaAtual();
    const eu = this.sessao.usuario();
    const atual = this.negocio()?.responsavel;
    const opcoes = new Map<string, string>();
    if (eu && podeSerResponsavel(eu, area)) {
      opcoes.set(eu.id, `${eu.nome} (você)`);
    }
    for (const usuario of this.usuarios()) {
      if (podeSerResponsavel(usuario, area) && !opcoes.has(usuario.id)) {
        opcoes.set(usuario.id, `${usuario.nome} · ${usuario.rotuloPapel}`);
      }
    }
    if (atual && !opcoes.has(atual.id)) {
      opcoes.set(atual.id, atual.nome);
    }
    return [...opcoes].map(([valor, rotulo]) => ({ valor, rotulo }));
  });
  protected readonly nomeDaEtapaDePerda = computed(
    () => this.etapas().find((etapa) => etapa.id === this.aguardandoPerda())?.nome ?? null,
  );
  protected readonly complemento = computed(() => {
    const negocio = this.negocio();
    return negocio ? `· ${negocio.etapa.nome}` : null;
  });
  protected readonly descricao = computed(() => {
    const negocio = this.negocio();
    if (!negocio) {
      return null;
    }
    return [negocio.contato.nome, negocio.empresa?.nome].filter(Boolean).join(' · ');
  });
  protected readonly vinculos = computed<Vinculo[]>(() => {
    const negocio = this.negocio();
    if (!negocio) {
      return [];
    }
    const lista: Vinculo[] = [];
    const jornada = this.jornada();
    if (negocio.negocioOrigemId) {
      const origem = this.relacionados().find((item) => item.id === negocio.negocioOrigemId);
      const daJornada = jornada?.origem;
      lista.push(
        origem
          ? this.vinculo('Veio de', origem)
          : daJornada && !daJornada.visivel
            ? semAcesso('Veio de', daJornada.area)
            : daJornada
              ? // Visível, mas a lista do contato ainda não chegou: só a área, por enquanto.
                {
                  rotulo: 'Veio de',
                  funil: ROTULO_AREA[daJornada.area],
                  titulo: null,
                  link: null,
                  carregando: true,
                }
              : { rotulo: 'Veio de', funil: 'outro funil', titulo: null, link: null },
      );
    }
    const gerados = this.relacionados().filter((item) => item.negocioOrigemId === negocio.id);
    for (const gerado of gerados) {
      lista.push(this.vinculo('Gerou', gerado));
    }
    // Os gerados em funis que a pessoa não vê (a lista do contato não os traz).
    for (const gerado of jornada?.gerados ?? []) {
      if (!gerado.visivel && !gerados.some((item) => item.id === gerado.id)) {
        lista.push(semAcesso('Gerou', gerado.area));
      }
    }
    return lista;
  });
  protected readonly itensMenu = computed<ItemMenuAcoes[]>(() => {
    const negocio = this.negocio();
    if (!negocio) {
      return [];
    }
    const itens: ItemMenuAcoes[] = [{ id: 'editar', rotulo: 'Editar título e valores' }];
    itens.push({ id: 'contato', rotulo: 'Abrir o contato' });
    if (negocio.status === 'ABERTO') {
      itens.push({
        id: 'perda',
        rotulo: this.areaAtual() === 'MARKETING' ? 'Descartar lead' : 'Mover para perda',
        separarAntes: true,
      });
    } else {
      itens.push({
        id: 'reabrir',
        rotulo: 'Reabrir negócio',
        separarAntes: true,
        desabilitado: !this.podeReabrir(),
        motivo: this.podeReabrir()
          ? undefined
          : 'Só a liderança da área, C-level e Admin reabrem negócios.',
      });
    }
    return itens;
  });
  protected readonly fatos = computed(() => {
    const negocio = this.negocio();
    if (!negocio) {
      return null;
    }
    const recorrente = paraNumero(negocio.valorRecorrente);
    return {
      valor: formatarMoeda(negocio.valor, { centavos: false }),
      recorrente: recorrente ? formatarMoeda(recorrente, { centavos: false }) : null,
      previsao: negocio.previsaoFechamento ? formatarData(negocio.previsaoFechamento) : null,
      dias: rotuloDias(negocio.diasNaEtapa, negocio.etapaDesde),
      ganhoEm: negocio.ganhoEm ? formatarData(negocio.ganhoEm) : null,
      perdidoEm: negocio.perdidoEm ? formatarData(negocio.perdidoEm) : null,
      telefone: formatarTelefone(negocio.contato.telefone),
      origem: ROTULO_ORIGEM[negocio.origem] ?? negocio.origem,
      criadoEm: formatarDataHora(negocio.criadoEm),
      atualizadoEm: formatarDataHora(negocio.atualizadoEm),
      etapaDesde: formatarDataHora(negocio.etapaDesde),
      utm: Object.entries(negocio.utm ?? {}).filter(([, valor]) => !!valor),
      campos: Object.entries(negocio.camposPersonalizados ?? {}).map(
        ([chave, valor]) =>
          [chave, typeof valor === 'object' ? JSON.stringify(valor) : String(valor)] as const,
      ),
    };
  });

  // Aba "Dados" ------------------------------------------------------------------------------
  protected readonly alterado = computed(() => {
    const negocio = this.negocio();
    if (!negocio) {
      return false;
    }
    return Object.keys(this.alteracao(negocio)).length > 0;
  });
  protected readonly erroTitulo = computed(() =>
    this.enviado() && !String(this.titulo() ?? '').trim()
      ? 'O negócio precisa de um título.'
      : null,
  );
  protected readonly erroValor = computed(() => {
    const valor = paraNumero(this.valor());
    return this.enviado() && valor !== null && valor < 0 ? 'O valor não pode ser negativo.' : null;
  });
  protected readonly erroRecorrente = computed(() => {
    const valor = paraNumero(this.valorRecorrente());
    return this.enviado() && valor !== null && valor < 0 ? 'O valor não pode ser negativo.' : null;
  });
  protected readonly erroMotivo = computed(() =>
    this.enviado() && this.negocio()?.status === 'PERDIDO' && !this.motivoPerda().trim()
      ? 'Escreva o motivo da perda.'
      : null,
  );

  constructor() {
    effect(() => {
      const id = this.negocioId();
      untracked(() => void this.carregar(id));
    });
  }

  // Abrir e fechar ------------------------------------------------------------------------------

  /**
   * Fechou o painel: volta ao quadro. O `<dialog>` devolve o foco a quem o abriu; se esse
   * elemento sumiu (o menu "⋯", um aviso, o cartão que mudou de coluna), o foco vai para o
   * cartão do negócio, para quem usa o teclado não perder o lugar.
   */
  protected voltar(): void {
    const id = this.negocioId();
    void this.router
      .navigate(['/funis', SLUG_AREA[this.areaAtual()]], { queryParamsHandling: 'preserve' })
      .then(() => {
        const ativo = this.documento.activeElement;
        if (!ativo || ativo === this.documento.body || !ativo.isConnected) {
          this.documento
            .querySelector<HTMLElement>(`[data-negocio-id="${id}"] .cartao__titulo`)
            ?.focus();
        }
      });
  }

  protected agir(item: ItemMenuAcoes): void {
    switch (item.id) {
      case 'editar':
        this.aba.set('dados');
        queueMicrotask(() => this.campoTitulo()?.focar());
        break;
      case 'contato':
        void this.router.navigate(['/contatos', this.negocio()!.contato.id]);
        break;
      case 'perda': {
        const perda = this.etapas().find((etapa) => etapa.tipo === 'PERDIDO');
        if (perda) {
          this.etapaSelecionada.set(perda.id);
          this.aguardandoPerda.set(perda.id);
        }
        break;
      }
      case 'reabrir':
        if (this.podeReabrir()) {
          void this.reabrir();
        }
        break;
    }
  }

  // Etapa -----------------------------------------------------------------------------------

  protected mudarEtapa(etapaId: string | null): void {
    const negocio = this.negocio();
    if (!negocio || !etapaId || etapaId === negocio.etapa.id) {
      return;
    }
    this.etapaSelecionada.set(etapaId);
    const etapa = this.etapas().find((item) => item.id === etapaId);
    if (etapa?.tipo === 'PERDIDO') {
      this.aguardandoPerda.set(etapaId);
      return;
    }
    void this.mover(etapaId);
  }

  protected confirmarPerda(motivo: string): void {
    const etapaId = this.aguardandoPerda();
    this.aguardandoPerda.set(null);
    if (etapaId) {
      void this.mover(etapaId, motivo);
    }
  }

  protected cancelarPerda(): void {
    this.aguardandoPerda.set(null);
    this.etapaSelecionada.set(this.negocio()?.etapa.id ?? null);
  }

  private async mover(etapaId: string, motivoPerda?: string): Promise<void> {
    const negocio = this.negocio()!;
    this.movendo.set(true);
    try {
      const resultado = await this.api.mover(negocio.id, {
        etapaId,
        ...(motivoPerda ? { motivoPerda } : {}),
      });
      this.aplicarMovimentacao(resultado);
    } catch (falha) {
      this.etapaSelecionada.set(negocio.etapa.id);
      this.avisos.erro(falha, { titulo: `Não deu para mover “${negocio.titulo}”` });
    } finally {
      this.movendo.set(false);
    }
  }

  private async reabrir(): Promise<void> {
    const negocio = this.negocio()!;
    this.movendo.set(true);
    try {
      const resultado = await this.api.reabrir(negocio.id);
      this.atualizar(resultado.negocio);
      this.versaoLinha.update((versao) => versao + 1);
      this.avisos.sucesso(`Negócio reaberto em ${resultado.negocio.etapa.nome}.`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.movendo.set(false);
    }
  }

  private aplicarMovimentacao(resultado: ResultadoMovimentacao): void {
    this.atualizar(resultado.negocio);
    this.versaoLinha.update((versao) => versao + 1);
    const nomes = this.estado?.nomesDosFunis() ?? new Map<string, string>();
    const aviso = mensagemDaMovimentacao(resultado, true, nomes);
    const destino =
      aviso.destino && (this.sessao.permissoes()?.areasVisiveis.length ?? 0) > 1
        ? aviso.destino
        : null;
    this.avisos.mostrar(aviso.tipo, aviso.mensagem, {
      chave: `mover-${resultado.negocio.id}`,
      acao: destino
        ? {
            rotulo: 'Ver negócio',
            executar: () =>
              void this.router.navigate(['/funis', destino.funilId], {
                queryParams: { negocio: destino.negocioId },
              }),
          }
        : undefined,
    });
    if (resultado.passagens.length) {
      void this.carregarRelacionados(resultado.negocio);
    }
  }

  // Responsável -----------------------------------------------------------------------------

  protected async trocarResponsavel(responsavelId: string | null): Promise<void> {
    const negocio = this.negocio();
    if (!negocio || responsavelId === (negocio.responsavel?.id ?? null)) {
      return;
    }
    this.responsavelSelecionado.set(responsavelId);
    this.trocandoResponsavel.set(true);
    try {
      const atualizado = await this.api.alterarNegocio(negocio.id, { responsavelId });
      const eu = this.sessao.usuario();
      const vouDeixarDeVer =
        this.sessao.permissoes()?.verNegocios === 'PROPRIOS' &&
        !!responsavelId &&
        responsavelId !== eu?.id;
      const nome = atualizado.responsavel?.nome;
      if (vouDeixarDeVer) {
        this.estado?.removerNegocio(negocio.id);
        this.avisos.sucesso(
          `“${negocio.titulo}” agora é de ${nome}. Ele sai do seu quadro, porque você não é mais o responsável.`,
        );
        this.aberto.set(false);
        return;
      }
      this.atualizar(atualizado);
      this.versaoLinha.update((versao) => versao + 1);
      this.avisos.sucesso(
        nome ? `Responsável trocado para ${nome}.` : 'O negócio ficou sem responsável.',
      );
    } catch (falha) {
      this.responsavelSelecionado.set(negocio.responsavel?.id ?? null);
      this.avisos.erro(falha);
    } finally {
      this.trocandoResponsavel.set(false);
    }
  }

  protected async assumir(): Promise<void> {
    const negocio = this.negocio();
    if (!negocio) {
      return;
    }
    this.assumindo.set(true);
    try {
      const atualizado = await this.api.assumir(negocio.id);
      this.atualizar(atualizado);
      this.versaoLinha.update((versao) => versao + 1);
      this.avisos.sucesso(`Você assumiu “${negocio.titulo}”.`);
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.assumindo.set(false);
    }
  }

  protected aoMudarProxima(atividade: Atividade | null): void {
    const negocio = this.negocio();
    if (negocio) {
      this.estado?.definirProxima(negocio.id, atividade);
    }
  }

  // Dados -----------------------------------------------------------------------------------

  protected async salvar(): Promise<void> {
    const negocio = this.negocio();
    if (!negocio) {
      return;
    }
    this.enviado.set(true);
    this.erroSalvar.set(null);
    if (this.erroTitulo() || this.erroValor() || this.erroRecorrente() || this.erroMotivo()) {
      if (this.erroTitulo()) {
        this.campoTitulo()?.focar();
      }
      return;
    }
    const alteracao = this.alteracao(negocio);
    if (!Object.keys(alteracao).length) {
      return;
    }
    this.salvando.set(true);
    try {
      const atualizado = await this.api.alterarNegocio(negocio.id, alteracao);
      this.atualizar(atualizado, true);
      this.enviado.set(false);
      this.versaoLinha.update((versao) => versao + 1);
      this.avisos.sucesso('Alterações salvas.');
    } catch (falha) {
      this.erroSalvar.set(erroDaApi(falha).mensagem);
    } finally {
      this.salvando.set(false);
    }
  }

  protected descartar(): void {
    const negocio = this.negocio();
    if (negocio) {
      this.preencher(negocio);
      this.enviado.set(false);
      this.erroSalvar.set(null);
    }
  }

  // Apoio -------------------------------------------------------------------------------------

  protected async carregar(id: string): Promise<void> {
    const doQuadro = this.estado?.negocio(id) ?? null;
    this.erro.set(null);
    this.relacionados.set([]);
    this.jornada.set(null);
    this.aba.set('linha');
    if (doQuadro) {
      this.atualizar(doQuadro, true);
    } else {
      this.negocio.set(null);
    }
    this.carregando.set(true);
    try {
      const { jornada, ...negocio } = await this.api.negocio(id);
      if (id !== this.negocioId()) {
        return;
      }
      this.jornada.set(jornada ?? null);
      this.atualizar(negocio, !this.alterado());
      void this.carregarFunil(negocio);
      void this.carregarRelacionados(negocio);
      void this.carregarUsuarios();
    } catch (falha) {
      if (id === this.negocioId()) {
        this.erro.set(erroDaApi(falha));
      }
    } finally {
      if (id === this.negocioId()) {
        this.carregando.set(false);
      }
    }
  }

  /** A versão nova do negócio: no painel, no quadro e (se pedido) no rascunho da aba Dados. */
  private atualizar(negocio: Negocio, preencher = true): void {
    this.negocio.set(negocio);
    this.etapaSelecionada.set(negocio.etapa.id);
    this.responsavelSelecionado.set(negocio.responsavel?.id ?? null);
    if (preencher) {
      this.preencher(negocio);
    }
    this.estado?.atualizarNegocio(negocio);
  }

  private preencher(negocio: Negocio): void {
    this.titulo.set(negocio.titulo);
    this.valor.set(paraNumero(negocio.valor));
    this.valorRecorrente.set(paraNumero(negocio.valorRecorrente));
    this.previsao.set(negocio.previsaoFechamento?.slice(0, 10) ?? null);
    this.motivoPerda.set(negocio.motivoPerda ?? '');
  }

  /** Só os campos que mudaram em relação ao negócio salvo. */
  private alteracao(negocio: Negocio): AlteracaoNegocio {
    const mudou: { -readonly [K in keyof AlteracaoNegocio]: AlteracaoNegocio[K] } = {};
    const titulo = String(this.titulo() ?? '').trim();
    if (titulo !== negocio.titulo) {
      mudou.titulo = titulo;
    }
    const valor = paraDecimal(paraNumero(this.valor()) ?? 0) ?? '0.00';
    if (valor !== (paraDecimal(negocio.valor) ?? '0.00')) {
      mudou.valor = valor;
    }
    const recorrente = paraDecimal(paraNumero(this.valorRecorrente()));
    if (recorrente !== paraDecimal(negocio.valorRecorrente ?? null)) {
      mudou.valorRecorrente = recorrente;
    }
    const previsao = this.previsao() || null;
    if (previsao !== (negocio.previsaoFechamento?.slice(0, 10) ?? null)) {
      mudou.previsaoFechamento = previsao;
    }
    if (negocio.status === 'PERDIDO') {
      const motivo = this.motivoPerda().trim();
      if (motivo !== (negocio.motivoPerda ?? '')) {
        mudou.motivoPerda = motivo;
      }
    }
    return mudou;
  }

  private vinculo(rotulo: Vinculo['rotulo'], negocio: Negocio): Vinculo {
    return {
      rotulo,
      funil: negocio.funil.nome || ROTULO_AREA[negocio.funil.area],
      titulo: negocio.titulo,
      link: ['/funis', SLUG_AREA[negocio.funil.area], negocio.id],
      queryParams: { funil: negocio.funil.id },
    };
  }

  private async carregarFunil(negocio: Negocio): Promise<void> {
    const doQuadro = this.estado?.funil();
    if (doQuadro?.id === negocio.funil.id) {
      this.funil.set(doQuadro);
      return;
    }
    try {
      this.funil.set(await this.api.funil(negocio.funil.id));
    } catch {
      // Sem as etapas, o seletor mostra só a etapa atual.
    }
  }

  private async carregarRelacionados(negocio: Negocio): Promise<void> {
    try {
      const pagina = await this.api.negociosDoContato(negocio.contato.id);
      if (negocio.id === this.negocioId()) {
        this.relacionados.set(pagina.itens);
      }
    } catch {
      // A jornada é um complemento: sem ela, o painel continua útil.
    }
  }

  private async carregarUsuarios(): Promise<void> {
    try {
      if (this.estado) {
        await this.estado.carregarUsuarios();
      } else {
        this.usuariosLocais.set((await this.api.usuariosAtivos()).itens);
      }
    } catch {
      // O seletor fica com você e o responsável atual.
    }
  }
}

/** "Gerou: negócio em Customer Success (sem acesso)": o outro funil existe, mas a pessoa não o vê. */
function semAcesso(rotulo: Vinculo['rotulo'], area: Area): Vinculo {
  return { rotulo, funil: ROTULO_AREA[area], titulo: null, link: null, semAcesso: true };
}
