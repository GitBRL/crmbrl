import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Aplicativos } from './aplicativos';
import {
  CATALOGO,
  FUNIS,
  integracaoElementor,
  microtarefas,
  pagina,
  webhookEntrada,
} from './dados-de-teste';

const LISTA = '/api/v1/webhooks/entradas?pagina=1&porPagina=100';

const ANTIGA = webhookEntrada({
  id: 'we-antiga',
  nome: 'Landing antiga',
  enderecoDisponivel: false,
});
const COM_ATENCAO = integracaoElementor({
  id: 'we-atencao',
  nome: 'Elementor da loja',
  situacao: 'PRECISA_ATENCAO',
  precisaAtencao: true,
  atencaoMotivo: 'A credencial foi recusada.',
});
const INATIVA = integracaoElementor({
  id: 'we-inativa',
  nome: 'Elementor parado',
  ativo: false,
  situacao: 'INATIVA',
  ultimoRecebimentoEm: null,
});

describe('Aplicativos (catálogo e suas integrações)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Aplicativos>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const elemento = () => fixture.nativeElement as HTMLElement;

  async function abrir(
    integracoes = [integracaoElementor(), COM_ATENCAO, INATIVA, ANTIGA],
    funil: string | null = null,
  ) {
    fixture = TestBed.createComponent(Aplicativos);
    fixture.componentRef.setInput('funil', funil);
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/aplicativos').flush(CATALOGO);
    http.expectOne(LISTA).flush(pagina(integracoes, 100));
    http.expectOne('/api/v1/funis').flush(FUNIS);
    await microtarefas();
    fixture.detectChanges();
  }

  function nomesDoCatalogo(): string[] {
    return Array.from(elemento().querySelectorAll('.catalogo__grade .app__nome')).map((n) =>
      (n.textContent ?? '').trim(),
    );
  }

  function digitarBusca(texto: string): void {
    const campo = elemento().querySelector<HTMLInputElement>('.catalogo__busca input')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mostra o catálogo em ordem alfabética, com os indisponíveis como "Em breve"', async () => {
    await abrir();
    expect(nomesDoCatalogo()).toEqual(['Elementor', 'Hotmart', 'Typeform', 'Webhook']);
    const hotmart = elemento().querySelector<HTMLButtonElement>('[data-app="HOTMART"]')!;
    expect(hotmart.disabled).toBe(true);
    expect(hotmart.textContent).toContain('Em breve');
    expect(elemento().querySelector<HTMLButtonElement>('[data-app="ELEMENTOR"]')!.disabled).toBe(
      false,
    );
    // O logotipo é decorativo e vem de /assets/integracoes.
    expect(elemento().querySelector('[data-app="ELEMENTOR"] img')?.getAttribute('src')).toBe(
      '/assets/integracoes/elementor.svg',
    );
  });

  it('a busca filtra pelo nome e, sem resultado, explica', async () => {
    await abrir();
    digitarBusca('type');
    expect(nomesDoCatalogo()).toEqual(['Typeform']);
    digitarBusca('zzz');
    expect(elemento().textContent).toContain('Nenhum aplicativo com esse nome');
  });

  it('agrupa as integrações por aplicativo, com situação e último recebimento', async () => {
    await abrir();
    const grupos = Array.from(elemento().querySelectorAll('.grupo__titulo')).map((g) =>
      g.textContent?.replace(/\s+/g, ''),
    );
    expect(grupos).toEqual(['Elementor·3', 'Webhook·1']);
    const linhas = elemento().querySelectorAll('.linha');
    expect(linhas).toHaveLength(4);
    const texto = elemento().querySelector('.suas')!.textContent ?? '';
    expect(texto).toContain('Precisa de atenção');
    expect(texto).toContain('A credencial foi recusada.');
    expect(texto).toContain('Inativa');
    expect(texto).toContain('Nunca');
    expect(texto).toContain('Criar ou atualizar negócio');
    expect(texto).toContain('Marketing · Novo lead');
    expect(texto).toContain('1 integração precisa de atenção');
  });

  it('integração antiga (sem endereço recuperável) é marcada', async () => {
    await abrir();
    const linha = elemento().querySelector('[data-integracao="Landing antiga"]')!;
    expect(linha.textContent).toContain('Endereço antigo');
  });

  it('o filtro "Precisam de atenção" mostra só elas', async () => {
    await abrir();
    const botao = Array.from(
      elemento().querySelectorAll<HTMLElement>('.suas [role="radio"], .suas button'),
    ).find((b) => b.textContent?.trim() === 'Precisam de atenção')!;
    botao.click();
    fixture.detectChanges();
    expect(elemento().querySelectorAll('.linha')).toHaveLength(1);
    expect(elemento().querySelector('.linha')!.textContent).toContain('Elementor da loja');
  });

  it('?funil filtra a lista e avisa que a nova integração entra nele', async () => {
    await abrir([integracaoElementor(), ANTIGA], 'f-com');
    expect(elemento().textContent).toContain('Mostrando só as integrações do funil');
    expect(elemento().textContent).toContain('Comercial');
    // Todas as integrações de teste estão no Marketing (f-mkt): nenhuma sobra.
    expect(elemento().querySelectorAll('.linha')).toHaveLength(0);
    expect(elemento().textContent).toContain('Nenhuma integração encontrada');
  });

  it('erro ao carregar a lista mostra a falha com "Tentar de novo"', async () => {
    fixture = TestBed.createComponent(Aplicativos);
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/aplicativos').flush(CATALOGO);
    http.expectOne(LISTA).flush({ statusCode: 500 }, { status: 500, statusText: 'Erro' });
    http.expectOne('/api/v1/funis').flush(FUNIS);
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Não conseguimos carregar as integrações');
    const tentar = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Tentar de novo',
    )!;
    tentar.click();
    http.expectOne(LISTA).flush(pagina([integracaoElementor()], 100));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelectorAll('.linha')).toHaveLength(1);
  });
});
