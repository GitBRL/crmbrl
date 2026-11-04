import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  type FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LucidePlus, LucideX } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { type OpcaoSeletor, Seletor } from '../../ui/seletor/seletor';
import { ValorUnico } from './comum/valor-unico';
import { IntegracoesApi } from './integracoes.api';
import {
  type DadosWebhookSaida,
  type EventoDeWebhook,
  type EventoDisponivel,
  descricaoDoEvento,
  type FormatoClint,
  type FormatoDeSaida,
  type FunilDoDestino,
  type GatilhoDeSaida,
  type MetodoDeSaida,
  ROTULO_EVENTO,
  ROTULO_GATILHO,
  ROTULO_STATUS_INICIAL,
  type StatusInicial,
  type TipoDeGatilho,
  type WebhookSaida,
  type WebhookSaidaComSegredo,
} from './tipos';

/** Identificador de um campo do envio no formato Clint (a API aceita estes caracteres). */
const IDENTIFICADOR_VALIDO = /^[A-Za-z0-9_.[\]-]{1,100}$/;

interface GatilhoEditavel {
  readonly id: number;
  readonly tipo: TipoDeGatilho;
  readonly funilId: string | null;
  readonly etapaId: string | null;
  readonly status: StatusInicial | null;
}

interface CampoEditavel {
  readonly origem: string;
  readonly rotulo: string;
  readonly grupo: string;
  readonly marcado: boolean;
  readonly identificador: string;
}

const OPCOES_FORMATO: readonly OpcaoGrupo<FormatoDeSaida>[] = [
  {
    valor: 'ENVELOPE_CRM',
    rotulo: 'Envelope do CRM',
    dica: 'Um POST com { id, evento, ocorridoEm, dados } a cada evento marcado, assinado com HMAC. Serve para integrações próprias.',
  },
  {
    valor: 'CLINT',
    rotulo: 'Formato Clint',
    dica: 'Você escolhe os gatilhos (negócio criado, entrou na etapa, mudou de status) e os campos enviados, cada um com o nome que o destino espera. POST com JSON ou GET com parâmetros na URL.',
  },
];

const OPCOES_METODO: readonly OpcaoGrupo<MetodoDeSaida>[] = [
  { valor: 'POST', rotulo: 'POST (JSON)', dica: 'Os campos vão num corpo JSON.' },
  { valor: 'GET', rotulo: 'GET (URL)', dica: 'Os campos vão como parâmetros na própria URL.' },
];

/** Nome de cabeçalho HTTP válido (token da RFC 9110). */
const NOME_DE_CABECALHO = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const CABECALHOS_MAXIMOS = 20;

/**
 * Cadastro e edição de um webhook de saída (TELAS-FASE1 §7, R9.1): nome, URL, eventos
 * (caixas com a descrição de cada um) e cabeçalhos extras. Ao criar, mostra o segredo das
 * assinaturas **uma única vez**.
 */
@Component({
  selector: 'app-formulario-saida',
  imports: [
    ReactiveFormsModule,
    Modal,
    Botao,
    BotaoIcone,
    CaixaSelecao,
    CampoTexto,
    Dica,
    EstadoVazio,
    Esqueleto,
    GrupoOpcoes,
    Seletor,
    ValorUnico,
  ],
  templateUrl: './formulario-saida.html',
  styleUrl: './formulario-saida.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioSaida {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly aberto = model(false);
  /** Destino a editar; sem ele, cadastra um novo. */
  readonly webhook = input<WebhookSaida | null>(null);
  readonly criado = output<WebhookSaidaComSegredo>();
  readonly salvo = output<WebhookSaida>();

  protected readonly icones = { adicionar: LucidePlus, remover: LucideX };
  protected readonly maximoCabecalhos = CABECALHOS_MAXIMOS;
  protected readonly mensagensUrl = {
    pattern: 'Digite o endereço completo, começando com https:// ou http://.',
  };
  protected readonly mensagensCabecalho = {
    pattern: 'Use só letras, números e hífen (ex.: X-Token).',
  };

  protected readonly eventosDisponiveis = signal<readonly EventoDisponivel[]>([]);
  protected readonly carregandoEventos = signal(false);
  protected readonly erroEventos = signal<ErroApi | null>(null);
  protected readonly marcados = signal<ReadonlySet<EventoDeWebhook>>(new Set());
  protected readonly tocouEventos = signal(false);
  /** Cabeçalhos já salvos (mascarados) que a pessoa marcou para remover. */
  protected readonly removidos = signal<ReadonlySet<string>>(new Set());
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly segredoCriado = signal<WebhookSaidaComSegredo | null>(null);

  // Formato Clint (Onda H)
  protected readonly opcoesFormato = OPCOES_FORMATO;
  protected readonly opcoesMetodo = OPCOES_METODO;
  protected readonly formato = signal<FormatoDeSaida>('ENVELOPE_CRM');
  protected readonly metodo = signal<MetodoDeSaida>('POST');
  protected readonly gatilhos = signal<readonly GatilhoEditavel[]>([]);
  protected readonly campos = signal<readonly CampoEditavel[]>([]);
  private readonly formatoClint = signal<FormatoClint | null>(null);
  private readonly funis = signal<readonly FunilDoDestino[]>([]);
  protected readonly carregandoClint = signal(false);
  protected readonly erroClint = signal<ErroApi | null>(null);
  private proximoGatilho = 1;
  protected readonly ehClint = computed(() => this.formato() === 'CLINT');

  protected readonly opcoesTipoGatilho = computed<readonly OpcaoSeletor<TipoDeGatilho>[]>(() =>
    (this.formatoClint()?.gatilhos ?? []).map((g) => ({
      valor: g.tipo,
      rotulo: ROTULO_GATILHO[g.tipo],
    })),
  );
  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis()
      .filter((funil) => funil.ativo)
      .map((funil) => ({ valor: funil.id, rotulo: funil.nome })),
  );
  protected readonly opcoesStatusGatilho: readonly OpcaoSeletor<StatusInicial>[] = [
    { valor: 'ABERTO', rotulo: ROTULO_STATUS_INICIAL.ABERTO },
    { valor: 'GANHO', rotulo: ROTULO_STATUS_INICIAL.GANHO },
    { valor: 'PERDIDO', rotulo: ROTULO_STATUS_INICIAL.PERDIDO },
  ];
  protected readonly gruposDeCampos = computed(() => {
    const grupos = new Map<string, CampoEditavel[]>();
    for (const campo of this.campos()) {
      grupos.set(campo.grupo, [...(grupos.get(campo.grupo) ?? []), campo]);
    }
    return [...grupos.entries()].map(([nome, itens]) => ({ nome, itens }));
  });
  protected readonly erroDosCampos = computed(() => {
    if (!this.tocouEventos() || !this.ehClint()) {
      return null;
    }
    const marcados = this.campos().filter((c) => c.marcado);
    if (!marcados.length) {
      return 'Escolha pelo menos um campo para enviar.';
    }
    const ruim = marcados.find((c) => !IDENTIFICADOR_VALIDO.test(c.identificador));
    if (ruim) {
      return `O identificador de “${ruim.rotulo}” deve ter de 1 a 100 caracteres: letras, números e _ - . [ ].`;
    }
    const vistos = new Set<string>();
    for (const c of marcados) {
      if (vistos.has(c.identificador)) {
        return `O identificador “${c.identificador}” aparece em mais de um campo.`;
      }
      vistos.add(c.identificador);
    }
    return null;
  });
  protected readonly erroDosGatilhos = computed(() => {
    if (!this.tocouEventos() || !this.ehClint()) {
      return null;
    }
    if (!this.gatilhos().length) {
      return 'Adicione pelo menos um gatilho.';
    }
    return this.gatilhos().some((g) => g.tipo === 'ENTRA_NA_ETAPA' && !g.etapaId)
      ? 'Escolha a etapa do gatilho “Negócio entra na etapa”.'
      : null;
  });

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(100)]],
    url: [
      '',
      [Validators.required, Validators.maxLength(2000), Validators.pattern(/^https?:\/\/\S+$/i)],
    ],
    cabecalhos: this.fb.array<FormGroup>([]),
  });

  protected readonly editando = computed(() => this.webhook() !== null);
  protected readonly titulo = computed(() => {
    if (this.segredoCriado()) {
      return 'Destino cadastrado';
    }
    return this.editando() ? 'Editar webhook de saída' : 'Novo webhook de saída';
  });

  /** Eventos que a pessoa escolhe (o de teste vai sempre ao destino testado). */
  protected readonly opcoesEvento = computed(() =>
    this.eventosDisponiveis()
      .filter((item) => item.evento !== 'webhook.teste')
      .map((item) => ({
        ...item,
        rotulo: ROTULO_EVENTO[item.evento] ?? item.evento,
        descricao: descricaoDoEvento(item.evento, item.descricao),
      })),
  );

  protected readonly todosMarcados = computed(
    () =>
      this.opcoesEvento().length > 0 &&
      this.opcoesEvento().every((item) => this.marcados().has(item.evento)),
  );
  protected readonly algunsMarcados = computed(
    () => this.marcados().size > 0 && !this.todosMarcados(),
  );
  protected readonly erroDosEventos = computed(() =>
    this.tocouEventos() && this.marcados().size === 0 ? 'Escolha pelo menos um evento.' : null,
  );

  protected readonly cabecalhosSalvos = computed(() => this.webhook()?.cabecalhos ?? []);

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.iniciar());
      } else {
        untracked(() => this.avisarCadastro());
      }
    });
  }

  protected get cabecalhos() {
    return this.form.controls.cabecalhos;
  }

  protected total(): number {
    return this.cabecalhosSalvos().length - this.removidos().size + this.cabecalhos.length;
  }

  protected marcar(evento: EventoDeWebhook, marcado: boolean): void {
    this.tocouEventos.set(true);
    this.marcados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) {
        novo.add(evento);
      } else {
        novo.delete(evento);
      }
      return novo;
    });
  }

  protected marcarTodos(marcado: boolean): void {
    this.tocouEventos.set(true);
    this.marcados.set(
      marcado ? new Set(this.opcoesEvento().map((item) => item.evento)) : new Set(),
    );
  }

  protected adicionarCabecalho(): void {
    this.cabecalhos.push(
      this.fb.group({
        nome: [
          '',
          [Validators.required, Validators.maxLength(100), Validators.pattern(NOME_DE_CABECALHO)],
        ],
        valor: ['', [Validators.required, Validators.maxLength(2000)]],
      }),
    );
  }

  protected removerCabecalho(indice: number): void {
    this.cabecalhos.removeAt(indice);
  }

  protected alternarRemocao(nome: string): void {
    this.removidos.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(nome)) {
        novo.delete(nome);
      } else {
        novo.add(nome);
      }
      return novo;
    });
  }

  protected async recarregarEventos(): Promise<void> {
    await this.carregarEventos(true);
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected async salvar(): Promise<void> {
    this.erroGeral.set(null);
    this.form.markAllAsTouched();
    this.tocouEventos.set(true);
    const semEventos = !this.ehClint() && this.marcados().size === 0;
    if (
      this.form.invalid ||
      semEventos ||
      (this.ehClint() && (this.erroDosCampos() || this.erroDosGatilhos()))
    ) {
      setTimeout(() =>
        this.elemento.nativeElement
          .querySelector<HTMLElement>(
            '.formulario [aria-invalid="true"], .formulario__eventos input',
          )
          ?.focus(),
      );
      return;
    }
    const dados = this.montarDados();
    const webhook = this.webhook();
    this.enviando.set(true);
    try {
      if (webhook) {
        const salvo = await this.api.atualizarSaida(webhook.id, dados);
        this.salvo.emit(salvo);
        this.avisos.sucesso(`Webhook “${salvo.nome}” atualizado.`);
        this.aberto.set(false);
      } else {
        const criado = await this.api.criarSaida(dados);
        this.segredoCriado.set(criado);
        this.criado.emit(criado);
        // O modal com o segredo (com o foco na frase) é o retorno imediato; o aviso curto
        // vem ao fechar, para não cobrir os botões.
        setTimeout(() =>
          this.elemento.nativeElement.querySelector<HTMLElement>('.formulario__resultado')?.focus(),
        );
      }
    } catch (falha) {
      this.tratarErro(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private montarDados(): DadosWebhookSaida {
    const valores = this.form.getRawValue();
    const novos = Object.fromEntries(
      valores.cabecalhos.map((grupo) => {
        const { nome, valor } = grupo as { nome: string; valor: string };
        return [nome.trim(), valor];
      }),
    ) as Record<string, string | null>;
    const removidos = Object.fromEntries([...this.removidos()].map((nome) => [nome, null]));
    const cabecalhos = { ...removidos, ...novos };
    const comCabecalhos = Object.keys(cabecalhos).length ? { cabecalhos } : {};
    if (this.ehClint()) {
      const gatilhos: GatilhoDeSaida[] = this.gatilhos().map((g) => ({
        tipo: g.tipo,
        ...(g.tipo === 'ENTRA_NA_ETAPA'
          ? { etapaId: g.etapaId }
          : g.funilId
            ? { funilId: g.funilId }
            : {}),
        ...(g.tipo === 'MUDA_DE_STATUS' && g.status ? { status: g.status } : {}),
      }));
      return {
        nome: valores.nome.trim(),
        url: valores.url.trim(),
        // O formato não muda depois de criado: só vai no cadastro.
        ...(this.editando() ? {} : { formato: 'CLINT' as const }),
        metodo: this.metodo(),
        gatilhos,
        campos: this.campos()
          .filter((c) => c.marcado)
          .map((c) => ({ origem: c.origem, identificador: c.identificador.trim() })),
        ...comCabecalhos,
      };
    }
    const eventos = this.opcoesEvento()
      .map((item) => item.evento)
      .filter((evento) => this.marcados().has(evento));
    return {
      nome: valores.nome.trim(),
      url: valores.url.trim(),
      eventos,
      ...comCabecalhos,
    };
  }

  // --- Formato Clint ---------------------------------------------------------------------------

  protected escolherFormato(formato: FormatoDeSaida | null): void {
    this.formato.set(formato ?? 'ENVELOPE_CRM');
    this.tocouEventos.set(false);
    if (this.ehClint()) {
      void this.carregarClint();
    }
  }

  protected adicionarGatilho(): void {
    this.gatilhos.update((lista) => [
      ...lista,
      {
        id: this.proximoGatilho++,
        tipo: 'NEGOCIO_CRIADO',
        funilId: null,
        etapaId: null,
        status: null,
      },
    ]);
  }

  protected removerGatilho(id: number): void {
    this.gatilhos.update((lista) => lista.filter((g) => g.id !== id));
  }

  protected editarGatilho(id: number, mudanca: Partial<GatilhoEditavel>): void {
    this.gatilhos.update((lista) => lista.map((g) => (g.id === id ? { ...g, ...mudanca } : g)));
  }

  protected opcoesEtapa(funilId: string | null): readonly OpcaoSeletor<string>[] {
    return (this.funis().find((f) => f.id === funilId)?.etapas ?? []).map((etapa) => ({
      valor: etapa.id,
      rotulo: etapa.nome,
    }));
  }

  protected exigeEtapa(tipo: TipoDeGatilho): boolean {
    return tipo === 'ENTRA_NA_ETAPA';
  }

  protected marcarCampo(origem: string, marcado: boolean): void {
    this.tocouEventos.set(true);
    this.campos.update((lista) => lista.map((c) => (c.origem === origem ? { ...c, marcado } : c)));
  }

  protected editarIdentificador(origem: string, identificador: string): void {
    this.campos.update((lista) =>
      lista.map((c) => (c.origem === origem ? { ...c, identificador } : c)),
    );
  }

  protected async recarregarClint(): Promise<void> {
    await this.carregarClint(true);
  }

  private async carregarClint(forcar = false): Promise<void> {
    if (this.formatoClint() && this.funis().length && !forcar) {
      this.prepararClint();
      return;
    }
    this.carregandoClint.set(true);
    this.erroClint.set(null);
    try {
      const [formato, funis] = await Promise.all([this.api.formatoClint(), this.api.funis()]);
      this.formatoClint.set(formato);
      this.funis.set(funis);
      this.prepararClint();
    } catch (falha) {
      this.erroClint.set(erroDaApi(falha));
    } finally {
      this.carregandoClint.set(false);
    }
  }

  /** Monta a lista de campos (marcando os do destino em edição) e o primeiro gatilho. */
  private prepararClint(): void {
    const formato = this.formatoClint();
    if (!formato) {
      return;
    }
    const salvo = this.webhook();
    const escolhidos = new Map((salvo?.campos ?? []).map((c) => [c.origem, c.identificador]));
    if (!this.campos().length) {
      const padrao = salvo
        ? null
        : new Set(['contato.nome', 'contato.email', 'contato.telefone', 'negocio.valor']);
      this.campos.set(
        formato.campos.map((campo) => ({
          origem: campo.origem,
          rotulo: campo.rotulo,
          grupo: campo.grupo,
          marcado: salvo ? escolhidos.has(campo.origem) : !!padrao?.has(campo.origem),
          identificador: escolhidos.get(campo.origem) ?? campo.identificadorPadrao,
        })),
      );
    }
    if (!this.gatilhos().length && !salvo) {
      this.adicionarGatilho();
    }
    // O gatilho de etapa guarda só a etapa: o funil sai dela, para o seletor de etapas.
    this.gatilhos.update((lista) =>
      lista.map((g) =>
        g.etapaId && !g.funilId
          ? {
              ...g,
              funilId:
                this.funis().find((f) => f.etapas.some((e) => e.id === g.etapaId))?.id ?? null,
            }
          : g,
      ),
    );
  }

  private tratarErro(erro: ErroApi): void {
    const nome = erro.mensagemDoCampo('nome');
    if (erro.ehConflito || nome) {
      this.form.controls.nome.setErrors({ api: nome ?? erro.resumo });
      return;
    }
    const url = erro.mensagemDoCampo('url');
    if (url || erro.regra === 'R9.1') {
      this.form.controls.url.setErrors({ api: url ?? erro.resumo });
      return;
    }
    if (erro.ehDadosInvalidos || erro.ehRegraViolada) {
      this.erroGeral.set(erro.resumo);
      return;
    }
    this.avisos.erro(erro);
  }

  private avisarCadastro(): void {
    const criado = this.segredoCriado();
    if (criado) {
      this.segredoCriado.set(null);
      this.avisos.sucesso(`Destino “${criado.webhook.nome}” cadastrado.`);
    }
  }

  private iniciar(): void {
    const webhook = this.webhook();
    this.segredoCriado.set(null);
    this.erroGeral.set(null);
    this.tocouEventos.set(false);
    this.removidos.set(new Set());
    this.cabecalhos.clear();
    this.form.reset({ nome: webhook?.nome ?? '', url: webhook?.url ?? '' });
    this.marcados.set(
      new Set(webhook?.eventos.filter((evento) => evento !== 'webhook.teste') ?? []),
    );
    this.formato.set(webhook?.formato ?? 'ENVELOPE_CRM');
    this.metodo.set(webhook?.metodo ?? 'POST');
    this.campos.set([]);
    this.gatilhos.set(
      (webhook?.gatilhos ?? []).map((g) => ({
        id: this.proximoGatilho++,
        tipo: g.tipo,
        funilId: g.funilId ?? null,
        etapaId: g.etapaId ?? null,
        status: g.status ?? null,
      })),
    );
    if (this.ehClint()) {
      void this.carregarClint();
    } else {
      void this.carregarEventos();
    }
  }

  private async carregarEventos(forcar = false): Promise<void> {
    if (this.eventosDisponiveis().length && !forcar) {
      return;
    }
    this.carregandoEventos.set(true);
    this.erroEventos.set(null);
    try {
      this.eventosDisponiveis.set(await this.api.eventos());
    } catch (falha) {
      this.erroEventos.set(erroDaApi(falha));
    } finally {
      this.carregandoEventos.set(false);
    }
  }
}
