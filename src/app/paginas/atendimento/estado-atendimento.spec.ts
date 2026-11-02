import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { assentar, conversaResumo, EU, ha, paginaConversas } from './dados-de-teste';
import {
  ESPERA_CONFERENCIA_MS,
  EstadoAtendimento,
  FILTROS_PADRAO,
  filtrosLigados,
  paraFiltrosDaApi,
} from './estado-atendimento';

const CONVERSAS = '/api/v1/atendimento/conversas';

describe('EstadoAtendimento', () => {
  let http: HttpTestingController;
  let socket: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    localStorage.clear();
    socket = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
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

  /** Cria o estado, responde a lista e os dados de apoio. */
  async function criar(
    itens = [conversaResumo()],
    ajustes: Parameters<typeof paginaConversas>[1] = {},
  ) {
    const estado = TestBed.inject(EstadoAtendimento);
    TestBed.tick();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    pedido.flush(paginaConversas(itens, ajustes));
    http.expectOne('/api/v1/atendimento/canais').flush([]);
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/atendimento/etiquetas').flush(['escola']);
    http.expectOne('/api/v1/atendimento/respostas-rapidas').flush([
      { id: 'r1', atalho: 'oi', titulo: 'Oi', texto: 'Oi!', area: null, ativa: true },
      { id: 'r2', atalho: 'off', titulo: 'Desligada', texto: '…', area: null, ativa: false },
    ]);
    await assentar();
    return { estado, pedido };
  }

  it('carrega as conversas em aberto de todas que a pessoa vê, com os contadores e o apoio', async () => {
    const { estado, pedido } = await criar([conversaResumo()], {
      contadores: { minhas: 1, semResponsavel: 2, todas: 3, naoLidas: 1 },
    });
    expect(pedido.request.params.get('escopo')).toBe('TODAS');
    expect(pedido.request.params.getAll('status')).toEqual(['ABERTA', 'PENDENTE']);
    expect(pedido.request.params.get('porPagina')).toBe('30');
    expect(estado.situacao()).toBe('pronta');
    expect(estado.conversas().map((c) => c.id)).toEqual(['c1']);
    expect(estado.contadores()).toEqual({ minhas: 1, semResponsavel: 2, todas: 3, naoLidas: 1 });
    expect(estado.etiquetasEmUso()).toEqual(['escola']);
    // Só as respostas ativas vão para o compositor.
    expect(estado.respostas().map((r) => r.atalho)).toEqual(['oi']);
  });

  it('trocar o filtro busca de novo e guarda o escopo e a situação por pessoa', async () => {
    const { estado } = await criar();
    estado.mudarFiltros({
      escopo: 'MINHAS',
      situacao: 'RESOLVIDA',
      canais: ['WHATSAPP'],
      busca: ' marina ',
    });
    TestBed.tick();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.get('escopo')).toBe('MINHAS');
    expect(pedido.request.params.getAll('status')).toEqual(['RESOLVIDA']);
    expect(pedido.request.params.getAll('tipoCanal')).toEqual(['WHATSAPP']);
    expect(pedido.request.params.get('busca')).toBe('marina');
    pedido.flush(paginaConversas([]));
    expect(JSON.parse(localStorage.getItem(`crmbrl.atendimento.filtros:${EU.id}`)!)).toEqual({
      escopo: 'MINHAS',
      situacao: 'RESOLVIDA',
    });
  });

  it('cenário 79 — link com ?canalId/?filaId (clique do BI) filtra a lista pela conta e pela fila', async () => {
    const { estado } = await criar();
    estado.aplicarDoLink({ canalId: 'canal-1', filaId: 'fila-1' });
    TestBed.tick();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.get('canalId')).toBe('canal-1');
    expect(pedido.request.params.get('filaId')).toBe('fila-1');
    pedido.flush(paginaConversas([]));
    expect(estado.abrirFiltros()).toBe(true);
    expect(filtrosLigados(estado.filtros())).toBe(2);
  });

  it('falha ao carregar: estado de erro com a falha', async () => {
    const estado = TestBed.inject(EstadoAtendimento);
    TestBed.tick();
    http
      .expectOne((r) => r.url === CONVERSAS)
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'x', requisicaoId: 'req-1' },
        { status: 500, statusText: 'Erro' },
      );
    http.match(() => true).forEach((pedido) => pedido.flush([]));
    await assentar();
    expect(estado.situacao()).toBe('erro');
    expect(estado.falha()?.status).toBe(500);
  });

  it('carregar mais acrescenta a próxima página sem repetir', async () => {
    const { estado } = await criar([conversaResumo({ id: 'a' })], { total: 2 });
    expect(estado.temMais()).toBe(true);
    estado.carregarMais();
    const pedido = http.expectOne((r) => r.url === CONVERSAS);
    expect(pedido.request.params.get('pagina')).toBe('2');
    pedido.flush(
      paginaConversas([conversaResumo({ id: 'a' }), conversaResumo({ id: 'b' })], { total: 2 }),
    );
    expect(estado.conversas().map((c) => c.id)).toEqual(['a', 'b']);
    expect(estado.temMais()).toBe(false);
  });

  it('tempo real: conversa nova entra no topo, a que sai do filtro sai da lista, e a lista é conferida', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { estado } = await criarComRelogioFalso();
    await Promise.resolve();
    socket.ultimo().simularConexao();

    const nova = conversaResumo({ id: 'nova', ultimaMensagemEm: ha(0) });
    socket.ultimo().receber('conversa.nova', { conversa: nova });
    expect(estado.conversas().map((c) => c.id)).toEqual(['nova', 'c1']);

    socket
      .ultimo()
      .receber('conversa.atualizada', { conversa: conversaResumo({ status: 'RESOLVIDA' }) });
    expect(estado.conversas().map((c) => c.id)).toEqual(['nova']);

    // Uma só conferência depois da pausa (os dois eventos viram uma busca).
    vi.advanceTimersByTime(ESPERA_CONFERENCIA_MS);
    const conferencia = http.expectOne((r) => r.url === CONVERSAS);
    conferencia.flush(
      paginaConversas([nova], {
        contadores: { minhas: 1, semResponsavel: 0, todas: 1, naoLidas: 0 },
      }),
    );
    expect(estado.contadores()?.todas).toBe(1);
  });

  it('a conversa de outra pessoa não entra em "Minhas"', async () => {
    const { estado } = await criar();
    estado.mudarFiltros({ escopo: 'MINHAS' });
    TestBed.tick();
    http.expectOne((r) => r.url === CONVERSAS).flush(paginaConversas([conversaResumo()]));
    estado.receber(conversaResumo({ id: 'outra', responsavel: { id: 'x', nome: 'Ana' } }));
    expect(estado.conversas().map((c) => c.id)).toEqual(['c1']);
    estado.conferirDepois(0);
    await assentar(1);
    http.expectOne((r) => r.url === CONVERSAS).flush(paginaConversas([conversaResumo()]));
  });

  it('vizinha: a próxima e a anterior da aberta; sem aberta, a primeira ou a última', async () => {
    const { estado } = await criar([
      conversaResumo({ id: 'a' }),
      conversaResumo({ id: 'b' }),
      conversaResumo({ id: 'c' }),
    ]);
    expect(estado.vizinha(1)?.id).toBe('a');
    expect(estado.vizinha(-1)?.id).toBe('c');
    estado.selecionadaId.set('b');
    expect(estado.vizinha(1)?.id).toBe('c');
    expect(estado.vizinha(-1)?.id).toBe('a');
    estado.selecionadaId.set('c');
    expect(estado.vizinha(1)).toBeNull();
  });

  it('marcar como lida na lista zera as não lidas na hora', async () => {
    const { estado } = await criar([conversaResumo({ naoLidas: 3 })]);
    estado.marcarLidaNaLista('c1');
    expect(estado.conversas()[0].naoLidas).toBe(0);
  });

  async function criarComRelogioFalso() {
    const estado = TestBed.inject(EstadoAtendimento);
    TestBed.tick();
    http.expectOne((r) => r.url === CONVERSAS).flush(paginaConversas([conversaResumo()]));
    http.match(() => true).forEach((pedido) => pedido.flush([]));
    await Promise.resolve();
    return { estado };
  }
});

describe('filtros da lista', () => {
  it('viram os parâmetros da API sem os vazios', () => {
    expect(paraFiltrosDaApi(FILTROS_PADRAO)).toEqual({
      escopo: 'TODAS',
      status: ['ABERTA', 'PENDENTE'],
      tipoCanal: [],
      etiqueta: [],
      naoLidas: undefined,
      slaEstourado: undefined,
      busca: undefined,
      pagina: 1,
      porPagina: 30,
    });
    expect(
      paraFiltrosDaApi(
        { ...FILTROS_PADRAO, filaId: 'f1', etiqueta: 'escola', naoLidas: true },
        50,
        2,
      ),
    ).toEqual(
      expect.objectContaining({
        filaId: 'f1',
        etiqueta: ['escola'],
        naoLidas: true,
        pagina: 2,
        porPagina: 50,
      }),
    );
  });

  it('contam os ligados além do escopo e da busca', () => {
    expect(filtrosLigados(FILTROS_PADRAO)).toBe(0);
    expect(filtrosLigados({ ...FILTROS_PADRAO, busca: 'x', escopo: 'MINHAS' })).toBe(0);
    expect(
      filtrosLigados({
        ...FILTROS_PADRAO,
        situacao: 'RESOLVIDA',
        canais: ['EMAIL'],
        slaEstourado: true,
      }),
    ).toBe(3);
  });
});
