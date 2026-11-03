import { type EnvioDeGravacao, PRIMEIRA_SEQUENCIA } from './gravacao.api';

/**
 * Gravador da ligação (Onda E, E3). Não conhece Angular: o `LigacaoService` cria um por ligação
 * que grava.
 *
 * - **Mistura estéreo** com Web Audio: o microfone do atendente no canal esquerdo, o áudio do
 *   cliente no direito (`ChannelMerger`), e um `MediaRecorder` webm/opus sobre o resultado.
 * - **Fatias de ~5 s**: cada fatia é uma parte numerada, enviada em ordem (uma por vez) e
 *   repetida com espera crescente se falhar. Um webm do mesmo `MediaRecorder` concatena direto.
 * - **Fim:** `parar()` fecha o gravador, espera as partes subirem e manda o "finalizar" com o
 *   total. Se a aba fechar, `sairDaPagina()` manda o "finalizar" por `sendBeacon` com o que já subiu.
 */

export const FATIA_MS = 5_000;
export const TIPO_DA_GRAVACAO = 'audio/webm;codecs=opus';
export const BITS_POR_SEGUNDO = 64_000;
/** Esperas entre as tentativas de enviar uma parte (a primeira tentativa é imediata). */
export const ESPERAS_DE_REENVIO_MS: readonly number[] = [1_000, 3_000, 8_000, 15_000];

export interface AmbienteDoGravador {
  /** O navegador sabe gravar em webm/opus com Web Audio? */
  suportado(): boolean;
  criarContexto(): AudioContext;
  criarGravador(stream: MediaStream): MediaRecorder;
  esperar(ms: number): Promise<void>;
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDoGravador = {
  suportado: () =>
    typeof MediaRecorder !== 'undefined' &&
    typeof AudioContext !== 'undefined' &&
    MediaRecorder.isTypeSupported(TIPO_DA_GRAVACAO),
  criarContexto: () => new AudioContext(),
  criarGravador: (stream) =>
    new MediaRecorder(stream, { mimeType: TIPO_DA_GRAVACAO, audioBitsPerSecond: BITS_POR_SEGUNDO }),
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};

export type SituacaoDoGravador = 'parado' | 'gravando' | 'finalizando' | 'concluido' | 'falhou';

export interface OpcoesDoGravador {
  readonly ligacaoId: string;
  readonly envio: EnvioDeGravacao;
  readonly ambiente?: AmbienteDoGravador;
  readonly fatiaMs?: number;
  readonly esperas?: readonly number[];
  /** Avisado a cada mudança de situação e quando uma parte não sobe (`envioComFalha`). */
  readonly aoMudar?: (situacao: SituacaoDoGravador, envioComFalha: boolean) => void;
}

interface Parte {
  readonly sequencia: number;
  readonly blob: Blob;
  enviada: boolean;
}

export class Gravador {
  private readonly envio: EnvioDeGravacao;
  private readonly ambiente: AmbienteDoGravador;
  private readonly esperas: readonly number[];
  private readonly partes: Parte[] = [];
  private cadeia: Promise<void> = Promise.resolve();
  private contexto: AudioContext | null = null;
  private destino: MediaStreamAudioDestinationNode | null = null;
  private juncao: ChannelMergerNode | null = null;
  private fonteLocal: MediaStreamAudioSourceNode | null = null;
  private fonteRemota: MediaStreamAudioSourceNode | null = null;
  private gravador: MediaRecorder | null = null;
  private _situacao: SituacaoDoGravador = 'parado';
  private _envioComFalha = false;
  private encerrando: Promise<void> | null = null;
  private finalizadoNaSaida = false;

  constructor(private readonly opcoes: OpcoesDoGravador) {
    this.envio = opcoes.envio;
    this.ambiente = opcoes.ambiente ?? AMBIENTE_DO_NAVEGADOR;
    this.esperas = opcoes.esperas ?? ESPERAS_DE_REENVIO_MS;
  }

  get situacao(): SituacaoDoGravador {
    return this._situacao;
  }

  get envioComFalha(): boolean {
    return this._envioComFalha;
  }

  /** Quantas partes subiram em sequência desde a primeira (o que a API consegue juntar). */
  get partesConfirmadas(): number {
    let total = 0;
    for (const parte of this.partes) {
      if (!parte.enviada) {
        break;
      }
      total++;
    }
    return total;
  }

  get totalDePartes(): number {
    return this.partes.length;
  }

  /** Liga a mistura e começa a gravar. Devolve `false` se o navegador não sabe gravar. */
  iniciar(local: MediaStream, remoto: MediaStream): boolean {
    if (this._situacao !== 'parado' || !this.ambiente.suportado()) {
      return false;
    }
    try {
      const contexto = this.ambiente.criarContexto();
      const juncao = contexto.createChannelMerger(2);
      const destino = contexto.createMediaStreamDestination();
      destino.channelCount = 2;
      destino.channelCountMode = 'explicit';
      destino.channelInterpretation = 'speakers';
      juncao.connect(destino);
      this.contexto = contexto;
      this.juncao = juncao;
      this.destino = destino;
      this.fonteLocal = this.ligarFonte(local, 0);
      this.fonteRemota = this.ligarFonte(remoto, 1);
      void contexto.resume?.();

      const gravador = this.ambiente.criarGravador(destino.stream);
      gravador.ondataavailable = (evento: BlobEvent) => this.aoReceberParte(evento.data);
      gravador.onerror = () => this.mudar('falhou');
      gravador.start(this.opcoes.fatiaMs ?? FATIA_MS);
      this.gravador = gravador;
      this.mudar('gravando');
      return true;
    } catch {
      this.desmontar();
      this.mudar('falhou');
      return false;
    }
  }

  /** O microfone mudou no meio da ligação: religa o canal esquerdo. */
  trocarLocal(local: MediaStream): void {
    if (!this.contexto || !this.juncao || this._situacao !== 'gravando') {
      return;
    }
    this.fonteLocal?.disconnect();
    this.fonteLocal = this.ligarFonte(local, 0);
  }

  /** Fim da ligação: fecha a gravação, espera as partes subirem e finaliza. */
  parar(): Promise<void> {
    if (!this.encerrando) {
      this.encerrando = this.encerrar();
    }
    return this.encerrando;
  }

  /**
   * A aba está fechando: manda o "finalizar" com o que já subiu. Não dá para esperar nada aqui,
   * então a parte que ainda estava sendo gravada ou enviada se perde.
   */
  sairDaPagina(): void {
    if (this._situacao !== 'gravando' || this.finalizadoNaSaida) {
      return;
    }
    this.finalizadoNaSaida = true;
    const total = this.partesConfirmadas;
    if (total > 0) {
      this.envio.finalizarNaSaida(this.opcoes.ligacaoId, total);
    }
    try {
      if (this.gravador && this.gravador.state !== 'inactive') {
        this.gravador.stop();
      }
    } catch {
      // a página está fechando
    }
  }

  // ----- Internos -----------------------------------------------------------------------------

  private ligarFonte(stream: MediaStream, canal: 0 | 1): MediaStreamAudioSourceNode | null {
    if (!this.contexto || !this.juncao || stream.getAudioTracks().length === 0) {
      return null;
    }
    const fonte = this.contexto.createMediaStreamSource(stream);
    // Cada entrada do merger é mono: o áudio (mono ou estéreo) vira um canal só.
    fonte.connect(this.juncao, 0, canal);
    return fonte;
  }

  private aoReceberParte(blob: Blob): void {
    if (!blob || blob.size === 0 || this.finalizadoNaSaida) {
      return;
    }
    const parte: Parte = {
      sequencia: PRIMEIRA_SEQUENCIA + this.partes.length,
      blob,
      enviada: false,
    };
    this.partes.push(parte);
    this.cadeia = this.cadeia.then(() => this.enviarComTentativas(parte));
  }

  private async enviarComTentativas(parte: Parte): Promise<void> {
    for (let tentativa = 0; tentativa <= this.esperas.length; tentativa++) {
      if (tentativa > 0) {
        await this.ambiente.esperar(this.esperas[tentativa - 1]!);
      }
      try {
        await this.envio.enviarParte(this.opcoes.ligacaoId, parte.sequencia, parte.blob);
        parte.enviada = true;
        this.definirFalha(this.partes.some((item) => !item.enviada && item !== parte));
        return;
      } catch {
        this.definirFalha(true);
      }
    }
  }

  private definirFalha(falha: boolean): void {
    if (falha !== this._envioComFalha) {
      this._envioComFalha = falha;
      this.opcoes.aoMudar?.(this._situacao, falha);
    }
  }

  private async encerrar(): Promise<void> {
    if (this._situacao === 'parado' || this._situacao === 'concluido') {
      return;
    }
    this.mudar('finalizando');
    await this.pararGravador();
    this.desmontar();
    await this.cadeia;
    // Última chance para as partes que não subiram.
    for (const parte of this.partes) {
      if (!parte.enviada) {
        await this.enviarComTentativas(parte);
      }
    }
    if (this.finalizadoNaSaida) {
      this.mudar('concluido');
      return;
    }
    const total = this.partesConfirmadas;
    if (total === 0) {
      this.mudar(this.partes.length > 0 ? 'falhou' : 'concluido');
      return;
    }
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        await this.envio.finalizar(this.opcoes.ligacaoId, total);
        this.mudar(total === this.partes.length ? 'concluido' : 'falhou');
        return;
      } catch {
        await this.ambiente.esperar(1_000 * (tentativa + 1));
      }
    }
    this.mudar('falhou');
  }

  private pararGravador(): Promise<void> {
    const gravador = this.gravador;
    if (!gravador || gravador.state === 'inactive') {
      return Promise.resolve();
    }
    return new Promise<void>((resolver) => {
      gravador.onstop = () => resolver();
      try {
        gravador.stop();
      } catch {
        resolver();
      }
    });
  }

  private desmontar(): void {
    this.fonteLocal?.disconnect();
    this.fonteRemota?.disconnect();
    this.juncao?.disconnect();
    this.destino?.stream.getTracks().forEach((faixa) => faixa.stop());
    void this.contexto?.close?.().catch?.(() => undefined);
    this.fonteLocal = this.fonteRemota = this.juncao = this.destino = this.contexto = null;
  }

  private mudar(situacao: SituacaoDoGravador): void {
    this._situacao = situacao;
    this.opcoes.aoMudar?.(situacao, this._envioComFalha);
  }
}
