import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import type { RespostaSaude } from '../../nucleo/saude';
import { URL_SAUDE } from '../../nucleo/saude.service';
import type { Area } from '../../nucleo/sessao/perfil';
import { entrarComo, type PapelDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import type { Atividade, GrupoAtividade } from '../atividades/atividades.api';
import { formatarIntervalo, Inicio } from './inicio';
import { COMERCIAL, CS, MARKETING, metricas } from './metricas-de-teste';
import type { MetricasDoFunil } from './metricas-jornada';
import { PAINEIS_DE_TESTE } from '../bi/bi-de-teste';
import type { IdPainel } from '../bi/bi.tipos';

const RESPOSTA_OK: RespostaSaude = {
  status: 'ok',
  versao: '0.0.1',
  ambiente: 'production',
  horario: '2026-10-20T18:00:00.000Z',
  uptimeSegundos: 42,
  banco: { status: 'ok', latenciaMs: 3 },
  migrations: { aplicadas: 1, ultima: '20261020180000_inicial' },
};

const texto = (elemento: Element | null | undefined) =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const pagina = <T>(itens: readonly T[]) => ({
  itens,
  total: itens.length,
  pagina: 1,
  porPagina: 100,
});

const ATUAIS: Readonly<Record<Area, MetricasDoFunil>> = { MARKETING, COMERCIAL, CS };
const ANTERIORES: Readonly<Record<Area, MetricasDoFunil>> = {
  MARKETING: metricas('MARKETING', [['Novo lead', 'ABERTA', null]], [16]),
  COMERCIAL: metricas(
    'COMERCIAL',
    [
      ['Novo', 'ABERTA', null],
      ['Ganho', 'GANHO', null],
    ],
    [10, 2],
  ),
  CS: metricas('CS', [['Boas-vindas', 'ABERTA', null]], [3]),
};
const VAZIAS: Readonly<Record<Area, MetricasDoFunil>> = {
  MARKETING: metricas(
    'MARKETING',
    [
      ['Novo lead', 'ABERTA', null],
      ['Qualificado (MQL)', 'GANHO', null],
    ],
    [0, 0],
  ),
  COMERCIAL: metricas(
    'COMERCIAL',
    [
      ['Novo', 'ABERTA', null],
      ['Ganho', 'GANHO', null],
    ],
    [0, 0],
  ),
  CS: metricas(
    'CS',
    [
      ['Boas-vindas', 'ABERTA', null],
      ['Renovado', 'GANHO', null],
    ],
    [0, 0],
  ),
};

const dias = (quantos: number) => new Date(Date.now() - quantos * 86_400_000).toISOString();

/** Os ganhos do Comercial: dois no período (R$ 14.400,50) e um antigo, que não conta. */
const GANHOS = [
  { valor: '10000.00', ganhoEm: dias(1), atualizadoEm: dias(1) },
  { valor: '4400.50', ganhoEm: dias(2), atualizadoEm: dias(2) },
  { valor: '9999.00', ganhoEm: dias(60), atualizadoEm: dias(3) },
];

const AREAS_DO_PAPEL: Readonly<Record<PapelDeTeste, readonly Area[]>> = {
  ADMIN: ['MARKETING', 'COMERCIAL', 'CS'],
  C_LEVEL: ['MARKETING', 'COMERCIAL', 'CS'],
  LIDER: ['COMERCIAL'],
  MEMBRO: ['COMERCIAL'],
  LIDER_COMERCIAL: ['COMERCIAL'],
  COMERCIAL: ['COMERCIAL'],
  LIDER_MARKETING: ['MARKETING'],
  MARKETING: ['MARKETING'],
  LIDER_CS: ['CS'],
  CS: ['CS'],
};

const PAINEIS_DO_PAPEL: Readonly<Record<PapelDeTeste, readonly IdPainel[]>> = {
  ADMIN: ['marketing', 'comercial', 'cs', 'atendimento', 'financeiro'],
  C_LEVEL: ['marketing', 'comercial', 'cs', 'atendimento', 'financeiro'],
  LIDER: ['comercial', 'atendimento'],
  MEMBRO: ['comercial', 'atendimento'],
  LIDER_COMERCIAL: ['comercial', 'atendimento'],
  COMERCIAL: ['comercial', 'atendimento'],
  LIDER_MARKETING: ['marketing'],
  MARKETING: ['marketing'],
  LIDER_CS: ['cs', 'atendimento', 'financeiro'],
  CS: ['cs', 'atendimento', 'financeiro'],
};

function atividade(id: string, ajustes: Partial<Atividade> = {}): Atividade {
  return {
    id,
    tipo: 'LIGACAO',
    titulo: `Atividade ${id}`,
    descricao: null,
    status: 'PENDENTE',
    prioridade: 'MEDIA',
    venceEm: new Date(Date.now() + 3_600_000).toISOString(),
    inicioEm: null,
    fimEm: null,
    atrasada: false,
    grupo: 'HOJE',
    responsavel: { id: 'eu', nome: 'Ana Ribeiro' },
    criadoPor: null,
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

function agenda(grupos: Partial<Record<GrupoAtividade, readonly Atividade[]>>) {
  const ordem: GrupoAtividade[] = [
    'ATRASADAS',
    'HOJE',
    'PROXIMOS_7_DIAS',
    'MAIS_TARDE',
    'SEM_DATA',
    'CONCLUIDAS',
  ];
  return {
    referencia: {},
    grupos: ordem.map((grupo) => ({
      grupo,
      rotulo: grupo,
      total: grupos[grupo]?.length ?? 0,
      itens: grupos[grupo] ?? [],
    })),
  };
}

const AGENDA_PADRAO = agenda({
  ATRASADAS: [
    atividade('a1', {
      titulo: 'Retornar à Padaria',
      atrasada: true,
      grupo: 'ATRASADAS',
      venceEm: dias(1),
    }),
  ],
  HOJE: [atividade('a2', { titulo: 'Enviar proposta', tipo: 'EMAIL' })],
});

describe('formatarIntervalo', () => {
  it('conta os dias do período terminando hoje; o ano só aparece quando muda', () => {
    const hoje = new Date(2026, 9, 20);
    expect(formatarIntervalo(hoje, 30, 'pt-BR')).toBe('21/09 a 20/10/2026');
    expect(formatarIntervalo(hoje, 7, 'pt-BR')).toBe('14/10 a 20/10/2026');
    expect(formatarIntervalo(hoje, 90, 'pt-BR')).toBe('23/07 a 20/10/2026');
    expect(formatarIntervalo(new Date(2026, 0, 10), 30, 'pt-BR')).toBe('12/12/2025 a 10/01/2026');
  });
});

describe('Inicio (visão geral)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });

  afterEach(() => localStorage.clear());

  async function estabilizar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * Responde as métricas da jornada: os funis visíveis, as métricas de cada um (o período e
   * o anterior) e os ganhos do Comercial (a receita).
   */
  async function responderJornada(
    fixture: ComponentFixture<unknown>,
    areas: readonly Area[],
    atuais: Readonly<Record<Area, MetricasDoFunil>> = ATUAIS,
  ) {
    http
      .expectOne('/api/v1/funis')
      .flush(
        areas.map((area) => ({ id: `funil-${area}`, nome: area, area, base: true, ativo: true })),
      );
    await estabilizar(fixture);
    const pedidos = http.match((requisicao) => requisicao.url.endsWith('/metricas'));
    expect(pedidos.length).toBe(areas.length * 2);
    for (const area of areas) {
      const doFunil = pedidos.filter((pedido) => pedido.request.url.includes(`funil-${area}`));
      const [anterior, atual] = [...doFunil].sort((a, b) =>
        (a.request.params.get('de') ?? '').localeCompare(b.request.params.get('de') ?? ''),
      );
      expect(anterior.request.params.get('ate')).toBe(atual.request.params.get('de'));
      atual.flush(atuais[area]);
      anterior.flush(ANTERIORES[area]);
    }
    for (const pedido of http.match((requisicao) => requisicao.url === '/api/v1/negocios')) {
      expect(pedido.request.params.get('status')).toBe('GANHO');
      expect(pedido.request.params.get('ordenarPor')).toBe('atualizadoEm');
      pedido.flush(pagina(GANHOS));
    }
    await estabilizar(fixture);
  }

  /** Responde a lista de painéis do BI e o período de cada painel que a Visão geral usa. */
  async function responderBi(
    fixture: ComponentFixture<unknown>,
    paineis: readonly IdPainel[],
    falhar?: IdPainel,
  ) {
    http.expectOne('/api/v1/bi/paineis').flush({ paineis });
    await estabilizar(fixture);
    for (const painel of ['comercial', 'cs', 'atendimento', 'financeiro'] as const) {
      const pedidos = http.match((requisicao) => requisicao.url === `/api/v1/bi/${painel}`);
      expect(pedidos.length, painel).toBe(paineis.includes(painel) ? 1 : 0);
      pedidos.forEach((pedido) =>
        painel === falhar
          ? pedido.flush(
              { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'r' },
              { status: 500, statusText: 'Erro' },
            )
          : pedido.flush(PAINEIS_DE_TESTE[painel]),
      );
    }
    await estabilizar(fixture);
  }

  /** Cria a página e responde tudo o que ela pede ao abrir. */
  async function criar(
    opcoes: {
      readonly papel?: PapelDeTeste;
      readonly atuais?: Readonly<Record<Area, MetricasDoFunil>>;
      readonly proximas?: ReturnType<typeof agenda>;
      readonly paineis?: readonly IdPainel[];
      readonly falhar?: IdPainel;
    } = {},
  ) {
    const papel = opcoes.papel ?? 'ADMIN';
    entrarComo(papel);
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    const pedidoUsuarios = http.match((requisicao) => requisicao.url === '/api/v1/usuarios');
    for (const pedido of pedidoUsuarios) {
      pedido.flush(
        pagina(
          ['Ana Ribeiro', 'Carla Nogueira', 'Lucas Prado', 'Rafael Souto'].map((nome) => ({
            nome,
            avatarUrl: null,
          })),
        ),
      );
    }
    const proximas = http.expectOne(
      (requisicao) => requisicao.url === '/api/v1/atividades/agrupadas',
    );
    expect(proximas.request.params.get('escopo')).toBe('MINHAS');
    expect(proximas.request.params.get('limitePorGrupo')).toBe('5');
    proximas.flush(opcoes.proximas ?? AGENDA_PADRAO);
    await responderJornada(fixture, AREAS_DO_PAPEL[papel], opcoes.atuais);
    await responderBi(fixture, opcoes.paineis ?? PAINEIS_DO_PAPEL[papel], opcoes.falhar);
    const raiz = fixture.nativeElement as HTMLElement;
    const clicar = async (seletor: string, rotulo: string) => {
      const alvo = [...raiz.querySelectorAll<HTMLElement>(seletor)].find(
        (elemento) => texto(elemento) === rotulo,
      );
      expect(alvo, `${seletor} "${rotulo}"`).toBeDefined();
      alvo?.click();
      await estabilizar(fixture);
    };
    return {
      fixture,
      raiz,
      pediuUsuarios: pedidoUsuarios.length > 0,
      aba: (rotulo: string) => clicar('[role="tab"]', rotulo),
      periodo: (rotulo: string) => clicar('[role="radio"]', rotulo),
      abas: () => [...raiz.querySelectorAll('[role="tab"]')].map(texto),
      totais: () => [...raiz.querySelectorAll('app-barra-funil .funil__total')].map(texto),
      etapas: () => [...raiz.querySelectorAll('app-barra-funil .funil__etapa')].map(texto),
      /** "R$ 14,4 mil": prefixo, valor e unidade de cada indicador (sem o selo de variação). */
      numeros: (seletor: string) =>
        [...raiz.querySelectorAll(`${seletor} app-indicador`)].map((indicador) =>
          [...indicador.querySelectorAll('.indicador__unidade, .indicador__valor')]
            .map(texto)
            .join(' '),
        ),
      legendas: (seletor: string) =>
        [...raiz.querySelectorAll(`${seletor} app-indicador .indicador__legenda`)].map(texto),
      /** Texto do balão de uma dica, pelo rótulo do botão "?". */
      dica: (rotulo: string) => {
        const botao = raiz.querySelector(`app-dica button[aria-label="${rotulo}"]`);
        return texto(raiz.querySelector(`#${botao?.getAttribute('aria-describedby')}`));
      },
    };
  }

  it('cabeçalho: título em dois tons, a frase e a pilha com quem usa o CRM (sem selo global)', async () => {
    const { raiz, pediuUsuarios } = await criar();
    const titulo = raiz.querySelector('h1');
    const mes = formatDate(new Date(), "MMMM 'de' y", 'pt-BR');
    expect(texto(titulo)).toBe(`Visão geral · ${mes}`);
    expect(texto(titulo?.querySelector('.tom-fraco'))).toBe('·');
    expect(texto(titulo?.querySelector('.tom-fraco.sem-quebra'))).toBe(mes);
    expect(texto(raiz.querySelector('.cabecalho__frase'))).toBe(
      'Da captação do lead ao sucesso do cliente, em um só lugar.',
    );
    // Os dados de exemplo agora são sinalizados bloco a bloco, não na página inteira.
    expect(raiz.querySelector('.cabecalho app-selo')).toBeNull();
    expect(pediuUsuarios).toBe(true);
    expect(raiz.querySelector('app-pilha-avatares')?.getAttribute('aria-label')).toBe(
      'Quem usa o CRM: Ana Ribeiro, Carla Nogueira, Lucas Prado e mais 1 pessoa',
    );
  });

  it('o membro não pede a lista de usuários (vê só a si mesmo) e não ganha a pilha', async () => {
    const { raiz, pediuUsuarios } = await criar({ papel: 'COMERCIAL' });
    expect(pediuUsuarios).toBe(false);
    expect(raiz.querySelector('app-pilha-avatares')).toBeNull();
  });

  it('o período mostra as datas que cobre, ligadas ao grupo de opções', async () => {
    const { fixture, raiz, periodo } = await criar();
    const intervalo = raiz.querySelector('.cabecalho__intervalo') as HTMLElement;
    const grupo = raiz.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute('aria-describedby')).toBe(intervalo.id);
    expect(texto(intervalo)).toBe(formatarIntervalo(new Date(), 30, 'pt-BR'));
    await periodo('Trimestre');
    expect(texto(intervalo)).toBe(formatarIntervalo(new Date(), 90, 'pt-BR'));
    await responderJornada(fixture, AREAS_DO_PAPEL.ADMIN);
  });

  it('jornada do cliente com as métricas reais: indicadores, áreas e as etapas de cada uma', async () => {
    const { fixture, raiz, abas, totais, etapas, numeros, legendas, dica } = await criar();
    expect(abas()).toEqual(['Jornada do cliente', 'Atendimento', 'Equipe']);
    expect(raiz.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');
    const titulo = raiz.querySelector('[role="tabpanel"] h2');
    expect(texto(titulo)).toBe('Jornada do cliente · 30 dias');
    expect(titulo?.classList).toContain('visualmente-oculto');
    // A jornada é real: nenhum selo de exemplo nela.
    expect(texto(raiz.querySelector('app-inicio-jornada'))).not.toContain('exemplo');

    expect(numeros('app-inicio-jornada')).toEqual(['15 %', '12 d', 'R$ 14,4 mil']);
    expect(legendas('app-inicio-jornada')).toEqual([
      'Conversão total do funil',
      'Ciclo médio de venda',
      'Receita ganha',
    ]);
    expect(dica('Sobre: Conversão total do funil')).toBe(
      'Negócios ganhos no Comercial em relação aos leads que entraram no Marketing no período: 3 de 20.',
    );
    expect(dica('Sobre: Receita ganha')).toBe(
      'Soma do valor dos 2 negócios ganhos no Comercial no período.',
    );

    // Com as três áreas, cada uma mostra a entrada e o ganho.
    expect([...raiz.querySelectorAll('.etapas__nome')].map(texto)).toEqual([
      'Marketing',
      'Comercial',
      'Customer Success',
    ]);
    expect(raiz.querySelector('.etapas__nome a')?.getAttribute('href')).toBe('/funis/marketing');
    expect(etapas()).toEqual([
      'Novo lead',
      'Qualificado (MQL)',
      'Novo',
      'Ganho',
      'Boas-vindas',
      'Renovado',
    ]);
    expect(totais()).toEqual(['20', '4', '12', '3', '5', '1']);
    expect(texto(raiz.querySelector('app-inicio-jornada app-legenda'))).toBe(
      'Seguiram adiante Pararam na etapa',
    );
    expect(dica('Como ler o funil')).toContain('nos últimos 30 dias chegaram até ela');
    expect([...raiz.querySelectorAll('.etapas__passagem-texto')].map(texto)).toEqual([
      'passagem automática',
      'passagem automática',
    ]);
    expect(dica('Como o negócio chega ao Comercial')).toContain('qualificado (MQL)');
    expect([...raiz.querySelectorAll('.etapas__parados')].map(texto)).toEqual([
      '3 parados',
      '1 parado',
    ]);
    expect(raiz.querySelector('app-barra-funil[role="img"]')?.getAttribute('aria-label')).toBe(
      'Novo lead: 20; Seguiram adiante 4, Pararam na etapa 16; tempo médio de 2 dias',
    );

    // "Ver todas as etapas" abre o Marketing inteiro (e diz que está aberto).
    const alternar = raiz.querySelector<HTMLButtonElement>('.etapas__alternar')!;
    expect(alternar.getAttribute('aria-expanded')).toBe('false');
    expect(texto(alternar)).toBe('Ver todas as etapas de Marketing');
    alternar.click();
    await estabilizar(fixture);
    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    expect(etapas().slice(0, 4)).toEqual([
      'Novo lead',
      'Em contato',
      'Nutrição',
      'Qualificado (MQL)',
    ]);
    expect(totais().slice(0, 4)).toEqual(['20', '10', '6', '4']);
  });

  it('quem vê uma área só: as etapas dela abertas e a taxa da própria área', async () => {
    const { raiz, etapas, numeros, legendas } = await criar({ papel: 'COMERCIAL' });
    expect([...raiz.querySelectorAll('.etapas__nome')].map(texto)).toEqual(['Comercial']);
    expect(etapas()).toEqual(['Novo', 'Qualificação', 'Ganho']);
    expect(raiz.querySelector('.etapas__alternar')).toBeNull();
    expect(raiz.querySelector('.etapas__passagem')).toBeNull();
    expect(legendas('app-inicio-jornada')).toEqual([
      'Taxa de ganho',
      'Ciclo médio de venda',
      'Receita ganha',
    ]);
    expect(numeros('app-inicio-jornada')[0]).toBe('25 %');
    // A taxa de ganho não se repete nos indicadores: lá vão os negócios novos da área.
    expect(legendas('app-inicio-indicadores')).toEqual(['Negócios novos em 30 dias']);
  });

  it('o Marketing (sem o Comercial) vê os negócios parados no lugar da receita', async () => {
    const { legendas, numeros } = await criar({ papel: 'MARKETING' });
    expect(legendas('app-inicio-jornada')).toEqual([
      'Taxa de qualificação',
      'Ciclo até a qualificação',
      'Negócios parados agora',
    ]);
    expect(numeros('app-inicio-jornada')).toEqual(['20 %', '6,5 d', '3']);
  });

  it('sem negócios no período: estado vazio com o atalho para os funis', async () => {
    const { raiz } = await criar({ atuais: VAZIAS });
    const vazio = raiz.querySelector('app-inicio-jornada app-estado-vazio');
    expect(texto(vazio)).toContain('Nenhum negócio no período');
    expect(texto(vazio)).toContain('negócios criados nos últimos 30 dias');
    expect(vazio?.querySelector('a')?.getAttribute('href')).toBe('/funis');
    expect(raiz.querySelector('app-inicio-jornada app-barra-funil')).toBeNull();
  });

  it('erro nas métricas: mensagem, código e "Tentar de novo"', async () => {
    entrarComo('ADMIN');
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    http.expectOne(URL_SAUDE).flush(RESPOSTA_OK);
    http
      .match((requisicao) => requisicao.url === '/api/v1/usuarios')
      .forEach((p) => p.flush(pagina([])));
    http
      .expectOne((requisicao) => requisicao.url === '/api/v1/atividades/agrupadas')
      .flush(agenda({}));
    http
      .expectOne('/api/v1/funis')
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'req-9' },
        { status: 500, statusText: 'Erro' },
      );
    await estabilizar(fixture);
    const raiz = fixture.nativeElement as HTMLElement;
    const erro = raiz.querySelector('app-inicio-jornada app-estado-vazio');
    expect(texto(erro)).toContain('Não conseguimos carregar as métricas');
    expect(texto(erro)).toContain('req-9');
    // Os indicadores reais ficam com "—" (sem esqueleto eterno); os de exemplo continuam.
    expect(
      [...raiz.querySelectorAll('app-inicio-indicadores .indicador__valor')].map(texto).slice(0, 2),
    ).toEqual(['—', '—']);
    (erro?.querySelector('button') as HTMLButtonElement).click();
    await estabilizar(fixture);
    await responderJornada(fixture, AREAS_DO_PAPEL.ADMIN);
    expect(raiz.querySelectorAll('app-inicio-jornada app-barra-funil').length).toBe(6);
  });

  it('indicadores: leads e taxa de ganho da jornada; MRR e clientes em risco vêm do BI', async () => {
    const { raiz, numeros, legendas, dica } = await criar();
    expect(texto(raiz.querySelector('.kpis__base'))).toBe(
      'Variações em relação aos 30 dias anteriores',
    );
    expect(numeros('app-inicio-indicadores')).toEqual(['20', '25 %', 'R$ 119,5 mil', '5']);
    // "30 dias" preso por um espaço inseparável (não se parte na legenda).
    expect(raiz.querySelector('app-inicio-indicadores .indicador__legenda')?.textContent).toBe(
      'Leads em 30\u00a0dias',
    );
    expect(legendas('app-inicio-indicadores')).toEqual([
      'Leads em 30 dias',
      'Taxa de ganho',
      'Receita recorrente (MRR)',
      'Clientes em risco alto',
    ]);
    // Nada de "exemplo": os quatro números são reais.
    expect(raiz.querySelector('app-inicio-indicadores app-selo[variante="contorno"]')).toBeNull();
    const variacoes = [...raiz.querySelectorAll('app-inicio-indicadores .indicador__variacao')];
    expect(variacoes.map((selo) => texto(selo.querySelector('span[aria-hidden="true"]')))).toEqual([
      '25%',
      '5 p.p.',
    ]);
    expect(dica('Sobre: Leads em 30 dias')).toContain('A seta compara com os 30 dias anteriores.');
    expect(dica('Sobre: Taxa de ganho')).toContain(
      '3 de 12. A seta compara com os 30 dias anteriores.',
    );
    expect(dica('Sobre: Receita recorrente (MRR)')).toBe(
      'Dica de MRR atual. Valor de hoje, sem comparação.',
    );
    expect(dica('Sobre: Clientes em risco alto')).toContain('Valor de hoje, sem comparação.');
  });

  it('sem o painel financeiro nem o de CS, os indicadores de agora não aparecem', async () => {
    const { legendas } = await criar({ papel: 'COMERCIAL' });
    expect(legendas('app-inicio-indicadores')).toEqual(['Negócios novos em 30 dias']);
  });

  it('troca as abas do palco: atendimento e equipe com os números do BI', async () => {
    const { raiz, aba, etapas, numeros } = await criar();

    await aba('Atendimento');
    const titulo = raiz.querySelector('[role="tabpanel"] h2');
    expect(texto(titulo)).toBe('Atendimento · 30 dias');
    expect(raiz.querySelector('app-inicio-atendimento app-selo[variante="contorno"]')).toBeNull();
    expect(numeros('app-inicio-atendimento')).toEqual(['18', '5 min', '72,5 %', '3,7 / 5']);
    // Canal sem conversa no período não ganha barra.
    expect(etapas()).toEqual(['WhatsApp Vendas', 'Chat do site']);
    expect(texto(raiz.querySelector('app-inicio-atendimento a[href="/bi/atendimento"]'))).toContain(
      'Ver o painel completo',
    );
    expect(raiz.querySelector('app-inicio-jornada')).toBeNull();

    await aba('Equipe');
    expect(texto(raiz.querySelector('[role="tabpanel"] h2'))).toBe('Equipe comercial · 30 dias');
    expect(
      [...raiz.querySelectorAll('app-inicio-equipe .palco__topo app-selo')].map(texto),
    ).toEqual(['11 negócios ganhos']);
    const pessoas = [...raiz.querySelectorAll('.ranking__item')];
    expect(pessoas.length).toBe(2);
    expect(texto(pessoas[0].querySelector('.ranking__nome'))).toBe('1º lugar: Lucas Pereira');
    expect(texto(pessoas[0].querySelector('app-selo'))).toBe('R$ 144 mil');
    expect(texto(pessoas[1].querySelector('.meta__texto'))).toBe('57%');
  });

  it('um painel do BI que falha mostra o erro só na aba dele', async () => {
    const { fixture, raiz, aba } = await criar({ falhar: 'atendimento' });
    await aba('Atendimento');
    expect(texto(raiz.querySelector('app-inicio-atendimento app-estado-vazio'))).toContain(
      'Não conseguimos carregar o atendimento',
    );
    await aba('Equipe');
    expect(raiz.querySelectorAll('.ranking__item').length).toBe(2);
    expect(fixture).toBeTruthy();
  });

  it('o período pede as métricas de novo, do primeiro dia do período até agora', async () => {
    const { fixture, raiz, periodo } = await criar();
    await periodo('7 dias');
    http
      .expectOne('/api/v1/funis')
      .flush([
        { id: 'funil-COMERCIAL', nome: 'Comercial', area: 'COMERCIAL', base: true, ativo: true },
      ]);
    await estabilizar(fixture);
    const pedidos = http.match((requisicao) => requisicao.url.endsWith('/metricas'));
    const de = new Date(pedidos.map((p) => p.request.params.get('de') ?? '').sort()[1]);
    const esperado = new Date();
    esperado.setDate(esperado.getDate() - 6);
    esperado.setHours(0, 0, 0, 0);
    expect(de.toISOString()).toBe(esperado.toISOString());
    pedidos.forEach((pedido) => pedido.flush(COMERCIAL));
    http
      .match((requisicao) => requisicao.url === '/api/v1/negocios')
      .forEach((p) => p.flush(pagina([])));
    await estabilizar(fixture);
    expect(texto(raiz.querySelector('[role="tabpanel"] h2'))).toBe('Jornada do cliente · 7 dias');
    expect(texto(raiz.querySelector('app-inicio-indicadores .indicador__legenda'))).toBe(
      'Leads em 7 dias',
    );
  });

  it('próximas atividades: as pendentes da pessoa, concluir ali mesmo com "Desfazer"', async () => {
    const { fixture, raiz } = await criar();
    const regioes = [...raiz.querySelectorAll('app-cartao[role="region"]')].map((regiao) =>
      texto(raiz.querySelector(`#${regiao.getAttribute('aria-labelledby')}`)),
    );
    expect(regioes).toEqual(['Próximas atividades', 'Status do sistema']);
    expect(texto(raiz.querySelector('.proximas__resumo'))).toBe('1 atrasada · 1 para hoje');
    const linhas = [...raiz.querySelectorAll('.proxima')];
    expect(linhas.map((linha) => texto(linha.querySelector('.proxima__titulo')))).toEqual([
      'Retornar à Padaria',
      'Enviar proposta',
    ]);
    expect(linhas[0].querySelector('.proxima__meta')?.classList).toContain(
      'proxima__meta--atrasada',
    );
    expect(linhas[0].querySelector('a')?.getAttribute('href')).toBe('/atividades?atividade=a1');
    expect(texto(raiz.querySelector('.proximas__total'))).toBe('2 pendentes');

    (linhas[1].querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    await estabilizar(fixture);
    http
      .expectOne('/api/v1/atividades/a2/concluir')
      .flush(atividade('a2', { status: 'CONCLUIDA' }));
    await estabilizar(fixture);
    http
      .expectOne((requisicao) => requisicao.url === '/api/v1/atividades/agrupadas')
      .flush(agenda({ ATRASADAS: AGENDA_PADRAO.grupos[0].itens }));
    await estabilizar(fixture);
    expect([...raiz.querySelectorAll('.proxima__titulo')].map(texto)).toEqual([
      'Retornar à Padaria',
    ]);
    const avisos = TestBed.inject(AvisosService);
    const aviso = avisos.lista().at(-1)!;
    expect(aviso.mensagem).toBe('Atividade concluída.');
    expect(aviso.acao).toBe('Desfazer');
    avisos.agir(aviso.id);
    await estabilizar(fixture);
    http.expectOne('/api/v1/atividades/a2/reabrir').flush(atividade('a2'));
    await estabilizar(fixture);
    http
      .expectOne((requisicao) => requisicao.url === '/api/v1/atividades/agrupadas')
      .flush(AGENDA_PADRAO);
    await estabilizar(fixture);
    expect(raiz.querySelectorAll('.proxima').length).toBe(2);

    const banco = raiz.querySelectorAll('app-inicio-status .status__linha dd')[1];
    expect(texto(banco?.querySelector('app-selo'))).toBe('Conectado');
  });

  it('próximas atividades sem nada pendente: "Tudo em dia"', async () => {
    const { raiz } = await criar({ proximas: agenda({}) });
    expect(texto(raiz.querySelector('app-inicio-atividades app-estado-vazio'))).toContain(
      'Tudo em dia',
    );
    expect(raiz.querySelector('.proximas__rodape')).toBeNull();
  });

  it('o botão "Analisar com IA" só aparece para o Admin e abre o modal', async () => {
    const { fixture, raiz } = await criar();
    const botaoIa = () =>
      [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (botao) => texto(botao) === 'Analisar com IA',
      );
    const iconeIa = () => raiz.querySelector('.cabecalho__icones [aria-label="Analisar com IA"]');
    expect(botaoIa()?.classList).toContain('botao--marca');
    expect(iconeIa()?.classList).toContain('botao-icone--marca');
    botaoIa()?.click();
    await estabilizar(fixture);
    expect(raiz.querySelector('app-analise-ia dialog')?.hasAttribute('open')).toBe(true);
    expect(raiz.querySelector('app-analise-ia')?.textContent).toContain('Comercial');

    for (const papel of ['C_LEVEL', 'LIDER_COMERCIAL', 'COMERCIAL', 'MARKETING', 'CS'] as const) {
      entrarComo(papel);
      await estabilizar(fixture);
      expect(botaoIa(), papel).toBeUndefined();
      expect(iconeIa(), papel).toBeNull();
      expect(raiz.querySelector('app-analise-ia'), papel).toBeNull();
    }
    entrarComo('ADMIN');
    await estabilizar(fixture);
    expect(botaoIa()).toBeDefined();
  });

  it('as abas seguem os painéis do papel: o Marketing não vê Atendimento nem Equipe', async () => {
    const { abas, raiz } = await criar({ papel: 'MARKETING' });
    expect(abas()).toEqual(['Jornada do cliente']);
    expect(raiz.querySelector('app-inicio-atendimento')).toBeNull();
    expect(raiz.querySelector('app-inicio-jornada')).not.toBeNull();
  });

  it('o CS vê o Atendimento e não vê a Equipe comercial', async () => {
    const { abas } = await criar({ papel: 'CS' });
    expect(abas()).toEqual(['Jornada do cliente', 'Atendimento']);
  });

  it('"Compartilhar" copia o link da página e mostra "Link copiado" à vista', async () => {
    const copiar = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copiar },
    });
    try {
      const { fixture, raiz } = await criar();
      const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (elemento) => texto(elemento) === 'Compartilhar',
      );
      const retorno = raiz.querySelector('.cabecalho [aria-live="polite"]') as HTMLElement;
      expect(retorno.classList).not.toContain('visualmente-oculto');
      expect(texto(retorno)).toBe('');

      botao?.click();
      await estabilizar(fixture);
      expect(copiar).toHaveBeenCalledWith(document.location.href);
      expect(texto(botao)).toBe('Link copiado');
      expect(texto(retorno)).toBe('Link copiado.');
      expect(retorno.classList).toContain('cabecalho__retorno--visivel');
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('"Compartilhar" avisa quando não dá para copiar', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('sem permissão')) },
    });
    const execCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    try {
      const { fixture, raiz } = await criar();
      const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.cabecalho button')].find(
        (elemento) => texto(elemento) === 'Compartilhar',
      );
      botao?.click();
      await estabilizar(fixture);
      expect(texto(botao)).toBe('Não deu para copiar');
      expect(texto(raiz.querySelector('.cabecalho [aria-live="polite"]'))).toBe(
        'Não deu para copiar o link. Copie o endereço na barra do navegador.',
      );
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
      if (execCommand) {
        Object.defineProperty(document, 'execCommand', execCommand);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  });
});
