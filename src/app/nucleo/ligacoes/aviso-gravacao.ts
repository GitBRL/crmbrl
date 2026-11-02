/**
 * Áudio de aviso da gravação (Onda E, E3): quando o canal tem um áudio de aviso ("esta ligação
 * pode ser gravada"), ele toca **para o cliente** ao atender. O som é misturado na saída do
 * microfone (troca a faixa enviada pela conexão por uma mistura microfone + aviso e devolve a
 * original no fim); o atendente não ouve, porque a mistura nunca vai para o alto-falante.
 */

export interface AvisoEmExecucao {
  /** Resolve quando o aviso terminou (ou foi cancelado). */
  readonly terminou: Promise<void>;
  cancelar(): void;
}

export interface DependenciasDoAviso {
  criarContexto(): AudioContext;
}

export function tocarAvisoParaOCliente(
  dependencias: DependenciasDoAviso,
  microfone: MediaStream,
  conexao: RTCPeerConnection,
  audio: ArrayBuffer,
): AvisoEmExecucao {
  let cancelado = false;
  let limpar: () => void = () => undefined;
  const terminou = (async () => {
    const contexto = dependencias.criarContexto();
    const emissor = conexao.getSenders().find((item) => item.track?.kind === 'audio');
    const original = emissor?.track ?? null;
    let trocou = false;
    limpar = () => {
      cancelado = true;
    };
    try {
      const buffer = await contexto.decodeAudioData(audio.slice(0));
      if (cancelado || !emissor) {
        return;
      }
      const destino = contexto.createMediaStreamDestination();
      const voz = microfone.getAudioTracks().length > 0 ? microfone : null;
      const fonteVoz = voz ? contexto.createMediaStreamSource(voz) : null;
      fonteVoz?.connect(destino);
      const aviso = contexto.createBufferSource();
      aviso.buffer = buffer;
      aviso.connect(destino);
      const faixa = destino.stream.getAudioTracks()[0];
      if (!faixa) {
        return;
      }
      await emissor.replaceTrack(faixa);
      trocou = true;
      await new Promise<void>((resolver) => {
        limpar = () => {
          cancelado = true;
          try {
            aviso.stop();
          } catch {
            // ainda não começou
          }
          resolver();
        };
        aviso.onended = () => resolver();
        aviso.start();
      });
    } finally {
      if (trocou && emissor) {
        // Devolve o microfone (que pode ter sido trocado no meio do aviso).
        const atual = microfone.getAudioTracks()[0] ?? original;
        try {
          await emissor.replaceTrack(atual);
        } catch {
          // a conexão já acabou
        }
      }
      void contexto.close?.().catch?.(() => undefined);
    }
  })().catch(() => undefined);
  return { terminou, cancelar: () => limpar() };
}
