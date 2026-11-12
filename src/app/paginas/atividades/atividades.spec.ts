import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Atividades, listarNomes } from './atividades';
import type {
  Atividade,
  AtividadesAgrupadas,
  GrupoAtividade,
  GrupoDeAtividades,
} from './atividades.api';
import { ESPERA_BUSCA_MS } from './seletor-vinculo';

const texto = (elemento: Element | null | undefined) =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const dois = (numero: number) => String(numero).padStart(2, '0');

/** Hoje (ou daqui a `dias`) às `hora`:`minuto`, no fuso do teste. */
function dia(dias: number, hora = 18, minuto = 0): Date {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(hora, minuto, 0, 0);
  return data;
}

const EU = '00000000-0000-4000-8000-000000000004'; // o COMERCIAL de perfilDeTeste

function atividade(id: string, ajustes: Partial<Atividade> = {}): Atividade {
  return {
    id,
    tipo: 'TAREFA',
    titulo: `Atividade ${id}`,
    descricao: null,
    status: 'PENDENTE',
    prioridade: 'MEDIA',
    venceEm: dia(0).toISOString(),
    inicioEm: null,
    fimEm: null,
    atrasada: false,
    grupo: 'HOJE',
    responsavel: { id: EU, nome: 'João Batista', avatarUrl: null },
    criadoPor: { id: EU, nome: 'João Batista', avatarUrl: null },
    concluidaEm: null,
    concluidaPor: null,
    canceladaEm: null,
    contato: null,
    empresa: null,
    negocio: null,
    encaminhadaDe: null,
    encaminhadaEm: null,
    criadoEm: '2026-10-21T12:00:00.000Z',
    atualizadoEm: '2026-10-21T12:00:00.000Z',
    ...ajustes,
  };
}

const ROTULOS: Record<GrupoAtividade, string> = {
  ATRASADAS: 'Atrasadas',
  HOJE: 'Hoje',
  PROXIMOS_7_DIAS: 'Próximos 7 dias',
  MAIS_TARDE: 'Mais tarde',
  SEM_DATA: 'Sem data',
  CONCLUIDAS: 'Concluídas',
};

function agenda(
  grupos: Partial<
    Record<GrupoAtividade, readonly Atividade[] | { itens: readonly Atividade[]; total: number }>
  >,
): AtividadesAgrupadas {
  return {
    referencia: {
      agora: new Date().toISOString(),
      fusoHorario: 'America/Sao_Paulo',
      inicioDeHoje: dia(0, 0).toISOString(),
      inicioDeAmanha: dia(1, 0).toISOString(),
      fimDosProximos7Dias: dia(8, 0).toISOString(),
    },
    grupos: (Object.keys(ROTULOS) as GrupoAtividade[]).map<GrupoDeAtividades>((grupo) => {
      const valor = grupos[grupo] ?? [];
      const { itens, total } =
        'itens' in valor ? valor : { itens: valor as readonly Atividade[], total: valor.length };
      return { grupo, rotulo: ROTULOS[grupo], total, itens };
    }),
  };
}

const pagina = <T = Atividade>(
  itens: readonly T[],
  total = itens.length,
  numero = 1,
  porPagina = 20,
) => ({
  itens,
  total,
  pagina: numero,
  porPagina,
});

describe('Atividades', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });

  const ehAgenda = (requisicao: { url: string }) =>
    requisicao.url === '/api/v1/atividades/agrupadas';
  /** `GET /atividades/:id` (com o fuso do navegador na query). */
  const ehDetalhe = (id: string) => (requisicao: { url: string; method: string }) =>
    requisicao.method === 'GET' && requisicao.url === `/api/v1/atividades/${id}`;
  const ehEncaminhadas = (requisicao: {
    url: string;
    params: { get(nome: string): string | null };
  }) => requisicao.url === '/api/v1/atividades' && requisicao.params.get('encaminhadas') === 'true';

  /** Responde a agenda e as encaminhadas (o que a página pede ao abrir e ao recarregar). */
  function responder(resposta: AtividadesAgrupadas, encaminhadas: readonly Atividade[] = []) {
    const pedido = http.expectOne(ehAgenda);
    pedido.flush(resposta);
    http.expectOne(ehEncaminhadas).flush(pagina(encaminhadas, encaminhadas.length, 1, 50));
    return pedido;
  }

  async function criar(resposta: AtividadesAgrupadas, encaminhadas: readonly Atividade[] = []) {
    const fixture = TestBed.createComponent(Atividades);
    fixture.detectChanges();
    const pedido = responder(resposta, encaminhadas);
    await estabilizar(fixture);
    return { fixture, pedido, raiz: fixture.nativeElement as HTMLElement };
  }

  /** Deixa as promessas da tela terminarem (várias voltas de microtarefas) e renderiza. */
  async function estabilizar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const titulosDosGrupos = (raiz: HTMLElement) =>
    [...raiz.querySelectorAll('.grupo__titulo')].map(texto);
  const titulosDasLinhas = (raiz: HTMLElement) =>
    [...raiz.querySelectorAll('.item__titulo')].map(texto);
  const botao = (raiz: Element, rotulo: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (elemento) => texto(elemento) === rotulo,
    );
  const caixaDe = (raiz: HTMLElement, id: string) =>
    raiz.querySelector<HTMLInputElement>(`[data-atividade="${id}"] input[type="checkbox"]`);

  it('agrupa as pendentes na ordem da agenda, com os totais, e esconde os grupos vazios', async () => {
    const atrasada = atividade('a1', {
      titulo: 'Retornar sobre a proposta',
      tipo: 'LIGACAO',
      venceEm: dia(-1, 16, 10).toISOString(),
      atrasada: true,
      grupo: 'ATRASADAS',
    });
    const hoje = atividade('a2', { titulo: 'Enviar contrato' });
    const semData = atividade('a3', {
      titulo: 'Revisar pipeline',
      venceEm: null,
      grupo: 'SEM_DATA',
    });
    const { pedido, raiz } = await criar(
      agenda({
        ATRASADAS: [atrasada],
        HOJE: [hoje],
        SEM_DATA: [semData],
        CONCLUIDAS: { itens: [], total: 4 },
      }),
    );

    expect(pedido.request.params.get('escopo')).toBe('MINHAS');
    expect(pedido.request.params.get('limitePorGrupo')).toBe('10');
    expect(pedido.request.params.get('fusoHorario')).toBeTruthy();
    expect(texto(raiz.querySelector('h1'))).toMatch(/^Atividades · \d{1,2} de \p{L}+$/u);

    expect(titulosDosGrupos(raiz)).toEqual([
      'Atrasadas 1 atividade',
      'Hoje 1 atividade',
      'Sem data 1 atividade',
    ]);
    expect(raiz.querySelector('section.grupo')?.classList).toContain('grupo--atrasadas');
    expect(titulosDasLinhas(raiz)).toEqual([
      'Retornar sobre a proposta',
      'Enviar contrato',
      'Revisar pipeline',
    ]);

    const quando = raiz.querySelector('[data-atividade="a1"] .item__quando');
    expect(texto(quando)).toBe('Venceu ontem às 16:10');
    expect(quando?.classList).toContain('item__quando--atrasada');
    expect(texto(raiz.querySelector('[data-atividade="a2"] .item__quando'))).toBe('Hoje às 18:00');
    expect(texto(raiz.querySelector('[data-atividade="a3"] .item__quando'))).toBe('Sem data');
    expect(texto(raiz.querySelector('[data-atividade="a1"] .item__meta'))).toContain('Ligação');
    // O título abre o painel pela query (link de verdade).
    expect(raiz.querySelector('[data-atividade="a2"] .item__titulo')?.getAttribute('href')).toBe(
      '/?atividade=a2',
    );
    // Concluir pela caixa grande, nomeada pela atividade.
    expect(raiz.querySelector('[data-atividade="a2"] app-caixa-selecao')?.classList).toContain(
      'caixa-selecao--lg',
    );
    expect(
      raiz.querySelector('[data-atividade="a2"] label.caixa__rotulo')?.textContent?.trim(),
    ).toBe('Concluir “Enviar contrato”');
    // Responsável escondido quando é a própria pessoa em "Minhas".
    expect(raiz.querySelector('.item__responsavel')).toBeNull();

    // O resumo ao lado conta todos os grupos, inclusive os vazios.
    expect([...raiz.querySelectorAll('.resumo__linha')].map(texto)).toEqual([
      'Atrasadas: 1',
      'Hoje: 1',
      'Próximos 7 dias: 0',
      'Mais tarde: 0',
      'Sem data: 1',
      'Concluídas: 4',
    ]);
    expect(texto(raiz.querySelector('.lateral app-cartao h2'))).toBe('Resumo · minhas');
  });

  it('filtros por papel: a equipe para líderes e C-level, todas para C-level e Admin', async () => {
    const { fixture, raiz } = await criar(agenda({}));
    const estados = () =>
      [...raiz.querySelectorAll('app-filtros-pilula')[0].querySelectorAll('button')].map((item) => [
        texto(item),
        item.getAttribute('aria-disabled') === 'true',
        item.getAttribute('title'),
      ]);

    expect(estados()).toEqual([
      ['Minhas', false, null],
      ['Da equipe', true, 'Só líderes e C-level têm equipe.'],
      ['Todas', true, 'Só C-level e Admin veem as atividades de todos.'],
    ]);
    entrarComo('LIDER_COMERCIAL');
    await estabilizar(fixture);
    expect(estados().map(([rotulo, desabilitado]) => [rotulo, desabilitado])).toEqual([
      ['Minhas', false],
      ['Da equipe', false],
      ['Todas', true],
    ]);
    entrarComo('ADMIN');
    await estabilizar(fixture);
    expect(estados().map(([, desabilitado]) => desabilitado)).toEqual([false, true, false]);
    entrarComo('C_LEVEL');
    await estabilizar(fixture);
    expect(estados().map(([, desabilitado]) => desabilitado)).toEqual([false, false, false]);

    // "Da equipe": busca de novo e mostra o responsável de cada linha.
    botao(raiz, 'Da equipe')?.click();
    await estabilizar(fixture);
    const pedido = http.expectOne(ehAgenda);
    expect(pedido.request.params.get('escopo')).toBe('EQUIPE');
    pedido.flush(
      agenda({
        HOJE: [
          atividade('b1', {
            titulo: 'Ligar para a Clínica',
            responsavel: { id: 'outro', nome: 'Juliana Alves' },
          }),
        ],
      }),
    );
    http.expectOne(ehEncaminhadas).flush(pagina([]));
    await estabilizar(fixture);
    expect(texto(raiz.querySelector('[data-atividade="b1"] .item__responsavel-nome'))).toBe(
      'Responsável: Juliana Alves',
    );
    expect(texto(raiz.querySelector('.lateral app-cartao h2'))).toBe('Resumo · da equipe');
  });

  it('filtro de tipo, o vazio da busca e "Limpar filtros"', async () => {
    const { fixture, raiz } = await criar(agenda({ HOJE: [atividade('a1')] }));
    const tipos = raiz.querySelectorAll('app-filtros-pilula')[1];
    expect([...tipos.querySelectorAll('button')].map(texto)).toEqual([
      'Tarefa',
      'Ligação',
      'Reunião',
      'E-mail',
      'WhatsApp',
    ]);
    botao(tipos, 'Ligação')?.click();
    await estabilizar(fixture);
    const pedido = http.expectOne(ehAgenda);
    expect(pedido.request.params.getAll('tipo')).toEqual(['LIGACAO']);
    pedido.flush(agenda({}));
    http.expectOne(ehEncaminhadas).flush(pagina([]));
    await estabilizar(fixture);

    expect(texto(raiz.querySelector('app-estado-vazio'))).toContain(
      'Nenhuma pendente com esses filtros',
    );
    botao(raiz, 'Limpar filtros')?.click();
    await estabilizar(fixture);
    const semFiltro = http.expectOne(ehAgenda);
    expect(semFiltro.request.params.getAll('tipo')).toBeNull();
    semFiltro.flush(agenda({}));
    http.expectOne(ehEncaminhadas).flush(pagina([]));
    await estabilizar(fixture);
    expect(texto(raiz.querySelector('app-estado-vazio'))).toContain('Tudo em dia');
    expect(
      botao(raiz.querySelector('app-estado-vazio') as Element, 'Nova atividade'),
    ).toBeDefined();
  });

  it('concluir pela caixa: aviso com "Desfazer", a lista recarrega e o "Desfazer" reabre', async () => {
    const a1 = atividade('a1', { titulo: 'Enviar contrato' });
    const a2 = atividade('a2', { titulo: 'Ligar para Ana', tipo: 'LIGACAO' });
    const { fixture, raiz } = await criar(agenda({ HOJE: [a1, a2] }));
    const avisos = TestBed.inject(AvisosService);

    caixaDe(raiz, 'a1')?.click();
    await estabilizar(fixture);
    // Enquanto a API responde, a caixa fica marcada e desabilitada.
    expect(caixaDe(raiz, 'a1')?.checked).toBe(true);
    expect(caixaDe(raiz, 'a1')?.disabled).toBe(true);
    const concluir = http.expectOne('/api/v1/atividades/a1/concluir');
    expect(concluir.request.method).toBe('POST');
    concluir.flush({ ...a1, status: 'CONCLUIDA', grupo: 'CONCLUIDAS' });
    await estabilizar(fixture);
    responder(agenda({ HOJE: [a2], CONCLUIDAS: { itens: [], total: 1 } }));
    await estabilizar(fixture);

    expect(titulosDasLinhas(raiz)).toEqual(['Ligar para Ana']);
    const aviso = avisos.lista().at(-1);
    expect(aviso?.mensagem).toBe('Atividade concluída.');
    expect(aviso?.acao).toBe('Desfazer');
    // O foco vai para a linha que ficou no lugar.
    expect(document.activeElement).toBe(caixaDe(raiz, 'a2'));

    avisos.agir(aviso!.id);
    await estabilizar(fixture);
    http.expectOne('/api/v1/atividades/a1/reabrir').flush(a1);
    await estabilizar(fixture);
    responder(agenda({ HOJE: [a1, a2] }));
    await estabilizar(fixture);
    expect(titulosDasLinhas(raiz)).toEqual(['Enviar contrato', 'Ligar para Ana']);
    expect(avisos.lista().at(-1)?.mensagem).toBe('Atividade reaberta.');
    expect(raiz.querySelector('[data-atividade="a1"]')?.classList).toContain('item--destacada');
  });

  it('R6.6 — concluir uma reunião abre o resultado; cancelar não conclui e confirmar manda o resultado', async () => {
    const r1 = atividade('r1', {
      titulo: 'Apresentação',
      tipo: 'REUNIAO',
      inicioEm: dia(0).toISOString(),
      fimEm: dia(0, 19).toISOString(),
      aguardandoResultado: true,
    });
    const { fixture, raiz } = await criar(agenda({ HOJE: [r1] }));

    expect(texto(raiz.querySelector('[data-atividade="r1"]'))).toContain('Aguardando resultado');
    caixaDe(raiz, 'r1')?.click();
    await estabilizar(fixture);
    http.expectNone('/api/v1/atividades/r1/concluir');
    expect(document.body.textContent).toContain('Como foi');

    // Cancelar: nada vai à API e a caixa volta.
    const cancelar = [...document.querySelectorAll('dialog[open] button')].find((b) =>
      b.textContent?.includes('Cancelar'),
    ) as HTMLButtonElement;
    cancelar.click();
    await new Promise((resolver) => setTimeout(resolver, 20)); // o evento "close" do diálogo
    await estabilizar(fixture);
    http.expectNone('/api/v1/atividades/r1/concluir');
    expect(caixaDe(raiz, 'r1')?.checked).toBe(false);

    // Confirmar com "Compareceu".
    caixaDe(raiz, 'r1')?.click();
    await estabilizar(fixture);
    const opcao = [...document.querySelectorAll('dialog[open] label.opcao')].find((o) =>
      o.textContent?.includes('Compareceu'),
    );
    opcao?.querySelector<HTMLInputElement>('input')?.click();
    await estabilizar(fixture);
    const confirmar = [...document.querySelectorAll('dialog[open] button')].find((b) =>
      b.textContent?.includes('Concluir reunião'),
    ) as HTMLButtonElement;
    confirmar.click();
    await estabilizar(fixture);
    const pedido = http.expectOne('/api/v1/atividades/r1/concluir');
    expect(pedido.request.body).toEqual({ resultadoReuniao: 'COMPARECEU' });
    pedido.flush({ ...r1, status: 'CONCLUIDA', resultadoReuniao: 'COMPARECEU' });
    await estabilizar(fixture);
    responder(agenda({ CONCLUIDAS: { itens: [], total: 1 } }));
    await estabilizar(fixture);
  });

  it('falha ao concluir: a caixa volta e o erro aparece no aviso', async () => {
    const a1 = atividade('a1');
    const { fixture, raiz } = await criar(agenda({ HOJE: [a1] }));
    caixaDe(raiz, 'a1')?.click();
    await estabilizar(fixture);
    http.expectOne('/api/v1/atividades/a1/concluir').flush(
      {
        statusCode: 409,
        erro: 'conflito',
        mensagem: 'A atividade já está concluída.',
        requisicaoId: 'r1',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await estabilizar(fixture);
    expect(caixaDe(raiz, 'a1')?.checked).toBe(false);
    expect(TestBed.inject(AvisosService).lista().at(-1)?.tipo).toBe('erro');
  });

  it('selo "Encaminhada de" (R7.3) e o cartão das encaminhadas', async () => {
    const pedro = { id: 'p', nome: 'Pedro Santos', avatarUrl: null };
    const encaminhada = atividade('a1', {
      titulo: 'Agendar diagnóstico',
      encaminhadaDe: pedro,
      encaminhadaEm: '2026-10-21T21:11:01.619Z',
      prioridade: 'ALTA',
    });
    const { raiz } = await criar(agenda({ HOJE: [encaminhada] }), [
      encaminhada,
      { ...encaminhada, id: 'a9' },
    ]);
    expect(
      [...raiz.querySelectorAll('[data-atividade="a1"] .item__selos app-selo')].map(texto),
    ).toEqual(['Encaminhada de Pedro Santos', 'Prioridade alta']);
    expect(texto(raiz.querySelector('.encaminhadas'))).toBe(
      '2 pendentes vieram de Pedro Santos no desligamento. Na lista, elas têm o selo “Encaminhada de”.',
    );
  });

  it('"Mostrar mais" traz o resto do grupo', async () => {
    const itens = Array.from({ length: 12 }, (_, i) =>
      atividade(`p${i}`, { grupo: 'PROXIMOS_7_DIAS', venceEm: dia(2).toISOString() }),
    );
    const { fixture, raiz } = await criar(
      agenda({ PROXIMOS_7_DIAS: { itens: itens.slice(0, 10), total: 12 } }),
    );
    expect(raiz.querySelectorAll('app-item-atividade').length).toBe(10);
    botao(raiz, 'Mostrar mais · faltam 2')?.click();
    await estabilizar(fixture);
    const pedido = http.expectOne(
      (requisicao) => requisicao.url === '/api/v1/atividades' && requisicao.params.has('grupo'),
    );
    expect(pedido.request.params.get('grupo')).toBe('PROXIMOS_7_DIAS');
    expect(pedido.request.params.get('porPagina')).toBe('20');
    pedido.flush(pagina(itens, 12, 1, 20));
    await estabilizar(fixture);
    expect(raiz.querySelectorAll('app-item-atividade').length).toBe(12);
    expect(raiz.querySelector('.grupo__mais')).toBeNull();
  });

  it('aba Concluídas: lista paginada da mais recente; desmarcar reabre', async () => {
    const { fixture, raiz } = await criar(agenda({ CONCLUIDAS: { itens: [], total: 1 } }));
    const aba = [...raiz.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (item) => texto(item) === 'Concluídas',
    );
    aba?.click();
    await estabilizar(fixture);
    const pedido = http.expectOne(
      (requisicao) =>
        requisicao.url === '/api/v1/atividades' && requisicao.params.get('grupo') === 'CONCLUIDAS',
    );
    expect(pedido.request.params.get('pagina')).toBe('1');
    expect(pedido.request.params.get('porPagina')).toBe('20');
    const feita = atividade('c1', {
      titulo: 'Kickoff',
      status: 'CONCLUIDA',
      grupo: 'CONCLUIDAS',
      concluidaEm: dia(0, 9, 30).toISOString(),
    });
    pedido.flush(pagina([feita], 1));
    await estabilizar(fixture);
    expect(texto(raiz.querySelector('[data-atividade="c1"] .item__quando'))).toBe(
      'Concluída hoje às 09:30',
    );
    expect(caixaDe(raiz, 'c1')?.checked).toBe(true);

    caixaDe(raiz, 'c1')?.click();
    await estabilizar(fixture);
    http.expectOne('/api/v1/atividades/c1/reabrir').flush({ ...feita, status: 'PENDENTE' });
    await estabilizar(fixture);
    responder(agenda({ HOJE: [{ ...feita, status: 'PENDENTE' }] }));
    http
      .expectOne(
        (requisicao) =>
          requisicao.url === '/api/v1/atividades' &&
          requisicao.params.get('grupo') === 'CONCLUIDAS',
      )
      .flush(pagina([], 0));
    await estabilizar(fixture);
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe('Atividade reaberta.');
    expect(texto(raiz.querySelector('app-estado-vazio'))).toContain('Nenhuma atividade concluída');
  });

  it('erro ao carregar: mensagem, código para o suporte e "Tentar de novo"', async () => {
    const fixture = TestBed.createComponent(Atividades);
    fixture.detectChanges();
    http.expectOne(ehAgenda).flush(
      {
        statusCode: 500,
        erro: 'erro_interno',
        mensagem: 'Erro interno.',
        requisicaoId: 'req-123',
      },
      { status: 500, statusText: 'Erro' },
    );
    http.expectOne(ehEncaminhadas).flush(pagina([]));
    await estabilizar(fixture);
    const raiz = fixture.nativeElement as HTMLElement;
    const estado = raiz.querySelector('app-estado-vazio');
    expect(texto(estado)).toContain('Não conseguimos carregar as atividades');
    expect(texto(estado)).toContain('req-123');
    // No topo da coluna, antes da criação rápida; sem a lista, os filtros e as abas saem.
    const principal = raiz.querySelector('.principal')!;
    expect(principal.firstElementChild?.tagName.toLowerCase()).toBe('app-estado-vazio');
    expect(raiz.querySelector('.filtros')).toBeNull();
    expect(raiz.querySelector('app-abas')).toBeNull();
    botao(raiz, 'Tentar de novo')?.click();
    await estabilizar(fixture);
    http.expectOne(ehAgenda).flush(agenda({ HOJE: [atividade('a1')] }));
    await estabilizar(fixture);
    expect(raiz.querySelectorAll('app-item-atividade').length).toBe(1);
    expect(raiz.querySelector('.principal > app-estado-vazio')).toBeNull();
    expect(raiz.querySelector('.filtros')).not.toBeNull();
  });

  it('cancelar pelo menu da linha pede confirmação e oferece "Desfazer"', async () => {
    const a1 = atividade('a1', { titulo: 'Enviar contrato' });
    const { fixture, raiz } = await criar(agenda({ HOJE: [a1] }));
    (
      raiz.querySelector('[data-atividade="a1"] app-menu-acoes button') as HTMLButtonElement
    ).click();
    await estabilizar(fixture);
    const cancelar = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => texto(item) === 'Cancelar atividade',
    );
    cancelar?.click();
    await estabilizar(fixture);
    const aberta = TestBed.inject(ConfirmacaoService).aberta();
    expect(aberta?.pedido.titulo).toBe('Cancelar “Enviar contrato”?');
    expect(aberta?.pedido.perigo).toBe(true);
    const execucao = aberta!.pedido.executar!();
    http.expectOne('/api/v1/atividades/a1/cancelar').flush({ ...a1, status: 'CANCELADA' });
    await execucao;
    aberta!.responder(true);
    await estabilizar(fixture);
    responder(agenda({}));
    await estabilizar(fixture);
    const aviso = TestBed.inject(AvisosService).lista().at(-1);
    expect(aviso?.mensagem).toBe('Atividade cancelada.');
    expect(aviso?.acao).toBe('Desfazer');
  });

  describe('criação rápida', () => {
    const campoTitulo = (raiz: HTMLElement) =>
      raiz.querySelector<HTMLInputElement>('app-criacao-rapida app-campo-texto input')!;
    const digitar = (campo: HTMLInputElement, valor: string) => {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    };
    const enviar = (raiz: HTMLElement) =>
      raiz.querySelector('app-criacao-rapida form')!.dispatchEvent(new Event('submit'));

    it('"Ligar para Maria amanhã às 10h" vira ligação para amanhã às 10:00 com o título limpo', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      digitar(campoTitulo(raiz), 'Ligar para Maria amanhã às 10h');
      await estabilizar(fixture);

      const tipoMarcado = raiz.querySelector('app-criacao-rapida .opcao--marcada');
      expect(texto(tipoMarcado)).toBe('Ligação');
      const amanha = dia(1, 10);
      const valorLocal = `${amanha.getFullYear()}-${dois(amanha.getMonth() + 1)}-${dois(amanha.getDate())}T10:00`;
      expect(
        raiz.querySelector<HTMLInputElement>('app-criacao-rapida app-campo-data input')?.value,
      ).toBe(valorLocal);
      expect(texto(raiz.querySelector('app-criacao-rapida app-campo-texto .moldura__dica'))).toBe(
        'Entendido: Ligação, amanhã às 10:00 · título “Ligar para Maria”.',
      );

      enviar(raiz);
      await estabilizar(fixture);
      const pedido = http.expectOne(
        (requisicao) => requisicao.url === '/api/v1/atividades' && requisicao.method === 'POST',
      );
      expect(pedido.request.body).toEqual({
        tipo: 'LIGACAO',
        titulo: 'Ligar para Maria',
        venceEm: amanha.toISOString(),
      });
      pedido.flush(
        atividade('nova', {
          tipo: 'LIGACAO',
          titulo: 'Ligar para Maria',
          venceEm: amanha.toISOString(),
          grupo: 'PROXIMOS_7_DIAS',
        }),
      );
      await estabilizar(fixture);
      responder(agenda({ PROXIMOS_7_DIAS: [atividade('nova', { titulo: 'Ligar para Maria' })] }));
      await estabilizar(fixture);

      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe(
        'Atividade “Ligar para Maria” criada para amanhã às 10:00.',
      );
      // O formulário volta ao início, pronto para a próxima.
      expect(campoTitulo(raiz).value).toBe('');
      expect(texto(raiz.querySelector('app-criacao-rapida .opcao--marcada'))).toBe('Tarefa');
      expect(raiz.querySelector('[data-atividade="nova"]')?.classList).toContain('item--destacada');
    });

    it('sem título não envia; reunião sem início também não', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      enviar(raiz);
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('app-criacao-rapida app-campo-texto .moldura__erro'))).toBe(
        'Escreva o que precisa ser feito.',
      );
      expect(document.activeElement).toBe(campoTitulo(raiz));

      digitar(campoTitulo(raiz), 'Alinhamento semanal');
      const reuniao = [
        ...raiz.querySelectorAll<HTMLInputElement>('app-criacao-rapida input[type="radio"]'),
      ][2];
      reuniao.click();
      await estabilizar(fixture);
      expect(
        [...raiz.querySelectorAll('app-criacao-rapida app-campo-data .moldura__rotulo')].map(texto),
      ).toEqual(['Começa em', 'Termina às']);
      enviar(raiz);
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('app-criacao-rapida app-campo-data .moldura__erro'))).toBe(
        'Diga quando a reunião começa.',
      );
      http.expectNone((requisicao) => requisicao.method === 'POST');
    });

    it('reunião: início e fim (uma hora depois, por padrão)', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      digitar(campoTitulo(raiz), 'Reunião com a diretoria amanhã às 15h');
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('app-criacao-rapida .opcao--marcada'))).toBe('Reunião');
      const datas = raiz.querySelectorAll<HTMLInputElement>(
        'app-criacao-rapida app-campo-data input',
      );
      expect(datas[1].value).toBe('16:00');
      enviar(raiz);
      await estabilizar(fixture);
      const pedido = http.expectOne((requisicao) => requisicao.method === 'POST');
      expect(pedido.request.body).toEqual({
        tipo: 'REUNIAO',
        titulo: 'Reunião com a diretoria',
        inicioEm: dia(1, 15).toISOString(),
        fimEm: dia(1, 16).toISOString(),
      });
    });

    it('o tipo escolhido à mão vence a frase', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      const email = [
        ...raiz.querySelectorAll<HTMLInputElement>('app-criacao-rapida input[type="radio"]'),
      ][3];
      email.click();
      digitar(campoTitulo(raiz), 'Ligar para o Bruno');
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('app-criacao-rapida .opcao--marcada'))).toBe('E-mail');
    });

    it('vínculo: busca contatos, empresas e negócios; o escolhido vai na criação', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      const busca = raiz.querySelector<HTMLInputElement>(
        'app-seletor-vinculo input[role="combobox"]',
      )!;
      expect(busca.getAttribute('aria-expanded')).toBe('false');
      digitar(busca, 'pad');
      await new Promise((resolver) => setTimeout(resolver, ESPERA_BUSCA_MS + 20));
      await estabilizar(fixture);
      const pedidos: Record<string, TestRequest> = {};
      for (const rota of ['contatos', 'empresas', 'negocios']) {
        pedidos[rota] = http.expectOne(
          (requisicao) =>
            requisicao.url === `/api/v1/${rota}` && requisicao.params.get('busca') === 'pad',
        );
      }
      pedidos['contatos'].flush(
        pagina([
          {
            id: 'c1',
            nome: 'Fernando Oliveira',
            email: null,
            empresa: { id: 'e1', nome: 'Padaria Pão Dourado' },
          },
        ]),
      );
      pedidos['empresas'].flush(
        pagina([{ id: 'e1', nome: 'Padaria Pão Dourado', cidade: 'Recife', uf: 'PE' }]),
      );
      pedidos['negocios'].flush(
        pagina([
          {
            id: 'n1',
            titulo: 'Padaria Pão Dourado — filiais',
            funil: { nome: 'Comercial' },
            etapa: { nome: 'Proposta' },
            contato: { id: 'c1' },
            empresa: { id: 'e1' },
          },
        ]),
      );
      await estabilizar(fixture);

      expect(busca.getAttribute('aria-expanded')).toBe('true');
      expect([...raiz.querySelectorAll('.vinculo__grupo-titulo')].map(texto)).toEqual([
        'Contatos',
        'Empresas',
        'Negócios',
      ]);
      expect(texto(raiz.querySelector('app-seletor-vinculo [aria-live]'))).toBe(
        '3 resultados. Use as setas para escolher.',
      );
      // Setas: a primeira já está ativa; duas para baixo chegam ao negócio.
      busca.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      busca.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await estabilizar(fixture);
      const ativa = document.getElementById(busca.getAttribute('aria-activedescendant')!);
      expect(texto(ativa)).toContain('Padaria Pão Dourado — filiais');
      busca.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('.vinculo__escolhido .vinculo__nome'))).toBe(
        'Padaria Pão Dourado — filiais',
      );
      expect(texto(raiz.querySelector('.vinculo__escolhido .vinculo__tipo'))).toBe('Negócio');
      expect(raiz.querySelector('.vinculo__tirar')?.getAttribute('aria-label')).toBe(
        'Tirar o vínculo com Padaria Pão Dourado — filiais',
      );

      digitar(campoTitulo(raiz), 'Enviar proposta revisada');
      enviar(raiz);
      await estabilizar(fixture);
      const criacao = http.expectOne((requisicao) => requisicao.method === 'POST');
      expect(criacao.request.body).toEqual({
        tipo: 'TAREFA',
        titulo: 'Enviar proposta revisada',
        venceEm: null,
        negocioId: 'n1',
      });
    });
  });

  describe('painel de detalhe (?atividade=)', () => {
    async function abrirPainel(detalhe: Atividade) {
      const { fixture, raiz } = await criar(agenda({ HOJE: [detalhe] }));
      fixture.componentRef.setInput('atividade', detalhe.id);
      await estabilizar(fixture);
      http.expectOne(ehDetalhe(detalhe.id)).flush(detalhe);
      await estabilizar(fixture);
      const painel = raiz.querySelector('app-detalhe-atividade dialog') as HTMLElement;
      return { fixture, raiz, painel };
    }

    it('mostra quando, responsável, vínculos com links e o "Encaminhada de"', async () => {
      const detalhe = atividade('a1', {
        tipo: 'REUNIAO',
        titulo: 'Apresentação para a diretoria',
        descricao: 'Levar a simulação de preços.',
        venceEm: dia(1, 10).toISOString(),
        inicioEm: dia(1, 10).toISOString(),
        fimEm: dia(1, 11).toISOString(),
        contato: { id: 'c1', nome: 'Beatriz Cardoso' },
        empresa: { id: 'e1', nome: 'Clínica Vida Plena' },
        negocio: { id: 'n1', titulo: 'Clínica — implantação', funilId: 'f1' },
        encaminhadaDe: { id: 'p', nome: 'Pedro Santos' },
        encaminhadaEm: '2026-10-21T21:11:01.619Z',
      });
      const { painel } = await abrirPainel(detalhe);
      expect(texto(painel.querySelector('h2'))).toBe('Apresentação para a diretoria · Reunião');
      expect(texto(painel.querySelector('.painel__descricao'))).toBe(
        'Pendente · amanhã, 10:00–11:00',
      );
      const dados = Object.fromEntries(
        [...painel.querySelectorAll('.detalhe__dado')].map((dado) => [
          texto(dado.querySelector('dt')),
          texto(dado.querySelector('dd')),
        ]),
      );
      expect(dados['Quando']).toMatch(/, das 10:00 às 11:00$/);
      expect(dados['Responsável']).toContain('João Batista');
      expect(dados['Contato']).toBe('Beatriz Cardoso');
      expect(painel.querySelector('.detalhe__link[href="/contatos/c1"]')).not.toBeNull();
      expect(painel.querySelector('.detalhe__link[href="/empresas/e1"]')).not.toBeNull();
      expect(painel.querySelector('.detalhe__link[href="/funis/f1?negocio=n1"]')).not.toBeNull();
      expect(texto(painel.querySelector('.detalhe__encaminhada'))).toContain(
        'Encaminhada de Pedro Santos',
      );
      expect(texto(painel.querySelector('.detalhe__texto'))).toBe('Levar a simulação de preços.');
      expect(botao(painel, 'Concluir')).toBeDefined();
    });

    it('concluir no painel avisa e recarrega a lista', async () => {
      const detalhe = atividade('a1', { titulo: 'Enviar contrato' });
      const { fixture, painel } = await abrirPainel(detalhe);
      botao(painel, 'Concluir')?.click();
      await estabilizar(fixture);
      http.expectOne('/api/v1/atividades/a1/concluir').flush({ ...detalhe, status: 'CONCLUIDA' });
      await estabilizar(fixture);
      responder(agenda({}));
      await estabilizar(fixture);
      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe('Atividade concluída.');
      expect(botao(painel, 'Reabrir')).toBeDefined();
    });

    it('editar: o formulário salva só pela API e volta para os dados', async () => {
      const detalhe = atividade('a1', { titulo: 'Enviar contrato' });
      const { fixture, painel } = await abrirPainel(detalhe);
      botao(painel, 'Editar')?.click();
      await estabilizar(fixture);
      const titulo = painel.querySelector<HTMLInputElement>('app-campo-texto input')!;
      expect(titulo.value).toBe('Enviar contrato');
      titulo.value = 'Enviar contrato assinado';
      titulo.dispatchEvent(new Event('input'));
      await estabilizar(fixture);
      painel.querySelector('form')?.dispatchEvent(new Event('submit'));
      await estabilizar(fixture);
      const pedido = http.expectOne(
        (requisicao) => requisicao.method === 'PATCH' && requisicao.url === '/api/v1/atividades/a1',
      );
      expect(pedido.request.body).toEqual({
        tipo: 'TAREFA',
        titulo: 'Enviar contrato assinado',
        prioridade: 'MEDIA',
        descricao: null,
        venceEm: dia(0).toISOString(),
      });
      pedido.flush({ ...detalhe, titulo: 'Enviar contrato assinado' });
      await estabilizar(fixture);
      responder(agenda({}));
      await estabilizar(fixture);
      expect(texto(painel.querySelector('h2'))).toBe('Enviar contrato assinado · Tarefa');
      expect(painel.querySelector('form')).toBeNull();
      expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe('Atividade salva.');
    });

    it('atividade que não existe (ou que a pessoa não vê): estado de não encontrada', async () => {
      const { fixture, raiz } = await criar(agenda({}));
      fixture.componentRef.setInput('atividade', 'sumiu');
      await estabilizar(fixture);
      http.expectOne(ehDetalhe('sumiu')).flush(
        {
          statusCode: 404,
          erro: 'nao_encontrado',
          mensagem: 'Atividade não encontrada.',
          requisicaoId: 'r',
        },
        { status: 404, statusText: 'Not Found' },
      );
      await estabilizar(fixture);
      expect(texto(raiz.querySelector('app-detalhe-atividade app-estado-vazio'))).toContain(
        'Atividade não encontrada',
      );
      // Sem atividade, sem botões: o rodapé do painel fica vazio (e o painel o esconde).
      expect(raiz.querySelector('app-detalhe-atividade .detalhe__rodape')).toBeNull();
      expect(raiz.querySelector('app-detalhe-atividade .painel__rodape')?.children.length).toBe(0);
    });
  });
});

describe('listarNomes', () => {
  it('junta os nomes como numa frase', () => {
    expect(listarNomes([])).toBe('');
    expect(listarNomes(['Ana'])).toBe('Ana');
    expect(listarNomes(['Ana', 'Bruno'])).toBe('Ana e Bruno');
    expect(listarNomes(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla');
  });
});
