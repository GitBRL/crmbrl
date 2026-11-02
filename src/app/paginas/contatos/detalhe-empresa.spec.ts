import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { contatoDeTeste, empresaDeTeste } from './dados-de-teste';
import { DetalheEmpresa } from './detalhe-empresa';

@Component({ template: '<p>outra tela</p>' })
class Outra {}

const ID = '22222222-2222-4222-8222-222222222222';

describe('DetalheEmpresa (/empresas/:id)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'contatos', component: Outra },
            { path: 'contatos/:id', component: Outra },
            { path: 'empresas/:id', component: DetalheEmpresa },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    entrarComo('COMERCIAL');
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  async function processar() {
    await new Promise((resolver) => setTimeout(resolver, 0));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver, 0));
    harness.detectChanges();
  }

  const texto = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  it('mostra o cabeçalho com CNPJ, site e, na aba Pessoas, os contatos da empresa', async () => {
    await harness.navigateByUrl(`/empresas/${ID}?aba=pessoas`, DetalheEmpresa);
    http.expectOne(`/api/v1/empresas/${ID}`).flush(empresaDeTeste());
    http
      .expectOne((req) => req.url === '/api/v1/negocios' && req.params.get('empresaId') === ID)
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    await processar();
    const pessoas = http.expectOne(
      (req) => req.url === '/api/v1/contatos' && req.params.get('empresaId') === ID,
    );
    pessoas.flush({ itens: [contatoDeTeste()], total: 1, pagina: 1, porPagina: 100 });
    await processar();

    expect(texto()).toContain('Clínica Vida Plena');
    expect(texto()).toContain('CNPJ 11.222.333/0001-81');
    expect(texto()).toContain('Saúde');
    expect(texto()).toContain('Curitiba · PR');
    expect(texto()).toContain('+55 (41) 3021-2202');
    expect(texto()).toContain('Pessoas (2)');
    expect(texto()).toContain('1 pessoa nesta empresa');
    const site = harness.routeNativeElement?.querySelector('a[target=_blank]') as HTMLAnchorElement;
    expect(site.getAttribute('href')).toBe('https://vidaplena.example.com.br');
    const pessoa = harness.routeNativeElement?.querySelector('a.pessoa__nome') as HTMLAnchorElement;
    expect(pessoa.getAttribute('href')).toBe('/contatos/11111111-1111-4111-8111-111111111111');
    // Sem poder editar (responsável de outra pessoa): só leitura, com o porquê.
    expect(texto()).toContain('Só leitura');
    expect(document.title).toBe('Clínica Vida Plena · BRL CRM');
  });
});
