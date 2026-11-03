/**
 * Toque da ligação recebida, gerado com Web Audio (sem arquivo de som). O navegador só libera
 * áudio depois de um gesto da pessoa (política de autoplay): `preparar()` cria e retoma o
 * contexto no primeiro clique ou tecla. Se o toque for pedido antes disso, `silenciado()` fica
 * verdadeiro e a tela avisa que o som está desligado; ao primeiro gesto o toque começa sozinho.
 */

/** Um ciclo: duas notas curtas e uma pausa (4 s no total). */
const CICLO_MS = 4_000;
const NOTAS: readonly {
  readonly inicio: number;
  readonly duracao: number;
  readonly graves: number;
  readonly agudos: number;
}[] = [
  { inicio: 0, duracao: 0.45, graves: 440, agudos: 480 },
  { inicio: 0.65, duracao: 0.45, graves: 440, agudos: 480 },
];
const VOLUME = 0.12;

type FabricaContexto = () => AudioContext | null;

function contextoDoNavegador(): AudioContext | null {
  const construtor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  return construtor ? new construtor() : null;
}

export class ToqueSonoro {
  private contexto: AudioContext | null = null;
  private ciclo: ReturnType<typeof setInterval> | undefined;
  private tocando = false;
  private ultimaNotaEm = 0;
  private liberado = false;
  private readonly gesto = () => this.liberar();
  private aoMudarFn: ((silenciado: boolean) => void) | null = null;

  constructor(private readonly fabrica: FabricaContexto = contextoDoNavegador) {}

  /** Escuta o primeiro gesto da pessoa na página para liberar o áudio. */
  preparar(alvo: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): void {
    for (const evento of ['pointerdown', 'keydown', 'touchstart']) {
      alvo.addEventListener(evento, this.gesto, { passive: true });
    }
    this.removerGesto = () => {
      for (const evento of ['pointerdown', 'keydown', 'touchstart']) {
        alvo.removeEventListener(evento, this.gesto);
      }
    };
  }

  private removerGesto: () => void = () => undefined;

  /** Verdadeiro quando o navegador ainda não liberou o áudio (ninguém clicou na página). */
  silenciado(): boolean {
    return !this.liberado;
  }

  /** Avisa quando o áudio é liberado (ou bloqueado) — a tela mostra "toque sem som". */
  aoMudarSilencio(tratar: (silenciado: boolean) => void): void {
    this.aoMudarFn = tratar;
  }

  private definirLiberado(liberado: boolean): void {
    if (this.liberado !== liberado) {
      this.liberado = liberado;
      this.aoMudarFn?.(!liberado);
    }
  }

  tocar(): void {
    if (this.tocando) {
      return;
    }
    this.tocando = true;
    this.garantirContexto();
    if (this.contexto?.state === 'running') {
      this.definirLiberado(true);
    }
    this.nota();
    this.ciclo = setInterval(() => this.nota(), CICLO_MS);
  }

  parar(): void {
    this.tocando = false;
    clearInterval(this.ciclo);
    this.ciclo = undefined;
  }

  destruir(): void {
    this.parar();
    this.removerGesto();
    void this.contexto?.close().catch(() => undefined);
    this.contexto = null;
  }

  private liberar(): void {
    this.garantirContexto();
    const contexto = this.contexto;
    if (!contexto) {
      return;
    }
    void contexto.resume().then(
      () => {
        this.definirLiberado(true);
        if (this.tocando) {
          this.nota();
        }
      },
      () => undefined,
    );
  }

  private garantirContexto(): void {
    if (!this.contexto) {
      try {
        this.contexto = this.fabrica();
      } catch {
        this.contexto = null;
      }
    }
    if (this.contexto?.state === 'suspended') {
      void this.contexto.resume().then(
        () => {
          this.definirLiberado(this.contexto?.state === 'running');
          if (this.tocando && this.liberado) {
            this.nota();
          }
        },
        () => undefined,
      );
    }
  }

  /** Agenda as duas notas do ciclo a partir de agora. */
  private nota(): void {
    const contexto = this.contexto;
    if (!contexto || contexto.state !== 'running') {
      return;
    }
    const relogio = Date.now();
    if (relogio - this.ultimaNotaEm < 500) {
      return; // dois gestos seguidos não dobram o toque
    }
    this.ultimaNotaEm = relogio;
    const agora = contexto.currentTime;
    for (const nota of NOTAS) {
      const ganho = contexto.createGain();
      const inicio = agora + nota.inicio;
      const fim = inicio + nota.duracao;
      ganho.gain.setValueAtTime(0, inicio);
      ganho.gain.linearRampToValueAtTime(VOLUME, inicio + 0.03);
      ganho.gain.setValueAtTime(VOLUME, fim - 0.05);
      ganho.gain.linearRampToValueAtTime(0, fim);
      ganho.connect(contexto.destination);
      for (const frequencia of [nota.graves, nota.agudos]) {
        const oscilador = contexto.createOscillator();
        oscilador.type = 'sine';
        oscilador.frequency.value = frequencia;
        oscilador.connect(ganho);
        oscilador.start(inicio);
        oscilador.stop(fim + 0.02);
      }
    }
  }
}
