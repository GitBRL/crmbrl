import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { contatoDeTeste, empresaDeTeste } from '../contatos/dados-de-teste';
import { ClienteNegocio } from './cliente-negocio';

const CONTATO = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';

describe('ClienteNegocio (aba Cliente do negócio)', () => {
  let fixture: ComponentFixture<ClienteNegocio>;
  let http: HttpTestingController;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });
  afterEach(() => http.verify());

  async function abrir() {
    fixture = TestBed.createComponent(ClienteNegocio);
    fixture.componentRef.setInput('contatoId', CONTATO);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Deixa as promessas encadeadas do carregamento (contato → empresa) terminarem. */
  async function assentar() {
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function responder(url: string, corpo: object) {
    http.expectOne(url).flush(corpo);
    await assentar();
  }

  /** Pares "rótulo → valor" de uma seção. */
  function linhas(secao: Element | null): Record<string, string> {
    return Object.fromEntries(
      [...(secao?.querySelectorAll('.ficha__linha') ?? [])].map((linha) => [
        linha.querySelector('dt')?.textContent?.trim() ?? '',
        linha.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ]),
    );
  }

  it('mostra o cadastro do contato e os campos personalizados dele, com rótulos legíveis', async () => {
    await abrir();
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Carregando');
    await responder(
      `/api/v1/contatos/${CONTATO}`,
      contatoDeTeste({
        camposPersonalizados: {
          planilha_cidade: 'Brasília',
          faturamentoMensal: 25000,
          interesses: ['implante', 'clareamento'],
          observacao: null,
        },
      }),
    );
    await responder(`/api/v1/empresas/${EMPRESA}`, empresaDeTeste());

    const [contato] = raiz.querySelectorAll('section');
    const dados = linhas(contato);
    expect(dados['Nome']).toBe('Ana Beatriz Lopes');
    expect(dados['Cargo']).toBe('Diretora');
    expect(dados['E-mail']).toBe('ana.lopes@clinica.example.com');
    expect(dados['Telefone']).toMatch(/41.*98877-1201/);
    expect(dados['Empresa']).toBe('Clínica Vida Plena');
    expect(dados['Responsável']).toBe('Mariana Costa');
    expect(dados['Etiquetas']).toBe('Lead quente');
    expect(dados['Primeira origem']).toBe('Site');
    expect(dados['Última origem']).toMatch(/^Webhook · Disparos BRL · /);
    expect(dados['Conversões']).toBe('2 vezes');
    // Campos personalizados: ordem pela chave, rótulo legível, chave original na dica.
    const campos = [...contato.querySelectorAll('dl')][1];
    const rotulos = [...campos.querySelectorAll('dt')];
    expect(rotulos.map((dt) => dt.textContent?.trim())).toEqual([
      'Faturamento mensal',
      'Interesses',
      'Observacao',
      'Planilha cidade',
    ]);
    expect(rotulos[0].getAttribute('title')).toBe('faturamentoMensal');
    expect(linhas(campos)).toEqual({
      'Faturamento mensal': '25000',
      Interesses: '["implante","clareamento"]',
      Observacao: '—',
      'Planilha cidade': 'Brasília',
    });
    const link = contato.querySelector<HTMLAnchorElement>('a[href="/contatos/' + CONTATO + '"]');
    expect(link?.textContent?.trim()).toBe('Abrir e editar');
  });

  it('mostra a empresa do contato com os campos personalizados dela', async () => {
    await abrir();
    await responder(`/api/v1/contatos/${CONTATO}`, contatoDeTeste());
    await responder(
      `/api/v1/empresas/${EMPRESA}`,
      empresaDeTeste({ camposPersonalizados: { numero_de_unidades: 3 } }),
    );
    const empresa = raiz.querySelectorAll('section')[1];
    expect(empresa.querySelector('h3')?.textContent).toBe('Empresa');
    const dados = linhas(empresa);
    expect(dados['CNPJ']).toBe('11.222.333/0001-81');
    expect(dados['Segmento']).toBe('Saúde');
    expect(dados['Cidade']).toBe('Curitiba / PR');
    expect(dados['Numero de unidades']).toBe('3');
    expect(empresa.textContent).toContain('Campos personalizados da empresa');
  });

  it('sem campos personalizados, diz isso; sem empresa, não pede a empresa', async () => {
    await abrir();
    await responder(
      `/api/v1/contatos/${CONTATO}`,
      contatoDeTeste({ empresa: null, podeEditar: false, conversoes: 1, cargo: null }),
    );
    expect(raiz.textContent).toContain('Este contato não tem campos personalizados.');
    expect(raiz.querySelectorAll('section')).toHaveLength(1);
    expect(linhas(raiz.querySelector('section'))['Empresa']).toBe('—');
    // O cargo aparece sempre: vazio mostra "—" (dá para ver que não veio).
    expect(linhas(raiz.querySelector('section'))['Cargo']).toBe('—');
    expect(linhas(raiz.querySelector('section'))['Última origem']).toBeUndefined();
    expect(raiz.querySelector('a[href="/contatos/' + CONTATO + '"]')?.textContent?.trim()).toBe(
      'Abrir o contato',
    );
    // http.verify() no afterEach: nenhum GET /empresas.
  });

  it('a empresa que falha não esconde o contato', async () => {
    await abrir();
    await responder(
      `/api/v1/contatos/${CONTATO}`,
      contatoDeTeste({ camposPersonalizados: { origem_planilha: 'Clint' } }),
    );
    http
      .expectOne(`/api/v1/empresas/${EMPRESA}`)
      .flush({ mensagem: 'Erro.' }, { status: 500, statusText: 'Erro' });
    await assentar();
    expect(linhas(raiz.querySelector('section'))['Nome']).toBe('Ana Beatriz Lopes');
    expect(raiz.textContent).toContain('Origem planilha');
    expect(raiz.textContent).toContain('não conseguimos carregar os dados da empresa');
    expect(raiz.querySelector(`a[href="/empresas/${EMPRESA}"]`)).not.toBeNull();
  });

  it('erro ao carregar o contato: mensagem e "Tentar de novo" pede outra vez', async () => {
    await abrir();
    http
      .expectOne(`/api/v1/contatos/${CONTATO}`)
      .flush({ mensagem: 'Falhou.' }, { status: 500, statusText: 'Erro' });
    await assentar();
    expect(raiz.textContent).toContain('Não conseguimos carregar os dados do cliente');
    [...raiz.querySelectorAll<HTMLButtonElement>('button')]
      .find((botao) => botao.textContent?.includes('Tentar de novo'))!
      .click();
    await responder(`/api/v1/contatos/${CONTATO}`, contatoDeTeste({ empresa: null }));
    expect(linhas(raiz.querySelector('section'))['Nome']).toBe('Ana Beatriz Lopes');
  });
});
