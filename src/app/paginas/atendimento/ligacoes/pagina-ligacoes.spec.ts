import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ligacaoDeTeste } from '../../../nucleo/ligacoes/ligacoes-de-teste';
import type { LigacaoDoHistorico } from '../../../nucleo/ligacoes/ligacoes.tipos';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { assentar, texto } from '../dados-de-teste';
import { PaginaLigacoes } from './pagina-ligacoes';

const LISTA = '/api/v1/ligacoes';

function item(extra: Partial<LigacaoDoHistorico> = {}): LigacaoDoHistorico {
  return {
    ...ligacaoDeTeste({
      id: 'lig-1',
      estado: 'ENCERRADA',
      duracaoSegundos: 125,
      atendente: { id: 'u1', nome: 'Lucas' },
    }),
    trechosEncontrados: [],
    ...extra,
  };
}

describe('PaginaLigacoes', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  async function criar(
    itens: LigacaoDoHistorico[] = [item()],
    total = itens.length,
    proximoCursor: string | null = null,
  ) {
    const fixture = TestBed.createComponent(PaginaLigacoes);
    await fixture.whenStable();
    http.expectOne('/api/v1/atendimento/atendentes').flush([
      {
        id: 'u1',
        nome: 'Lucas',
        papel: 'COMERCIAL',
        rotuloPapel: 'Comercial',
        area: 'COMERCIAL',
        emAberto: 0,
        conectado: true,
      },
    ]);
    http.expectOne('/api/v1/atendimento/filas').flush([{ id: 'f1', nome: 'Vendas' }]);
    http
      .expectOne('/api/v1/atendimento/canais')
      .flush([{ id: 'canal-1', nome: 'WhatsApp Oficial' }]);
    const pedido = http.expectOne((r) => r.url === LISTA);
    pedido.flush({ itens, proximoCursor, total });
    await assentar();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement, pedido };
  }

  it('lista as ligações dos últimos 30 dias, da mais recente à mais antiga, com o resultado em texto', async () => {
    const { raiz, pedido } = await criar([
      item(),
      item({ id: 'lig-2', estado: 'PERDIDA', atendente: null, duracaoSegundos: null }),
    ]);
    expect(pedido.request.params.get('de')).toBeTruthy();
    expect(pedido.request.params.get('limite')).toBe('30');
    const linhas = [...raiz.querySelectorAll<HTMLAnchorElement>('a.item')];
    expect(linhas).toHaveLength(2);
    expect(texto(linhas[0])).toContain('Atendida');
    expect(texto(linhas[0])).toContain('2:05');
    expect(texto(linhas[0])).toContain('Lucas');
    expect(texto(linhas[1])).toContain('Perdida');
    expect(texto(linhas[1])).toContain('Sem atendente');
    expect(linhas[0].getAttribute('href')).toBe('/atendimento/ligacoes/lig-1');
    expect(linhas[1].getAttribute('aria-label')).toBe('Recebida, perdida, Maria Oficial');
    expect(texto(raiz.querySelector('.lista__total'))).toContain('2 ligações');
  });

  it('estado vazio sem filtros explica de onde vêm as ligações', async () => {
    const { raiz } = await criar([], 0);
    expect(raiz.querySelector('a.item')).toBeNull();
    expect(texto(raiz)).toContain('Ainda não há ligações');
  });

  it('filtros viram parâmetros: direção, situações, atendente "sem" e período livre', async () => {
    const { fixture, raiz } = await criar();
    const botoes = [...raiz.querySelectorAll<HTMLButtonElement>('.lista__filtros button')];
    const clicar = (rotulo: string) => botoes.find((b) => texto(b).startsWith(rotulo))!.click();

    clicar('Recebidas');
    fixture.detectChanges();
    let pedido = http.expectOne((r) => r.url === LISTA);
    expect(pedido.request.params.get('direcao')).toBe('RECEBIDA');
    pedido.flush({ itens: [], proximoCursor: null, total: 0 });
    await assentar();
    fixture.detectChanges();

    clicar('Perdidas');
    clicar('Recusadas');
    fixture.detectChanges();
    const pedidos = http.match((r) => r.url === LISTA);
    const ultimo = pedidos[pedidos.length - 1];
    expect(ultimo.request.params.get('situacao')).toBe('PERDIDA,RECUSADA');
    expect(ultimo.request.params.get('direcao')).toBe('RECEBIDA');
    pedidos.forEach((p) => p.flush({ itens: [], proximoCursor: null, total: 0 }));
    await assentar();
    fixture.detectChanges();
    expect(texto(raiz)).toContain('Nenhuma ligação com esses filtros');
  });

  it('a busca no texto vai ao servidor, destaca o achado e leva a busca ao painel', async () => {
    const { fixture, raiz } = await criar();
    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"]')!;
    campo.value = '"segunda via"';
    campo.dispatchEvent(new Event('input'));
    // Enter (envio do formulário de busca) busca já, sem esperar a pausa da digitação.
    raiz.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    const pedido = http.expectOne((r) => r.url === LISTA);
    expect(pedido.request.params.get('busca')).toBe('"segunda via"');
    pedido.flush({
      itens: [
        item({
          trechosEncontrados: [
            { falante: 'cliente', inicio: 42, texto: 'Preciso da segunda via do boleto' },
          ],
        }),
      ],
      proximoCursor: null,
      total: 1,
    });
    await assentar();
    fixture.detectChanges();
    const marca = raiz.querySelector('.trecho mark');
    expect(marca?.textContent).toBe('segunda via');
    expect(texto(raiz.querySelector('.trecho__quem'))).toContain('Cliente');
    expect(texto(raiz.querySelector('.trecho__quem'))).toContain('0:42');
    expect(texto(raiz.querySelector('.lista__total'))).toContain('1 ligação');
    expect(raiz.querySelector<HTMLAnchorElement>('a.item')!.getAttribute('href')).toContain(
      'busca=%22segunda%20via%22',
    );
  });

  it('"Mostrar mais ligações" pede a próxima página pelo cursor e junta sem repetir', async () => {
    const { fixture, raiz } = await criar([item()], 2, 'cur-1');
    const botao = [...raiz.querySelectorAll<HTMLButtonElement>('.lista__mais button')][0];
    expect(texto(botao)).toContain('Mostrar mais ligações');
    botao.click();
    const pedido = http.expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'cur-1');
    pedido.flush({
      itens: [item(), item({ id: 'lig-9', estado: 'SEM_RESPOSTA', direcao: 'FEITA' })],
      proximoCursor: null,
      total: 2,
    });
    await assentar();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('a.item')).toHaveLength(2);
    expect(raiz.querySelector('.lista__mais')).toBeNull();
  });

  it('erro da API mostra o estado de erro com "Tentar de novo"', async () => {
    const fixture = TestBed.createComponent(PaginaLigacoes);
    await fixture.whenStable();
    http.expectOne('/api/v1/atendimento/atendentes').flush([]);
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/atendimento/canais').flush([]);
    http
      .expectOne((r) => r.url === LISTA)
      .flush({ message: 'Falhou' }, { status: 500, statusText: 'Erro' });
    await assentar();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(texto(raiz)).toContain('Não deu para carregar as ligações');
    expect(texto(raiz)).toContain('Tentar de novo');
  });
});
