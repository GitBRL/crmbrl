import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SdrAtendimentoApi } from './sdr.api';
import { estadoSdrDeTeste, qualificacaoDeTeste } from './sdr-de-teste';

describe('SdrAtendimentoApi', () => {
  let api: SdrAtendimentoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SdrAtendimentoApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lê o estado e chama assumir e devolver', async () => {
    let estado;
    api.estado('c1').subscribe((e) => (estado = e));
    http.expectOne('/api/v1/sdr/conversas/c1').flush(estadoSdrDeTeste());
    expect(estado).toEqual(estadoSdrDeTeste());

    const assumir = api.assumir('c1');
    const a = http.expectOne('/api/v1/sdr/conversas/c1/assumir');
    expect(a.request.method).toBe('POST');
    a.flush(estadoSdrDeTeste());
    await assumir;

    const devolver = api.devolver('c1');
    http.expectOne('/api/v1/sdr/conversas/c1/devolver').flush(estadoSdrDeTeste());
    await devolver;
  });

  it('aprova a sugestão com ou sem texto editado e descarta', async () => {
    const sem = api.aprovarSugestao('s1');
    const r1 = http.expectOne('/api/v1/sdr/sugestoes/s1/aprovar');
    expect(r1.request.body).toEqual({});
    r1.flush(estadoSdrDeTeste());
    await sem;
    const com = api.aprovarSugestao('s1', 'Oi');
    const r2 = http.expectOne('/api/v1/sdr/sugestoes/s1/aprovar');
    expect(r2.request.body).toEqual({ texto: 'Oi' });
    r2.flush(estadoSdrDeTeste());
    await com;
    const d = api.descartarSugestao('s1');
    http.expectOne('/api/v1/sdr/sugestoes/s1/descartar').flush(estadoSdrDeTeste());
    await d;
  });

  it('a qualificação vem sem o invólucro', () => {
    const lidas: unknown[] = [];
    api.qualificacaoDoContato('ct1').subscribe((q) => lidas.push(q));
    api.qualificacaoDoNegocio('n1').subscribe((q) => lidas.push(q));
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ qualificacao: qualificacaoDeTeste() });
    http.expectOne('/api/v1/sdr/negocios/n1/qualificacao').flush({ qualificacao: null });
    expect(lidas).toEqual([qualificacaoDeTeste(), null]);
  });
});
