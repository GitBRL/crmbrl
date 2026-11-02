import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Contatos } from './contatos';
import { contatoDeTeste, empresaDeTeste } from './dados-de-teste';

@Component({ template: '<p>detalhe</p>' })
class Detalhe {}

function pagina<T>(itens: T[], total = itens.length) {
  return { itens, total, pagina: 1, porPagina: 20 };
}

describe('Contatos (/contatos)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  let euId = '';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'contatos', component: Contatos },
            { path: 'contatos/:id', component: Detalhe },
            { path: 'empresas/:id', component: Detalhe },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    euId = entrarComo('COMERCIAL').usuario.id;
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /** Responde às listas de apoio (usuários e etiquetas) que os filtros usam. */
  function responderApoio(rota: 'contatos' | 'empresas' = 'contatos') {
    http
      .expectOne((req) => req.url === '/api/v1/usuarios')
      .flush(
        pagina([
          {
            id: 'u9',
            nome: 'Rafael Mendes',
            papel: 'LIDER_COMERCIAL',
            rotuloPapel: 'Líder',
            ativo: true,
          },
        ]),
      );
    http
      .expectOne(`/api/v1/${rota}/etiquetas?limite=200`)
      .flush([{ etiqueta: 'Lead quente', quantidade: 3 }]);
  }

  function lista(rota: 'contatos' | 'empresas' = 'contatos'): TestRequest {
    return http.expectOne((req) => req.url === `/api/v1/${rota}`);
  }

  /** Depois das respostas: espera a tela assentar (sem pedido pendente, o whenStable volta). */
  async function estabilizar() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Com um pedido a caminho (o whenStable esperaria por ele): deixa navegação e efeitos rodarem. */
  async function processar() {
    await new Promise((resolver) => setTimeout(resolver, 0));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver, 0));
    harness.detectChanges();
  }

  const texto = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  it('lista as pessoas com a busca da URL e liga cada linha ao detalhe', async () => {
    await harness.navigateByUrl('/contatos?busca=ana', Contatos);
    responderApoio();
    const pedido = lista();
    expect(pedido.request.params.get('busca')).toBe('ana');
    expect(pedido.request.params.get('pagina')).toBe('1');
    pedido.flush(pagina([contatoDeTeste()]));
    await estabilizar();

    expect(texto()).toContain('Contatos e empresas');
    expect(texto()).not.toContain('Importar planilha');
    expect(texto()).toContain('1 pessoa encontrada');
    expect(texto()).toContain('Ana Beatriz Lopes');
    expect(texto()).toContain('Clínica Vida Plena');
    expect(texto()).toContain('+55 (41) 98877-1201');
    expect(texto()).toContain('2 entradas');
    const link = harness.routeNativeElement?.querySelector('a.tabela__abrir') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/contatos/11111111-1111-4111-8111-111111111111');
  });

  it('o líder vê "Importar planilha", que leva ao assistente de importação (R16.1)', async () => {
    entrarComo('LIDER_COMERCIAL');
    await harness.navigateByUrl('/contatos', Contatos);
    responderApoio();
    lista().flush(pagina([contatoDeTeste()]));
    await estabilizar();

    const link = [...(harness.routeNativeElement?.querySelectorAll('a') ?? [])].find((a) =>
      a.textContent?.includes('Importar planilha'),
    );
    expect(link?.getAttribute('href')).toBe('/contatos/importar');
  });

  it('filtro de opt-out e "meus" vão para a URL e para a API', async () => {
    await harness.navigateByUrl('/contatos', Contatos);
    responderApoio();
    lista().flush(pagina([contatoDeTeste()]));
    await estabilizar();

    const optOut = [...(harness.routeNativeElement as HTMLElement).querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Opt-out',
    ) as HTMLButtonElement;
    optOut.click();
    await processar();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/contatos?marketing=optout');
    const filtrado = lista();
    expect(filtrado.request.params.get('optOut')).toBe('true');
    filtrado.flush(pagina([]));
    await estabilizar();
    expect(texto()).toContain('Nenhuma pessoa encontrada');

    await harness.navigateByUrl('/contatos?responsavel=meus', Contatos);
    const meus = lista();
    expect(meus.request.params.get('responsavelId')).toBe(euId);
    meus.flush(pagina([]));
  });

  it('sem nada cadastrado mostra o estado vazio com "Novo contato"', async () => {
    await harness.navigateByUrl('/contatos', Contatos);
    responderApoio();
    lista().flush(pagina([]));
    await estabilizar();
    expect(texto()).toContain('Nenhum contato ainda');
    expect(texto()).toContain('Novo contato');
  });

  it('erro do servidor: mensagem humana, código e "Tentar de novo"', async () => {
    await harness.navigateByUrl('/contatos', Contatos);
    responderApoio();
    lista().flush(
      { statusCode: 500, erro: 'erro_interno', mensagem: 'Erro interno.', requisicaoId: 'req-123' },
      { status: 500, statusText: 'Erro' },
    );
    await estabilizar();
    expect(texto()).toContain('Não conseguimos carregar as pessoas');
    expect(texto()).toContain('req-123');
    const tentar = [...(harness.routeNativeElement as HTMLElement).querySelectorAll('button')].find(
      (botao) => botao.textContent?.includes('Tentar de novo'),
    ) as HTMLButtonElement;
    tentar.click();
    await processar();
    lista().flush(pagina([contatoDeTeste()]));
    await estabilizar();
    expect(texto()).toContain('Ana Beatriz Lopes');
  });

  it('a aba Empresas lista as empresas com CNPJ e quantidade de pessoas', async () => {
    await harness.navigateByUrl('/contatos?aba=empresas', Contatos);
    responderApoio('empresas');
    const pedido = lista('empresas');
    pedido.flush(pagina([empresaDeTeste()]));
    await estabilizar();
    expect(texto()).toContain('Nova empresa');
    expect(texto()).toContain('11.222.333/0001-81');
    expect(texto()).toContain('Curitiba · PR');
    const link = harness.routeNativeElement?.querySelector('a.tabela__abrir') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/empresas/22222222-2222-4222-8222-222222222222');
  });
});
