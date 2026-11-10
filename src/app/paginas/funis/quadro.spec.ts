import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import type { Papel } from '../../nucleo/papeis';
import { entrarComo, type PapelDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import {
  colunasDeTeste,
  ETAPAS,
  FUNIL_ID,
  funilDeTeste,
  negocioDeTeste,
  quadroDeTeste,
} from './funis-de-teste';
import type { Funil, Negocio, NivelNoFunil } from './funis.tipos';
import { QuadroFunil } from './quadro';

const [NOVO, PROPOSTA] = ETAPAS;

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('QuadroFunil', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<QuadroFunil>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true);
    http.verify();
  });

  async function abrir(
    papel: PapelDeTeste = 'LIDER_COMERCIAL',
    negocios?: Record<string, Negocio[]>,
    etapaId?: string,
    extra: { funil?: Funil; todos?: readonly Funil[] } = {},
  ) {
    entrarComo(papel);
    fixture = TestBed.createComponent(QuadroFunil);
    fixture.componentRef.setInput('area', 'comercial');
    if (etapaId) {
      fixture.componentRef.setInput('etapaId', etapaId);
    }
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const funil = extra.funil ?? funilDeTeste();
    http.expectOne('/api/v1/funis?area=COMERCIAL').flush([funil]);
    await microtarefas();
    http
      .expectOne((req) => req.url === '/api/v1/funis' && !req.params.has('area'))
      .flush(extra.todos ?? [funil]);
    await microtarefas();
    http
      .expectOne((req) => req.url === `/api/v1/funis/${FUNIL_ID}/quadro`)
      .flush(
        quadroDeTeste(
          colunasDeTeste(
            negocios ?? {
              novo: [
                negocioDeTeste('a', NOVO, {
                  titulo: 'Padaria — delivery',
                  parado: true,
                  diasNaEtapa: 3,
                }),
                negocioDeTeste('b', NOVO, { responsavel: null }),
              ],
              proposta: [negocioDeTeste('c', PROPOSTA, { valor: '12000.00' })],
            },
          ),
        ),
      );
    await microtarefas();
    for (const pedido of http.match((req) => req.url === '/api/v1/atividades')) {
      pedido.flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    }
    for (const pedido of http.match((req) => req.url.endsWith('/etiquetas'))) {
      pedido.flush([]);
    }
    // Dicas do cabeçalho (o líder lê o rodízio da área).
    for (const pedido of http.match(
      (req) => req.url === '/api/v1/regras-distribuicao' || req.url === '/api/v1/passagens',
    )) {
      pedido.flush([]);
    }
    await microtarefas();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function colunaDe(nome: string): HTMLElement {
    const colunas = [...raiz.querySelectorAll<HTMLElement>('.coluna')];
    return colunas.find((coluna) =>
      coluna.querySelector('.coluna__titulo')?.textContent?.includes(nome),
    )!;
  }

  function titulosEm(nome: string): string[] {
    return [...colunaDe(nome).querySelectorAll('.cartao__titulo')].map((el) =>
      el.textContent!.trim(),
    );
  }

  async function teclar(negocioId: string, key: string) {
    const alca = raiz.querySelector<HTMLElement>(`[data-mover="${negocioId}"]`)!;
    alca.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('mostra o título com o total em aberto, as colunas (ganho e perda no fim) e os cartões', async () => {
    await abrir();
    expect(raiz.querySelector('h1')?.textContent).toContain('Comercial');
    expect(raiz.querySelector('h1')?.textContent).toContain('3 em aberto');
    // O "·" fica preso ao título (espaço inseparável) e só depois dele a linha pode quebrar.
    expect(raiz.querySelector('h1')?.textContent?.trim()).toBe('Comercial\u00a0· 3 em aberto');
    expect(raiz.querySelector('h1 .sem-quebra')?.textContent).toBe('3 em aberto');
    const nomes = [...raiz.querySelectorAll('.coluna__titulo')].map((el) =>
      el.childNodes[0].textContent!.trim(),
    );
    expect(nomes).toEqual(['Novo', 'Proposta', 'Ganho', 'Perdido']);
    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    expect(colunaDe('Proposta').querySelector('.coluna__valor')?.textContent).toContain('R$');
  });

  it('cenário 79 — ?etapaId (clique do BI) mostra só a coluna da etapa, com o aviso para voltar a todas', async () => {
    await abrir('LIDER_COMERCIAL', undefined, NOVO.id);
    const nomes = [...raiz.querySelectorAll('.coluna__titulo')].map((el) =>
      el.childNodes[0].textContent!.trim(),
    );
    expect(nomes).toEqual(['Novo']);
    expect(raiz.querySelector('.quadro__aviso')?.textContent).toContain('Etapa Novo');
    expect(raiz.textContent).toContain('Mostrar todas as etapas');
  });

  it('cartão parado ganha o selo coral com o texto; sem responsável mostra "Assumir"', async () => {
    await abrir();
    const parado = raiz.querySelector('[data-negocio-id="a"]')!;
    expect(parado.querySelector('app-selo')?.textContent).toContain('Parado · 3 d');
    const semDono = raiz.querySelector('[data-negocio-id="b"]')!;
    expect(semDono.querySelector('.cartao__assumir')?.textContent).toContain('Assumir');
  });

  it('assumir chama a API e avisa', async () => {
    await abrir('COMERCIAL');
    const avisos = TestBed.inject(AvisosService);
    raiz.querySelector<HTMLButtonElement>('[data-negocio-id="b"] .cartao__assumir')!.click();
    http
      .expectOne('/api/v1/negocios/b/assumir')
      .flush(negocioDeTeste('b', NOVO, { responsavel: { id: 'x', nome: 'João Batista' } }));
    await microtarefas();
    fixture.detectChanges();
    expect(avisos.lista().at(-1)?.mensagem).toBe('Você assumiu “Negócio b”.');
    expect(raiz.querySelector('[data-negocio-id="b"] .cartao__assumir')).toBeNull();
  });

  it('"Configurar etapas" só para quem configura o funil; "Da equipe" desabilitado para membro', async () => {
    await abrir('COMERCIAL');
    expect(raiz.textContent).not.toContain('Configurar etapas');
    const equipe = [...raiz.querySelectorAll<HTMLButtonElement>('app-filtros-pilula button')].find(
      (botao) => botao.textContent?.includes('Da equipe'),
    );
    expect(equipe?.getAttribute('aria-disabled')).toBe('true');
  });

  describe('botões por nível no funil (R5.12)', () => {
    const comNivel = (nivel: NivelNoFunil) => ({ funil: funilDeTeste({ nivel }) });
    const botaoNovo = () =>
      [...raiz.querySelectorAll('button')].some((b) => b.textContent?.includes('Novo negócio'));

    it('VER: só olha, sem novo negócio, sem alça de mover, sem assumir e sem configurar', async () => {
      await abrir('ADMIN', undefined, undefined, comNivel('VER'));
      expect(botaoNovo()).toBe(false);
      expect(raiz.querySelector('[data-mover]')).toBeNull();
      expect(raiz.querySelector('.cartao__assumir')).toBeNull();
      expect(raiz.textContent).not.toContain('Configurar etapas');
      expect(raiz.textContent).not.toContain('Configurar funil');
      expect(raiz.querySelector('.quadro__aviso')?.textContent).toContain('Você só pode ver');
      expect(raiz.querySelectorAll('.cartao').length).toBe(3);
    });

    it.each<NivelNoFunil>(['MEMBRO', 'GESTOR'])(
      '%s: cria e move, mas não configura nem reabre',
      async (nivel) => {
        await abrir('LIDER_COMERCIAL', undefined, undefined, comNivel(nivel));
        expect(botaoNovo()).toBe(true);
        expect(raiz.querySelector('[data-mover]')).not.toBeNull();
        expect(raiz.textContent).not.toContain('Configurar etapas');
        expect(raiz.textContent).not.toContain('Configurar funil');
      },
    );

    describe('MEMBRO que vê todos (veTodos)', () => {
      const negociosMistos = (meuId: string) => ({
        novo: [
          negocioDeTeste('outro', NOVO),
          negocioDeTeste('meu', NOVO, { responsavel: { id: meuId, nome: 'Eu', avatarUrl: null } }),
          negocioDeTeste('livre', NOVO, { responsavel: null }),
        ],
      });
      const meuId = () => {
        entrarComo('LIDER_COMERCIAL');
        return TestBed.inject(SessaoService).usuario()!.id;
      };
      const movers = () =>
        [...raiz.querySelectorAll<HTMLElement>('[data-mover]')].map((e) => e.dataset['mover']);

      it('sem ações no negócio de outra pessoa; os próprios e os sem responsável seguem', async () => {
        await abrir('LIDER_COMERCIAL', negociosMistos(meuId()), undefined, {
          funil: funilDeTeste({ nivel: 'MEMBRO', veTodos: true }),
        });
        expect(raiz.querySelectorAll('.cartao').length).toBe(3);
        expect(movers()).toEqual(['meu', 'livre']);
        expect(raiz.querySelectorAll('.cartao__assumir').length).toBe(1);
      });

      it('sem veTodos (API antiga) mantém o comportamento: age em todos', async () => {
        await abrir('LIDER_COMERCIAL', negociosMistos(meuId()), undefined, {
          funil: funilDeTeste({ nivel: 'MEMBRO' }),
        });
        expect(movers()).toEqual(['outro', 'meu', 'livre']);
      });

      it('GESTOR com veTodos age em todos', async () => {
        await abrir('LIDER_COMERCIAL', negociosMistos(meuId()), undefined, {
          funil: funilDeTeste({ nivel: 'GESTOR', veTodos: true }),
        });
        expect(movers()).toEqual(['outro', 'meu', 'livre']);
      });
    });

    it('CONFIGURAR: também configura o funil (link para a tela) e as etapas', async () => {
      await abrir('COMERCIAL', undefined, undefined, comNivel('CONFIGURAR'));
      expect(botaoNovo()).toBe(true);
      expect(raiz.textContent).toContain('Configurar etapas');
      const link = [...raiz.querySelectorAll('a')].find((a) =>
        a.textContent?.includes('Configurar funil'),
      );
      expect(link?.getAttribute('href')).toBe(`/configuracoes/funis/${FUNIL_ID}`);
    });

    it('o nível manda mais que o papel: líder do setor que só vê não configura', async () => {
      await abrir('LIDER_COMERCIAL', undefined, undefined, comNivel('VER'));
      expect(raiz.textContent).not.toContain('Configurar etapas');
      expect(botaoNovo()).toBe(false);
    });
  });

  describe('seletor de funis agrupado por setor', () => {
    const funilDoCs = funilDeTeste({
      id: 'funil-cs',
      nome: 'Pós-venda',
      area: 'CS',
      nomeSetor: 'Customer Success',
      base: false,
      nivel: 'VER',
    });
    const funilExtra = funilDeTeste({ id: 'funil-extra', nome: 'Parcerias', base: false });

    it('agrupa por setor e inclui os funis de outros setores que a pessoa vê por acesso', async () => {
      await abrir('LIDER_COMERCIAL', undefined, undefined, {
        todos: [funilDoCs, funilExtra, funilDeTeste()],
      });
      const grupos = [...raiz.querySelectorAll('.filtros__funil optgroup')].map((g) => ({
        setor: g.getAttribute('label'),
        funis: [...g.querySelectorAll('option')].map((o) => o.textContent?.trim()),
      }));
      expect(grupos).toEqual([
        { setor: 'Comercial', funis: ['Comercial', 'Parcerias'] },
        { setor: 'Customer Success', funis: ['Pós-venda'] },
      ]);
    });

    it('sem outros funis, o seletor nem aparece', async () => {
      await abrir('LIDER_COMERCIAL');
      expect(raiz.querySelector('.filtros__funil')).toBeNull();
    });
  });

  it('o líder vê "Configurar etapas"', async () => {
    await abrir('LIDER_COMERCIAL');
    expect(raiz.textContent).toContain('Configurar etapas');
  });

  it('teclado: Espaço pega, seta move de etapa, Espaço solta e manda à API com os vizinhos', async () => {
    await abrir();
    await teclar('a', ' ');
    expect(raiz.querySelector('[data-negocio-id="a"] .cartao--pego')).not.toBeNull();
    await teclar('a', 'ArrowRight');
    expect(titulosEm('Proposta')).toEqual(['Padaria — delivery', 'Negócio c']);
    await teclar('a', ' ');
    const pedido = http.expectOne('/api/v1/negocios/a/mover');
    expect(pedido.request.body).toEqual({ etapaId: 'proposta', antesDeId: 'c' });
    pedido.flush({
      negocio: negocioDeTeste('a', PROPOSTA, { titulo: 'Padaria — delivery' }),
      passagens: [],
    });
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe(
      '“Padaria — delivery” movido para Proposta.',
    );
  });

  it('teclado: Esc cancela e o cartão volta', async () => {
    await abrir();
    await teclar('b', ' ');
    await teclar('b', 'ArrowUp');
    expect(titulosEm('Novo')).toEqual(['Negócio b', 'Padaria — delivery']);
    await teclar('b', 'Escape');
    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    expect(http.match('/api/v1/negocios/b/mover')).toHaveLength(0);
  });

  it('teclado: o foco sair do cartão pego (clique fora) devolve o cartão, sem chamar a API', async () => {
    await abrir();
    raiz.querySelector<HTMLElement>('[data-mover="a"]')!.focus();
    await teclar('a', ' ');
    await teclar('a', 'ArrowRight');
    expect(titulosEm('Proposta')).toEqual(['Padaria — delivery', 'Negócio c']);
    expect(document.activeElement?.getAttribute('data-mover')).toBe('a');

    raiz.querySelector<HTMLElement>('h1')!.setAttribute('tabindex', '-1');
    raiz.querySelector<HTMLElement>('h1')!.focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    expect(titulosEm('Proposta')).toEqual(['Negócio c']);
    expect(raiz.querySelector('.cartao--pego')).toBeNull();
    expect(http.match('/api/v1/negocios/a/mover')).toHaveLength(0);
  });

  it('teclado: pegar outro cartão devolve o primeiro ao lugar', async () => {
    await abrir();
    await teclar('a', ' ');
    await teclar('a', 'ArrowRight');
    await teclar('c', ' ');
    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    expect(titulosEm('Proposta')).toEqual(['Negócio c']);
    expect(raiz.querySelector('[data-negocio-id="a"] .cartao--pego')).toBeNull();
    expect(raiz.querySelector('[data-negocio-id="c"] .cartao--pego')).not.toBeNull();
  });

  it('soltar na perda pede o motivo; cancelar desfaz o movimento', async () => {
    await abrir();
    await teclar('a', ' ');
    for (let i = 0; i < 3; i++) {
      await teclar('a', 'ArrowRight');
    }
    await teclar('a', 'Enter');
    expect(titulosEm('Perdido')).toEqual(['Padaria — delivery']);
    const modal = raiz.querySelector('app-motivo-perda dialog')!;
    expect(modal.hasAttribute('open')).toBe(true);
    const cancelar = [...modal.querySelectorAll<HTMLButtonElement>('button')].find(
      (botao) => botao.textContent?.trim() === 'Cancelar',
    )!;
    cancelar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    expect(http.match('/api/v1/negocios/a/mover')).toHaveLength(0);
  });

  it('soltar na perda com o motivo manda o motivo à API', async () => {
    await abrir();
    await teclar('b', ' ');
    for (let i = 0; i < 3; i++) {
      await teclar('b', 'ArrowRight');
    }
    await teclar('b', ' ');
    const modal = raiz.querySelector('app-motivo-perda dialog')!;
    const campo = modal.querySelector('textarea')!;
    campo.value = 'Escolheu um concorrente';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/negocios/b/mover');
    expect(pedido.request.body).toEqual({
      etapaId: 'perdido',
      motivoPerda: 'Escolheu um concorrente',
    });
    pedido.flush({ negocio: negocioDeTeste('b', ETAPAS[3]), passagens: [] });
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toBe(
      'Negócio “Negócio b” marcado como perdido.',
    );
  });

  it('erro da API ao mover: o cartão volta e o aviso explica', async () => {
    await abrir();
    await teclar('a', ' ');
    await teclar('a', 'ArrowRight');
    await teclar('a', ' ');
    http.expectOne('/api/v1/negocios/a/mover').flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'Etapa de outro funil.',
        requisicaoId: 'r',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await microtarefas();
    fixture.detectChanges();
    expect(titulosEm('Novo')).toEqual(['Padaria — delivery', 'Negócio b']);
    const aviso = TestBed.inject(AvisosService).lista().at(-1);
    expect(aviso?.tipo).toBe('erro');
    expect(aviso?.mensagem).toBe('Etapa de outro funil.');
  });

  it('negócio ganho fica preso na coluna para quem não reabre (R5.5)', async () => {
    await abrir('COMERCIAL', {
      ganho: [negocioDeTeste('g', ETAPAS[2])],
    });
    await teclar('g', ' ');
    await teclar('g', 'ArrowRight');
    await teclar('g', 'ArrowLeft');
    expect(titulosEm('Ganho')).toEqual(['Negócio g']);
  });

  it('erro ao carregar mostra "Tentar de novo"', async () => {
    entrarComo('LIDER_COMERCIAL');
    fixture = TestBed.createComponent(QuadroFunil);
    fixture.componentRef.setInput('area', 'comercial');
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http
      .expectOne('/api/v1/funis?area=COMERCIAL')
      .flush(
        { statusCode: 503, erro: 'indisponivel', mensagem: 'Fora do ar', requisicaoId: 'req-1' },
        { status: 503, statusText: 'Indisponível' },
      );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Não conseguimos carregar o quadro');
    expect(raiz.textContent).toContain('Tentar de novo');
  });
});
