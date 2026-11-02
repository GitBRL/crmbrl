/**
 * Leitor de Server-Sent Events sobre `fetch` (o `EventSource` não faz POST). Os blocos vêm
 * separados por linha em branco; cada um tem linhas `event: X` e `data: {json}`. Linhas que
 * começam com ":" são o batimento do servidor e são ignoradas. Blocos com JSON inválido
 * também (um evento corrompido não derruba a leitura).
 */
export interface BlocoSse {
  readonly evento: string;
  readonly dados: unknown;
}

export function lerBloco(bloco: string): BlocoSse | null {
  let evento = 'message';
  const dados: string[] = [];
  for (const linha of bloco.split('\n')) {
    if (linha === '' || linha.startsWith(':')) {
      continue;
    }
    const dois = linha.indexOf(':');
    const campo = dois === -1 ? linha : linha.slice(0, dois);
    const valor = dois === -1 ? '' : linha.slice(dois + 1).replace(/^ /, '');
    if (campo === 'event') {
      evento = valor;
    } else if (campo === 'data') {
      dados.push(valor);
    }
  }
  if (dados.length === 0) {
    return null;
  }
  try {
    return { evento, dados: JSON.parse(dados.join('\n')) };
  } catch {
    return null;
  }
}

export async function* lerEventosSse(
  corpo: ReadableStream<Uint8Array>,
): AsyncGenerator<BlocoSse, void, undefined> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let pendente = '';
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      pendente += decodificador.decode(value, { stream: !done }).replace(/\r\n?/g, '\n');
      let fim = pendente.indexOf('\n\n');
      while (fim !== -1) {
        const bloco = lerBloco(pendente.slice(0, fim));
        pendente = pendente.slice(fim + 2);
        if (bloco) {
          yield bloco;
        }
        fim = pendente.indexOf('\n\n');
      }
      if (done) {
        break;
      }
    }
    const resto = lerBloco(pendente);
    if (resto) {
      yield resto;
    }
  } finally {
    leitor.cancel().catch(() => undefined);
  }
}
