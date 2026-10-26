import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideInfo,
  LucidePause,
  LucidePlay,
  LucideRefreshCw,
  LucideTrash,
  LucideUnlink,
  LucideUnplug,
} from '@lucide/angular';

import { erroDaApi } from '../../../../nucleo/api/erro-api';
import { AvisosService } from '../../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { formatarData } from '../../../../nucleo/formatos';
import { aoReceber, aoReconectar } from '../../../../nucleo/tempo-real/auxiliares';
import { TempoRealService } from '../../../../nucleo/tempo-real/tempo-real.service';
import { AreaTexto } from '../../../../ui/area-texto/area-texto';
import { Botao } from '../../../../ui/botao/botao';
import { CaixaSelecao } from '../../../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Cartao } from '../../../../ui/cartao/cartao';
import { Esqueleto } from '../../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../../ui/estado-vazio/estado-vazio';
import { Indicador } from '../../../../ui/indicador/indicador';
import { type ItemMenuAcoes, MenuAcoes } from '../../../../ui/menu-acoes/menu-acoes';
import { Modal } from '../../../../ui/modal/modal';
import { Seletor } from '../../../../ui/seletor/seletor';
import { Carregamento } from '../../carregamento';
import { formatarTelefone } from '../../textos';
import {
  desdeQuando,
  EXPLICACAO_STATUS_WHATSAPP,
  explicacaoDoAquecimento,
  formatarInteiro,
  resumoDaPausa,
  resumoDoAquecimento,
  resumoDoRitmo,
  SITUACAO_WHATSAPP,
} from '../apresentacao';
import { CanaisApi } from '../canais.api';
import {
  type DadosNumeroWhatsapp,
  type EnviosNoDia,
  type EstadoDoNumero,
  FAIXAS_WHATSAPP,
  type NumeroWhatsapp,
  PADROES_WHATSAPP,
  type StatusWhatsapp,
  TAMANHO_MAXIMO_MOTIVO_PAUSA,
  TAMANHO_MAXIMO_NOME_NUMERO,
} from '../canais.modelos';
import { CabecalhoCanal } from '../comum/cabecalho-canal';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';
import { ConexaoWhatsapp } from './conexao-whatsapp';
import { GraficoEnvios } from './grafico-envios';

/** Sem o tempo real, o QR e o status são buscados de novo a cada 5 s enquanto se conecta. */
export const INTERVALO_STATUS_SEM_TEMPO_REAL_MS = 5_000;

type Acao = 'conectar' | 'dados' | 'limites' | 'pausar' | 'retomar';

/** O status ao vivo (evento `whatsapp.conexao` ou `GET …/status`) por cima do gravado. */
type AoVivo = Partial<Omit<EstadoDoNumero, 'numeroId' | 'canalId'>> & {
  readonly status: StatusWhatsapp;
};

/** Espera máxima ≥ mínima (a API recusa o contrário). */
function intervaloValido(grupo: AbstractControl): ValidationErrors | null {
  const minimo = grupo.get('intervaloMinimoSegundos')?.value as number | null;
  const maximo = grupo.get('intervaloMaximoSegundos');
  if (!maximo) {
    return null;
  }
  const atual = maximo.errors ?? {};
  if (minimo !== null && maximo.value !== null && maximo.value < minimo) {
    if (!atual['intervalo']) {
      maximo.setErrors({ ...atual, intervalo: true });
    }
  } else if (atual['intervalo']) {
    const { intervalo: _remover, ...resto } = atual;
    maximo.setErrors(Object.keys(resto).length ? resto : null);
  }
  return null;
}

function inteiro(minimo: number, maximo: number, valor: number) {
  return new FormControl<number | null>(valor, {
    validators: [Validators.required, Validators.min(minimo), Validators.max(maximo)],
  });
}

/**
 * Um número de WhatsApp (`/configuracoes/canais/whatsapp/:id`, Admin) — §2.3/§7 do contrato e
 * R13: a conexão com o QR ao vivo (evento `whatsapp.conexao`; sem o tempo real, a tela busca o
 * status a cada 5 s), os envios de hoje, o aquecimento, os envios dos últimos 14 dias, a fila e
 * os limites e proteções anti-banimento. Ações: pausar/retomar, desconectar, desvincular,
 * excluir. Com `?conectar=1` (logo depois de criar), a conexão começa sozinha.
 */
@Component({
  selector: 'app-detalhe-whatsapp',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideInfo,
    LucidePause,
    AreaTexto,
    Botao,
    CabecalhoCanal,
    CaixaSelecao,
    CampoTexto,
    Cartao,
    ConexaoWhatsapp,
    Esqueleto,
    EstadoVazio,
    GraficoEnvios,
    Indicador,
    MenuAcoes,
    Modal,
    Seletor,
  ],
  templateUrl: './detalhe-whatsapp.html',
  styleUrl: './detalhe-whatsapp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheWhatsapp {
  /** `:id` da rota. */
  readonly id = input.required<string>();
  /** `?conectar=1`: começa a conexão ao abrir (número recém-criado). */
  readonly conectar_ = input<string | undefined>(undefined, { alias: 'conectar' });

  private readonly api = inject(CanaisApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);
  protected readonly tempoReal = inject(TempoRealService);

  protected readonly icones = {
    tentar: LucideRefreshCw,
    retomar: LucidePlay,
    pausar: LucidePause,
  };
  protected readonly faixas = FAIXAS_WHATSAPP;
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly tamanhoNome = TAMANHO_MAXIMO_NOME_NUMERO;
  protected readonly tamanhoMotivo = TAMANHO_MAXIMO_MOTIVO_PAUSA;

  protected readonly numero = new Carregamento<NumeroWhatsapp>();
  protected readonly envios = new Carregamento<readonly EnviosNoDia[]>();
  protected readonly filas = new FilasDisponiveis(this.api);
  protected readonly aoVivo = signal<AoVivo | null>(null);
  protected readonly erroGateway = signal<string | null>(null);
  protected readonly emAndamento = signal<Acao | null>(null);
  protected readonly pausando = signal(false);
  protected readonly motivoPausa = signal('');

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected readonly dadosForm = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(TAMANHO_MAXIMO_NOME_NUMERO)],
    }),
    filaPadraoId: new FormControl<string | null>(null),
    ativo: new FormControl(true, { nonNullable: true }),
  });

  protected readonly limitesForm = new FormGroup(
    {
      limiteDiario: inteiro(
        FAIXAS_WHATSAPP.limiteDiario.minimo,
        FAIXAS_WHATSAPP.limiteDiario.maximo,
        PADROES_WHATSAPP.limiteDiario,
      ),
      aquecimentoDias: inteiro(
        FAIXAS_WHATSAPP.aquecimentoDias.minimo,
        FAIXAS_WHATSAPP.aquecimentoDias.maximo,
        PADROES_WHATSAPP.aquecimentoDias,
      ),
      intervaloMinimoSegundos: inteiro(
        FAIXAS_WHATSAPP.intervaloSegundos.minimo,
        FAIXAS_WHATSAPP.intervaloSegundos.maximo,
        PADROES_WHATSAPP.intervaloMinimoSegundos,
      ),
      intervaloMaximoSegundos: inteiro(
        FAIXAS_WHATSAPP.intervaloSegundos.minimo,
        FAIXAS_WHATSAPP.intervaloSegundos.maximo,
        PADROES_WHATSAPP.intervaloMaximoSegundos,
      ),
      protecoes: new FormGroup({
        digitando: new FormControl(true, { nonNullable: true }),
        digitandoMaximoSegundos: inteiro(
          FAIXAS_WHATSAPP.digitandoMaximoSegundos.minimo,
          FAIXAS_WHATSAPP.digitandoMaximoSegundos.maximo,
          4,
        ),
        verificarNumero: new FormControl(true, { nonNullable: true }),
        limitarRespostas: new FormControl(false, { nonNullable: true }),
        pausarAposFalhasSeguidas: inteiro(
          FAIXAS_WHATSAPP.pausarAposFalhasSeguidas.minimo,
          FAIXAS_WHATSAPP.pausarAposFalhasSeguidas.maximo,
          5,
        ),
      }),
    },
    { validators: intervaloValido },
  );

  // Estado da conexão -----------------------------------------------------------------------

  protected readonly status = computed<StatusWhatsapp>(
    () => this.aoVivo()?.status ?? this.numero.dados()?.status ?? 'DESCONECTADO',
  );
  protected readonly qr = computed(() => {
    const status = this.status();
    return status === 'AGUARDANDO_QR' || status === 'CONECTANDO'
      ? (this.aoVivo()?.qr ?? null)
      : null;
  });
  protected readonly qrExpiraEm = computed(() =>
    this.qr() ? (this.aoVivo()?.qrExpiraEm ?? null) : null,
  );
  protected readonly telefone = computed(
    () => this.aoVivo()?.telefone ?? this.numero.dados()?.telefone ?? null,
  );
  protected readonly motivo = computed(() =>
    this.aoVivo() ? (this.aoVivo()?.motivo ?? null) : (this.numero.dados()?.motivo ?? null),
  );
  protected readonly situacao = computed(() => SITUACAO_WHATSAPP[this.status()]);
  protected readonly explicacaoStatus = computed(() => EXPLICACAO_STATUS_WHATSAPP[this.status()]);
  protected readonly desde = computed(() => {
    const numero = this.numero.dados();
    return numero ? desdeQuando({ ...numero, status: this.status() }) : null;
  });

  // Textos -----------------------------------------------------------------------------------

  protected readonly pausa = computed(() => {
    const numero = this.numero.dados();
    return numero ? resumoDaPausa(numero) : null;
  });
  protected readonly ritmo = computed(() => {
    const numero = this.numero.dados();
    return numero ? resumoDoRitmo(numero) : '';
  });
  protected readonly aquecimento = computed(() => {
    const numero = this.numero.dados();
    return numero ? resumoDoAquecimento(numero) : '';
  });
  protected readonly explicacaoAquecimento = computed(() => {
    const numero = this.numero.dados();
    return numero ? explicacaoDoAquecimento(numero) : '';
  });
  protected readonly usoDeHoje = computed(() => {
    const hoje = this.numero.dados()?.hoje;
    if (!hoje || hoje.limite <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((hoje.enviados / hoje.limite) * 100));
  });
  protected readonly diasDoAquecimento = computed(() => {
    const aquecimento = this.numero.dados()?.aquecimento;
    if (!aquecimento || aquecimento.dias <= 0) {
      return [];
    }
    const atual = aquecimento.inicioEm
      ? aquecimento.ativo
        ? (aquecimento.dia ?? 0)
        : aquecimento.dias + 1
      : 0;
    return Array.from({ length: aquecimento.dias }, (_, indice) => ({
      numero: indice + 1,
      feito: indice + 1 < atual || (indice + 1 === atual && !aquecimento.ativo),
      hoje: aquecimento.ativo && indice + 1 === atual,
    }));
  });

  protected readonly acoes = computed<readonly ItemMenuAcoes[]>(() => {
    const numero = this.numero.dados();
    const status = this.status();
    const ligado = status !== 'DESCONECTADO';
    return [
      numero?.pausa
        ? { id: 'retomar', rotulo: 'Retomar envios', icone: LucidePlay }
        : { id: 'pausar', rotulo: 'Pausar envios', icone: LucidePause },
      {
        id: 'desconectar',
        rotulo: 'Desconectar',
        icone: LucideUnplug,
        desabilitado: !ligado,
        motivo: ligado ? undefined : 'O número já está desconectado.',
      },
      {
        id: 'desvincular',
        rotulo: 'Desvincular o aparelho',
        icone: LucideUnlink,
        perigo: true,
        separarAntes: true,
      },
      { id: 'excluir', rotulo: 'Excluir número', icone: LucideTrash, perigo: true },
    ];
  });

  constructor() {
    // Trocar de número (ou abrir a tela) carrega tudo de novo.
    effect(() => {
      const id = this.id();
      untracked(() => void this.abrir(id));
    });

    aoReceber('whatsapp.conexao', (evento) => {
      if (evento.numeroId !== this.id()) {
        return;
      }
      this.aplicarEstado(evento);
    });
    aoReconectar(() => void this.atualizarTudo());

    // Sem o tempo real, o QR novo não chegaria: busca o status de tempos em tempos.
    let reserva: ReturnType<typeof setInterval> | null = null;
    const pararReserva = () => {
      if (reserva) {
        clearInterval(reserva);
        reserva = null;
      }
    };
    effect(() => {
      const esperando = this.status() === 'AGUARDANDO_QR' || this.status() === 'CONECTANDO';
      const precisa = esperando && !this.tempoReal.conectado() && this.numero.dados() !== null;
      if (precisa && !reserva) {
        reserva = setInterval(() => void this.lerStatus(), INTERVALO_STATUS_SEM_TEMPO_REAL_MS);
      } else if (!precisa) {
        pararReserva();
      }
    });
    inject(DestroyRef).onDestroy(pararReserva);
  }

  protected formatar(valor: number): string {
    return formatarInteiro(valor);
  }

  protected dataCurta(valor: string): string {
    return formatarData(valor);
  }

  protected recarregar(): void {
    void this.abrir(this.id());
  }

  protected carregarEnvios(): void {
    const id = this.id();
    void this.envios.executar(() => this.api.enviosDoNumero(id, 14));
  }

  private async abrir(id: string): Promise<void> {
    this.aoVivo.set(null);
    this.erroGateway.set(null);
    this.envios.limpar();
    this.numero.limpar();
    void this.filas.carregar();
    const ok = await this.numero.executar(() => this.api.detalharNumero(id));
    if (!ok) {
      return;
    }
    this.preencherFormularios(this.numero.dados()!);
    this.carregarEnvios();
    await this.lerStatus();
    if (this.conectar_() === '1') {
      // Some da URL: recarregar a página não pede outro QR.
      void this.router.navigate([], {
        queryParams: { conectar: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      if (this.status() !== 'CONECTADO' && this.status() !== 'AGUARDANDO_QR') {
        await this.conectar();
      }
    }
  }

  private async atualizarTudo(): Promise<void> {
    const id = this.id();
    if (await this.numero.executar(() => this.api.detalharNumero(id))) {
      await this.lerStatus();
    }
  }

  /** O estado ao vivo no gateway (com o QR, se estiver esperando a leitura). */
  private async lerStatus(): Promise<void> {
    const id = this.id();
    try {
      const estado = await this.api.statusDoNumero(id);
      if (id === this.id()) {
        this.erroGateway.set(null);
        this.aplicarEstado(estado);
      }
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.ehFalhaDoServidor) {
        this.erroGateway.set(
          `O serviço do WhatsApp não respondeu agora (${erro.resumo.replace(/\.$/, '')}). O status pode estar desatualizado.`,
        );
      }
    }
  }

  private aplicarEstado(estado: Partial<EstadoDoNumero> & { status: StatusWhatsapp }): void {
    const antes = this.status();
    const esperando = estado.status === 'AGUARDANDO_QR' || estado.status === 'CONECTANDO';
    this.aoVivo.update((atual) => ({
      status: estado.status,
      telefone: estado.telefone ?? atual?.telefone ?? null,
      motivo: estado.motivo ?? null,
      // O QR só vale enquanto espera a leitura; um evento sem QR mantém o atual.
      qr: esperando ? (estado.qr ?? atual?.qr ?? null) : null,
      qrExpiraEm: esperando ? (estado.qrExpiraEm ?? atual?.qrExpiraEm ?? null) : null,
    }));
    if (estado.status === 'CONECTADO' && antes !== 'CONECTADO' && this.numero.dados()) {
      const telefone = formatarTelefone(estado.telefone ?? this.telefone());
      this.avisos.sucesso(telefone ? `WhatsApp conectado: ${telefone}.` : 'WhatsApp conectado.', {
        chave: `whatsapp-${this.id()}`,
      });
      // O telefone, o início do aquecimento e o limite de hoje mudam com a conexão.
      const id = this.id();
      void this.numero.executar(() => this.api.detalharNumero(id));
    }
  }

  protected async conectar(): Promise<void> {
    if (this.emAndamento() === 'conectar') {
      return;
    }
    this.emAndamento.set('conectar');
    try {
      const estado = await this.api.conectarNumero(this.id());
      this.erroGateway.set(null);
      this.aplicarEstado(estado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.ehFalhaDoServidor) {
        this.erroGateway.set(
          `Não foi possível falar com o serviço do WhatsApp: ${erro.resumo} Tente de novo em instantes.`,
        );
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.emAndamento.set(null);
    }
  }

  protected agir(id: string): void {
    const numero = this.numero.dados();
    if (!numero) {
      return;
    }
    switch (id) {
      case 'pausar':
        this.motivoPausa.set('');
        this.pausando.set(true);
        return;
      case 'retomar':
        void this.retomar();
        return;
      case 'desconectar':
        void this.confirmacao.confirmar({
          titulo: `Desconectar “${numero.nome}”?`,
          mensagem:
            'Até você conectar de novo, as mensagens deste número não entram no Atendimento e as respostas não saem. O aparelho continua vinculado: para voltar, basta tocar em “Conectar de novo”, sem QR.',
          confirmar: 'Desconectar',
          executar: async () => this.aplicarEstado(await this.api.desconectarNumero(numero.id)),
        });
        return;
      case 'desvincular':
        void this.confirmacao.confirmar({
          titulo: `Desvincular o aparelho de “${numero.nome}”?`,
          mensagem:
            'O CRM sai da lista de aparelhos conectados do celular e as chaves deste número são apagadas. Para voltar, será preciso ler um QR novo com o celular.',
          confirmar: 'Desvincular',
          perigo: true,
          executar: async () =>
            this.aplicarEstado(await this.api.desconectarNumero(numero.id, true)),
        });
        return;
      case 'excluir':
        void this.excluir(numero);
        return;
    }
  }

  private async excluir(numero: NumeroWhatsapp): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: `Excluir o número “${numero.nome}”?`,
      mensagem:
        'O número é desvinculado do WhatsApp e sai dos canais do Atendimento. As conversas que já aconteceram continuam no histórico.',
      detalhes: numero.telefone ? [`Telefone: ${formatarTelefone(numero.telefone)}`] : undefined,
      confirmar: 'Excluir número',
      perigo: true,
      exigirTexto: 'excluir',
      rotuloTexto: 'Digite “excluir” para confirmar',
      executar: () => this.api.excluirNumero(numero.id),
    });
    if (ok) {
      this.avisos.sucesso(`Número “${numero.nome}” excluído.`);
      void this.router.navigate(['/configuracoes', 'canais']);
    }
  }

  protected async pausar(): Promise<void> {
    if (this.emAndamento()) {
      return;
    }
    this.emAndamento.set('pausar');
    try {
      const numero = await this.api.pausarNumero(this.id(), this.motivoPausa().trim() || null);
      this.numero.definir(numero);
      this.pausando.set(false);
      this.avisos.sucesso('Envios pausados.', {
        acao: { rotulo: 'Desfazer', executar: () => void this.retomar() },
      });
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.emAndamento.set(null);
    }
  }

  protected async retomar(): Promise<void> {
    if (this.emAndamento()) {
      return;
    }
    this.emAndamento.set('retomar');
    try {
      this.numero.definir(await this.api.retomarNumero(this.id()));
      this.avisos.sucesso('Envios retomados: as mensagens que esperavam começam a sair.');
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.emAndamento.set(null);
    }
  }

  // Formulários -------------------------------------------------------------------------------

  private preencherFormularios(numero: NumeroWhatsapp): void {
    this.filas.definirAtual(numero.filaPadrao);
    this.dadosForm.reset({
      nome: numero.nome,
      filaPadraoId: numero.filaPadrao?.id ?? null,
      ativo: numero.ativo,
    });
    this.limitesForm.reset({
      limiteDiario: numero.limiteDiario,
      aquecimentoDias: numero.aquecimento.dias,
      intervaloMinimoSegundos: numero.intervaloMinimoSegundos,
      intervaloMaximoSegundos: numero.intervaloMaximoSegundos,
      protecoes: { ...numero.protecoes },
    });
  }

  protected restaurarPadroes(): void {
    this.limitesForm.patchValue({
      ...PADROES_WHATSAPP,
      protecoes: {
        digitando: true,
        digitandoMaximoSegundos: 4,
        verificarNumero: true,
        limitarRespostas: false,
        pausarAposFalhasSeguidas: 5,
      },
    });
    this.limitesForm.markAsDirty();
    this.avisos.info('Padrões preenchidos. Toque em “Salvar limites” para valerem.');
  }

  protected async salvarDados(): Promise<void> {
    const numero = this.numero.dados();
    if (!numero || this.emAndamento()) {
      return;
    }
    this.dadosForm.markAllAsTouched();
    if (this.dadosForm.invalid) {
      this.campoNome()?.focar();
      return;
    }
    const valor = this.dadosForm.getRawValue();
    const dados: DadosNumeroWhatsapp = {
      ...(valor.nome.trim() !== numero.nome ? { nome: valor.nome.trim() } : {}),
      ...(valor.filaPadraoId !== (numero.filaPadrao?.id ?? null)
        ? { filaPadraoId: valor.filaPadraoId }
        : {}),
      ...(valor.ativo !== numero.ativo ? { ativo: valor.ativo } : {}),
    };
    await this.salvar('dados', dados, () => this.dadosForm.controls.nome);
  }

  protected async salvarLimites(): Promise<void> {
    const numero = this.numero.dados();
    if (!numero || this.emAndamento()) {
      return;
    }
    this.limitesForm.markAllAsTouched();
    if (this.limitesForm.invalid) {
      this.avisos.atencao('Confira os campos marcados antes de salvar.');
      return;
    }
    const valor = this.limitesForm.getRawValue();
    const protecoes = valor.protecoes;
    const dados: DadosNumeroWhatsapp = {
      limiteDiario: valor.limiteDiario!,
      aquecimentoDias: valor.aquecimentoDias!,
      intervaloMinimoSegundos: valor.intervaloMinimoSegundos!,
      intervaloMaximoSegundos: valor.intervaloMaximoSegundos!,
      protecoes: {
        digitando: protecoes.digitando,
        digitandoMaximoSegundos: protecoes.digitandoMaximoSegundos!,
        verificarNumero: protecoes.verificarNumero,
        limitarRespostas: protecoes.limitarRespostas,
        pausarAposFalhasSeguidas: protecoes.pausarAposFalhasSeguidas!,
      },
    };
    await this.salvar('limites', dados);
  }

  private async salvar(
    acao: Acao,
    dados: DadosNumeroWhatsapp,
    campoDoNome?: () => FormControl<string>,
  ): Promise<void> {
    if (Object.keys(dados).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      return;
    }
    this.emAndamento.set(acao);
    try {
      const atualizado = await this.api.atualizarNumero(this.id(), dados);
      this.numero.definir(atualizado);
      this.preencherFormularios(atualizado);
      this.avisos.sucesso(
        acao === 'limites'
          ? 'Limites e proteções salvos. Valem a partir do próximo envio.'
          : 'Alterações do número salvas.',
      );
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doNome =
        campoDoNome && (erro.mensagemDoCampo('nome') ?? (erro.ehConflito ? erro.mensagem : null));
      if (doNome && campoDoNome) {
        campoDoNome().setErrors({ api: doNome });
        this.campoNome()?.focar();
        return;
      }
      if (
        erro.ehDadosInvalidos &&
        this.marcarCampos(
          erro.campos.map((c) => c.campo),
          erro,
        )
      ) {
        return;
      }
      this.avisos.erro(erro);
    } finally {
      this.emAndamento.set(null);
    }
  }

  /** Erros de campo da API nos campos do formulário de limites. */
  private marcarCampos(campos: readonly string[], erro: ReturnType<typeof erroDaApi>): boolean {
    let marcou = false;
    for (const campo of campos) {
      const controle = this.limitesForm.get(campo) ?? this.dadosForm.get(campo);
      const mensagem = erro.mensagemDoCampo(campo);
      if (controle && mensagem) {
        controle.setErrors({ api: mensagem });
        controle.markAsTouched();
        marcou = true;
      }
    }
    return marcou;
  }
}
