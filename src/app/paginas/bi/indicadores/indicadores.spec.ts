import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { entrarComo, type PapelDeTeste } from '../../../nucleo/sessao/sessao-de-teste';
import { CARREGADOR_ECHARTS } from '../../../ui/grafico/grafico';
import { ROTAS_BI } from '../bi.routes';
import { Indicadores, periodoConsultavel } from './indicadores';
import { calculo, CATALOGO_DE_TESTE, painel, resultadoNumero } from './indicadores-de-teste';

const MOTOR = {
  echarts: {
    init: () => ({
      on: () => undefined,
      setOption: () => undefined,
      resize: () => undefined,
      dispose: () => undefined,
    }),
  },
};
const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('periodoConsultavel', () => {
  it('R20.3 — personalizado só consulta com as duas datas, em ordem e até 366 dias', () => {
    expect(periodoConsultavel({})).toBe(true);
    expect(periodoConsultavel({ periodo: { tipo: 'HOJE' } })).toBe(true);
    expect(
      periodoConsultavel({ periodo: { tipo: 'PERSONALIZADO', de: '2026-11-01T00:00:00Z' } }),
    ).toBe(false);
    expect(
      periodoConsultavel({
        periodo: { tipo: 'PERSONALIZADO', de: '2026-11-10T00:00:00Z', ate: '2026-11-01T00:00:00Z' },
      }),
    ).toBe(false);
    expect(
      periodoConsultavel({
        periodo: { tipo: 'PERSONALIZADO', de: '2024-01-01T00:00:00Z', ate: '2026-11-01T00:00:00Z' },
      }),
    ).toBe(false);
    expect(
      periodoConsultavel({
        periodo: { tipo: 'PERSONALIZADO', de: '2026-11-01T00:00:00Z', ate: '2026-11-10T00:00:00Z' },
      }),
    ).toBe(true);
  });
});

describe('Indicadores (página)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'bi', children: ROTAS_BI },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CARREGADOR_ECHARTS, useValue: () => Promise.resolve(MOTOR) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  const estabilizar = async (h: RouterTestingHarness) => {
    await new Promise((resolver) => setTimeout(resolver));
    responderBase();
    await new Promise((resolver) => setTimeout(resolver));
    await h.fixture.whenStable();
    h.detectChanges();
    await h.fixture.whenStable();
    h.detectChanges();
  };

  /** Responde o que a base da página pede (catálogo e opções dos filtros). */
  function responderBase() {
    http.match('/api/v1/indicadores/catalogo').forEach((p) => p.flush(CATALOGO_DE_TESTE));
    http
      .match((r) => r.url === '/api/v1/usuarios')
      .forEach((p) =>
        p.flush({
          itens: [{ id: 'u1', nome: 'Ana', area: 'COMERCIAL' }],
          total: 1,
          pagina: 1,
          porPagina: 100,
        }),
      );
    http.match((r) => r.url === '/api/v1/usuarios/equipes').forEach((p) => p.flush([]));
    http.match((r) => r.url === '/api/v1/funis').forEach((p) => p.flush([]));
    http.match((r) => r.url === '/api/v1/setores').forEach((p) => p.flush([]));
  }

  async function abrir(caminho: string, papel: PapelDeTeste = 'ADMIN') {
    entrarComo(papel);
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl(caminho, Indicadores);
    return h;
  }

  it('R33.8 — a lista mostra os painéis (meus e compartilhados) e o botão de novo painel para quem cria', async () => {
    const h = await abrir('/bi/indicadores');
    http.expectOne('/api/v1/indicadores/paineis').flush([
      painel({ id: 'p1', nome: 'Time comercial' }),
      painel({
        id: 'p2',
        nome: 'Do Rafael',
        minha: false,
        podeEditar: false,
        modelo: null,
        dono: { id: 'u9', nome: 'Rafael Mendes' },
      }),
    ]);
    responderBase();
    await estabilizar(h);
    const raiz = h.fixture.nativeElement as HTMLElement;
    expect(Array.from(raiz.querySelectorAll('.paineis__item')).map((i) => texto(i))).toHaveLength(
      2,
    );
    expect(texto(raiz)).toContain('Compartilhado · Rafael Mendes');
    expect(texto(raiz)).toContain('Novo painel');
    // Só quem pode editar vê "Excluir".
    expect(
      Array.from(raiz.querySelectorAll('.paineis__item')[1].querySelectorAll('button')).map(texto),
    ).toEqual(['Duplicar']);
  });

  it('R33.6 — o membro só vê o que foi compartilhado: sem Novo painel, sem Duplicar, sem Excluir', async () => {
    const h = await abrir('/bi/indicadores', 'COMERCIAL');
    http.expectOne('/api/v1/indicadores/paineis').flush([
      painel({
        id: 'p2',
        nome: 'Do Rafael',
        minha: false,
        podeEditar: false,
        compartilhamento: null,
      }),
    ]);
    responderBase();
    await estabilizar(h);
    const raiz = h.fixture.nativeElement as HTMLElement;
    expect(texto(raiz)).not.toContain('Novo painel');
    expect(raiz.querySelectorAll('.paineis__item button')).toHaveLength(0);
    expect(texto(raiz)).toContain('Abrir');
  });

  it('R33.8 — sem painéis: quem cria vê o modelo "Time comercial"; o membro, a explicação', async () => {
    const h = await abrir('/bi/indicadores');
    http.expectOne('/api/v1/indicadores/paineis').flush([]);
    responderBase();
    await estabilizar(h);
    expect(texto(h.fixture.nativeElement)).toContain('Criar “Time comercial”');
  });

  it('R33.8 — erro ao listar mostra o estado de erro com "Tentar de novo"', async () => {
    const h = await abrir('/bi/indicadores');
    http
      .expectOne('/api/v1/indicadores/paineis')
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'r1' },
        { status: 500, statusText: 'x' },
      );
    responderBase();
    await estabilizar(h);
    expect(texto(h.fixture.nativeElement)).toContain('Não conseguimos carregar os painéis');
  });

  it('R33.2 e R33.7 — o painel calcula pelo servidor e mostra cada indicador; o erro de um não derruba os outros', async () => {
    const h = await abrir('/bi/indicadores/p1');
    http.expectOne('/api/v1/indicadores/paineis/p1').flush(painel());
    responderBase();
    await estabilizar(h);
    const pedido = http.expectOne('/api/v1/indicadores/calcular');
    expect(pedido.request.body).toMatchObject({ painelId: 'p1' });
    pedido.flush(
      calculo([
        resultadoNumero({ id: 'w1' }),
        resultadoNumero({
          id: 'w2',
          ordem: 1,
          titulo: 'No-show',
          ok: false,
          erro: { mensagem: 'Funil não encontrado.', status: 404 },
        }),
      ]),
    );
    await estabilizar(h);
    const raiz = h.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('app-widget-indicador')).toHaveLength(2);
    expect(texto(raiz)).toContain('42');
    expect(texto(raiz)).toContain('Funil não encontrado.');
    expect(texto(raiz)).toContain('Time comercial');
    expect(texto(raiz)).toContain('Planilha (XLSX)');
  });

  it('R33.6 — painel que a pessoa não vê (404) mostra "sem acesso"', async () => {
    const h = await abrir('/bi/indicadores/zzz');
    http.expectOne('/api/v1/indicadores/paineis/zzz').flush(
      {
        statusCode: 404,
        erro: 'nao_encontrado',
        mensagem: 'Painel não encontrado.',
        requisicaoId: 'r1',
      },
      { status: 404, statusText: 'x' },
    );
    responderBase();
    await estabilizar(h);
    expect(texto(h.fixture.nativeElement)).toContain('Você não vê este painel');
  });

  it('R33.6 — quem só vê o painel não tem Editar, Compartilhar nem Excluir', async () => {
    const h = await abrir('/bi/indicadores/p1', 'COMERCIAL');
    http
      .expectOne('/api/v1/indicadores/paineis/p1')
      .flush(painel({ minha: false, podeEditar: false, compartilhamento: null }));
    responderBase();
    await estabilizar(h);
    http.expectOne('/api/v1/indicadores/calcular').flush(calculo([resultadoNumero()]));
    await estabilizar(h);
    const acoes = texto(h.fixture.nativeElement.querySelector('.cabecalho__acoes'));
    expect(acoes).not.toContain('Editar');
    expect(acoes).not.toContain('Compartilhar');
    expect(acoes).not.toContain('Excluir');
    expect(acoes).toContain('Planilha (XLSX)');
  });
});
