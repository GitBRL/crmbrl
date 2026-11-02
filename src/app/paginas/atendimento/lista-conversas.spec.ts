import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import {
  assentar,
  CANAL_INSTAGRAM,
  conversaResumo,
  ha,
  paginaConversas,
  texto,
} from './dados-de-teste';
import { EstadoAtendimento } from './estado-atendimento';
import { ESPERA_BUSCA_MS, ListaConversas } from './lista-conversas';

const CONVERSAS = '/api/v1/atendimento/conversas';

describe('ListaConversas', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        EstadoAtendimento,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  async function criar(
    itens = [conversaResumo()],
    ajustes: Parameters<typeof paginaConversas>[1] = {},
  ) {
    const fixture = TestBed.createComponent(ListaConversas);
    await fixture.whenStable();
    http.expectOne((r) => r.url === CONVERSAS).flush(paginaConversas(itens, ajustes));
    http.expectOne('/api/v1/atendimento/canais').flush([]);
    http
      .expectOne('/api/v1/atendimento/filas')
      .flush([{ id: 'f1', nome: 'Vendas', area: 'COMERCIAL', ativa: true }]);
    http.expectOne('/api/v1/atendimento/etiquetas').flush(['escola']);
    http.expectOne('/api/v1/atendimento/respostas-rapidas').flush([]);
    await assentar();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const itensNaTela = () => [...raiz.querySelectorAll<HTMLAnchorElement>('a.item')];
    return { fixture, raiz, itensNaTela, estado: TestBed.inject(EstadoAtendimento) };
  }

  it('mostra cada conversa com canal, prévia, hora, não lidas, espera e responsável', async () => {
    const { raiz, itensNaTela } = await criar(
      [
        conversaResumo({
          naoLidas: 2,
          aguardandoDesde: ha(20),
          sla: {
            primeiraRespostaAte: ha(5),
            resolucaoAte: null,
            primeiraRespostaEstourada: true,
            resolucaoEstourada: false,
          },
          etiquetas: ['escola', 'rede', 'urgente'],
          prioridade: 'ALTA',
        }),
        conversaResumo({ id: 'c2', canal: CANAL_INSTAGRAM, responsavel: null }),
      ],
      { contadores: { minhas: 1, semResponsavel: 1, todas: 2, naoLidas: 1 } },
    );
    const [primeira, segunda] = itensNaTela();
    expect(primeira.getAttribute('href')).toBe('/atendimento/c1');
    expect(texto(primeira.querySelector('.item__nome'))).toBe('Marina Lopes');
    expect(texto(primeira.querySelector('.item__previa'))).toBe('Oi! Queria saber dos planos.');
    expect(texto(primeira.querySelector('.item__nao-lidas'))).toBe('2');
    expect(
      primeira.querySelector('app-selo[variante="coral"], .selo--coral, app-selo'),
    ).not.toBeNull();
    expect(texto(primeira.querySelector('.item__meta'))).toContain('20 min');
    expect(texto(primeira.querySelector('.item__meta'))).toContain('Alta');
    expect(texto(primeira.querySelector('.item__meta'))).toContain('#escola');
    expect(texto(primeira.querySelector('.item__meta'))).not.toContain('#urgente');
    // O nome acessível resume tudo, inclusive o prazo estourado.
    expect(primeira.getAttribute('aria-label')).toContain('2 mensagens não lidas');
    expect(primeira.getAttribute('aria-label')).toContain('acima do prazo da fila');
    expect(segunda.getAttribute('aria-label')).toContain('Instagram');
    expect(texto(segunda.querySelector('.item__meta'))).toContain('Sem responsável');
    // Contadores no controle do topo.
    expect(
      [...raiz.querySelectorAll('.escopo__opcao')].map((opcao) => opcao.getAttribute('aria-label')),
    ).toEqual([
      'Minhas: 1 conversa em aberto',
      'Sem responsável: 1 conversa em aberto',
      'Todas: 2 conversas em aberto',
    ]);
  });

  it('o controle do topo troca o escopo (e o escolhido fica pressionado)', async () => {
    const { fixture, raiz, estado } = await criar();
    const minhas = raiz.querySelector<HTMLButtonElement>('.escopo__opcao')!;
    minhas.click();
    await fixture.whenStable();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.get('escopo')).toBe('MINHAS');
    pedido.flush(paginaConversas([]));
    await fixture.whenStable();
    expect(estado.filtros().escopo).toBe('MINHAS');
    expect(minhas.getAttribute('aria-pressed')).toBe('true');
    expect(texto(raiz)).toContain('Nenhuma conversa com você');
  });

  it('a busca espera a pausa da digitação; sem resultado, oferece limpar', async () => {
    const { fixture, raiz } = await criar();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const campo = raiz.querySelector<HTMLInputElement>('app-campo-busca input')!;
    campo.value = 'otávio';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(ESPERA_BUSCA_MS - 10);
    http.expectNone((r) => r.url === CONVERSAS);
    vi.advanceTimersByTime(20);
    TestBed.tick();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.get('busca')).toBe('otávio');
    pedido.flush(paginaConversas([]));
    vi.useRealTimers();
    await fixture.whenStable();
    expect(texto(raiz)).toContain('Nenhuma conversa com estes filtros');
    const limpar = [...raiz.querySelectorAll('button')].find((b) => texto(b) === 'Limpar filtros')!;
    limpar.click();
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === CONVERSAS && !r.params.has('busca'))
      .flush(paginaConversas([conversaResumo()]));
  });

  it('filtros extras: situação e canal, com o número de ligados no botão', async () => {
    const { fixture, raiz } = await criar();
    const alternar = raiz.querySelector<HTMLButtonElement>(
      'button[aria-controls="atendimento-filtros"]',
    )!;
    expect(raiz.querySelector<HTMLElement>('#atendimento-filtros')!.hidden).toBe(true);
    alternar.click();
    await fixture.whenStable();
    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    const resolvidas = [
      ...raiz.querySelectorAll<HTMLButtonElement>('#atendimento-filtros button'),
    ].find((b) => texto(b) === 'Resolvidas')!;
    resolvidas.click();
    await fixture.whenStable();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.getAll('status')).toEqual(['RESOLVIDA']);
    pedido.flush(paginaConversas([]));
    await fixture.whenStable();
    expect(alternar.getAttribute('aria-label')).toBe('Filtros (1 ligado)');
  });

  it('teclado: setas, Home e End andam pela lista com um só ponto de Tab', async () => {
    const { fixture, itensNaTela } = await criar([
      conversaResumo({ id: 'a' }),
      conversaResumo({ id: 'b' }),
      conversaResumo({ id: 'c' }),
    ]);
    const [a, b, c] = itensNaTela();
    expect([a.tabIndex, b.tabIndex, c.tabIndex]).toEqual([0, -1, -1]);
    a.focus();
    a.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(document.activeElement).toBe(b);
    expect([a.tabIndex, b.tabIndex]).toEqual([-1, 0]);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(c);
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(a);
  });

  it('a conversa aberta fica marcada e recebe o Tab', async () => {
    const { fixture, itensNaTela, estado } = await criar([
      conversaResumo({ id: 'a' }),
      conversaResumo({ id: 'b' }),
    ]);
    estado.selecionadaId.set('b');
    await fixture.whenStable();
    const [, b] = itensNaTela();
    expect(b.classList).toContain('item--selecionada');
    expect(b.getAttribute('aria-current')).toBe('page');
    expect(b.tabIndex).toBe(0);
  });

  it('mais conversas do que a página: "Carregar mais"', async () => {
    const { fixture, raiz } = await criar([conversaResumo()], { total: 31 });
    const mais = [...raiz.querySelectorAll('button')].find(
      (b) => texto(b) === 'Carregar mais conversas',
    )!;
    mais.click();
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === CONVERSAS && r.params.get('pagina') === '2')
      .flush(paginaConversas([], { total: 31 }));
  });

  it('erro ao carregar: mensagem e "Tentar de novo"', async () => {
    const fixture = TestBed.createComponent(ListaConversas);
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === CONVERSAS)
      .flush(
        { statusCode: 503, erro: 'indisponivel', mensagem: 'Fora do ar.', requisicaoId: 'req-9' },
        { status: 503, statusText: 'Indisponível' },
      );
    http.match(() => true).forEach((p) => p.flush([]));
    await assentar();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(texto(raiz)).toContain('Não deu para carregar as conversas');
    [...raiz.querySelectorAll('button')].find((b) => texto(b) === 'Tentar de novo')!.click();
    http.expectOne((r) => r.url === CONVERSAS).flush(paginaConversas([]));
  });
});
