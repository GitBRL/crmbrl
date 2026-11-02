import { GravadorAudio, liberarAudio } from './gravador-audio';

/** MediaRecorder falso: `stop()` entrega o que foi "gravado" e avisa o fim. */
class GravadorFalso {
  static isTypeSupported = (tipo: string) => tipo === 'audio/webm;codecs=opus';
  static ultimo: GravadorFalso | null = null;
  ondataavailable: ((evento: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly mimeType: string;
  iniciado = false;

  constructor(
    readonly fluxo: unknown,
    opcoes?: { mimeType?: string },
  ) {
    this.mimeType = opcoes?.mimeType ?? '';
    GravadorFalso.ultimo = this;
  }

  start(): void {
    this.iniciado = true;
  }

  stop(): void {
    this.ondataavailable?.({ data: new Blob(['som'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

describe('GravadorAudio', () => {
  const faixa = { stop: vi.fn() };
  const getUserMedia = vi.fn();
  const original = {
    mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    criarUrl: URL.createObjectURL,
    revogarUrl: URL.revokeObjectURL,
  };

  beforeEach(() => {
    faixa.stop.mockReset();
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [faixa] });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    vi.stubGlobal('MediaRecorder', GravadorFalso);
    // O jsdom não tem URL.createObjectURL.
    URL.createObjectURL = vi.fn(() => 'blob:audio');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = original.criarUrl;
    URL.revokeObjectURL = original.revogarUrl;
    if (original.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', original.mediaDevices);
    } else {
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    }
  });

  it('suportado só com getUserMedia e MediaRecorder', () => {
    expect(GravadorAudio.suportado()).toBe(true);
    vi.stubGlobal('MediaRecorder', undefined);
    expect(GravadorAudio.suportado()).toBe(false);
  });

  it('grava em webm/opus, mede o tempo e entrega o arquivo ao parar (e solta o microfone)', async () => {
    vi.useFakeTimers();
    try {
      const gravador = new GravadorAudio();
      expect(await gravador.iniciar()).toBe(true);
      expect(gravador.estado()).toBe('gravando');
      expect(getUserMedia).toHaveBeenCalledWith({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      expect(GravadorFalso.ultimo?.mimeType).toBe('audio/webm;codecs=opus');
      expect(GravadorFalso.ultimo?.iniciado).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(gravador.segundos()).toBeGreaterThanOrEqual(2.9);

      const audio = await gravador.parar();
      expect(audio?.arquivo.type).toBe('audio/webm');
      expect(audio?.arquivo.name).toMatch(/^audio-\d{8}-\d{6}\.webm$/);
      expect(audio?.url).toBe('blob:audio');
      expect(audio?.duracao).toBeGreaterThanOrEqual(2.9);
      expect(gravador.estado()).toBe('parado');
      expect(faixa.stop).toHaveBeenCalled();

      liberarAudio(audio);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelar descarta o que foi gravado', async () => {
    const gravador = new GravadorAudio();
    await gravador.iniciar();
    const parada = gravador.parar();
    gravador.cancelar();
    expect(await parada).not.toBeNull(); // o parar() pedido antes ainda entrega
    await gravador.iniciar();
    gravador.cancelar();
    expect(gravador.estado()).toBe('parado');
    expect(await gravador.parar()).toBeNull();
  });

  it('microfone negado ou ausente: motivo em português', async () => {
    const casos: [string, string][] = [
      ['NotAllowedError', 'O navegador não deixou usar o microfone.'],
      ['NotFoundError', 'Nenhum microfone encontrado.'],
      ['NotReadableError', 'O microfone está sendo usado por outro programa.'],
      ['AbortError', 'Não foi possível usar o microfone.'],
    ];
    for (const [nome, motivo] of casos) {
      getUserMedia.mockRejectedValueOnce(Object.assign(new Error(nome), { name: nome }));
      const gravador = new GravadorAudio();
      expect(await gravador.iniciar()).toBe(false);
      expect(gravador.estado()).toBe('parado');
      expect(gravador.erro()).toContain(motivo);
    }
  });
});
