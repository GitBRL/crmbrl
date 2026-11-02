import { signal } from '@angular/core';

/** Formatos tentados, nesta ordem (o gateway converte para ogg/opus antes de enviar). */
const FORMATOS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
/** Gravação mais longa que isto para sozinha. */
export const DURACAO_MAXIMA_GRAVACAO_S = 10 * 60;
/** Quantas barras do nível do microfone a tela mostra. */
export const BARRAS_NIVEL = 28;

export type EstadoGravacao = 'parado' | 'pedindo' | 'gravando';

/** O áudio gravado, pronto para ouvir e enviar. */
export interface AudioGravado {
  readonly arquivo: File;
  /** `blob:` para o player (liberado por `liberarAudio`). */
  readonly url: string;
  readonly duracao: number;
}

/**
 * Gravação de áudio pelo navegador (`MediaRecorder`, webm/opus quando houver), com o tempo e o
 * nível do microfone em signals. Uso interno do `app-compositor`.
 *
 * ```ts
 * const gravador = new GravadorAudio();
 * await gravador.iniciar();          // pede o microfone
 * const audio = await gravador.parar(); // { arquivo, url, duracao } ou null
 * gravador.cancelar();               // descarta
 * ```
 */
export class GravadorAudio {
  readonly estado = signal<EstadoGravacao>('parado');
  readonly segundos = signal(0);
  /** Nível recente do microfone (0 a 1), uma barra por posição. */
  readonly niveis = signal<readonly number[]>([]);
  /** Motivo pronto para a tela quando não deu para gravar. */
  readonly erro = signal<string | null>(null);

  private gravador: MediaRecorder | null = null;
  private fluxo: MediaStream | null = null;
  private contexto: AudioContext | null = null;
  private pedacos: Blob[] = [];
  private inicio = 0;
  private relogio: ReturnType<typeof setInterval> | undefined;
  private quadro = 0;
  private aoParar: ((audio: AudioGravado | null) => void) | null = null;
  private descartar = false;

  /** O navegador grava áudio (`getUserMedia` e `MediaRecorder`)? */
  static suportado(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  /** Pede o microfone e começa. `false` se não deu (o motivo fica em `erro`). */
  async iniciar(): Promise<boolean> {
    if (this.estado() !== 'parado') {
      return false;
    }
    this.erro.set(null);
    this.estado.set('pedindo');
    try {
      this.fluxo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (falha) {
      this.estado.set('parado');
      this.erro.set(motivoDoMicrofone(falha));
      return false;
    }
    const formato = FORMATOS.find((tipo) => MediaRecorder.isTypeSupported?.(tipo));
    try {
      this.gravador = new MediaRecorder(this.fluxo, formato ? { mimeType: formato } : undefined);
    } catch {
      this.liberar();
      this.estado.set('parado');
      this.erro.set('Este navegador não consegue gravar áudio.');
      return false;
    }
    this.pedacos = [];
    this.descartar = false;
    this.gravador.ondataavailable = (evento) => {
      if (evento.data.size) {
        this.pedacos.push(evento.data);
      }
    };
    this.gravador.onstop = () => this.finalizar();
    this.gravador.start(250);
    this.inicio = performance.now();
    this.segundos.set(0);
    this.niveis.set([]);
    this.relogio = setInterval(() => {
      const segundos = (performance.now() - this.inicio) / 1000;
      this.segundos.set(segundos);
      if (segundos >= DURACAO_MAXIMA_GRAVACAO_S) {
        void this.parar();
      }
    }, 250);
    this.acompanharNivel();
    this.estado.set('gravando');
    return true;
  }

  /** Para e devolve o áudio (ou `null` se nada foi gravado). */
  parar(): Promise<AudioGravado | null> {
    if (this.estado() !== 'gravando' || !this.gravador) {
      return Promise.resolve(null);
    }
    return new Promise((resolver) => {
      this.aoParar = resolver;
      this.gravador?.stop();
    });
  }

  /** Para e joga fora. */
  cancelar(): void {
    if (this.gravador && this.estado() === 'gravando') {
      this.descartar = true;
      this.gravador.stop();
    } else {
      this.liberar();
      this.estado.set('parado');
    }
  }

  private finalizar(): void {
    const tipo = (this.gravador?.mimeType || 'audio/webm').split(';')[0];
    const duracao = (performance.now() - this.inicio) / 1000;
    const pedacos = this.pedacos;
    const resolver = this.aoParar;
    const descartar = this.descartar;
    this.aoParar = null;
    this.pedacos = [];
    this.liberar();
    this.estado.set('parado');
    if (descartar || !pedacos.length) {
      resolver?.(null);
      return;
    }
    const blob = new Blob(pedacos, { type: tipo });
    const arquivo = new File([blob], nomeDoAudio(tipo), { type: tipo });
    resolver?.({ arquivo, url: URL.createObjectURL(blob), duracao });
  }

  private acompanharNivel(): void {
    const Contexto =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto || !this.fluxo) {
      return;
    }
    try {
      this.contexto = new Contexto();
      const analisador = this.contexto.createAnalyser();
      analisador.fftSize = 256;
      this.contexto.createMediaStreamSource(this.fluxo).connect(analisador);
      const amostras = new Uint8Array(analisador.fftSize);
      let ultimo = 0;
      const medir = (agora: number) => {
        this.quadro = requestAnimationFrame(medir);
        if (agora - ultimo < 90) {
          return;
        }
        ultimo = agora;
        analisador.getByteTimeDomainData(amostras);
        let soma = 0;
        for (const amostra of amostras) {
          const valor = (amostra - 128) / 128;
          soma += valor * valor;
        }
        const nivel = Math.min(1, Math.sqrt(soma / amostras.length) * 4);
        this.niveis.update((niveis) => [...niveis, nivel].slice(-BARRAS_NIVEL));
      };
      this.quadro = requestAnimationFrame(medir);
    } catch {
      // Sem o medidor de nível, a gravação continua.
    }
  }

  private liberar(): void {
    clearInterval(this.relogio);
    cancelAnimationFrame(this.quadro);
    this.quadro = 0;
    this.fluxo?.getTracks().forEach((faixa) => faixa.stop());
    this.fluxo = null;
    void this.contexto?.close().catch(() => undefined);
    this.contexto = null;
    this.gravador = null;
  }
}

/** Libera a URL do player de um áudio gravado. */
export function liberarAudio(audio: AudioGravado | null | undefined): void {
  if (audio) {
    URL.revokeObjectURL(audio.url);
  }
}

function nomeDoAudio(tipo: string): string {
  const extensao = tipo.includes('ogg') ? 'ogg' : tipo.includes('mp4') ? 'm4a' : 'webm';
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  const carimbo =
    `${agora.getFullYear()}${dois(agora.getMonth() + 1)}${dois(agora.getDate())}-` +
    `${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`;
  return `audio-${carimbo}.${extensao}`;
}

function motivoDoMicrofone(falha: unknown): string {
  const nome = (falha as { name?: string } | null)?.name;
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return 'O navegador não deixou usar o microfone. Libere o acesso nas configurações do site e tente de novo.';
  }
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
    return 'Nenhum microfone encontrado. Conecte um e tente de novo.';
  }
  if (nome === 'NotReadableError') {
    return 'O microfone está sendo usado por outro programa.';
  }
  return 'Não foi possível usar o microfone.';
}
