import {
  avaliarQualidade,
  type AmostraDeQualidade,
  comCrlfFinal,
  erroDeMidia,
  ErroDeMidia,
  SessaoWebrtc,
} from './sessao-webrtc';
import { ConexaoFalsa, provideNavegadorFalso } from './ligacoes-de-teste';

const amostra = (extra: Partial<AmostraDeQualidade> = {}): AmostraDeQualidade => ({
  pacotesRecebidos: 0,
  pacotesPerdidos: 0,
  jitter: 0,
  rtt: null,
  bytesRecebidos: 0,
  ...extra,
});

describe('SessaoWebrtc — funções puras', () => {
  it('comCrlfFinal: normaliza as quebras de linha e garante o CRLF final', () => {
    expect(comCrlfFinal('v=0\na=x')).toBe('v=0\r\na=x\r\n');
    expect(comCrlfFinal('v=0\r\na=x\r\n')).toBe('v=0\r\na=x\r\n');
  });

  it('erroDeMidia: traduz o erro do navegador em um motivo e numa frase', () => {
    const negado = erroDeMidia(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(negado.motivo).toBe('negado');
    expect(negado.mensagem).toContain('permita o microfone');
    expect(erroDeMidia({ name: 'NotFoundError' }).motivo).toBe('sem-dispositivo');
    expect(erroDeMidia({ name: 'NotReadableError' }).motivo).toBe('ocupado');
    expect(erroDeMidia(new Error('?')).motivo).toBe('outro');
  });

  it('avaliarQualidade: boa, ruim por perda, por jitter, por falta de pacotes e desconhecida', () => {
    const antes = amostra({ pacotesRecebidos: 100 });
    expect(avaliarQualidade(null, antes)).toBe('desconhecida');
    expect(avaliarQualidade(antes, amostra({ pacotesRecebidos: 250, jitter: 0.01 }))).toBe('boa');
    expect(avaliarQualidade(antes, amostra({ pacotesRecebidos: 200, pacotesPerdidos: 30 }))).toBe(
      'ruim',
    );
    expect(avaliarQualidade(antes, amostra({ pacotesRecebidos: 200, jitter: 0.2 }))).toBe('ruim');
    expect(avaliarQualidade(antes, amostra({ pacotesRecebidos: 200, rtt: 0.9 }))).toBe('ruim');
    // Nenhum pacote novo no intervalo: a conexão parou.
    expect(avaliarQualidade(antes, amostra({ pacotesRecebidos: 100 }))).toBe('ruim');
  });
});

describe('SessaoWebrtc — ciclo da ligação', () => {
  function criar(opcoes: { stunUrls?: string[]; tempoColetaMs?: number } = {}) {
    const navegador = provideNavegadorFalso();
    const fabrica = {
      criarConexao: (config: RTCConfiguration) => {
        const conexao = new ConexaoFalsa(config);
        navegador.conexoes.push(conexao);
        return conexao as unknown as RTCPeerConnection;
      },
      midia: () =>
        ({
          getUserMedia: () => {
            const stream = {
              getTracks: () => [faixa],
              getAudioTracks: () => [faixa],
            };
            const faixa = { kind: 'audio', enabled: true, stop: vi.fn() };
            return Promise.resolve(stream as unknown as MediaStream);
          },
        }) as unknown as MediaDevices,
    };
    const sessao = new SessaoWebrtc({ fabrica, ...opcoes });
    return { sessao, navegador };
  }

  it('responder (recebida): setRemoteDescription(oferta), resposta com CRLF final e só os dados da conexão', async () => {
    const { sessao, navegador } = criar({ stunUrls: ['stun:stun.exemplo.org:3478'] });
    await sessao.abrirMicrofone();
    const sdp = await sessao.responder('v=0\r\na=oferta-da-meta');
    const conexao = navegador.conexoes[0];
    expect(conexao.remoteDescription).toEqual({
      type: 'offer',
      sdp: 'v=0\r\na=oferta-da-meta\r\n',
    });
    expect(conexao.faixas.length).toBe(1);
    expect(conexao.config.iceServers).toEqual([{ urls: ['stun:stun.exemplo.org:3478'] }]);
    expect(sdp.endsWith('\r\n')).toBe(true);
    expect(sdp).toContain('a=resposta-falsa');
  });

  it('sem STUN configurado, não há iceServers (sem TURN)', async () => {
    const { sessao, navegador } = criar();
    await sessao.abrirMicrofone();
    await sessao.oferecer();
    expect(navegador.conexoes[0].config.iceServers).toEqual([]);
  });

  it('oferecer (feita) e aplicarResposta: a resposta da Meta vira setRemoteDescription(answer)', async () => {
    const { sessao, navegador } = criar();
    await sessao.abrirMicrofone();
    const sdp = await sessao.oferecer();
    expect(sdp).toContain('a=oferta-falsa');
    await sessao.aplicarResposta('v=0\na=resposta-da-meta');
    expect(navegador.conexoes[0].remoteDescription).toEqual({
      type: 'answer',
      sdp: 'v=0\r\na=resposta-da-meta\r\n',
    });
  });

  it('espera o fim da coleta de candidatos, mas só até o tempo limite', async () => {
    vi.useFakeTimers();
    try {
      const { sessao, navegador } = criar({ tempoColetaMs: 500 });
      await sessao.abrirMicrofone();
      const originalOferta = ConexaoFalsa.prototype.createOffer;
      ConexaoFalsa.prototype.createOffer = function (this: ConexaoFalsa) {
        this.iceGatheringState = 'gathering';
        return originalOferta.call(this);
      };
      let pronto = false;
      const promessa = sessao.oferecer().then((sdp) => {
        pronto = true;
        return sdp;
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(pronto).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      await promessa;
      expect(pronto).toBe(true);
      expect(navegador.conexoes[0].iceGatheringState).toBe('gathering');
      ConexaoFalsa.prototype.createOffer = originalOferta;
    } finally {
      vi.useRealTimers();
    }
  });

  it('termina antes do limite quando a coleta completa', async () => {
    const { sessao, navegador } = criar({ tempoColetaMs: 60_000 });
    await sessao.abrirMicrofone();
    const original = ConexaoFalsa.prototype.createOffer;
    ConexaoFalsa.prototype.createOffer = function (this: ConexaoFalsa) {
      this.iceGatheringState = 'gathering';
      setTimeout(() => {
        this.iceGatheringState = 'complete';
        this.ouvintes.get('icegatheringstatechange')?.forEach((fn) => fn());
      }, 5);
      return original.call(this);
    };
    const sdp = await sessao.oferecer();
    ConexaoFalsa.prototype.createOffer = original;
    expect(sdp).toContain('oferta-falsa');
    expect(navegador.conexoes[0].fechada).toBe(false);
  });

  it('mudo desliga a faixa sem fechar a conexão; fechar para o microfone e a conexão', async () => {
    const { sessao, navegador } = criar();
    const stream = await sessao.abrirMicrofone();
    await sessao.oferecer();
    sessao.definirMicrofoneAtivo(false);
    expect(stream.getAudioTracks()[0].enabled).toBe(false);
    expect(navegador.conexoes[0].fechada).toBe(false);
    sessao.fechar();
    expect(navegador.conexoes[0].fechada).toBe(true);
    expect((stream.getAudioTracks()[0].stop as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    sessao.fechar(); // idempotente
  });

  it('microfone negado vira ErroDeMidia', async () => {
    const fabrica = {
      criarConexao: () => ({}) as RTCPeerConnection,
      midia: () =>
        ({
          getUserMedia: () =>
            Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })),
        }) as unknown as MediaDevices,
    };
    const sessao = new SessaoWebrtc({ fabrica });
    await expect(sessao.abrirMicrofone()).rejects.toBeInstanceOf(ErroDeMidia);
  });

  it('medirQualidade: usa as estatísticas do áudio recebido', async () => {
    const { sessao, navegador } = criar();
    await sessao.abrirMicrofone();
    await sessao.oferecer();
    const conexao = navegador.conexoes[0];
    conexao.estatisticas = [
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 100, packetsLost: 0, jitter: 0.01 },
    ];
    expect(await sessao.medirQualidade()).toBe('desconhecida');
    conexao.estatisticas = [
      { type: 'inbound-rtp', kind: 'audio', packetsReceived: 200, packetsLost: 1, jitter: 0.01 },
      { type: 'remote-inbound-rtp', kind: 'audio', roundTripTime: 0.05 },
    ];
    expect(await sessao.medirQualidade()).toBe('boa');
  });
});
