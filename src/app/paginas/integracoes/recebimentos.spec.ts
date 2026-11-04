import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import {
  microtarefas,
  pagina,
  PREVIA_VALIDA,
  recebimento,
  recebimentoDetalhe,
} from './dados-de-teste';
import {
  acaoAplicada,
  eventoDoRecebimento,
  motivoSemReprocessar,
  Recebimentos,
} from './recebimentos';
import { APLICATIVO_HOTMART_COM_EVENTOS } from './dados-de-teste';

const BASE = '/api/v1/webhooks/recebimentos';
const LISTA = `${BASE}?integracaoId=we1&pagina=1&porPagina=10`;

describe('motivoSemReprocessar', () => {
  it('explica por que não dá para reprocessar', () => {
    expect(motivoSemReprocessar(recebimento())).toBeNull();
    expect(
      motivoSemReprocessar(recebimento({ podeReprocessar: false, recusadoNaRecepcao: true })),
    ).toContain('Recusado na chegada');
    expect(
      motivoSemReprocessar(recebimento({ podeReprocessar: false, status: 'PROCESSADO' })),
    ).toContain('Já foi processado');
  });
});

describe('Recebimentos (histórico das integrações)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Recebimentos>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    )!;
  }

  async function criar(
    itens = [
      recebimento(),
      recebimento({
        id: 'r2',
        status: 'PROCESSADO',
        mensagem: 'Contato criado.',
        podeReprocessar: false,
        contato: { id: 'c1', nome: 'Tatiane' },
        negocio: { id: 'n1', titulo: 'Tatiane' },
      }),
    ],
  ) {
    fixture = TestBed.createComponent(Recebimentos);
    fixture.componentRef.setInput('consulta', { integracaoId: 'we1' });
    fixture.componentRef.setInput('funilDaIntegracao', new Map([['we1', 'f-mkt']]));
    fixture.detectChanges();
    http.expectOne(LISTA).flush(pagina(itens, 10));
    await microtarefas();
    fixture.detectChanges();
  }

  async function abrirPrimeiro(detalhe = recebimentoDetalhe()) {
    elemento().querySelector<HTMLButtonElement>('.historico__resumo')!.click();
    http.expectOne(`${BASE}/r1`).flush(detalhe);
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra o evento da plataforma e a ação aplicada, com o nome amigável do catálogo', async () => {
    const compra = recebimento({
      id: 'r1',
      aplicativo: 'HOTMART',
      aplicativoNome: 'Hotmart',
      status: 'PROCESSADO',
      mensagem:
        'Evento "Compra aprovada"; Contato "Ana" criado; negócio criado em Comercial / Ganho.',
      podeReprocessar: false,
      itens: [
        {
          indice: 0,
          rotulo: null,
          status: 'PROCESSADO',
          mensagem: 'x',
          contatoId: 'c1',
          negocioId: 'n1',
          avisos: [],
          evento: 'PURCHASE_APPROVED',
          chave: 'id:1',
        },
      ],
    });
    const ignorado = recebimento({
      id: 'r2',
      status: 'IGNORADO',
      mensagem: 'Produto fora do filtro desta integração (X): evento ignorado.',
      podeReprocessar: false,
      itens: [
        {
          indice: 0,
          rotulo: null,
          status: 'IGNORADO',
          mensagem: 'x',
          contatoId: null,
          negocioId: null,
          avisos: [],
          evento: 'PURCHASE_REFUNDED',
          chave: null,
        },
      ],
    });
    await criar([compra, ignorado]);
    http
      .expectOne('/api/v1/webhooks/aplicativos')
      .flush({ aplicativos: [APLICATIVO_HOTMART_COM_EVENTOS], destinos: [] });
    await microtarefas();
    fixture.detectChanges();
    const itens = elemento().querySelectorAll('.historico__item');
    expect(itens[0].querySelector('[data-teste=evento]')?.textContent?.trim()).toBe(
      'Compra aprovada',
    );
    expect(itens[0].querySelector('.historico__texto')?.textContent).toContain(
      'negócio criado em Comercial / Ganho',
    );
    expect(itens[0].querySelector('.historico__texto')?.textContent).not.toContain('Evento "');
    // Sem prefixo na mensagem, o nome vem do catálogo pelo código.
    expect(itens[1].querySelector('[data-teste=evento]')?.textContent?.trim()).toBe(
      'Compra reembolsada',
    );
    itens[0].querySelector<HTMLButtonElement>('.historico__resumo')!.click();
    http.expectOne(`${BASE}/r1`).flush(recebimentoDetalhe({ id: 'r1' }));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelector('[data-teste=evento-detalhe]')?.textContent).toContain(
      'PURCHASE_APPROVED',
    );
    expect(elemento().querySelector('[data-teste=acao-aplicada]')?.textContent).toContain(
      'Contato "Ana" criado',
    );
  });

  it('lista com status, mensagem, origem e tempo; a consulta nova vai para a API', async () => {
    await criar();
    const itens = elemento().querySelectorAll('.historico__item');
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toContain('Erro');
    expect(itens[0].textContent).toContain('Sem e-mail nem telefone');
    expect(itens[0].textContent).toContain('H1 Elementor');
    expect(itens[0].textContent).toContain('há 5 min');
    fixture.componentRef.setInput('consulta', { integracaoId: 'we1', status: ['ERRO'] });
    fixture.detectChanges();
    await microtarefas();
    http
      .expectOne(`${BASE}?integracaoId=we1&status=ERRO&pagina=1&porPagina=10`)
      .flush(pagina([], 10));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum recebimento com esses filtros');
  });

  it('abre no lugar com o corpo e os cabeçalhos guardados', async () => {
    await criar();
    await abrirPrimeiro();
    const resumo = elemento().querySelector('.historico__resumo')!;
    expect(resumo.getAttribute('aria-expanded')).toBe('true');
    const detalhe = elemento().querySelector('.historico__detalhe')!;
    expect(detalhe.textContent).toContain('"name": "Lead sem contato"');
    expect(detalhe.textContent).toContain('content-type');
  });

  it('o recebimento processado leva ao contato e ao negócio criados', async () => {
    await criar();
    elemento().querySelectorAll<HTMLButtonElement>('.historico__resumo')[1].click();
    http.expectOne(`${BASE}/r2`).flush(recebimentoDetalhe({ id: 'r2' }));
    await microtarefas();
    fixture.detectChanges();
    const links = Array.from(elemento().querySelectorAll<HTMLAnchorElement>('.historico__link'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/contatos/c1',
      '/funis/f-mkt?negocio=n1',
    ]);
    expect(botao('Reprocessar').disabled).toBe(true);
    expect(elemento().textContent).toContain('Já foi processado');
  });

  it('reprocessar manda de novo para a fila, avisa e confere depois', async () => {
    await criar();
    await abrirPrimeiro();
    botao('Reprocessar').click();
    http
      .expectOne(`${BASE}/r1/reprocessar`)
      .flush(recebimento({ status: 'RECEBIDO', mensagem: null }));
    await microtarefas();
    http.expectOne(LISTA).flush(pagina([recebimento({ status: 'RECEBIDO', mensagem: null })], 10));
    http.expectOne(`${BASE}/r1`).flush(recebimentoDetalhe({ status: 'RECEBIDO' }));
    await microtarefas();
    fixture.detectChanges();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('fila');
    expect(elemento().textContent).toContain('Na fila');

    vi.advanceTimersByTime(4_000);
    http
      .expectOne(LISTA)
      .flush(pagina([recebimento({ status: 'PROCESSADO', mensagem: 'Contato criado.' })], 10));
    http.expectOne(`${BASE}/r1`).flush(recebimentoDetalhe({ status: 'PROCESSADO' }));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Processado');
  });

  it('"Simular" mostra a prévia com a configuração atual', async () => {
    await criar();
    await abrirPrimeiro();
    botao('Simular com a configuração atual').click();
    const previa = http.expectOne('/api/v1/webhooks/entradas/we1/previa');
    expect(previa.request.body).toEqual({ recebimentoId: 'r1' });
    previa.flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Funcionaria');
  });

  it('sem nenhum recebimento, explica o que vai aparecer', async () => {
    await criar([]);
    expect(elemento().textContent).toContain('Nenhum recebimento com esses filtros');
  });

  it('mostra os avisos, o resultado de cada lead e emite "Editar integração"', async () => {
    await criar([
      recebimento({
        status: 'PROCESSADO',
        mensagem: 'Processado.',
        avisos: ['etapa "X" não existe no funil Comercial'],
        itens: [
          {
            indice: 0,
            rotulo: 'lead 1 de 2',
            status: 'PROCESSADO',
            mensagem: 'Criado.',
            contatoId: 'c1',
            negocioId: 'n1',
            avisos: [],
          },
          {
            indice: 1,
            rotulo: 'lead 2 de 2',
            status: 'ERRO',
            mensagem: 'Sem e-mail nem telefone.',
            contatoId: null,
            negocioId: null,
            avisos: [],
          },
        ],
      }),
    ]);
    await abrirPrimeiro();
    expect(elemento().textContent).toContain('etapa "X" não existe no funil Comercial');
    expect(elemento().textContent).toContain('lead 2 de 2: Sem e-mail nem telefone.');
    const editar = vi.fn();
    fixture.componentInstance.editarIntegracao.subscribe(editar);
    botao('Editar integração').click();
    expect(editar).toHaveBeenCalledWith('we1');
  });
});

describe('evento e ação aplicada de um recebimento', () => {
  it('lê o nome do evento da mensagem, do código ou do catálogo, e separa a ação', () => {
    const comPrefixo = recebimento({ mensagem: 'Evento "Chargeback"; Contato "A" etiquetado.' });
    expect(eventoDoRecebimento(comPrefixo)).toEqual({ codigo: null, nome: 'Chargeback' });
    expect(acaoAplicada(comPrefixo)).toBe('Contato "A" etiquetado.');

    const soCodigo = recebimento({
      mensagem: 'Evento repetido.',
      itens: [
        {
          indice: 0,
          rotulo: null,
          status: 'IGNORADO',
          mensagem: '',
          contatoId: null,
          negocioId: null,
          avisos: [],
          evento: 'order_approved',
        },
      ],
    });
    expect(eventoDoRecebimento(soCodigo)?.nome).toBe('order_approved');
    expect(
      eventoDoRecebimento(soCodigo, new Map([['order_approved', 'Compra aprovada']]))?.nome,
    ).toBe('Compra aprovada');
    expect(eventoDoRecebimento(recebimento())).toBeNull();
  });
});
