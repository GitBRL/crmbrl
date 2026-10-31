import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Automacoes } from './automacoes';
import type { Automacao } from './automacoes.tipos';

const esperar = () => new Promise<void>((resolver) => setTimeout(resolver, 20));

function automacao(ajustes: Partial<Automacao> = {}): Automacao {
  return {
    id: 'a1',
    nome: 'Boas-vindas ao lead',
    descricao: 'Manda um oi.',
    area: 'COMERCIAL',
    ativa: true,
    tipoGatilho: 'EVENTO',
    evento: 'contato.criado',
    gatilhoRotulo: 'Contato criado',
    gatilhoConfig: {},
    entidade: 'contato',
    condicoes: {},
    definicao: { passos: [] },
    criteriosParada: ['RESPONDEU'],
    limiteExecucao: 'UMA_VEZ',
    limitePeriodoDias: null,
    marketing: false,
    modelo: null,
    versao: 1,
    pendencias: [],
    proximaExecucaoEm: null,
    ultimaExecucaoEm: null,
    criadoPor: null,
    criadoEm: '2026-10-30T10:00:00Z',
    atualizadoEm: '2026-10-30T10:00:00Z',
    execucoes: { AGUARDANDO: 2, FALHOU: 1 },
    ...ajustes,
  };
}

describe('Automações (lista)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Automacoes>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('LIDER_COMERCIAL');
  });
  afterEach(() => http.verify());

  const html = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  async function abrir(itens: Automacao[]) {
    fixture = TestBed.createComponent(Automacoes);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/automacoes')
      .flush({ itens, total: itens.length, pagina: 1, porPagina: 20 });
    await esperar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('lista as automações com situação e resumo das execuções', async () => {
    await abrir([
      automacao(),
      automacao({ id: 'a2', nome: 'Reativação', ativa: false, execucoes: {} }),
    ]);
    expect(html()).toContain('Boas-vindas ao lead');
    expect(html()).toContain('Ligada');
    expect(html()).toContain('2 aguardando · 1 falhou');
    expect(html()).toContain('Desligada');
    expect(html()).toContain('Nenhuma ainda');
  });

  it('sem automações, oferece os modelos prontos', async () => {
    await abrir([]);
    expect(html()).toContain('Você ainda não tem automações');
    expect(html()).toContain('Ver modelos prontos');
  });

  it('sem permissão mostra o estado de sem acesso', async () => {
    fixture = TestBed.createComponent(Automacoes);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/automacoes')
      .flush(
        { statusCode: 403, erro: 'sem_permissao', mensagem: 'Sem permissão.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await esperar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.detectChanges();
    expect(html()).toContain('Você não tem acesso a isto');
  });
});
