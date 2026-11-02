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
  webhookEntrada,
} from './dados-de-teste';
import { motivoSemReprocessar, Recebimentos } from './recebimentos';

const BASE = '/api/v1/webhooks/entradas/we1/recebimentos';
const LISTA = `${BASE}?pagina=1&porPagina=10`;

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

describe('Recebimentos (aba do webhook de entrada)', () => {
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
    fixture.componentRef.setInput('webhook', webhookEntrada());
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

  it('lista com status, mensagem e tempo; o filtro vai para a API', async () => {
    await criar();
    const itens = elemento().querySelectorAll('.historico__item');
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toContain('Erro');
    expect(itens[0].textContent).toContain('Sem e-mail nem telefone');
    expect(itens[0].textContent).toContain('há 5 min');
    botao('Com erro').click();
    fixture.detectChanges();
    http.expectOne(`${BASE}?pagina=1&porPagina=10&status=ERRO`).flush(pagina([], 10));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum recebimento com erro');
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
      '/funis/marketing/n1',
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
    expect(elemento().textContent).toContain('Nenhum recebimento ainda');
  });
});
