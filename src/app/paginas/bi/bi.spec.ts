import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CARREGADOR_ECHARTS } from '../../ui/grafico/grafico';
import { entrarComo, type PapelDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { PAINEIS_DE_TESTE } from './bi-de-teste';
import { Bi } from './bi';
import { ROTAS_BI } from './bi.routes';
import type { IdPainel } from './bi.tipos';
import { diaLocal } from './filtros-bi';

// O ECharts não desenha no jsdom: um motor falso guarda a opção e devolve os cliques.
const grafico = {
  opcoes: [] as unknown[],
  aoClicar: null as ((p: unknown) => void) | null,
};
const MOTOR_FALSO = {
  echarts: {
    init: () => ({
      on: (_: string, f: (p: unknown) => void) => (grafico.aoClicar = f),
      setOption: (opcao: unknown) => grafico.opcoes.push(opcao),
      resize: () => undefined,
      dispose: () => undefined,
    }),
  },
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('BI (página)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    grafico.opcoes = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'bi', children: ROTAS_BI },
          { path: '**', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CARREGADOR_ECHARTS, useValue: () => Promise.resolve(MOTOR_FALSO) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  const estabilizar = async (harness: RouterTestingHarness) => {
    await new Promise((resolver) => setTimeout(resolver));
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
  };

  /** Abre `/bi/...`, responde a lista de painéis e as listas dos filtros. */
  async function abrir(
    caminho: string,
    paineis: readonly IdPainel[],
    papel: PapelDeTeste = 'ADMIN',
    responder = true,
  ) {
    entrarComo(papel);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(caminho, Bi);
    http.expectOne('/api/v1/bi/paineis').flush({ paineis });
    await estabilizar(harness);
    for (const [url, corpo] of [
      [
        '/api/v1/usuarios',
        {
          itens: [
            { id: 'u1', nome: 'Lucas Pereira', area: 'COMERCIAL' },
            { id: 'u2', nome: 'Marina Costa', area: 'COMERCIAL' },
          ],
          total: 2,
          pagina: 1,
          porPagina: 100,
        },
      ],
      [
        '/api/v1/usuarios/equipes',
        [
          {
            lider: {
              usuario: {
                id: 'l1',
                nome: 'Rafael Mendes',
                papel: 'LIDER_COMERCIAL',
                area: 'COMERCIAL',
              },
            },
          },
        ],
      ],
      [
        '/api/v1/funis',
        [
          { id: 'f1', nome: 'Comercial', area: 'COMERCIAL', ativo: true },
          { id: 'f2', nome: 'Renovação', area: 'COMERCIAL', ativo: true },
        ],
      ],
      ['/api/v1/atendimento/canais', [{ id: 'c1', nome: 'WhatsApp Vendas' }]],
      ['/api/v1/atendimento/filas', [{ id: 'q1', nome: 'Vendas', area: 'COMERCIAL' }]],
    ] as const) {
      for (const pedido of http.match((r) => r.url === url)) {
        pedido.flush(corpo);
      }
    }
    const raiz = harness.fixture.nativeElement as HTMLElement;
    if (responder) {
      const painel = (caminho.split('/')[2] ?? paineis[0]) as IdPainel;
      http.expectOne((r) => r.url === `/api/v1/bi/${painel}`).flush(PAINEIS_DE_TESTE[painel]);
      await estabilizar(harness);
    }
    return { harness, raiz };
  }

  it('uma aba por painel do papel e o primeiro abre sozinho, com o período dos últimos 30 dias', async () => {
    entrarComo('ADMIN');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bi', Bi);
    http
      .expectOne('/api/v1/bi/paineis')
      .flush({ paineis: ['marketing', 'comercial', 'cs', 'atendimento', 'financeiro'] });
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/marketing');
    expect(pedido.request.params.get('comparar')).toBe('true');
    expect(pedido.request.params.get('de')).toBe(
      new Date(`${diaLocal(29)}T00:00:00`).toISOString(),
    );
    const amanha = new Date();
    amanha.setHours(0, 0, 0, 0);
    amanha.setDate(amanha.getDate() + 1);
    expect(pedido.request.params.get('ate')).toBe(amanha.toISOString());
    // Filtros que o painel de Marketing não usa não vão na consulta.
    expect(pedido.request.params.has('filaId')).toBe(false);
    pedido.flush(PAINEIS_DE_TESTE.marketing);
    await estabilizar(harness);
    const raiz = harness.fixture.nativeElement as HTMLElement;
    expect([...raiz.querySelectorAll('[role="tab"]')].map(texto)).toEqual([
      'Marketing',
      'Comercial',
      'Sucesso do cliente',
      'Atendimento',
      'Financeiro',
    ]);
    expect(texto(raiz.querySelector('app-indicador .indicador__legenda'))).toBe('Leads');
    http.match(() => true);
  });

  it('cartões com variação (cor pelo melhor sentido) e os de agora em outro grupo', async () => {
    const { raiz } = await abrir('/bi/comercial', ['comercial']);
    const grupos = [...raiz.querySelectorAll('app-bi-painel .painel__subtitulo')].map(texto);
    expect(grupos[0]).toBe('No período');
    expect(grupos[1]).toContain('Agora');
    const doPeriodo = [
      ...raiz.querySelectorAll('app-bi-painel section:first-of-type app-indicador'),
    ];
    expect(doPeriodo.map((c) => texto(c.querySelector('.indicador__legenda')))).toEqual([
      'Negócios novos',
      'Ciclo médio',
    ]);
    const selos = [...raiz.querySelectorAll('.indicador__variacao')];
    expect(selos.map((s) => texto(s.querySelector('span[aria-hidden="true"]')))).toEqual([
      '104%',
      '15%',
    ]);
    // O ciclo médio caiu: menor é melhor, então a queda é boa (mesma cor da alta de novos).
    expect(selos[0].className).toBe(selos[1].className);
    // Os de agora não têm variação.
    expect(
      raiz.querySelectorAll('app-bi-painel section:nth-of-type(2) .indicador__variacao').length,
    ).toBe(0);
    expect(texto(raiz.querySelector('app-bi-painel .painel__periodo'))).toContain('comparado com');
  });

  it('gráficos com a alternativa em números e o texto do clique', async () => {
    const { raiz, harness } = await abrir('/bi/comercial', ['comercial']);
    expect(raiz.querySelectorAll('app-grafico').length).toBe(1);
    expect(raiz.querySelector('app-grafico [role="img"]')?.getAttribute('aria-label')).toContain(
      'Funil',
    );
    expect(raiz.textContent).toContain(
      'Clique numa barra ou numa linha para ver os negócios daquela etapa.',
    );
    const numeros = [...raiz.querySelectorAll<HTMLElement>('[role="radio"]')].find(
      (e) => texto(e) === 'Números',
    );
    numeros?.click();
    await estabilizar(harness);
    expect(raiz.querySelectorAll('app-grafico').length).toBe(0);
    expect(texto(raiz.querySelector('app-bi-painel app-tabela'))).toContain('Proposta');
  });

  it('cenário 78 — clicar numa barra do funil abre os negócios da etapa', async () => {
    const { harness } = await abrir('/bi/comercial', ['comercial']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    grafico.aoClicar?.({
      name: 'Novo',
      seriesName: 'Negócios',
      dataIndex: 0,
      data: { value: 9, id: 'e1' },
    });
    expect(navegar).toHaveBeenCalledWith(['/funis', 'comercial'], {
      queryParams: { etapaId: 'e1' },
    });
    await estabilizar(harness);
  });

  it('clicar numa pessoa do ranking vira o filtro Responsável e consulta de novo', async () => {
    const { harness, raiz } = await abrir('/bi/comercial', ['comercial']);
    const linha = [
      ...raiz.querySelectorAll<HTMLElement>(
        'app-bi-painel app-tabela button, app-bi-painel app-tabela a',
      ),
    ].find((e) => texto(e).includes('Marina Costa'));
    expect(linha).toBeDefined();
    linha?.click();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/comercial');
    expect(pedido.request.params.get('pessoaId')).toBe('u2');
    pedido.flush(PAINEIS_DE_TESTE.comercial);
    await estabilizar(harness);
  });

  it('trocar de aba abre outro painel e zera funil, canal e fila', async () => {
    const { harness, raiz } = await abrir('/bi/comercial', ['comercial', 'atendimento']);
    [...raiz.querySelectorAll<HTMLElement>('[role="tab"]')]
      .find((e) => texto(e) === 'Atendimento')
      ?.click();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/atendimento');
    expect(pedido.request.params.has('funilId')).toBe(false);
    pedido.flush(PAINEIS_DE_TESTE.atendimento);
    await estabilizar(harness);
    expect(TestBed.inject(Router).url).toBe('/bi/atendimento');
    expect(raiz.textContent).toContain('Conversas em aberto');
  });

  it('painel do SDR: cartões, gráficos, bloco de tokens só com a coluna e filtro de canal', async () => {
    const { harness, raiz } = await abrir('/bi/sdr', ['atendimento', 'sdr']);
    expect(raiz.textContent).toContain('Atendidas pela IA');
    expect(raiz.textContent).toContain('Em atendimento agora');
    expect(raiz.textContent).toContain('Conversas da IA por dia');
    expect(raiz.textContent).toContain('Tokens gastos por dia');
    expect(raiz.textContent).toContain('Motivos das passagens');
    expect(grafico.opcoes.length).toBeGreaterThanOrEqual(4);
    // Sem a coluna de tokens (quem não vê o custo), o bloco some.
    const semCusto = {
      ...PAINEIS_DE_TESTE.sdr,
      tabelas: {
        ...PAINEIS_DE_TESTE.sdr.tabelas,
        porDia: {
          ...PAINEIS_DE_TESTE.sdr.tabelas['porDia'],
          colunas: PAINEIS_DE_TESTE.sdr.tabelas['porDia'].colunas.filter(
            (c) => c.chave !== 'tokens',
          ),
        },
      },
    };
    [...raiz.querySelectorAll<HTMLElement>('[role="radio"]')]
      .find((e) => texto(e) === '7 dias')
      ?.click();
    await estabilizar(harness);
    http.expectOne((r) => r.url === '/api/v1/bi/sdr').flush(semCusto);
    await estabilizar(harness);
    expect(raiz.textContent).not.toContain('Tokens gastos por dia');
    expect(raiz.textContent).toContain('Conversas da IA por dia');
  });

  it('o período de 7 dias refaz a consulta', async () => {
    const { harness, raiz } = await abrir('/bi/comercial', ['comercial']);
    [...raiz.querySelectorAll<HTMLElement>('[role="radio"]')]
      .find((e) => texto(e) === '7 dias')
      ?.click();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/comercial');
    expect(pedido.request.params.get('de')).toBe(new Date(`${diaLocal(6)}T00:00:00`).toISOString());
    pedido.flush(PAINEIS_DE_TESTE.comercial);
  });

  it('só o filtro que o papel pode usar aparece: o membro não vê equipe nem área', async () => {
    const { raiz, harness } = await abrir(
      '/bi/comercial',
      ['comercial', 'atendimento'],
      'COMERCIAL',
    );
    expect(http.match((r) => r.url === '/api/v1/usuarios/equipes').length).toBe(0);
    [...raiz.querySelectorAll<HTMLElement>('button')]
      .find((e) => texto(e).startsWith('Mais filtros'))
      ?.click();
    await estabilizar(harness);
    const rotulos = [...raiz.querySelectorAll('.filtros__mais label')].map(texto);
    expect(rotulos).not.toContain('Equipe');
    expect(rotulos).not.toContain('Área');
    expect(rotulos).toContain('Responsável');
    expect(rotulos).toContain('Funil');
  });

  it('painel que o papel não vê: aviso de sem acesso, sem pedir os números', async () => {
    const { raiz } = await abrir('/bi/financeiro', ['marketing'], 'MARKETING', false);
    expect(texto(raiz)).toContain('Você não vê este painel');
    expect(http.match((r) => r.url === '/api/v1/bi/financeiro').length).toBe(0);
  });

  it('403 da API vira "sem acesso"; erro do servidor tem código e "Tentar de novo"', async () => {
    const { raiz, harness } = await abrir('/bi/cs', ['cs'], 'ADMIN', false);
    http
      .expectOne((r) => r.url === '/api/v1/bi/cs')
      .flush(
        { statusCode: 403, erro: 'sem_permissao', mensagem: 'Sem acesso.', requisicaoId: 'r1' },
        { status: 403, statusText: 'Proibido' },
      );
    await estabilizar(harness);
    expect(texto(raiz)).toContain('Você não vê este painel');
  });

  it('erro do servidor: mensagem, código e nova tentativa', async () => {
    const { raiz, harness } = await abrir('/bi/cs', ['cs'], 'ADMIN', false);
    http
      .expectOne((r) => r.url === '/api/v1/bi/cs')
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'req-7' },
        { status: 500, statusText: 'Erro' },
      );
    await estabilizar(harness);
    expect(texto(raiz)).toContain('Não conseguimos carregar este painel');
    expect(texto(raiz)).toContain('req-7');
    [...raiz.querySelectorAll<HTMLElement>('button')]
      .find((e) => texto(e) === 'Tentar de novo')
      ?.click();
    await estabilizar(harness);
    http.expectOne((r) => r.url === '/api/v1/bi/cs').flush(PAINEIS_DE_TESTE.cs);
    await estabilizar(harness);
    expect(texto(raiz)).toContain('Renovados');
  });

  it('sem nenhum painel: aviso de sem acesso', async () => {
    entrarComo('ADMIN');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/bi', Bi);
    http.expectOne('/api/v1/bi/paineis').flush({ paineis: [] });
    await estabilizar(harness);
    expect(texto(harness.fixture.nativeElement)).toContain('Nenhum painel disponível');
  });

  it('exportar planilha: pede à API com os filtros e baixa o arquivo pela URL devolvida', async () => {
    const { raiz, harness } = await abrir('/bi/comercial', ['comercial']);
    const clicar = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    [...raiz.querySelectorAll<HTMLElement>('button')]
      .find((e) => texto(e).includes('Planilha'))
      ?.click();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/comercial/exportar');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body.formato).toBe('xlsx');
    expect(pedido.request.body.comparar).toBe(true);
    expect(pedido.request.body.tabela).toBeUndefined();
    pedido.flush({
      id: 'a1',
      nome: 'bi-comercial.xlsx',
      mime: 'x',
      tamanho: 10,
      url: '/api/v1/arquivos/a1',
    });
    await estabilizar(harness);
    expect(clicar).toHaveBeenCalledTimes(1);
    clicar.mockRestore();
  });

  it('baixar uma tabela em CSV manda a chave da tabela', async () => {
    const { raiz, harness } = await abrir('/bi/comercial', ['comercial']);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    raiz.querySelector<HTMLElement>('button[aria-label="Baixar Ranking em CSV"]')?.click();
    await estabilizar(harness);
    const pedido = http.expectOne((r) => r.url === '/api/v1/bi/comercial/exportar');
    expect(pedido.request.body).toMatchObject({ formato: 'csv', tabela: 'ranking' });
    pedido.flush({
      id: 'a2',
      nome: 'ranking.csv',
      mime: 'text/csv',
      tamanho: 1,
      url: '/api/v1/arquivos/a2',
    });
  });

  it('"Analisar com IA" aparece só para o Admin e abre o modal com o estado da IA', async () => {
    const { harness, raiz } = await abrir('/bi/comercial', ['comercial', 'cs']);
    const botao = Array.from(raiz.querySelectorAll('button')).find(
      (b) => texto(b) === 'Analisar com IA',
    );
    expect(botao).toBeTruthy();
    botao!.click();
    await estabilizar(harness);
    http.expectOne('/api/v1/bi/analise/estado').flush({
      configurada: false,
      comoConfigurar: 'Defina a chave da IA no servidor.',
      disponivel: false,
      motivo: null,
      modelo: 'claude-opus-5-5',
      limiteDiario: 20,
      usadasHoje: 0,
      restantesHoje: 20,
      maxPerguntasPorAnalise: 5,
    });
    await estabilizar(harness);
    expect(texto(raiz.querySelector('app-analise-ia'))).toContain(
      'Defina a chave da IA no servidor.',
    );
  });

  it('quem não é Admin não vê o botão nem o modal da análise', async () => {
    const { raiz } = await abrir('/bi/comercial', ['comercial'], 'C_LEVEL');
    expect(texto(raiz.querySelector('.cabecalho'))).not.toContain('Analisar com IA');
    expect(raiz.querySelector('app-analise-ia')).toBeNull();
  });
});
