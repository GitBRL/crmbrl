import { describe, expect, it } from 'vitest';

import { lerBloco, lerEventosSse } from './analise.sse';

function fluxo(...pedacos: string[]): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder();
  return new ReadableStream({
    start(controle) {
      for (const pedaco of pedacos) {
        controle.enqueue(codificador.encode(pedaco));
      }
      controle.close();
    },
  });
}

async function ler(...pedacos: string[]) {
  const eventos = [];
  for await (const bloco of lerEventosSse(fluxo(...pedacos))) {
    eventos.push(bloco);
  }
  return eventos;
}

describe('leitor de SSE', () => {
  it('separa os blocos por linha em branco e lê event e data', async () => {
    const eventos = await ler(
      'event: inicio\ndata: {"analiseId":"a1"}\n\nevent: fase\ndata: {"fase":"pensando"}\n\n',
    );
    expect(eventos).toEqual([
      { evento: 'inicio', dados: { analiseId: 'a1' } },
      { evento: 'fase', dados: { fase: 'pensando' } },
    ]);
  });

  it('junta um bloco cortado no meio entre dois pedaços (e no meio de um caractere)', async () => {
    const codificador = new TextEncoder();
    const bytes = codificador.encode('event: parcial\ndata: {"resumo":"ação"}\n\n');
    const corte = bytes.indexOf(0xc3) + 1; // no meio do "ç"
    const eventos = [];
    const corpo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, corte));
        c.enqueue(bytes.slice(corte));
        c.close();
      },
    });
    for await (const bloco of lerEventosSse(corpo)) {
      eventos.push(bloco);
    }
    expect(eventos).toEqual([{ evento: 'parcial', dados: { resumo: 'ação' } }]);
  });

  it('ignora o batimento (linhas com ":") e blocos com JSON inválido', async () => {
    const eventos = await ler(
      ': batimento\n\nevent: fase\ndata: {quebrado\n\nevent: fase\ndata: {"fase":"escrevendo"}\n\n',
    );
    expect(eventos).toEqual([{ evento: 'fase', dados: { fase: 'escrevendo' } }]);
  });

  it('aceita CRLF e entrega o último bloco mesmo sem a linha em branco final', async () => {
    const eventos = await ler('event: concluido\r\ndata: {"ok":true}');
    expect(eventos).toEqual([{ evento: 'concluido', dados: { ok: true } }]);
  });

  it('lerBloco: sem data não é evento; sem event vira "message"', () => {
    expect(lerBloco('event: fase')).toBeNull();
    expect(lerBloco('data: {"a":1}')).toEqual({ evento: 'message', dados: { a: 1 } });
  });
});
