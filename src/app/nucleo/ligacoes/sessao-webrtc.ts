/**
 * Mídia de uma ligação (Onda E, E2): o `RTCPeerConnection` do navegador do atendente fala direto
 * com a Meta, sem servidor de mídia e sem TURN. A API só sinaliza (SDP pelas rotas e pelo tempo
 * real). Não há trickle ICE pela Graph: espera-se o fim da coleta de candidatos, com tempo
 * limite, antes de mandar o SDP.
 *
 * Esta classe não conhece Angular nem a API: o `LigacaoService` a usa uma vez por ligação. Em
 * testes, `FabricaWebrtc` troca o navegador por um falso.
 */

/** Tempo máximo esperando o fim da coleta de candidatos (a Meta tem 30 a 60 s para aceitar). */
export const TEMPO_COLETA_ICE_MS = 3_000;

export type MotivoErroDeMidia =
  'negado' | 'sem-dispositivo' | 'ocupado' | 'inseguro' | 'nao-suportado' | 'outro';

export class ErroDeMidia extends Error {
  constructor(
    readonly motivo: MotivoErroDeMidia,
    readonly mensagem: string,
    readonly causa?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroDeMidia';
  }
}

/** Texto para a pessoa, por motivo (microfone negado, sem microfone…). */
export const MENSAGEM_DE_MIDIA: Readonly<Record<MotivoErroDeMidia, string>> = {
  negado:
    'O navegador não deixou o CRM usar o microfone. Clique no cadeado ao lado do endereço, permita o microfone e tente de novo.',
  'sem-dispositivo':
    'Nenhum microfone foi encontrado. Conecte um microfone ou um fone e tente de novo.',
  ocupado:
    'Não foi possível abrir o microfone: outro programa pode estar usando. Feche-o e tente de novo.',
  inseguro:
    'O navegador só libera o microfone em páginas seguras (https). Abra o CRM pelo endereço seguro.',
  'nao-suportado':
    'Este navegador não faz ligações pelo CRM. Use o Chrome, o Edge ou o Firefox atualizados.',
  outro: 'Não foi possível abrir o microfone. Confira as permissões do navegador e tente de novo.',
};

export function erroDeMidia(falha: unknown): ErroDeMidia {
  if (falha instanceof ErroDeMidia) {
    return falha;
  }
  const nome = (falha as { name?: string } | null)?.name ?? '';
  const motivo: MotivoErroDeMidia =
    nome === 'NotAllowedError' || nome === 'SecurityError'
      ? 'negado'
      : nome === 'NotFoundError' || nome === 'OverconstrainedError'
        ? 'sem-dispositivo'
        : nome === 'NotReadableError' || nome === 'AbortError'
          ? 'ocupado'
          : 'outro';
  return new ErroDeMidia(motivo, MENSAGEM_DE_MIDIA[motivo], falha);
}

/** O SDP precisa terminar com CRLF (a Meta recusa sem ele). */
export function comCrlfFinal(sdp: string): string {
  const normalizado = sdp.replace(/\r?\n/g, '\r\n');
  return normalizado.endsWith('\r\n') ? normalizado : `${normalizado}\r\n`;
}

export type QualidadeDaLigacao = 'desconhecida' | 'boa' | 'ruim';

/** Amostra de `getStats` do áudio, a cada poucos segundos. */
export interface AmostraDeQualidade {
  readonly pacotesRecebidos: number;
  readonly pacotesPerdidos: number;
  /** Jitter em segundos. */
  readonly jitter: number;
  /** Ida e volta em segundos (do relatório do outro lado), quando há. */
  readonly rtt: number | null;
  readonly bytesRecebidos: number;
}

export interface LimitesDeQualidade {
  /** Fração de pacotes perdidos no intervalo acima da qual a qualidade é "ruim". */
  readonly perda: number;
  readonly jitter: number;
  readonly rtt: number;
}

export const LIMITES_DE_QUALIDADE: LimitesDeQualidade = { perda: 0.08, jitter: 0.08, rtt: 0.6 };

/**
 * Compara duas amostras seguidas: ruim com perda, jitter ou ida e volta altos, ou quando nenhum
 * áudio chegou no intervalo (a conexão parou de entregar).
 */
export function avaliarQualidade(
  anterior: AmostraDeQualidade | null,
  atual: AmostraDeQualidade,
  limites: LimitesDeQualidade = LIMITES_DE_QUALIDADE,
): QualidadeDaLigacao {
  if (!anterior) {
    return 'desconhecida';
  }
  const recebidos = atual.pacotesRecebidos - anterior.pacotesRecebidos;
  const perdidos = Math.max(0, atual.pacotesPerdidos - anterior.pacotesPerdidos);
  if (recebidos <= 0) {
    return 'ruim';
  }
  const fracao = perdidos / (recebidos + perdidos);
  if (fracao > limites.perda || atual.jitter > limites.jitter) {
    return 'ruim';
  }
  if (atual.rtt !== null && atual.rtt > limites.rtt) {
    return 'ruim';
  }
  return 'boa';
}

/** Lê `getStats()` e junta o que importa do áudio recebido. */
export async function lerAmostra(pc: RTCPeerConnection): Promise<AmostraDeQualidade> {
  const relatorio = await pc.getStats();
  let pacotesRecebidos = 0;
  let pacotesPerdidos = 0;
  let bytesRecebidos = 0;
  let jitter = 0;
  let rtt: number | null = null;
  relatorio.forEach((item: Record<string, unknown>) => {
    const tipo = item['type'];
    const audio = item['kind'] === 'audio' || item['mediaType'] === 'audio';
    if (tipo === 'inbound-rtp' && audio) {
      pacotesRecebidos += Number(item['packetsReceived'] ?? 0);
      pacotesPerdidos += Number(item['packetsLost'] ?? 0);
      bytesRecebidos += Number(item['bytesReceived'] ?? 0);
      jitter = Math.max(jitter, Number(item['jitter'] ?? 0));
    } else if (
      tipo === 'remote-inbound-rtp' &&
      audio &&
      typeof item['roundTripTime'] === 'number'
    ) {
      rtt = item['roundTripTime'] as number;
    }
  });
  return { pacotesRecebidos, pacotesPerdidos, jitter, rtt, bytesRecebidos };
}

/** O que o navegador oferece (trocável nos testes). */
export interface FabricaWebrtc {
  criarConexao(config: RTCConfiguration): RTCPeerConnection;
  midia(): MediaDevices | null;
}

export const FABRICA_WEBRTC_DO_NAVEGADOR: FabricaWebrtc = {
  criarConexao: (config) => new RTCPeerConnection(config),
  midia: () => (typeof navigator === 'undefined' ? null : (navigator.mediaDevices ?? null)),
};

export interface OpcoesSessao {
  readonly stunUrls?: readonly string[];
  readonly fabrica?: FabricaWebrtc;
  readonly tempoColetaMs?: number;
  readonly microfoneId?: string | null;
}

export type EstadoDaConexao = RTCPeerConnectionState;

export class SessaoWebrtc {
  private readonly fabrica: FabricaWebrtc;
  private readonly tempoColetaMs: number;
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remoto: MediaStream | null = null;
  private fechada = false;
  private amostraAnterior: AmostraDeQualidade | null = null;
  private readonly ouvintesDeEstado = new Set<(estado: EstadoDaConexao) => void>();
  private readonly ouvintesDeRemoto = new Set<(stream: MediaStream) => void>();

  constructor(private readonly opcoes: OpcoesSessao = {}) {
    this.fabrica = opcoes.fabrica ?? FABRICA_WEBRTC_DO_NAVEGADOR;
    this.tempoColetaMs = opcoes.tempoColetaMs ?? TEMPO_COLETA_ICE_MS;
  }

  get streamLocal(): MediaStream | null {
    return this.local;
  }

  get streamRemoto(): MediaStream | null {
    return this.remoto;
  }

  get conexao(): RTCPeerConnection | null {
    return this.pc;
  }

  get estado(): EstadoDaConexao {
    return this.pc?.connectionState ?? 'closed';
  }

  aoMudarEstado(tratar: (estado: EstadoDaConexao) => void): () => void {
    this.ouvintesDeEstado.add(tratar);
    return () => this.ouvintesDeEstado.delete(tratar);
  }

  aoReceberAudio(tratar: (stream: MediaStream) => void): () => void {
    this.ouvintesDeRemoto.add(tratar);
    return () => this.ouvintesDeRemoto.delete(tratar);
  }

  /** Abre o microfone (pede a permissão ao navegador). Falhas viram `ErroDeMidia`. */
  async abrirMicrofone(
    deviceId: string | null = this.opcoes.microfoneId ?? null,
  ): Promise<MediaStream> {
    const midia = this.fabrica.midia();
    if (!midia?.getUserMedia) {
      const seguro = typeof isSecureContext === 'boolean' ? isSecureContext : true;
      throw new ErroDeMidia(
        seguro ? 'nao-suportado' : 'inseguro',
        MENSAGEM_DE_MIDIA[seguro ? 'nao-suportado' : 'inseguro'],
      );
    }
    try {
      const stream = await midia.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      });
      if (this.fechada) {
        stream.getTracks().forEach((faixa) => faixa.stop());
        throw new ErroDeMidia('outro', 'A ligação já terminou.');
      }
      this.local = stream;
      return stream;
    } catch (falha) {
      // O microfone escolhido sumiu (fone desconectado): tenta o padrão uma vez.
      if (deviceId && (falha as { name?: string })?.name === 'OverconstrainedError') {
        return this.abrirMicrofone(null);
      }
      throw erroDeMidia(falha);
    }
  }

  /** Ligação recebida: oferta da Meta → resposta SDP (já com os candidatos coletados). */
  async responder(ofertaSdp: string): Promise<string> {
    const pc = this.criar();
    this.adicionarFaixasLocais(pc);
    await pc.setRemoteDescription({ type: 'offer', sdp: comCrlfFinal(ofertaSdp) });
    const resposta = await pc.createAnswer();
    await pc.setLocalDescription(resposta);
    await this.esperarColeta(pc);
    return comCrlfFinal(pc.localDescription?.sdp ?? resposta.sdp ?? '');
  }

  /** Ligação feita: oferta do navegador (já com os candidatos coletados). */
  async oferecer(): Promise<string> {
    const pc = this.criar();
    this.adicionarFaixasLocais(pc);
    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    await this.esperarColeta(pc);
    return comCrlfFinal(pc.localDescription?.sdp ?? oferta.sdp ?? '');
  }

  /** Ligação feita: a resposta SDP da Meta chegou pelo tempo real. */
  async aplicarResposta(sdp: string): Promise<void> {
    if (!this.pc || this.fechada) {
      return;
    }
    await this.pc.setRemoteDescription({ type: 'answer', sdp: comCrlfFinal(sdp) });
  }

  /** Liga ou desliga o envio do microfone (mudo não derruba a conexão). */
  definirMicrofoneAtivo(ativo: boolean): void {
    this.local?.getAudioTracks().forEach((faixa) => (faixa.enabled = ativo));
  }

  /** Troca o microfone no meio da ligação, sem renegociar. */
  async trocarMicrofone(deviceId: string | null, ativo: boolean): Promise<void> {
    const midia = this.fabrica.midia();
    if (!midia || !this.pc) {
      return;
    }
    const novo = await midia.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      video: false,
    });
    const faixa = novo.getAudioTracks()[0];
    if (!faixa) {
      return;
    }
    faixa.enabled = ativo;
    const emissor = this.pc.getSenders().find((item) => item.track?.kind === 'audio');
    await emissor?.replaceTrack(faixa);
    this.local?.getAudioTracks().forEach((antiga) => {
      antiga.stop();
      this.local?.removeTrack(antiga);
    });
    this.local?.addTrack(faixa);
  }

  /** Uma amostra da qualidade do áudio recebido, comparada com a anterior. */
  async medirQualidade(): Promise<QualidadeDaLigacao> {
    if (!this.pc || this.fechada) {
      return 'desconhecida';
    }
    const atual = await lerAmostra(this.pc);
    const qualidade = avaliarQualidade(this.amostraAnterior, atual);
    this.amostraAnterior = atual;
    return qualidade;
  }

  /** Para o microfone e fecha a conexão. Pode ser chamado mais de uma vez. */
  fechar(): void {
    if (this.fechada) {
      return;
    }
    this.fechada = true;
    this.local?.getTracks().forEach((faixa) => faixa.stop());
    this.remoto?.getTracks().forEach((faixa) => faixa.stop());
    const pc = this.pc;
    this.pc = null;
    if (pc) {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        // já fechada
      }
    }
    this.ouvintesDeEstado.clear();
    this.ouvintesDeRemoto.clear();
  }

  private criar(): RTCPeerConnection {
    if (this.pc) {
      throw new Error('A conexão desta ligação já foi criada.');
    }
    const iceServers = (this.opcoes.stunUrls ?? []).length
      ? [{ urls: [...(this.opcoes.stunUrls ?? [])] }]
      : [];
    const pc = this.fabrica.criarConexao({ iceServers, bundlePolicy: 'max-bundle' });
    this.pc = pc;
    pc.ontrack = (evento) => {
      const stream = evento.streams[0] ?? this.remoto ?? new MediaStream();
      if (!evento.streams[0] && !stream.getTracks().includes(evento.track)) {
        stream.addTrack(evento.track);
      }
      this.remoto = stream;
      for (const tratar of Array.from(this.ouvintesDeRemoto)) {
        tratar(stream);
      }
    };
    pc.onconnectionstatechange = () => {
      for (const tratar of Array.from(this.ouvintesDeEstado)) {
        tratar(pc.connectionState);
      }
    };
    return pc;
  }

  private adicionarFaixasLocais(pc: RTCPeerConnection): void {
    const stream = this.local;
    if (!stream) {
      throw new ErroDeMidia('outro', MENSAGEM_DE_MIDIA.outro);
    }
    for (const faixa of stream.getAudioTracks()) {
      pc.addTrack(faixa, stream);
    }
  }

  private esperarColeta(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise<void>((resolver) => {
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      const terminar = () => {
        clearTimeout(temporizador);
        pc.removeEventListener('icegatheringstatechange', aoMudar);
        resolver();
      };
      const aoMudar = () => {
        if (pc.iceGatheringState === 'complete') {
          terminar();
        }
      };
      pc.addEventListener('icegatheringstatechange', aoMudar);
      temporizador = setTimeout(terminar, this.tempoColetaMs);
    });
  }
}
