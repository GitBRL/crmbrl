import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import type { Papel } from '../../nucleo/papeis';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { contatoDeTeste } from './dados-de-teste';
import type { NegocioRelacionado, RegistroDaLinhaDoTempo } from './contatos.tipos';
import { DetalheContato } from './detalhe-contato';

@Component({ template: '<p>outra tela</p>' })
class Outra {}

const ID = '11111111-1111-4111-8111-111111111111';

function negocio(
  id: string,
  area: 'MARKETING' | 'COMERCIAL' | 'CS',
  titulo: string,
  negocioOrigemId: string | null = null,
): NegocioRelacionado {
  return {
    id,
    titulo,
    status: area === 'COMERCIAL' ? 'GANHO' : 'ABERTO',
    valor: '1500.00',
    diasNaEtapa: 3,
    parado: false,
    negocioOrigemId,
    funil: { id: `funil-${area}`, nome: area === 'CS' ? 'Customer Success' : area, area },
    etapa: { id: 'e', nome: 'Etapa', tipo: 'ABERTA' },
    contato: { id: ID, nome: 'Ana' },
    responsavel: { id: 'u1', nome: 'Lucas Pereira' },
    ganhoEm: '2026-10-10T10:00:00Z',
    criadoEm: `2026-10-0${area === 'MARKETING' ? 1 : area === 'COMERCIAL' ? 2 : 3}T10:00:00Z`,
  };
}

const EVENTO: RegistroDaLinhaDoTempo = {
  tipo: 'evento',
  ocorridoEm: '2026-10-20T10:00:00Z',
  evento: {
    id: '10',
    acao: 'contato.reconvertido',
    entidade: 'contato',
    entidadeId: ID,
    resumo: 'Contato "Ana Beatriz Lopes" reconvertido (WEBHOOK: Disparos BRL)',
    dados: { alteracoes: { telefone: { antes: null, depois: '5541988771201' } } },
    tipoAtor: 'WEBHOOK',
    usuarioId: null,
    atorDescricao: 'Disparos BRL',
    criadoEm: '2026-10-20T10:00:00Z',
  },
  atividade: null,
};

describe('DetalheContato (/contatos/:id)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  async function abrir(papel: Papel, url = `/contatos/${ID}`) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'contatos', component: Outra },
            { path: 'contatos/:id', component: DetalheContato },
            { path: 'empresas/:id', component: Outra },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    entrarComo(papel);
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, DetalheContato);
  }

  afterEach(() => {
    // O cartão de risco de cancelamento (Financeiro) consulta por conta própria.
    for (const pedido of http.match((req) => req.url.includes('/financeiro/risco-churn'))) {
      pedido.flush({ risco: null });
    }
    // O cartão de qualificação do SDR com IA também consulta sozinho.
    for (const pedido of http.match((req) => req.url.startsWith('/api/v1/sdr/'))) {
      pedido.flush({ qualificacao: null });
    }
    http.verify({ ignoreCancelled: true });
  });

  async function processar() {
    await new Promise((resolver) => setTimeout(resolver, 0));
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver, 0));
    harness.detectChanges();
  }

  function responderContato(ajustes = {}) {
    http.expectOne(`/api/v1/contatos/${ID}`).flush(contatoDeTeste(ajustes));
    http
      .expectOne((req) => req.url === '/api/v1/negocios' && req.params.get('contatoId') === ID)
      .flush({
        itens: [
          negocio('n2', 'COMERCIAL', 'Clínica — plano anual', 'n1'),
          negocio('n1', 'MARKETING', 'Ana — lead do site'),
          negocio('n3', 'CS', 'Clínica — implantação', 'n2'),
        ],
        total: 3,
        pagina: 1,
        porPagina: 100,
      });
  }

  function responderLinhaDoTempo() {
    const pedido = http.expectOne((req) => req.url === `/api/v1/contatos/${ID}/linha-do-tempo`);
    expect(pedido.request.params.get('incluir')).toBe('tudo');
    pedido.flush({ itens: [EVENTO], total: 1, pagina: 1, porPagina: 20 });
  }

  const tela = () => harness.routeNativeElement as HTMLElement;
  const texto = () => tela().textContent ?? '';
  const botao = (rotulo: string) =>
    [...tela().querySelectorAll('button')].find((item) =>
      item.textContent?.trim().startsWith(rotulo),
    ) as HTMLButtonElement | undefined;

  it('mostra o cabeçalho, a origem e a linha do tempo', async () => {
    await abrir('COMERCIAL');
    responderContato();
    await processar();
    responderLinhaDoTempo();
    await processar();

    expect(texto()).toContain('Ana Beatriz Lopes');
    expect(texto()).toContain('Diretora');
    const empresa = tela().querySelector('a.perfil__empresa') as HTMLAnchorElement;
    expect(empresa.getAttribute('href')).toBe('/empresas/22222222-2222-4222-8222-222222222222');
    expect(texto()).toContain('+55 (41) 98877-1201');
    expect(texto()).toContain('chegou 2 vezes');
    expect(texto()).toContain('Fonte: google · Meio: cpc');
    expect(texto()).toContain('reconvertido (WEBHOOK: Disparos BRL)');
    expect(texto()).toContain('Webhook · Disparos BRL');
    expect(texto()).toContain('Negócios (3)');
    expect(document.title).toBe('Ana Beatriz Lopes · BRL CRM');
  });

  it('a aba Negócios mostra a jornada com "Veio de" e "Gerou"', async () => {
    await abrir('C_LEVEL', `/contatos/${ID}?aba=negocios`);
    responderContato();
    await processar();

    expect(texto()).toContain('Clínica — plano anual');
    expect(texto()).toContain('Veio de: Marketing — Ana — lead do site');
    expect(texto()).toContain('Gerou: Customer Success — Clínica — implantação');
    // Sem centavos, como no quadro ("R$ 1.500").
    expect(texto()).toMatch(/R\$\s1\.500(?!,)/);
    const titulos = [...tela().querySelectorAll('a.negocio__titulo')].map((link) =>
      link.getAttribute('href'),
    );
    expect(titulos).toEqual([
      '/funis/marketing/n1?funil=funil-MARKETING',
      '/funis/comercial/n2?funil=funil-COMERCIAL',
      '/funis/cs/n3?funil=funil-CS',
    ]);
  });

  it('opt-out tem efeito imediato (PATCH) e avisa', async () => {
    await abrir('COMERCIAL');
    responderContato();
    await processar();
    responderLinhaDoTempo();
    await processar();
    const avisos = TestBed.inject(AvisosService);

    const alternador = tela().querySelector('input[role="switch"]') as HTMLInputElement;
    expect(alternador.checked).toBe(false);
    alternador.click();
    await processar();
    const patch = http.expectOne(`/api/v1/contatos/${ID}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ optOutMarketing: true });
    patch.flush(contatoDeTeste({ optOutMarketing: true, optOutEm: '2026-10-21T10:00:00Z' }));
    await processar();
    // A linha do tempo recarrega com a alteração nova.
    responderLinhaDoTempo();
    await processar();
    expect(avisos.lista().at(-1)?.mensagem).toBe('Opt-out ligado: Ana não recebe mais marketing.');
    expect(texto()).toContain('Opt-out de marketing');
  });

  it('só o Admin vê "Anonimizar"; a anonimização exige digitar o primeiro nome', async () => {
    await abrir('ADMIN');
    responderContato();
    await processar();
    responderLinhaDoTempo();
    await processar();

    botao('Anonimizar contato…')?.click();
    await processar();
    const dialogo = [...tela().querySelectorAll('dialog')].find((item) =>
      item.textContent?.includes('Anonimizar Ana Beatriz Lopes?'),
    ) as HTMLDialogElement;
    expect(dialogo.hasAttribute('open')).toBe(true);
    const confirmar = [...dialogo.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Anonimizar contato',
    ) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    const campos = dialogo.querySelectorAll('input');
    const confirmacao = campos[campos.length - 1] as HTMLInputElement;
    confirmacao.value = 'ana';
    confirmacao.dispatchEvent(new Event('input'));
    await processar();
    expect(confirmar.disabled).toBe(false);
    confirmar.click();
    await processar();

    const pedido = http.expectOne(`/api/v1/contatos/${ID}/anonimizar`);
    expect(pedido.request.method).toBe('POST');
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await processar();
    expect(TestBed.inject(Router).url).toBe('/contatos');
  });

  it('Admin exporta os dados pessoais: baixa o JSON, mostra carregando e o erro da API', async () => {
    await abrir('ADMIN');
    responderContato();
    await processar();
    responderLinhaDoTempo();
    await processar();

    const urls: Blob[] = [];
    const criar = vi.fn((arquivo: Blob) => {
      urls.push(arquivo);
      return 'blob:teste';
    });
    const revogar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const baixados: string[] = [];
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      baixados.push(this.download);
    });

    botao('Exportar dados pessoais')?.click();
    await processar();
    expect(botao('Exportar dados pessoais')?.getAttribute('aria-busy')).toBe('true');
    const pedido = http.expectOne(`/api/v1/contatos/${ID}/dados-pessoais`);
    expect(pedido.request.method).toBe('GET');
    pedido.flush({ contato: { id: ID } });
    await processar();
    expect(baixados).toEqual([`dados-pessoais-${ID}.json`]);
    expect(await urls[0].text()).toContain('"contato"');

    botao('Exportar dados pessoais')?.click();
    await processar();
    http
      .expectOne(`/api/v1/contatos/${ID}/dados-pessoais`)
      .flush(
        { statusCode: 403, erro: 'Proibido', mensagem: 'Só o Admin exporta.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await processar();
    expect(texto()).toContain('Só o Admin exporta.');
    expect(baixados.length).toBe(1);
    clique.mockRestore();
  });

  it('quem não é Admin não vê "Exportar dados pessoais"', async () => {
    await abrir('COMERCIAL');
    responderContato();
    await processar();
    responderLinhaDoTempo();
    await processar();
    expect(botao('Exportar dados pessoais')).toBeUndefined();
  });

  it('quem não é Admin lê que a anonimização é só do Admin; sem edição, "Só leitura"', async () => {
    await abrir('COMERCIAL');
    responderContato({ podeEditar: false });
    await processar();
    responderLinhaDoTempo();
    await processar();
    expect(botao('Anonimizar contato…')).toBeUndefined();
    expect(texto()).toContain('feita só pelo Admin');
    expect(texto()).toContain('Só leitura');
    expect(botao('Editar')).toBeUndefined();
    const alternador = tela().querySelector('input[role="switch"]') as HTMLInputElement;
    expect(alternador.disabled).toBe(true);
  });

  it('contato que não existe (ou anonimizado): "Contato não encontrado"', async () => {
    await abrir('COMERCIAL');
    http.expectOne(`/api/v1/contatos/${ID}`).flush(
      {
        statusCode: 404,
        erro: 'nao_encontrado',
        mensagem: 'Contato não encontrado.',
        requisicaoId: 'r',
      },
      { status: 404, statusText: 'Not Found' },
    );
    http
      .expectOne((req) => req.url === '/api/v1/negocios')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
    await processar();
    expect(texto()).toContain('Contato não encontrado');
    expect(texto()).toContain('Ver todos os contatos');
  });
});
