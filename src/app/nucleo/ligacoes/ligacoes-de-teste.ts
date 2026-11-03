import type { Provider } from '@angular/core';

import { AMBIENTE_DE_LIGACAO, type AmbienteDeLigacao } from './ligacao.service';
import type { Ligacao } from './ligacoes.tipos';
import type { FabricaWebrtc } from './sessao-webrtc';
import type { ToqueSonoro } from './toque';

/**
 * **Só para testes (specs).** Navegador falso para o softphone: `RTCPeerConnection`, microfone,
 * toque e alto-falante, sem rede nem áudio. Nenhum código do app importa isto.
 */

export interface FaixaFalsa {
  kind: 'audio';
  enabled: boolean;
  parada: boolean;
  stop(): void;
}

export interface StreamFalsa {
  faixas: FaixaFalsa[];
  getTracks(): FaixaFalsa[];
  getAudioTracks(): FaixaFalsa[];
  addTrack(faixa: FaixaFalsa): void;
  removeTrack(faixa: FaixaFalsa): void;
}

export function streamFalsa(): StreamFalsa {
  const faixas: FaixaFalsa[] = [];
  const faixa = (): FaixaFalsa => {
    const f: FaixaFalsa = {
      kind: 'audio',
      enabled: true,
      parada: false,
      stop: () => {
        f.parada = true;
      },
    };
    return f;
  };
  faixas.push(faixa());
  return {
    faixas,
    getTracks: () => faixas,
    getAudioTracks: () => faixas,
    addTrack: (f) => faixas.push(f),
    removeTrack: (f) => faixas.splice(faixas.indexOf(f), 1),
  };
}

export class ConexaoFalsa {
  connectionState: RTCPeerConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'complete';
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  fechada = false;
  faixas: unknown[] = [];
  ontrack: ((evento: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  readonly ouvintes = new Map<string, Set<() => void>>();
  estatisticas: Record<string, unknown>[] = [];

  constructor(readonly config: RTCConfiguration) {}

  addTrack(faixa: unknown): { track: unknown; replaceTrack: (nova: unknown) => Promise<void> } {
    this.faixas.push(faixa);
    return { track: faixa, replaceTrack: () => Promise.resolve() };
  }
  getSenders() {
    return this.faixas.map((track) => ({ track, replaceTrack: () => Promise.resolve() }));
  }
  setRemoteDescription(descricao: { type: string; sdp: string }): Promise<void> {
    this.remoteDescription = descricao;
    return Promise.resolve();
  }
  createAnswer(): Promise<{ type: string; sdp: string }> {
    return Promise.resolve({ type: 'answer', sdp: 'v=0\r\na=resposta-falsa' });
  }
  createOffer(): Promise<{ type: string; sdp: string }> {
    return Promise.resolve({ type: 'offer', sdp: 'v=0\r\na=oferta-falsa' });
  }
  setLocalDescription(descricao: { type: string; sdp: string }): Promise<void> {
    this.localDescription = descricao;
    return Promise.resolve();
  }
  addEventListener(evento: string, tratar: () => void): void {
    const lista = this.ouvintes.get(evento) ?? new Set();
    lista.add(tratar);
    this.ouvintes.set(evento, lista);
  }
  removeEventListener(evento: string, tratar: () => void): void {
    this.ouvintes.get(evento)?.delete(tratar);
  }
  getStats(): Promise<{ forEach: (fn: (item: Record<string, unknown>) => void) => void }> {
    return Promise.resolve({ forEach: (fn) => this.estatisticas.forEach(fn) });
  }
  close(): void {
    this.fechada = true;
    this.connectionState = 'closed';
  }

  /** O navegador recebeu o áudio do outro lado. */
  receberAudio(): StreamFalsa {
    const stream = streamFalsa();
    this.ontrack?.({ streams: [stream], track: stream.faixas[0] });
    return stream;
  }

  mudarEstado(estado: RTCPeerConnectionState): void {
    this.connectionState = estado;
    this.onconnectionstatechange?.();
  }
}

export interface NavegadorFalso {
  readonly providers: Provider[];
  readonly conexoes: ConexaoFalsa[];
  readonly microfones: StreamFalsa[];
  readonly toque: { tocar: ReturnType<typeof vi.fn>; parar: ReturnType<typeof vi.fn> };
  readonly audio: {
    srcObject: unknown;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  };
  /** O próximo `getUserMedia` falha com este erro (`NotAllowedError`…). */
  falharMicrofone(nome: string): void;
}

export function provideNavegadorFalso(): NavegadorFalso {
  const conexoes: ConexaoFalsa[] = [];
  const microfones: StreamFalsa[] = [];
  let erroDoMicrofone: string | null = null;
  const toque = { tocar: vi.fn(), parar: vi.fn() };
  const audio = {
    srcObject: null as unknown,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  };
  const webrtc: FabricaWebrtc = {
    criarConexao: (config) => {
      const conexao = new ConexaoFalsa(config);
      conexoes.push(conexao);
      return conexao as unknown as RTCPeerConnection;
    },
    midia: () =>
      ({
        getUserMedia: () => {
          if (erroDoMicrofone) {
            const nome = erroDoMicrofone;
            erroDoMicrofone = null;
            return Promise.reject(Object.assign(new Error(nome), { name: nome }));
          }
          const stream = streamFalsa();
          microfones.push(stream);
          return Promise.resolve(stream);
        },
      }) as unknown as MediaDevices,
  };
  const ambiente: AmbienteDeLigacao = {
    webrtc,
    criarToque: () =>
      ({
        preparar: () => undefined,
        tocar: toque.tocar,
        parar: toque.parar,
        silenciado: () => false,
        aoMudarSilencio: () => undefined,
        destruir: () => undefined,
      }) as unknown as ToqueSonoro,
    criarAudio: () => audio as unknown as HTMLAudioElement,
    dispositivos: () => null,
  };
  return {
    providers: [{ provide: AMBIENTE_DE_LIGACAO, useValue: ambiente }],
    conexoes,
    microfones,
    toque,
    audio,
    falharMicrofone: (nome) => {
      erroDoMicrofone = nome;
    },
  };
}

/** Uma ligação da API para os testes. */
export function ligacaoDeTeste(extra: Partial<Ligacao> = {}): Ligacao {
  return {
    id: 'lig-1',
    direcao: 'RECEBIDA',
    estado: 'TOCANDO',
    motivo: null,
    motivoTexto: null,
    canal: { id: 'canal-1', nome: 'WhatsApp Oficial' },
    contato: {
      id: 'ct-1',
      nome: 'Maria Oficial',
      telefone: '5511999990001',
      empresa: 'Maria Ltda',
    },
    conversaId: 'conv-1',
    atendente: null,
    atividadeId: null,
    anotacao: null,
    iniciadaEm: '2026-11-02T12:00:00.000Z',
    tocouEm: '2026-11-02T12:00:00.000Z',
    atendidaEm: null,
    encerradaEm: null,
    duracaoSegundos: null,
    expiraEm: null,
    ofertaSdp: null,
    respostaSdp: null,
    gravar: false,
    erroCodigo: null,
    erroMensagem: null,
    ...extra,
  };
}
