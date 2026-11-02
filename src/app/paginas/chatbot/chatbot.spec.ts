import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Chatbot } from './chatbot';
import type { FluxoResumo } from './chatbot.tipos';

const fluxo = (extra: Partial<FluxoResumo> = {}): FluxoResumo => ({
  id: 'f1',
  nome: 'Boas-vindas do site',
  descricao: 'Menu inicial',
  area: 'COMERCIAL',
  canalIds: [],
  gatilho: 'NOVA_CONVERSA',
  palavrasChave: [],
  prioridade: 0,
  ativo: true,
  versaoPublicada: { id: 'v1', numero: 2, publicadaEm: '2026-10-30T12:00:00Z', publicadaPor: null },
  rascunhoNaoPublicado: false,
  passos: 5,
  criadoPor: null,
  criadoEm: '2026-10-30T12:00:00Z',
  atualizadoEm: '2026-10-30T12:00:00Z',
  rascunhoAlteradoEm: '2026-10-30T12:00:00Z',
  contadores: { total: 4, emAndamento: 1, transferidas: 2, semResposta: 0 },
  podeEditar: true,
  ...extra,
});

describe('Chatbot (lista de fluxos)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('LIDER_COMERCIAL');
  });
  afterEach(() => http.verify());

  const esperar = () => new Promise((r) => setTimeout(r, 0));

  it('mostra os fluxos com situação e versão', async () => {
    const fixture = TestBed.createComponent(Chatbot);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/chatbot/fluxos')
      .flush({
        itens: [fluxo(), fluxo({ id: 'f2', nome: 'Boleto', ativo: false, versaoPublicada: null })],
        total: 2,
        pagina: 1,
        porPagina: 20,
      });
    await esperar();
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Boas-vindas do site');
    expect(texto).toContain('Ligado');
    expect(texto).toContain('Versão 2');
    expect(texto).toContain('Nunca publicado');
    expect(texto).toContain('Nova conversa');
  });

  it('mostra o estado de erro com “Tentar de novo”', async () => {
    const fixture = TestBed.createComponent(Chatbot);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/chatbot/fluxos')
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou', requisicaoId: 'x' },
        { status: 500, statusText: 'x' },
      );
    await esperar();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Não conseguimos carregar os fluxos');
    expect(el.textContent).toContain('Tentar de novo');
  });

  it('mostra “sem acesso” quando a API responde 403', async () => {
    const fixture = TestBed.createComponent(Chatbot);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/chatbot/fluxos')
      .flush(
        { statusCode: 403, erro: 'sem_permissao', mensagem: 'Sem acesso', requisicaoId: 'x' },
        { status: 403, statusText: 'x' },
      );
    await esperar();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Você não tem acesso a isto',
    );
  });

  it('lista vazia convida a criar o primeiro fluxo', async () => {
    const fixture = TestBed.createComponent(Chatbot);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/chatbot/fluxos')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    await esperar();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum fluxo ainda');
  });
});
