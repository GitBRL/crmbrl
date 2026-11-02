import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCopy,
  LucideFlaskConical,
  LucidePause,
  LucidePlay,
  LucideSave,
  LucideTrash2,
} from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { AREAS, ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { ConstrutorSegmento } from '../../ui/construtor-segmento/construtor-segmento';
import {
  type CampoSegmento,
  type Segmento,
  SEGMENTO_VAZIO,
} from '../../ui/construtor-segmento/segmento';
import { EditorPassos } from '../../ui/editor-passos/editor-passos';
import { type Passo, validarPassos } from '../../ui/editor-passos/passos';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Modal } from '../../ui/modal/modal';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { Selo } from '../../ui/selo/selo';
import { type Agenda, agendaPadrao, erroDaAgenda } from '../../ui/seletor-agenda/agenda';
import { SeletorAgenda } from '../../ui/seletor-agenda/seletor-agenda';
import {
  JANELA_COMERCIAL,
  type JanelaEnvio,
  erroDaJanela,
} from '../../ui/seletor-janela-envio/janela-envio';
import { SeletorJanelaEnvio } from '../../ui/seletor-janela-envio/seletor-janela-envio';
import { AutomacoesApi } from './automacoes.api';
import {
  type Automacao,
  type Catalogo,
  type CorpoAutomacao,
  type CriterioParada,
  type LimiteExecucao,
  ROTULO_CRITERIO,
  ROTULO_ENTIDADE,
  ROTULO_MOTIVO_CONDICOES,
  ROTULO_TIPO_GATILHO,
  type ResultadoTeste,
  type TipoGatilho,
} from './automacoes.tipos';
import {
  agendaParaConfig,
  configParaAgenda,
  configParaFiltros,
  filtrosParaConfig,
  horarioParaJanela,
  janelaParaHorario,
  marketingPadrao,
  segmentoDaApi,
  segmentoParaApi,
  segmentoTemCondicoes,
  type FiltrosGatilho,
} from './conversao';
import { DetalheExecucao } from './detalhe-execucao';
import { HistoricoAutomacoes } from './historico';
import {
  APOIO_VAZIO,
  type ApoioDePassos,
  type Bruto,
  definicoesDePassos,
  passosDaApi,
  passosParaApi,
} from './passos-automacao';

type Texto = string | number | null;

const FILTRO_ROTULO: Readonly<Record<string, { rotulo: string; dica?: string }>> = {
  origem: { rotulo: 'De onde veio o contato', dica: 'Vazio: qualquer origem.' },
  funilId: { rotulo: 'Funil', dica: 'Vazio: qualquer funil.' },
  etapaId: { rotulo: 'Etapa', dica: 'Vazio: qualquer etapa.' },
  diasAlemDoPrazo: {
    rotulo: 'Dias além do prazo da etapa',
    dica: '0 = assim que o prazo da etapa vence.',
  },
  tipo: { rotulo: 'Tipo de atividade', dica: 'Vazio: qualquer tipo.' },
  horasAlemDoVencimento: {
    rotulo: 'Horas depois do vencimento',
    dica: '0 = assim que vence.',
  },
  canalTipo: { rotulo: 'Tipo de canal', dica: 'Vazio: qualquer canal.' },
  canalId: { rotulo: 'Canal', dica: 'Vazio: qualquer canal.' },
  palavras: {
    rotulo: 'Palavras que disparam',
    dica: 'Separe com vírgula. Dispara se a mensagem tiver qualquer uma.',
  },
  notaMinima: { rotulo: 'Nota mínima (1 a 5)' },
  notaMaxima: { rotulo: 'Nota máxima (1 a 5)', dica: 'Ex.: 2 para agir só com notas baixas.' },
  campanhaId: { rotulo: 'Campanha', dica: 'Vazio: qualquer campanha.' },
};

const ORIGENS: readonly OpcaoSeletor<string>[] = [
  ['MANUAL', 'Cadastro manual'],
  ['SITE', 'Site'],
  ['WHATSAPP', 'WhatsApp'],
  ['EMAIL', 'E-mail'],
  ['INSTAGRAM', 'Instagram'],
  ['MESSENGER', 'Messenger'],
  ['WEBHOOK', 'Integração (webhook)'],
  ['IMPORTACAO', 'Importação'],
  ['INDICACAO', 'Indicação'],
  ['PASSAGEM', 'Passagem entre áreas'],
  ['OUTRO', 'Outra'],
].map(([valor, rotulo]) => ({ valor, rotulo }));

const TIPOS_CANAL: readonly OpcaoSeletor<string>[] = [
  ['WHATSAPP', 'WhatsApp'],
  ['WHATSAPP_OFICIAL', 'WhatsApp oficial'],
  ['WEBCHAT', 'Chat do site'],
  ['EMAIL', 'E-mail'],
  ['INSTAGRAM', 'Instagram'],
  ['MESSENGER', 'Messenger'],
].map(([valor, rotulo]) => ({ valor, rotulo }));

const TIPOS_ATIVIDADE: readonly OpcaoSeletor<string>[] = [
  ['TAREFA', 'Tarefa'],
  ['LIGACAO', 'Ligação'],
  ['REUNIAO', 'Reunião'],
  ['EMAIL', 'E-mail'],
  ['WHATSAPP', 'WhatsApp'],
].map(([valor, rotulo]) => ({ valor, rotulo }));

const ABAS: readonly ItemAba[] = [
  { id: 'editar', rotulo: 'Configuração' },
  { id: 'historico', rotulo: 'Histórico' },
];

const CRITERIOS: readonly CriterioParada[] = ['RESPONDEU', 'GANHOU', 'PERDEU', 'SAIU_DO_SEGMENTO'];

/**
 * Editor de automação (`/automacoes/nova` e `/automacoes/:id`): nome, gatilho (quando começa),
 * condições (para quem e em que horário), passos (ações, esperas e "se… senão"), quando parar e
 * limites. Salvar nunca liga a automação; ligar só funciona com tudo preenchido. O modo teste
 * roda a automação para um registro sem enviar nada de verdade.
 */
@Component({
  selector: 'app-editor-automacao',
  imports: [
    Abas,
    AreaTexto,
    Botao,
    CaixaSelecao,
    CampoTexto,
    Cartao,
    ConstrutorSegmento,
    DetalheExecucao,
    EditorPassos,
    EstadoVazio,
    Esqueleto,
    HistoricoAutomacoes,
    Modal,
    PainelLateral,
    RouterLink,
    Seletor,
    SeletorAgenda,
    SeletorJanelaEnvio,
    Selo,
  ],
  templateUrl: './editor-automacao.html',
  styleUrl: './editor-automacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorAutomacao {
  private readonly api = inject(AutomacoesApi);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  protected readonly sessao = inject(SessaoService);

  /** `:id` da rota; ausente em `/automacoes/nova`. */
  readonly id = input<string | undefined>(undefined);

  // --- carregamento
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly automacao = signal<Automacao | null>(null);
  protected readonly catalogo = signal<Catalogo | null>(null);
  protected readonly aba = signal('editar');
  protected readonly abas = ABAS;

  // --- apoio (listas)
  protected readonly funis = signal<
    readonly { id: string; nome: string; etapas: readonly { id: string; nome: string }[] }[]
  >([]);
  protected readonly etiquetas = signal<readonly string[]>([]);
  protected readonly usuarios = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly fluxos = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly webhooks = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly campanhas = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly canais = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly modelos = signal<
    readonly { id: string; nome: string; canal: string | null }[]
  >([]);
  protected readonly chavesPersonalizadas = signal<readonly string[]>([]);

  // --- estado editável
  protected readonly nome = signal<Texto>('');
  protected readonly descricao = signal('');
  protected readonly area = signal<string | null>(null);
  protected readonly tipoGatilho = signal<TipoGatilho>('EVENTO');
  protected readonly evento = signal<string | null>(null);
  protected readonly filtros = signal<FiltrosGatilho>({});
  protected readonly agenda = signal<Agenda>(agendaPadrao('recorrente'));
  protected readonly usarSegmento = signal(false);
  protected readonly segmento = signal<Segmento>(SEGMENTO_VAZIO);
  protected readonly segmentoAvancado = signal<unknown>(null);
  protected readonly usarHorario = signal(false);
  protected readonly janela = signal<JanelaEnvio>(JANELA_COMERCIAL);
  protected readonly horarioAvancado = signal<unknown>(null);
  protected readonly passos = signal<readonly Passo[]>([]);
  protected readonly criterios = signal<readonly CriterioParada[]>(['RESPONDEU']);
  protected readonly limite = signal<LimiteExecucao>('UMA_VEZ');
  protected readonly limiteDias = signal<Texto>(30);
  protected readonly marketing = signal(false);
  /** Depois que a pessoa mexe na caixa (ou abre uma automação salva), o padrão não interfere mais. */
  private marketingEscolhido = false;
  private readonly bruto: Bruto = new Map();

  // --- ações
  protected readonly salvando = signal(false);
  protected readonly agindo = signal(false);
  protected readonly avisoErro = signal<string | null>(null);
  protected readonly pendenciasDaApi = signal<readonly string[]>([]);
  private readonly instantaneo = signal('');

  // --- pausar / testar
  protected readonly modalPausar = signal(false);
  protected readonly cancelarEsperas = signal(false);
  protected readonly painelTeste = signal(false);
  protected readonly candidatos = signal<readonly OpcaoSeletor<string>[]>([]);
  protected readonly candidatoId = signal<string | null>(null);
  protected readonly idManual = signal<Texto>('');
  protected readonly testando = signal(false);
  protected readonly resultadoTeste = signal<ResultadoTeste | null>(null);
  protected readonly erroTeste = signal<string | null>(null);
  protected readonly acaoExecucao = signal(false);

  protected readonly rotuloTipoGatilho = ROTULO_TIPO_GATILHO;
  protected readonly rotuloCriterio = ROTULO_CRITERIO;
  protected readonly criteriosLista = CRITERIOS;
  protected readonly rotuloEntidade = ROTULO_ENTIDADE;
  protected readonly filtroRotulo = FILTRO_ROTULO;
  protected readonly origens = ORIGENS;
  protected readonly tiposCanal = TIPOS_CANAL;
  protected readonly tiposAtividade = TIPOS_ATIVIDADE;
  protected readonly iconeVoltar = LucideArrowLeft;
  protected readonly iconeSalvar = LucideSave;
  protected readonly iconeTeste = LucideFlaskConical;
  protected readonly iconePausar = LucidePause;
  protected readonly iconeLigar = LucidePlay;
  protected readonly iconeCopiar = LucideCopy;
  protected readonly iconeLixo = LucideTrash2;
  protected readonly opcoesTipoGatilho: readonly OpcaoSeletor<TipoGatilho>[] = (
    Object.keys(ROTULO_TIPO_GATILHO) as TipoGatilho[]
  ).map((valor) => ({ valor, rotulo: ROTULO_TIPO_GATILHO[valor] }));
  protected readonly opcoesLimite: readonly OpcaoSeletor<LimiteExecucao>[] = [
    { valor: 'UMA_VEZ', rotulo: 'Uma vez para cada contato, negócio ou conversa' },
    { valor: 'UMA_VEZ_POR_PERIODO', rotulo: 'Uma vez a cada tantos dias' },
    { valor: 'SEMPRE', rotulo: 'Toda vez que acontecer' },
  ];
  protected readonly opcoesArea: readonly OpcaoSeletor<string>[] = AREAS.map((a) => ({
    valor: a,
    rotulo: ROTULO_AREA[a],
  }));

  // --- derivados
  protected readonly ehNova = computed(() => !this.id());
  protected readonly opcoesEvento = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.catalogo()?.gatilhos ?? []).map((g) => ({ valor: g.evento, rotulo: g.rotulo })),
  );
  protected readonly gatilhoAtual = computed(
    () => this.catalogo()?.gatilhos.find((g) => g.evento === this.evento()) ?? null,
  );
  protected readonly filtrosDoEvento = computed(() => this.gatilhoAtual()?.filtros ?? []);
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis().map((f) => ({ valor: f.id, rotulo: f.nome })),
  );
  protected readonly opcoesEtapaDoFiltro = computed<readonly OpcaoSeletor<string>[]>(() => {
    const funilId = this.filtros()['funilId'];
    return this.funis()
      .filter((f) => !funilId || f.id === funilId)
      .flatMap((f) =>
        f.etapas.map((e) => ({ valor: e.id, rotulo: funilId ? e.nome : `${f.nome} › ${e.nome}` })),
      );
  });
  protected readonly opcoesCampoData = computed<readonly OpcaoSeletor<string>[]>(() => {
    const base = (this.catalogo()?.camposDeData ?? []).map((c) => ({
      valor: c.campo,
      rotulo: c.rotulo,
    }));
    const extras = this.chavesPersonalizadas().map((k) => ({
      valor: `contato.campos.${k}`,
      rotulo: `Campo do contato: ${k}`,
    }));
    const atual = this.agenda().campo;
    const todos = [...base, ...extras];
    if (atual && !todos.some((o) => o.valor === atual)) {
      todos.push({ valor: atual, rotulo: atual.replace('contato.campos.', 'Campo do contato: ') });
    }
    return todos;
  });
  protected readonly apoio = computed<ApoioDePassos>(() => ({
    ...APOIO_VAZIO,
    etapas: this.funis().flatMap((f) =>
      f.etapas.map((e) => ({ valor: e.id, rotulo: `${f.nome} › ${e.nome}` })),
    ),
    usuarios: this.usuarios(),
    fluxos: this.fluxos(),
    webhooks: this.webhooks(),
    modelosWhatsapp: this.modelos()
      .filter((m) => m.canal === null || m.canal === 'WHATSAPP')
      .map((m) => ({ valor: m.id, rotulo: m.nome })),
    modelosEmail: this.modelos()
      .filter((m) => m.canal === null || m.canal === 'EMAIL')
      .map((m) => ({ valor: m.id, rotulo: m.nome })),
    etiquetas: this.etiquetas().map((e) => ({ valor: e, rotulo: e })),
  }));
  protected readonly definicoes = computed(() => definicoesDePassos(this.apoio()));
  protected readonly camposSegmento = computed<readonly CampoSegmento[]>(() => [
    {
      id: 'etiqueta',
      rotulo: 'Etiqueta',
      tipo: 'opcao',
      grupo: 'Contato',
      operadores: ['e', 'nao-e'],
      opcoes: this.etiquetas().map((e) => ({ valor: e, rotulo: e })),
    },
    {
      id: 'origem',
      rotulo: 'Origem',
      tipo: 'opcao',
      grupo: 'Contato',
      operadores: ['e', 'nao-e'],
      opcoes: ORIGENS.map((o) => ({ valor: o.valor, rotulo: o.rotulo })),
    },
    {
      id: 'responsavel',
      rotulo: 'Responsável',
      tipo: 'opcao',
      grupo: 'Contato',
      operadores: ['e', 'nao-e', 'vazio', 'preenchido'],
      opcoes: this.usuarios().map((u) => ({ valor: u.valor, rotulo: u.rotulo })),
    },
    {
      id: 'email',
      rotulo: 'E-mail',
      tipo: 'texto',
      grupo: 'Contato',
      operadores: ['preenchido', 'vazio'],
    },
    {
      id: 'telefone',
      rotulo: 'Telefone',
      tipo: 'texto',
      grupo: 'Contato',
      operadores: ['preenchido', 'vazio'],
    },
    {
      id: 'opt_out',
      rotulo: 'Pediu para não receber marketing',
      tipo: 'booleano',
      grupo: 'Contato',
    },
    { id: 'negocio', rotulo: 'Tem negócio', tipo: 'booleano', grupo: 'Negócio' },
    {
      id: 'criado_em',
      rotulo: 'Cadastrado',
      tipo: 'data',
      grupo: 'Datas',
      operadores: ['ultimos-dias', 'ha-mais-de-dias', 'antes', 'depois'],
    },
    {
      id: 'ultima_interacao_em',
      rotulo: 'Última conversa',
      tipo: 'data',
      grupo: 'Datas',
      operadores: ['ultimos-dias', 'ha-mais-de-dias', 'antes', 'depois'],
    },
  ]);
  protected readonly contagem = (segmento: Segmento): Promise<number> =>
    this.api.contarSegmento(segmentoParaApi(segmento), this.marketing());

  protected readonly problemasDosPassos = computed(() =>
    validarPassos(this.passos(), this.definicoes()),
  );
  protected readonly erroDoGatilho = computed<string | null>(() => {
    if (this.tipoGatilho() === 'EVENTO') {
      return this.evento() ? null : 'Escolha o que faz a automação começar.';
    }
    return erroDaAgenda(this.agenda());
  });
  protected readonly corpo = computed<CorpoAutomacao>(() => this.montarCorpo());
  protected readonly sujo = computed(() => JSON.stringify(this.corpo()) !== this.instantaneo());
  protected readonly nomeVazio = computed(() => String(this.nome() ?? '').trim() === '');
  protected readonly podeSalvar = computed(() => !this.nomeVazio() && !this.salvando());
  protected readonly entidadeDeTeste = computed(() => this.automacao()?.entidade ?? 'contato');
  protected readonly textoMotivo = (m: string | null): string =>
    m ? (ROTULO_MOTIVO_CONDICOES[m] ?? m) : '';
  protected escolherMarketing(valor: boolean): void {
    this.marketingEscolhido = true;
    this.marketing.set(valor);
  }

  protected readonly titulo = computed(() => {
    const nome = String(this.nome() ?? '').trim();
    return nome || (this.ehNova() ? 'Nova automação' : 'Automação');
  });

  constructor() {
    // Também recarrega quando a rota troca só o `:id` (ex.: depois de duplicar).
    effect(() => {
      this.id();
      untracked(() => void this.iniciar());
    });
    // Automação nova da área de Marketing nasce como "mensagem de marketing" (R4.6): assim o
    // e-mail dela não chega a quem pediu para não receber.
    effect(() => {
      const area = this.sessao.ehDiretoria() ? this.area() : (this.sessao.usuario()?.area ?? null);
      if (this.id() || this.marketingEscolhido) return;
      untracked(() => this.marketing.set(marketingPadrao(area)));
    });
  }

  // --- carregar -------------------------------------------------------------------------------

  protected async iniciar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const idAtual = this.id();
      const [catalogo, automacao] = await Promise.all([
        this.api.catalogo(),
        idAtual ? this.api.obter(idAtual) : Promise.resolve(null),
      ]);
      this.catalogo.set(catalogo);
      const [funis, etiquetas, usuarios, fluxos, modelos, webhooks, campanhas, canais, chaves] =
        await Promise.all([
          this.api.funis(),
          this.api.etiquetas(),
          this.api.usuarios(),
          this.api.fluxosChatbot(),
          this.api.modelosMensagem(),
          this.api.webhooksSaida(),
          this.api.campanhas(),
          this.api.canais(),
          this.api.camposPersonalizados(),
        ]);
      this.funis.set(funis);
      this.etiquetas.set(etiquetas);
      const op = (l: readonly { id: string; rotulo: string }[]) =>
        l.map((x) => ({ valor: x.id, rotulo: x.rotulo }));
      this.usuarios.set(op(usuarios));
      this.fluxos.set(op(fluxos));
      this.webhooks.set(op(webhooks));
      this.campanhas.set(op(campanhas));
      this.canais.set(op(canais));
      this.modelos.set(modelos);
      this.chavesPersonalizadas.set(chaves);
      if (automacao) {
        this.aplicar(automacao);
      } else {
        this.instantaneo.set(JSON.stringify(this.montarCorpo()));
      }
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Põe a automação da API nos campos da tela e marca como "sem mudanças". */
  private aplicar(a: Automacao): void {
    this.automacao.set(a);
    this.nome.set(a.nome);
    this.descricao.set(a.descricao ?? '');
    this.area.set(a.area);
    this.tipoGatilho.set(a.tipoGatilho);
    this.evento.set(a.evento);
    if (a.tipoGatilho === 'EVENTO') {
      this.filtros.set(configParaFiltros(a.gatilhoConfig));
    } else {
      this.filtros.set({});
      this.agenda.set(configParaAgenda(a.tipoGatilho, a.gatilhoConfig));
    }
    const temSegmento = segmentoTemCondicoes(a.condicoes?.segmento);
    this.usarSegmento.set(temSegmento);
    const conv = segmentoDaApi(a.condicoes?.segmento);
    this.segmento.set(conv.segmento);
    this.segmentoAvancado.set(temSegmento && !conv.completo ? a.condicoes?.segmento : null);
    const horario = a.condicoes?.horario;
    const j = horario ? horarioParaJanela(horario) : null;
    this.usarHorario.set(!!horario);
    this.janela.set(j ?? JANELA_COMERCIAL);
    this.horarioAvancado.set(horario && !j ? horario : null);
    this.bruto.clear();
    this.passos.set(passosDaApi(a.definicao?.passos ?? [], this.bruto));
    this.criterios.set([...a.criteriosParada]);
    this.limite.set(a.limiteExecucao);
    this.limiteDias.set(a.limitePeriodoDias ?? 30);
    this.marketingEscolhido = true;
    this.marketing.set(a.marketing);
    this.pendenciasDaApi.set(a.pendencias);
    this.instantaneo.set(JSON.stringify(this.montarCorpo()));
  }

  // --- montar o corpo para a API --------------------------------------------------------------

  private funilDaEtapa = (etapaId: string): string | undefined =>
    this.funis().find((f) => f.etapas.some((e) => e.id === etapaId))?.id;

  private montarCorpo(): CorpoAutomacao {
    const tipo = this.tipoGatilho();
    const condicoes: Record<string, unknown> = {};
    if (this.usarSegmento()) {
      const bruto = this.segmentoAvancado();
      const seg = bruto ?? segmentoParaApi(this.segmento());
      if (segmentoTemCondicoes(seg)) condicoes['segmento'] = seg;
    }
    if (this.usarHorario()) {
      condicoes['horario'] = this.horarioAvancado() ?? janelaParaHorario(this.janela());
    }
    const corpo: CorpoAutomacao = {
      nome: String(this.nome() ?? '').trim(),
      descricao: this.descricao().trim() || null,
      tipoGatilho: tipo,
      evento: tipo === 'EVENTO' ? this.evento() : null,
      gatilhoConfig:
        tipo === 'EVENTO'
          ? filtrosParaConfig(this.filtros())
          : agendaParaConfig(tipo, this.agenda()),
      condicoes,
      definicao: { passos: passosParaApi(this.passos(), this.bruto, this.funilDaEtapa) },
      criteriosParada: [...this.criterios()],
      limiteExecucao: this.limite(),
      limitePeriodoDias:
        this.limite() === 'UMA_VEZ_POR_PERIODO' ? Number(this.limiteDias()) || null : null,
      marketing: this.marketing(),
    };
    if (this.sessao.ehDiretoria()) corpo.area = this.area();
    return corpo;
  }

  // --- edição ---------------------------------------------------------------------------------

  protected mudarTipoGatilho(tipo: TipoGatilho | null): void {
    if (!tipo || tipo === this.tipoGatilho()) return;
    this.tipoGatilho.set(tipo);
    this.filtros.set({});
    if (tipo === 'EVENTO') {
      return;
    }
    this.evento.set(null);
    this.agenda.set(agendaPadrao(tipo === 'RECORRENCIA' ? 'recorrente' : 'relativa'));
  }

  protected mudarEvento(evento: string | null): void {
    this.evento.set(evento);
    this.filtros.set({});
  }

  protected valorFiltro(chave: string): Texto {
    return this.filtros()[chave] ?? null;
  }

  protected definirFiltro(chave: string, valor: Texto): void {
    const novo = { ...this.filtros(), [chave]: valor === '' ? null : valor };
    if (chave === 'funilId') {
      novo['etapaId'] = null;
    }
    this.filtros.set(novo);
  }

  protected alternarCriterio(c: CriterioParada, marcado: boolean): void {
    const atual = this.criterios();
    this.criterios.set(marcado ? [...new Set([...atual, c])] : atual.filter((x) => x !== c));
  }

  protected temCriterio(c: CriterioParada): boolean {
    return this.criterios().includes(c);
  }

  protected trocarSegmentoAvancado(): void {
    this.segmentoAvancado.set(null);
  }

  protected trocarHorarioAvancado(): void {
    this.horarioAvancado.set(null);
  }

  protected erroJanela(): string | null {
    return erroDaJanela(this.janela());
  }

  // --- salvar e agir --------------------------------------------------------------------------

  /** Salva (cria ou atualiza). Devolve a automação salva ou `null` se não deu. */
  protected async salvar(): Promise<Automacao | null> {
    if (this.nomeVazio()) {
      this.avisoErro.set('Dê um nome para a automação.');
      return null;
    }
    this.salvando.set(true);
    this.avisoErro.set(null);
    try {
      const idAtual = this.id();
      const salva = idAtual
        ? await this.api.atualizar(idAtual, this.soAlterados(this.corpo()))
        : await this.api.criar(this.corpo());
      this.avisos.sucesso('Automação salva.');
      if (!idAtual) {
        await this.router.navigate(['/automacoes', salva.id], { replaceUrl: true });
        return salva;
      }
      this.aplicar(salva);
      return salva;
    } catch (falha) {
      this.avisoErro.set(this.textoDoErro(falha));
      return null;
    } finally {
      this.salvando.set(false);
    }
  }

  /** Na edição só vão os campos que mudaram: assim a versão da automação não sobe à toa. */
  private soAlterados(corpo: CorpoAutomacao): CorpoAutomacao {
    const base = JSON.parse(this.instantaneo() || '{}') as Record<string, unknown>;
    const alterados: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(corpo)) {
      if (JSON.stringify(valor) !== JSON.stringify(base[chave])) alterados[chave] = valor;
    }
    return alterados as CorpoAutomacao;
  }

  private textoDoErro(falha: unknown): string {
    const e = erroDaApi(falha);
    const problemas = (e.detalhes?.['problemas'] as { mensagem: string }[] | undefined)?.map(
      (p) => p.mensagem,
    );
    const pendencias = e.detalhes?.['pendencias'] as string[] | undefined;
    const lista = problemas ?? pendencias;
    return lista?.length ? `${e.mensagem} ${lista.join(' ')}` : e.mensagem;
  }

  protected async ativar(): Promise<void> {
    this.agindo.set(true);
    this.avisoErro.set(null);
    try {
      let a = this.automacao();
      if (this.sujo() || !a) {
        a = await this.salvar();
        if (!a || !this.id()) return;
      }
      const ligada = await this.api.ativar(a.id);
      this.aplicar(ligada);
      this.avisos.sucesso('Automação ligada.');
    } catch (falha) {
      const e = erroDaApi(falha);
      const pendencias = e.detalhes?.['pendencias'] as string[] | undefined;
      if (pendencias?.length) this.pendenciasDaApi.set(pendencias);
      this.avisoErro.set(this.textoDoErro(falha));
    } finally {
      this.agindo.set(false);
    }
  }

  protected abrirPausar(): void {
    this.cancelarEsperas.set(false);
    this.modalPausar.set(true);
  }

  protected async pausar(): Promise<void> {
    const a = this.automacao();
    if (!a) return;
    this.agindo.set(true);
    try {
      const pausada = await this.api.pausar(a.id, this.cancelarEsperas());
      if (this.sujo()) this.automacao.set(pausada);
      else this.aplicar(pausada);
      this.modalPausar.set(false);
      this.avisos.sucesso('Automação desligada.');
    } catch (falha) {
      this.avisoErro.set(this.textoDoErro(falha));
      this.modalPausar.set(false);
    } finally {
      this.agindo.set(false);
    }
  }

  protected async duplicar(): Promise<void> {
    const a = this.automacao();
    if (!a) return;
    try {
      const copia = await this.api.duplicar(a.id);
      this.avisos.sucesso('Cópia criada, desligada.');
      await this.router.navigate(['/automacoes', copia.id]);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  protected async excluir(): Promise<void> {
    const a = this.automacao();
    if (!a) return;
    const ok = await this.confirmacao.confirmar({
      titulo: 'Excluir esta automação?',
      mensagem: `“${a.nome}” será apagada e as execuções que estão esperando serão canceladas. Isso não pode ser desfeito.`,
      confirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await this.api.excluir(a.id);
      this.avisos.sucesso('Automação excluída.');
      await this.router.navigate(['/automacoes']);
    } catch (falha) {
      this.avisos.erro(falha);
    }
  }

  // --- modo teste -----------------------------------------------------------------------------

  protected async abrirTeste(): Promise<void> {
    if (this.sujo() || !this.automacao()) {
      const salva = await this.salvar();
      if (!salva || !this.id()) return;
    }
    this.resultadoTeste.set(null);
    this.erroTeste.set(null);
    this.candidatoId.set(null);
    this.idManual.set('');
    this.painelTeste.set(true);
    const a = this.automacao();
    if (a) {
      const lista = await this.api.candidatosDeTeste(a.entidade);
      this.candidatos.set(lista.map((c) => ({ valor: c.id, rotulo: c.rotulo })));
    }
  }

  protected async testar(): Promise<void> {
    const a = this.automacao();
    const alvo = this.candidatoId() ?? String(this.idManual() ?? '').trim();
    if (!a || !alvo) {
      this.erroTeste.set('Escolha em qual registro testar.');
      return;
    }
    this.testando.set(true);
    this.erroTeste.set(null);
    this.resultadoTeste.set(null);
    try {
      this.resultadoTeste.set(await this.api.testar(a.id, alvo));
    } catch (falha) {
      this.erroTeste.set(erroDaApi(falha).mensagem);
    } finally {
      this.testando.set(false);
    }
  }

  protected async agirNaExecucao(tipo: 'reexecutar' | 'cancelar', id: string): Promise<void> {
    this.acaoExecucao.set(true);
    try {
      const detalhe =
        tipo === 'reexecutar' ? await this.api.reexecutar(id) : await this.api.cancelarExecucao(id);
      const atual = this.resultadoTeste();
      if (atual) this.resultadoTeste.set({ ...atual, execucao: detalhe });
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.acaoExecucao.set(false);
    }
  }
}
