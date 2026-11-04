import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { integracaoElementor, microtarefas, pagina } from './dados-de-teste';
import { IntegracoesDoFunil } from './integracoes-do-funil';

const URL_LISTA = '/api/v1/webhooks/entradas?funilId=f-com&porPagina=100';

describe('IntegracoesDoFunil (configurações do funil)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<IntegracoesDoFunil>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const elemento = () => fixture.nativeElement as HTMLElement;

  async function abrir(resposta: unknown) {
    fixture = TestBed.createComponent(IntegracoesDoFunil);
    fixture.componentRef.setInput('funilId', 'f-com');
    fixture.detectChanges();
    http.expectOne(URL_LISTA).flush(resposta as object);
    await microtarefas();
    fixture.detectChanges();
  }

  it('lista as integrações do funil e leva "Nova integração" com o funil escolhido', async () => {
    await abrir(pagina([integracaoElementor({ nome: 'Elementor — matrículas' })], 100));
    expect(elemento().textContent).toContain('Elementor — matrículas');
    expect(elemento().textContent).toContain('Ativa');
    const nova = Array.from(elemento().querySelectorAll<HTMLAnchorElement>('a')).find((a) =>
      a.textContent?.includes('Nova integração'),
    )!;
    expect(nova.getAttribute('href')).toBe('/integracoes/aplicativos?funil=f-com');
    const editar = elemento().querySelector<HTMLAnchorElement>('.integracoes__nome')!;
    expect(editar.getAttribute('href')).toBe('/integracoes/aplicativos?integracao=we-el');
  });

  it('sem integrações, explica; com erro, oferece tentar de novo', async () => {
    await abrir(pagina([], 100));
    expect(elemento().textContent).toContain('Nenhuma integração neste funil');

    fixture.componentRef.setInput('funilId', 'f-com');
    fixture = TestBed.createComponent(IntegracoesDoFunil);
    fixture.componentRef.setInput('funilId', 'f-com');
    fixture.detectChanges();
    http.expectOne(URL_LISTA).flush({ statusCode: 500 }, { status: 500, statusText: 'Erro' });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Não conseguimos carregar as integrações');
  });
});
