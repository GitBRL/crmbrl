import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { RespostaSaude } from './saude';
import { MENSAGENS_SAUDE, SaudeService, URL_SAUDE } from './saude.service';

const RESPOSTA_OK: RespostaSaude = {
  status: 'ok',
  versao: '0.0.1',
  ambiente: 'development',
  horario: '2026-10-20T18:00:00.000Z',
  uptimeSegundos: 42,
  banco: { status: 'ok', latenciaMs: 3 },
  migrations: { aplicadas: 1, ultima: '20261020180000_inicial' },
};

describe('SaudeService', () => {
  let http: HttpTestingController;
  let saude: SaudeService;

  beforeEach(() => {
    // O detalhe técnico do erro vai para o console (conferido abaixo); aqui só não polui.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    saude = TestBed.inject(SaudeService);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('consulta ao nascer e fica "ok" com a resposta', () => {
    expect(saude.carregando()).toBe(true);
    expect(saude.situacao()).toBe('carregando');
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    expect(saude.carregando()).toBe(false);
    expect(saude.situacao()).toBe('ok');
    expect(saude.dados()?.migrations?.ultima).toBe('20261020180000_inicial');
    expect(saude.atualizadoEm()).toBeInstanceOf(Date);
  });

  it('503 com o corpo da saúde é "degradado", não erro', () => {
    const degradada: RespostaSaude = {
      ...RESPOSTA_OK,
      status: 'degradado',
      banco: { status: 'erro', erro: 'conexão recusada' },
      migrations: null,
    };
    http.expectOne(URL_SAUDE).flush(degradada, { status: 503, statusText: 'Service Unavailable' });
    expect(saude.erro()).toBeNull();
    expect(saude.situacao()).toBe('degradado');
    expect(saude.dados()?.banco?.erro).toBe('conexão recusada');
  });

  it('corpo mínimo { status } (quem não é Admin) vale: "ok", e "degradado" no 503', () => {
    http.expectOne(URL_SAUDE).flush({ status: 'ok' });
    expect(saude.situacao()).toBe('ok');
    expect(saude.dados()?.banco).toBeUndefined();
    saude.recarregar();
    http
      .expectOne(URL_SAUDE)
      .flush({ status: 'degradado' }, { status: 503, statusText: 'Service Unavailable' });
    expect(saude.erro()).toBeNull();
    expect(saude.situacao()).toBe('degradado');
  });

  it('API fora do ar vira "indisponivel" com mensagem sem jargão; recarregar() tenta de novo', () => {
    http.expectOne(URL_SAUDE).error(new ProgressEvent('error'), { status: 0 });
    expect(saude.situacao()).toBe('indisponivel');
    expect(saude.erro()).toBe('O servidor do CRM não respondeu.');
    // O detalhe técnico fica no console, para quem investiga.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('/api/saude'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 0'));
    saude.recarregar();
    expect(saude.carregando()).toBe(true);
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    expect(saude.situacao()).toBe('ok');
    expect(saude.erro()).toBeNull();
  });

  it('erro de proxy (502) também é "o servidor não respondeu"', () => {
    http.expectOne(URL_SAUDE).flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    expect(saude.situacao()).toBe('indisponivel');
    expect(saude.erro()).toBe(MENSAGENS_SAUDE.semResposta);
  });

  it('404 e outros status são "o servidor respondeu com erro", sem citar a rota', () => {
    http.expectOne(URL_SAUDE).flush('Not Found', { status: 404, statusText: 'Not Found' });
    expect(saude.erro()).toBe('O servidor do CRM respondeu com erro.');
    expect(saude.erro()).not.toContain('/api');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 404'));
  });
});

describe('SaudeService (tempo limite)', () => {
  it('sem resposta em 8 s vira "indisponivel" com "demorou demais"', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      const http = TestBed.inject(HttpTestingController);
      const saude = TestBed.inject(SaudeService);
      const pedido = http.expectOne(URL_SAUDE);

      vi.advanceTimersByTime(7999);
      expect(saude.carregando()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(pedido.cancelled).toBe(true);
      expect(saude.situacao()).toBe('indisponivel');
      expect(saude.erro()).toBe('O servidor demorou demais para responder.');
      http.verify();
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
