import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErroApi } from '../../nucleo/api/erro-api';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { EstadoQuadro } from './estado-quadro';
import {
  colunasDeTeste,
  ETAPAS,
  FUNIL_ID,
  funilDeTeste,
  negocioDeTeste,
  quadroDeTeste,
} from './funis-de-teste';

const [NOVO, PROPOSTA, , PERDIDO] = ETAPAS;
const FUNIL_DO_CS = funilDeTeste({ id: 'funil-cs', nome: 'Pós-venda', area: 'CS', nivel: 'VER' });
const TODOS_OS_FUNIS = [funilDeTeste(), FUNIL_DO_CS];

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('EstadoQuadro', () => {
  let http: HttpTestingController;
  let estado: EstadoQuadro;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EstadoQuadro, provideHttpClient(), provideHttpClientTesting()],
    });
    entrarComo('LIDER_COMERCIAL');
    http = TestBed.inject(HttpTestingController);
    estado = TestBed.inject(EstadoQuadro);
  });

  afterEach(() => http.verify());

  /** Abre o Comercial com A e B em Novo e C em Proposta. */
  async function abrir() {
    const iniciando = estado.iniciar('COMERCIAL', null);
    http.expectOne('/api/v1/funis?area=COMERCIAL').flush([funilDeTeste()]);
    // A lista geral (com os funis de outros setores) alimenta o seletor do quadro.
    await microtarefas();
    http
      .expectOne((req) => req.url === '/api/v1/funis' && !req.params.has('area'))
      .flush(TODOS_OS_FUNIS);
    await microtarefas();
    http
      .expectOne((req) => req.url === `/api/v1/funis/${FUNIL_ID}/quadro`)
      .flush(
        quadroDeTeste(
          colunasDeTeste({
            novo: [negocioDeTeste('a', NOVO), negocioDeTeste('b', NOVO)],
            proposta: [negocioDeTeste('c', PROPOSTA)],
          }),
        ),
      );
    await iniciando;
    http
      .expectOne((req) => req.url === '/api/v1/atividades')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    http
      .expectOne((req) => req.url === '/api/v1/contatos/etiquetas')
      .flush([{ etiqueta: 'VIP', quantidade: 2 }]);
    http
      .expectOne((req) => req.url === '/api/v1/empresas/etiquetas')
      .flush([
        { etiqueta: 'vip', quantidade: 1 },
        { etiqueta: 'Agro', quantidade: 1 },
      ]);
    await microtarefas();
  }

  it('carrega os funis da área, o funil-base, o quadro e as etiquetas (sem repetir)', async () => {
    await abrir();
    expect(estado.situacao()).toBe('pronto');
    expect(estado.funil()?.nome).toBe('Comercial');
    expect(estado.colunas().map((coluna) => coluna.negocios.length)).toEqual([2, 1, 0, 0]);
    expect(estado.totalAbertos()).toBe(3);
    expect(estado.etiquetas()).toEqual(['Agro', 'VIP']);
  });

  it('guarda os funis de todos os setores que a pessoa vê, e o nível dela no funil aberto', async () => {
    await abrir();
    expect(estado.todosOsFunis().map((funil) => funil.id)).toEqual([FUNIL_ID, 'funil-cs']);
    // Sem `nivel` na resposta, a líder do Comercial configura o funil do setor dela.
    expect(estado.nivel()).toBe('CONFIGURAR');
    expect(estado.podeAgir()).toBe(true);
    expect(estado.podeConfigurar()).toBe(true);
  });

  it('filtros recarregam o quadro com visão, busca e etiqueta', async () => {
    await abrir();
    estado.definirFiltros({ visao: 'MEUS', busca: 'padaria', etiqueta: 'VIP' });
    const pedido = http.expectOne((req) => req.url === `/api/v1/funis/${FUNIL_ID}/quadro`);
    expect(pedido.request.params.get('visao')).toBe('MEUS');
    expect(pedido.request.params.get('busca')).toBe('padaria');
    expect(pedido.request.params.get('etiqueta')).toBe('VIP');
    pedido.flush(quadroDeTeste(colunasDeTeste({})));
    await microtarefas();
    http
      .expectOne((req) => req.url === '/api/v1/atividades')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    expect(estado.totalAbertos()).toBe(0);
  });

  it('movimento otimista: muda na hora, manda os vizinhos e fica com a versão da API', async () => {
    await abrir();
    const movimento = estado.prever('a', 'proposta', 1)!;
    expect(estado.colunas()[1].negocios.map((n) => n.id)).toEqual(['c', 'a']);

    const confirmando = estado.confirmar(movimento);
    const pedido = http.expectOne('/api/v1/negocios/a/mover');
    expect(pedido.request.body).toEqual({ etapaId: 'proposta', depoisDeId: 'c' });
    pedido.flush({
      negocio: negocioDeTeste('a', PROPOSTA, { titulo: 'Da API', posicao: 2 }),
      passagens: [],
    });
    await confirmando;

    expect(estado.colunas()[1].negocios.map((n) => n.titulo)).toEqual(['Negócio c', 'Da API']);
    expect(estado.colunas()[0].total).toBe(1);
  });

  it('a API recusando, o cartão volta para onde estava e a falha sobe', async () => {
    await abrir();
    const antes = estado.colunas();
    const movimento = estado.prever('b', 'perdido', 0)!;
    const confirmando = estado.confirmar(movimento, 'Sem orçamento');
    const pedido = http.expectOne('/api/v1/negocios/b/mover');
    expect(pedido.request.body).toEqual({ etapaId: 'perdido', motivoPerda: 'Sem orçamento' });
    pedido.flush(
      { statusCode: 403, erro: 'sem_permissao', mensagem: 'Sem permissão.', requisicaoId: 'r1' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect(confirmando).rejects.toBeInstanceOf(ErroApi);
    expect(estado.colunas()).toEqual(antes);
    expect(estado.colunas()[3].etapa.id).toBe(PERDIDO.id);
  });

  it('não move para o mesmo lugar', async () => {
    await abrir();
    expect(estado.prever('a', 'novo', 0)).toBeNull();
  });

  it('carrega mais cartões de uma etapa pela lista de negócios', async () => {
    await abrir();
    estado.colunas.update((colunas) =>
      colunas.map((coluna) =>
        coluna.etapa.id === 'novo' ? { ...coluna, total: 3, temMais: true } : coluna,
      ),
    );
    const carregando = estado.carregarMais('novo');
    const pedido = http.expectOne((req) => req.url === '/api/v1/negocios');
    expect(pedido.request.params.get('etapaId')).toBe('novo');
    expect(pedido.request.params.get('ordenarPor')).toBe('posicao');
    pedido.flush({
      itens: [negocioDeTeste('b', NOVO), negocioDeTeste('x', NOVO)],
      total: 3,
      pagina: 1,
      porPagina: 50,
    });
    await carregando;
    expect(estado.colunas()[0].negocios.map((n) => n.id)).toEqual(['a', 'b', 'x']);
    expect(estado.colunas()[0].temMais).toBe(false);
  });

  it('erro ao carregar vira o estado de erro', async () => {
    const iniciando = estado.iniciar('COMERCIAL', null);
    http
      .expectOne('/api/v1/funis?area=COMERCIAL')
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'x', requisicaoId: 'req-9' },
        { status: 500, statusText: 'Erro' },
      );
    await iniciando;
    http.match(() => true).forEach((pedido) => pedido.flush([]));
    expect(estado.situacao()).toBe('erro');
    expect(estado.erro()?.requisicaoId).toBe('req-9');
  });
});
