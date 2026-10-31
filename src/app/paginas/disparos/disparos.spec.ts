import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { resumo } from './dados-de-teste';
import { Disparos } from './disparos';
import { CONTADORES_ZERADOS } from './disparos.tipos';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Disparos (lista)', () => {
  let http: HttpTestingController;
  let socket: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    socket = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('LIDER_COMERCIAL');
  });

  async function estabilizar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Deixa as microtarefas rodarem e renderiza, sem esperar requisições pendentes. */
  async function passar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
  }

  const ehLista = (r: { url: string; method: string }) =>
    r.method === 'GET' && r.url === '/api/v1/disparos/campanhas';

  async function abrir(itens: ReturnType<typeof resumo>[], total = itens.length) {
    const fixture = TestBed.createComponent(Disparos);
    fixture.detectChanges();
    http.expectOne(ehLista).flush({ itens, total, pagina: 1, porPagina: 20 });
    await estabilizar(fixture);
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('lista as campanhas com situação, andamento e resultado', async () => {
    const { raiz } = await abrir([
      resumo('a', { nome: 'Oferta de renovação' }),
      resumo('b', {
        nome: 'Convite',
        status: 'AGENDADA',
        agendadaPara: '2026-12-01T13:00:00.000Z',
        contadores: { ...CONTADORES_ZERADOS },
      }),
    ]);
    const conteudo = texto(raiz);
    expect(conteudo).toContain('Oferta de renovação');
    expect(conteudo).toContain('Em andamento');
    expect(conteudo).toContain('40% · 4 de 10');
    expect(conteudo).toContain('Agendada');
    expect(conteudo).toContain('2 campanhas');
    expect(raiz.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('40');
  });

  it('sem campanhas mostra o convite para criar a primeira', async () => {
    const { raiz } = await abrir([]);
    expect(texto(raiz)).toContain('Nenhuma campanha ainda');
    expect(raiz.querySelector('a[href="/disparos/novo"]')).not.toBeNull();
  });

  it('falha de acesso (403) mostra o estado sem acesso', async () => {
    const fixture = TestBed.createComponent(Disparos);
    fixture.detectChanges();
    http
      .expectOne(ehLista)
      .flush(
        { statusCode: 403, erro: 'sem_permissao', mensagem: 'x' },
        { status: 403, statusText: 'Forbidden' },
      );
    await estabilizar(fixture);
    expect(texto(fixture.nativeElement)).toContain('Você não tem acesso aos Disparos');
  });

  it('filtra por situação mandando a lista separada por vírgula', async () => {
    const { fixture, raiz } = await abrir([resumo('a')]);
    const botoes = [...raiz.querySelectorAll('app-filtros-pilula button')] as HTMLButtonElement[];
    botoes.find((b) => texto(b) === 'Pausada')?.click();
    await passar(fixture);
    const pedido = http.expectOne(ehLista);
    expect(pedido.request.params.get('status')).toBe('PAUSADA');
    pedido.flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    await estabilizar(fixture);
    expect(texto(raiz)).toContain('Nenhuma campanha com esses filtros');
  });

  it('atualiza o andamento ao vivo (campanha.progresso), ignorando eventos repetidos', async () => {
    const { fixture, raiz } = await abrir([resumo('a')]);
    socket.ultimo().simularConexao();
    const evento = {
      campanhaId: 'a',
      status: 'EM_ANDAMENTO',
      contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 2, enviados: 8 },
      proximoEnvioEm: null,
      pausaMotivo: null,
      em: '2026-10-30T12:05:00.000Z',
    };
    socket.ultimo().receber('campanha.progresso', evento);
    await estabilizar(fixture);
    expect(texto(raiz)).toContain('80% · 8 de 10');
    // o mesmo `em` de novo, com números diferentes, não vale
    socket.ultimo().receber('campanha.progresso', {
      ...evento,
      contadores: { ...evento.contadores, enviados: 1 },
    });
    await estabilizar(fixture);
    expect(texto(raiz)).toContain('80% · 8 de 10');
  });

  it('mudança de situação pelo tempo real recarrega a lista (os botões dependem dela)', async () => {
    const { fixture } = await abrir([resumo('a')]);
    socket.ultimo().simularConexao();
    socket.ultimo().receber('campanha.progresso', {
      campanhaId: 'a',
      status: 'PAUSADA',
      contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 6, enviados: 4 },
      proximoEnvioEm: null,
      pausaMotivo: 'falhas',
      em: '2026-10-30T12:06:00.000Z',
    });
    await passar(fixture);
    http
      .expectOne(ehLista)
      .flush({ itens: [resumo('a', { status: 'PAUSADA' })], total: 1, pagina: 1, porPagina: 20 });
    await estabilizar(fixture);
    expect(texto(fixture.nativeElement)).toContain('Pausada');
  });
});
