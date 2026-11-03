import { ToqueSonoro } from './toque';

class OsciladorFalso {
  type = 'sine';
  frequency = { value: 0 };
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
}

class ContextoFalso {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = {};
  osciladores: OsciladorFalso[] = [];
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createOscillator() {
    const oscilador = new OsciladorFalso();
    this.osciladores.push(oscilador);
    return oscilador;
  }
}

describe('ToqueSonoro (Web Audio, sem arquivo de som)', () => {
  it('antes de qualquer gesto o navegador não libera o som: fica silenciado e não gera notas', () => {
    const contexto = new ContextoFalso();
    contexto.resume = vi.fn(() => new Promise<void>(() => undefined)) as never;
    const toque = new ToqueSonoro(() => contexto as unknown as AudioContext);
    const avisos: boolean[] = [];
    toque.aoMudarSilencio((silenciado) => avisos.push(silenciado));
    toque.tocar();
    expect(toque.silenciado()).toBe(true);
    expect(contexto.osciladores).toEqual([]);
    toque.destruir();
  });

  it('contexto liberado: gera as duas notas (dois tons cada) e para sem vazar o intervalo', async () => {
    vi.useFakeTimers();
    try {
      const contexto = new ContextoFalso();
      contexto.state = 'running';
      const toque = new ToqueSonoro(() => contexto as unknown as AudioContext);
      toque.tocar();
      expect(toque.silenciado()).toBe(false);
      expect(contexto.osciladores.length).toBe(4);
      expect(contexto.osciladores.map((o) => o.frequency.value)).toEqual([440, 480, 440, 480]);
      vi.setSystemTime(Date.now() + 4_000);
      vi.advanceTimersByTime(4_000);
      expect(contexto.osciladores.length).toBe(8);
      toque.parar();
      vi.setSystemTime(Date.now() + 8_000);
      vi.advanceTimersByTime(8_000);
      expect(contexto.osciladores.length).toBe(8);
      toque.destruir();
    } finally {
      vi.useRealTimers();
    }
  });

  it('o primeiro gesto da pessoa libera o som e avisa quem mostra "toque sem som"', async () => {
    const contexto = new ContextoFalso();
    const alvo = new EventTarget();
    const toque = new ToqueSonoro(() => contexto as unknown as AudioContext);
    toque.preparar(alvo as unknown as Document);
    const avisos: boolean[] = [];
    toque.aoMudarSilencio((silenciado) => avisos.push(silenciado));
    alvo.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    await Promise.resolve();
    expect(contexto.resume).toHaveBeenCalled();
    expect(toque.silenciado()).toBe(false);
    expect(avisos).toEqual([false]);
    toque.destruir();
  });
});
