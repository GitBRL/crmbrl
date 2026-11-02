import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AjudaApi, interpretarEventoPergunta } from './ajuda.api';
import type { EventoPergunta } from './ajuda.tipos';

function resposta(corpo: string, init: ResponseInit = {}): Response {
  return new Response(corpo, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    ...init,
  });
}

async function coletar(gerador: AsyncGenerator<EventoPergunta>): Promise<EventoPergunta[]> {
  const eventos: EventoPergunta[] = [];
  for await (const e of gerador) {
    eventos.push(e);
  }
  return eventos;
}

describe('AjudaApi', () => {
  let api: AjudaApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AjudaApi);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('interpreta os eventos do streaming', () => {
    expect(
      interpretarEventoPergunta({
        evento: 'inicio',
        dados: { conversaId: 'c1', perguntaId: 'p1', conversaNova: true, modelo: 'm' },
      }),
    ).toEqual({
      evento: 'inicio',
      conversaId: 'c1',
      perguntaId: 'p1',
      conversaNova: true,
      modelo: 'm',
    });
    expect(interpretarEventoPergunta({ evento: 'parcial', dados: { resposta: 'Oi' } })).toEqual({
      evento: 'parcial',
      resposta: 'Oi',
    });
    expect(
      interpretarEventoPergunta({
        evento: 'erro',
        dados: { codigo: 'tempo_esgotado', mensagem: 'x' },
      }),
    ).toMatchObject({ evento: 'erro', codigo: 'tempo_esgotado', conversaId: null });
    expect(interpretarEventoPergunta({ evento: 'desconhecido', dados: {} })).toBeNull();
  });

  it('envia a pergunta, a tela e a conversa; devolve os eventos em ordem', async () => {
    const fetchFalso = vi.fn(() =>
      Promise.resolve(
        resposta(
          ': batimento\n\nevent: inicio\ndata: {"conversaId":"c1","perguntaId":"p1","conversaNova":true}\n\n' +
            'event: parcial\ndata: {"resposta":"Olá"}\n\n' +
            'event: concluido\ndata: {"conversaId":"c1","perguntaId":"p1","resposta":"Olá!","resolvido":true,"categoria":"duvida_de_uso","resumoDoPedido":null,"podeAbrirChamado":false,"restantesHoje":9}\n\n',
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const eventos = await coletar(
      api.perguntar('Como crio?', '/funis/comercial', 'c0', new AbortController().signal),
    );
    expect(eventos.map((e) => e.evento)).toEqual(['inicio', 'parcial', 'concluido']);
    const [url, opcoes] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/assistente/perguntas');
    expect(opcoes.credentials).toBe('include');
    expect(JSON.parse(opcoes.body as string)).toEqual({
      pergunta: 'Como crio?',
      tela: '/funis/comercial',
      conversaId: 'c0',
    });
  });

  it('erro antes do streaming vira ErroApi com o motivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 429,
              erro: 'muitas_requisicoes',
              mensagem: 'Limite',
              detalhes: { regra: 'R25', motivo: 'limite_diario' },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
          ),
        ),
      ),
    );
    await expect(
      coletar(api.perguntar('x?', '/inicio', null, new AbortController().signal)),
    ).rejects.toMatchObject({ status: 429, detalhes: { motivo: 'limite_diario' } });
  });

  it('sem rede: ErroApi de status 0; abortado: termina em silêncio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(
      coletar(api.perguntar('x?', '/inicio', null, new AbortController().signal)),
    ).rejects.toMatchObject({ status: 0 });
    const controle = new AbortController();
    controle.abort();
    expect(await coletar(api.perguntar('x?', '/inicio', null, controle.signal))).toEqual([]);
  });
});
