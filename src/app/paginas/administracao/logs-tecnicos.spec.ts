import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { logDetalhe, logTecnico, microtarefas, PESSOAS } from './dados-de-teste';
import { LogsTecnicos } from './logs-tecnicos';

const LISTA = '/api/v1/administracao/logs-tecnicos?limite=50';

describe('LogsTecnicos (Administração)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LogsTecnicos>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: LogsTecnicos }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

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
      logTecnico(),
      logTecnico({
        id: '11',
        nivel: 'ERRO',
        contexto: 'HTTP',
        mensagem: 'Erro interno',
        metodo: 'POST',
        rota: '/api/v1/negocios/:id/mover',
        status: 500,
        duracaoMs: 120,
      }),
    ],
  ) {
    fixture = TestBed.createComponent(LogsTecnicos);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/usuarios?porPagina=100')
      .flush({ itens: PESSOAS, total: 2, pagina: 1, porPagina: 100 });
    http.expectOne(LISTA).flush({ itens, proximoCursor: null });
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra nível em selo, origem, mensagem e a requisição HTTP', async () => {
    await criar();
    const [aviso, erro] = Array.from(elemento().querySelectorAll('tbody tr.tabela__linha')).map(
      (linha) => linha.textContent?.replace(/\s+/g, ' ') ?? '',
    );
    expect(aviso).toContain('Aviso');
    expect(aviso).toContain('Webhooks');
    expect(aviso).toContain('passou de 60 chamadas');
    expect(erro).toContain('Erro');
    expect(erro).toContain('POST /api/v1/negocios/:id/mover · 500 · 120 ms');
  });

  it('filtra por nível (vários) e por origem', async () => {
    await criar();
    botao('Erros').click();
    fixture.detectChanges();
    http.expectOne(`${LISTA}&nivel=ERRO`).flush({ itens: [], proximoCursor: null });
    await microtarefas();
    botao('Avisos').click();
    fixture.detectChanges();
    http.expectOne(`${LISTA}&nivel=ERRO&nivel=AVISO`).flush({ itens: [], proximoCursor: null });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum log com esses filtros');

    const id = Array.from(elemento().querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith('Origem'))
      ?.getAttribute('for');
    const origem = elemento().querySelector<HTMLInputElement>(`#${id}`)!;
    origem.value = 'Fila';
    origem.dispatchEvent(new Event('input'));
    origem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    http
      .expectOne(`${LISTA}&nivel=ERRO&nivel=AVISO&contexto=Fila`)
      .flush({ itens: [], proximoCursor: null });
    await microtarefas();
  });

  it('sem logs, diz que é um bom sinal', async () => {
    await criar([]);
    expect(elemento().textContent).toContain('Nenhum log técnico');
    expect(elemento().textContent).toContain('Bom sinal');
  });

  it('o detalhe mostra os dados, a pilha do erro e liga à auditoria pela requisição', async () => {
    await criar();
    fixture.componentRef.setInput('log', '11');
    fixture.detectChanges();
    http.expectOne('/api/v1/administracao/logs-tecnicos/11').flush(
      logDetalhe({
        id: '11',
        nivel: 'ERRO',
        contexto: 'HTTP',
        usuarioId: 'u-rafael',
        dados: {
          erro: {
            nome: 'TypeError',
            mensagem: 'x is undefined',
            pilha: 'TypeError: x\n  at mover',
          },
          corpo: { a: 1 },
        },
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    const painel = elemento().querySelector('app-painel-lateral')!;
    expect(painel.querySelector('h2')?.textContent).toContain('Erro');
    expect(painel.textContent).toContain('TypeError');
    expect(painel.textContent).toContain('at mover');
    expect(painel.textContent).toContain('"corpo"');
    expect(painel.textContent).toContain('Rafael Mendes');
    expect(painel.querySelector('a[href^="/administracao/auditoria"]')?.getAttribute('href')).toBe(
      '/administracao/auditoria?requisicao=req-xyz',
    );
  });
});
