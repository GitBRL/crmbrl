import type { EnvioDeGravacao } from './gravacao.api';
import { type AmbienteDoGravador, Gravador, type SituacaoDoGravador } from './gravador';

class NoFalso {
  conexoes: Array<[unknown, number | undefined, number | undefined]> = [];
  desconectado = false;
  channelCount = 0;
  channelCountMode = '';
  channelInterpretation = '';
  stream = { getTracks: () => [{ stop: () => (this.parou = true) }] };
  parou = false;
  connect(destino: unknown, saida?: number, entrada?: number) {
    this.conexoes.push([destino, saida, entrada]);
  }
  disconnect() {
    this.desconectado = true;
  }
}

class ContextoFalso {
  merger = new NoFalso();
  destino = new NoFalso();
  fontes: NoFalso[] = [];
  fechado = false;
  retomado = false;
  createChannelMerger(canais: number) {
    expect(canais).toBe(2);
    return this.merger;
  }
  createMediaStreamDestination() {
    return this.destino;
  }
  createMediaStreamSource() {
    const fonte = new NoFalso();
    this.fontes.push(fonte);
    return fonte;
  }
  resume() {
    this.retomado = true;
    return Promise.resolve();
  }
  close() {
    this.fechado = true;
    return Promise.resolve();
  }
}

class GravadorFalso {
  state: 'inactive' | 'recording' = 'inactive';
  fatia = 0;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start(fatia: number) {
    this.state = 'recording';
    this.fatia = fatia;
  }
  stop() {
    this.state = 'inactive';
    this.entregar(new Blob(['final']));
    this.onstop?.();
  }
  entregar(blob: Blob) {
    this.ondataavailable?.({ data: blob });
  }
}

const stream = (faixas = 1) =>
  ({ getAudioTracks: () => new Array(faixas).fill({}) }) as unknown as MediaStream;

function montar(
  envio: Partial<EnvioDeGravacao> = {},
  extra: { suportado?: boolean; esperas?: number[] } = {},
) {
  const contexto = new ContextoFalso();
  const gravador = new GravadorFalso();
  const esperas: number[] = [];
  const ambiente: AmbienteDoGravador = {
    suportado: () => extra.suportado ?? true,
    criarContexto: () => contexto as unknown as AudioContext,
    criarGravador: () => gravador as unknown as MediaRecorder,
    esperar: (ms) => {
      esperas.push(ms);
      return Promise.resolve();
    },
  };
  const enviadas: number[] = [];
  const finalizacoes: number[] = [];
  const saidas: number[] = [];
  const completo: EnvioDeGravacao = {
    enviarParte: (_id, sequencia) => {
      enviadas.push(sequencia);
      return Promise.resolve();
    },
    finalizar: (_id, total) => {
      finalizacoes.push(total);
      return Promise.resolve();
    },
    finalizarNaSaida: (_id, total) => {
      saidas.push(total);
      return true;
    },
    audioDeAviso: () => Promise.resolve(null),
    ...envio,
  };
  const situacoes: SituacaoDoGravador[] = [];
  const g = new Gravador({
    ligacaoId: 'l1',
    envio: completo,
    ambiente,
    esperas: extra.esperas ?? [10, 20],
    aoMudar: (s) => situacoes.push(s),
  });
  return { g, contexto, gravador, enviadas, finalizacoes, saidas, esperas, situacoes };
}

const dormir = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('Gravador', () => {
  it('mistura em estéreo (atendente à esquerda, cliente à direita) e grava em fatias de 5 s', () => {
    const t = montar();
    expect(t.g.iniciar(stream(), stream())).toBe(true);
    expect(t.gravador.fatia).toBe(5000);
    expect(t.contexto.destino.channelCount).toBe(2);
    expect(t.contexto.destino.channelCountMode).toBe('explicit');
    expect(t.contexto.merger.conexoes[0]?.[0]).toBe(t.contexto.destino);
    expect(t.contexto.fontes[0]!.conexoes).toEqual([[t.contexto.merger, 0, 0]]);
    expect(t.contexto.fontes[1]!.conexoes).toEqual([[t.contexto.merger, 0, 1]]);
    expect(t.g.situacao).toBe('gravando');
  });

  it('não grava quando o navegador não sabe (ou já iniciou)', () => {
    const t = montar({}, { suportado: false });
    expect(t.g.iniciar(stream(), stream())).toBe(false);
    expect(t.g.situacao).toBe('parado');
    const u = montar();
    expect(u.g.iniciar(stream(), stream())).toBe(true);
    expect(u.g.iniciar(stream(), stream())).toBe(false);
  });

  it('envia as partes em ordem e finaliza com o total ao parar', async () => {
    const t = montar();
    t.g.iniciar(stream(), stream());
    t.gravador.entregar(new Blob(['a']));
    t.gravador.entregar(new Blob(['b']));
    t.gravador.entregar(new Blob([]));
    await t.g.parar();
    expect(t.enviadas).toEqual([0, 1, 2]);
    expect(t.finalizacoes).toEqual([3]);
    expect(t.g.situacao).toBe('concluido');
    expect(t.contexto.fechado).toBe(true);
    expect(t.contexto.destino.parou).toBe(true);
  });

  it('repete a parte que falha, sem pular a ordem', async () => {
    let tentativas = 0;
    const t = montar({
      enviarParte: (_id, sequencia) => {
        if (sequencia === 0 && ++tentativas < 3) {
          return Promise.reject(new Error('rede'));
        }
        t.enviadas.push(sequencia);
        return Promise.resolve();
      },
    });
    t.g.iniciar(stream(), stream());
    t.gravador.entregar(new Blob(['a']));
    t.gravador.entregar(new Blob(['b']));
    await t.g.parar();
    expect(t.enviadas).toEqual([0, 1, 2]);
    expect(tentativas).toBe(3);
    expect(t.esperas).toEqual([10, 20]);
    expect(t.finalizacoes).toEqual([3]);
  });

  it('quando uma parte nunca sobe, finaliza só com o que subiu em sequência e marca falha', async () => {
    const t = montar({
      enviarParte: (_id, sequencia) =>
        sequencia === 1
          ? Promise.reject(new Error('rede'))
          : (t.enviadas.push(sequencia), Promise.resolve()),
    });
    t.g.iniciar(stream(), stream());
    t.gravador.entregar(new Blob(['a']));
    t.gravador.entregar(new Blob(['b']));
    await t.g.parar();
    expect(t.finalizacoes).toEqual([1]);
    expect(t.g.situacao).toBe('falhou');
    expect(t.g.envioComFalha).toBe(true);
  });

  it('repete o finalizar se a API falhar', async () => {
    let chamadas = 0;
    const t = montar({
      finalizar: () => (++chamadas < 2 ? Promise.reject(new Error('x')) : Promise.resolve()),
    });
    t.g.iniciar(stream(), stream());
    t.gravador.entregar(new Blob(['a']));
    await t.g.parar();
    expect(chamadas).toBe(2);
    expect(t.g.situacao).toBe('concluido');
  });

  it('ao fechar a aba manda o finalizar por sendBeacon com o que já subiu', async () => {
    const t = montar();
    t.g.iniciar(stream(), stream());
    t.gravador.entregar(new Blob(['a']));
    t.gravador.entregar(new Blob(['b']));
    await dormir();
    t.g.sairDaPagina();
    t.g.sairDaPagina();
    expect(t.saidas).toEqual([2]);
    expect(t.finalizacoes).toEqual([]);
    await t.g.parar();
    expect(t.finalizacoes).toEqual([]);
  });

  it('religa o canal do atendente quando o microfone muda', () => {
    const t = montar();
    t.g.iniciar(stream(), stream());
    const antiga = t.contexto.fontes[0]!;
    t.g.trocarLocal(stream());
    expect(antiga.desconectado).toBe(true);
    expect(t.contexto.fontes).toHaveLength(3);
    expect(t.contexto.fontes[2]!.conexoes).toEqual([[t.contexto.merger, 0, 0]]);
  });

  it('parar sem ter iniciado não faz nada', async () => {
    const t = montar();
    await t.g.parar();
    expect(t.finalizacoes).toEqual([]);
  });
});
