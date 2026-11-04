import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { CATALOGO, integracaoElementor, microtarefas, pagina, recebimento } from './dados-de-teste';
import { Historico, inicioDoDia } from './historico';

const ENTRADAS = '/api/v1/webhooks/entradas?pagina=1&porPagina=100';
const BASE = '/api/v1/webhooks/recebimentos';

describe('inicioDoDia', () => {
  it('converte o dia local em ISO e o fim exclusivo é o dia seguinte', () => {
    const inicio = inicioDoDia('2026-11-04')!;
    expect(new Date(inicio).getDate()).toBe(4);
    expect(new Date(inicio).getHours()).toBe(0);
    expect(new Date(inicioDoDia('2026-11-04', true)!).getDate()).toBe(5);
    expect(inicioDoDia('')).toBeUndefined();
  });
});

describe('Historico (global)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Historico>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const elemento = () => fixture.nativeElement as HTMLElement;

  async function abrir(integracao: string | null = null) {
    fixture = TestBed.createComponent(Historico);
    fixture.componentRef.setInput('integracao', integracao);
    fixture.detectChanges();
    await microtarefas();
    http.expectOne('/api/v1/webhooks/aplicativos').flush(CATALOGO);
    http.expectOne(ENTRADAS).flush(pagina([integracaoElementor()], 100));
    await microtarefas();
    fixture.detectChanges();
  }

  it('lista os recebimentos de todas as integrações, com a origem de cada um', async () => {
    await abrir();
    http.expectOne(`${BASE}?pagina=1&porPagina=10`).flush(pagina([recebimento()], 10));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('H1 Elementor');
    expect(elemento().textContent).toContain('Elementor');
    // Só os aplicativos disponíveis entram no filtro.
    const opcoes = Array.from(
      elemento().querySelectorAll<HTMLSelectElement>('select')[0].options,
    ).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual(['Todos os aplicativos', 'Elementor', 'Typeform', 'Webhook']);
  });

  it('?integracao já chega filtrado e o status vai para a API', async () => {
    await abrir('we-el');
    http
      .expectOne(`${BASE}?integracaoId=we-el&pagina=1&porPagina=10`)
      .flush(pagina([recebimento()], 10));
    await microtarefas();
    fixture.detectChanges();
    const erro = Array.from(
      elemento().querySelectorAll<HTMLElement>('button, [role="radio"]'),
    ).find((b) => b.textContent?.trim() === 'Com erro')!;
    erro.click();
    fixture.detectChanges();
    await microtarefas();
    http
      .expectOne(`${BASE}?status=ERRO&integracaoId=we-el&pagina=1&porPagina=10`)
      .flush(pagina([], 10));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum recebimento com esses filtros');
    expect(elemento().textContent).toContain('Limpar filtros');
  });
});
