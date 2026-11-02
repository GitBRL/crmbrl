import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { ROTAS_BI } from '../bi.routes';
import { HistoricoAnalises } from './historico-analises';
import type { ItemHistorico } from './analise.tipos';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const item = (id: string, extra: Partial<ItemHistorico> = {}): ItemHistorico => ({
  id,
  usuario: { id: 'u1', nome: 'Administrador' },
  painel: 'comercial',
  periodo: { de: '2026-10-01T03:00:00.000Z', ate: '2026-10-31T03:00:00.000Z' },
  filtros: {},
  status: 'CONCLUIDA',
  erro: null,
  resumo: `Resumo ${id}`,
  modelo: 'claude-opus-5-5',
  tentativas: 1,
  totalPerguntas: 2,
  tokens: null,
  duracaoMs: 3000,
  criadoEm: '2026-10-20T12:00:00.000Z',
  concluidoEm: '2026-10-20T12:00:03.000Z',
  ...extra,
});

const ESTADO = {
  configurada: true,
  comoConfigurar: null,
  disponivel: true,
  motivo: null,
  modelo: 'claude-opus-5-5',
  limiteDiario: 20,
  usadasHoje: 3,
  restantesHoje: 17,
  maxPerguntasPorAnalise: 5,
};

/** Membros protegidos que o teste aciona direto. */
interface Interno {
  painel: { set(v: string): void };
  limite: { set(v: string | number): void };
  mudarFiltro(): void;
  salvarLimite(): Promise<void>;
}

describe('Histórico das análises com IA', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'bi', children: ROTAS_BI },
          { path: 'sem-acesso', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => TestBed.resetTestingModule());

  const estabilizar = async (harness: RouterTestingHarness) => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      harness.detectChanges();
    }
    await harness.fixture.whenStable();
  };

  async function abrir() {
    entrarComo('ADMIN');
    const harness = await RouterTestingHarness.create();
    const comp = await harness.navigateByUrl('/bi/analises', HistoricoAnalises);
    await estabilizar(harness);
    http.expectOne('/api/v1/bi/analise/estado').flush(ESTADO);
    http
      .expectOne((r) => r.url === '/api/v1/usuarios')
      .flush({
        itens: [{ id: 'u1', nome: 'Administrador', area: null }],
        total: 1,
        pagina: 1,
        porPagina: 100,
      });
    return { harness, comp: comp as unknown as Interno };
  }

  const lista = (itens: ItemHistorico[], total = itens.length) => ({
    itens,
    total,
    pagina: 1,
    porPagina: 20,
  });

  it('lista as análises com quem pediu, painel, situação e perguntas', async () => {
    const { harness, comp } = await abrir();
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/analise/historico');
    expect(pedido.request.params.get('pagina')).toBe('1');
    expect(pedido.request.params.has('painel')).toBe(false);
    pedido.flush(
      lista([item('a1'), item('a2', { status: 'FALHOU', resumo: null, erro: 'Demorou' })]),
    );
    await estabilizar(harness);
    const raiz = harness.fixture.nativeElement as HTMLElement;
    const linhas = texto(raiz.querySelector('app-tabela'));
    expect(linhas).toContain('Resumo a1');
    expect(linhas).toContain('Comercial');
    expect(linhas).toContain('Concluída');
    expect(linhas).toContain('Falhou');
    expect(linhas).toContain('Demorou');
    expect(texto(raiz)).toContain('3 usadas hoje');
  });

  it('o filtro de painel refaz a consulta na página 1', async () => {
    const { harness, comp } = await abrir();
    http.expectOne((r) => r.url === '/api/v1/bi/analise/historico').flush(lista([item('a1')]));
    await estabilizar(harness);
    comp.painel.set('atendimento');
    comp.mudarFiltro();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/analise/historico');
    expect(pedido.request.params.get('painel')).toBe('atendimento');
    pedido.flush(lista([]));
    await estabilizar(harness);
    expect(texto(harness.fixture.nativeElement)).toContain('Nenhuma análise com esses filtros');
  });

  it('sem análises e sem filtros: orienta a usar o botão do BI', async () => {
    const { harness, comp } = await abrir();
    http.expectOne((r) => r.url === '/api/v1/bi/analise/historico').flush(lista([]));
    await estabilizar(harness);
    expect(texto(harness.fixture.nativeElement)).toContain('Nenhuma análise ainda');
  });

  it('salva o limite diário (0 a 1000) com PUT e valida antes', async () => {
    const { harness, comp } = await abrir();
    http.expectOne((r) => r.url === '/api/v1/bi/analise/historico').flush(lista([]));
    await estabilizar(harness);
    comp.limite.set(5000);
    await comp.salvarLimite();
    http.expectNone('/api/v1/bi/analise/configuracao');
    comp.limite.set(0);
    const salvando = comp.salvarLimite();
    const put = http.expectOne('/api/v1/bi/analise/configuracao');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ limiteDiario: 0 });
    put.flush({ ...ESTADO, limiteDiario: 0, disponivel: false });
    await salvando;
  });

  it('a rota é só do Admin', async () => {
    entrarComo('C_LEVEL');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bi/analises');
    expect(TestBed.inject(Router).url).toContain('/sem-acesso');
    expect(http.match(() => true)).toHaveLength(0);
  });
});
