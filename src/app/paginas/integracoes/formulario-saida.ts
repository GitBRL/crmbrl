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
import { Modal } from '../../ui/modal/modal';
import { ValorUnico } from './comum/valor-unico';
import { IntegracoesApi } from './integracoes.api';
import {
  type DadosWebhookSaida,
  type EventoDeWebhook,
  type EventoDisponivel,
  descricaoDoEvento,
  ROTULO_EVENTO,
  type WebhookSaida,
  type WebhookSaidaComSegredo,
} from './tipos';

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
    if (this.form.invalid || this.marcados().size === 0) {
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
    const eventos = this.opcoesEvento()
      .map((item) => item.evento)
      .filter((evento) => this.marcados().has(evento));
    return {
      nome: valores.nome.trim(),
      url: valores.url.trim(),
      eventos,
      ...(Object.keys(cabecalhos).length ? { cabecalhos } : {}),
    };
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
    void this.carregarEventos();
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
