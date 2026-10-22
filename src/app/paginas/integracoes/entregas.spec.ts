import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrega, entregaDetalhe, microtarefas, pagina, webhookSaida } from './dados-de-teste';
import { Entregas, resultadoDaEntrega } from './entregas';

const BASE = '/api/v1/webhooks/saidas/ws1/entregas';
const LISTA = `${BASE}?pagina=1&porPagina=10`;

describe('resultadoDaEntrega', () => {
  it('resume o que o destino respondeu', () => {
    expect(resultadoDaEntrega(entrega())).toBe('HTTP 500 · 2 ms');
    expect(
      resultadoDaEntrega(
        entrega({ statusHttp: null, duracaoMs: null, erro: 'Tempo esgotado (10 s)' }),
      ),
    ).toBe('Tempo esgotado (10 s)');
    expect(
      resultadoDaEntrega(entrega({ statusHttp: null, duracaoMs: null, erro: null, tentativas: 0 })),
    ).toBe('Ainda não enviada');
  });
});

describe('Entregas (aba do webhook de saída)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Entregas>;

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

  async function criar(destino = webhookSaida()) {
    fixture = TestBed.createComponent(Entregas);
    fixture.componentRef.setInput('destino', destino);
    fixture.detectChanges();
    http.expectOne(LISTA).flush(pagina([entrega()], 10));
    await microtarefas();
    fixture.detectChanges();
    elemento().querySelector<HTMLButtonElement>('.historico__resumo')!.click();
    http.expectOne(`${BASE}/en1`).flush(entregaDetalhe());
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra as tentativas com status HTTP, duração e trecho da resposta, e o envelope', async () => {
    await criar();
    const tabela = elemento().querySelector('.entrega__tabela')!;
    expect(tabela.textContent).toContain('Falhou');
    expect(tabela.textContent).toContain('HTTP 500 · 2 ms');
    expect(tabela.textContent).toContain('{"ok":false}');
    expect(elemento().textContent).toContain('"evento": "negocio.perdido"');
  });

  it('reenviar recomeça as tentativas e recarrega', async () => {
    await criar();
    botao('Reenviar').click();
    http
      .expectOne(`${BASE}/en1/reenviar`)
      .flush(entregaDetalhe({ tentativas: 0, historicoTentativas: [] }));
    await microtarefas();
    http.expectOne(LISTA).flush(pagina([entrega({ tentativas: 0 })], 10));
    await microtarefas();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('reenviada');
    vi.advanceTimersByTime(4_000);
    http.expectOne(LISTA).flush(pagina([entrega({ status: 'ENTREGUE' })], 10));
    http.expectOne(`${BASE}/en1`).flush(entregaDetalhe({ status: 'ENTREGUE' }));
    await microtarefas();
  });

  it('com o destino desativado, "Reenviar" fica indisponível e diz por quê', async () => {
    await criar(webhookSaida({ ativo: false }));
    expect(botao('Reenviar').disabled).toBe(true);
    expect(elemento().textContent).toContain('Reative o destino para reenviar.');
  });

  it('recarrega quando a tela avisa (depois de "Enviar teste")', async () => {
    await criar();
    fixture.componentRef.setInput('versao', 1);
    fixture.detectChanges();
    http.expectOne(LISTA).flush(pagina([entrega()], 10));
    await microtarefas();
  });
});
