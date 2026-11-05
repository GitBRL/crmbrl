import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CONEXAO_COM_ATENCAO, CONEXAO_FACEBOOK, microtarefas } from './dados-de-teste';
import {
  consumirContextoDoLogin,
  type ConexaoFacebook,
  type RetornoDoFacebook,
} from './facebook.tipos';
import { ABRIR_JANELA, CHAVE_DO_RETORNO } from './login/login-janela';
import { IR_PARA_ENDERECO, PassoConexaoFacebook } from './passo-conexao-facebook';

const BASE = '/api/v1/webhooks/facebook';
const CONFIGURACAO = {
  appCadastrado: true,
  enderecoDeRetorno: 'https://crm.exemplo.com.br/api/v1/publico/facebook/oauth/retorno',
  escopos: ['leads_retrieval'],
  versaoDaGraph: 'v24.0',
  enderecoPublicoHttps: true,
};
const NOVA = '33333333-3333-4333-8333-333333333333';
const DIALOGO = 'http://127.0.0.1:3296/v24.0/dialog/oauth?state=abc';
const INICIADO = {
  conexaoId: NOVA,
  urlDialogo: DIALOGO,
  expiraEm: '2026-11-04T12:10:00Z',
  enderecoDeRetorno: CONFIGURACAO.enderecoDeRetorno,
};

describe('PassoConexaoFacebook', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PassoConexaoFacebook>;
  let destino: string[];
  let abertas: string[];
  let janela: { location: { href: string }; close: ReturnType<typeof vi.fn> } | null;

  beforeEach(() => {
    destino = [];
    abertas = [];
    janela = { location: { href: 'about:blank' }, close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IR_PARA_ENDERECO, useValue: (endereco: string) => destino.push(endereco) },
        {
          provide: ABRIR_JANELA,
          useValue: (endereco: string) => {
            abertas.push(endereco);
            return janela as unknown as Window | null;
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const elemento = () => fixture.nativeElement as HTMLElement;

  async function aguardar(): Promise<void> {
    await microtarefas();
    fixture.detectChanges();
  }

  function responderCarga(conexoes: readonly ConexaoFacebook[], configuracao = CONFIGURACAO) {
    http.expectOne(`${BASE}/conexoes`).flush(conexoes);
    http.expectOne(`${BASE}/configuracao`).flush(configuracao);
  }

  async function abrir(
    conexoes: readonly ConexaoFacebook[],
    opcoes: {
      retorno?: RetornoDoFacebook;
      selecionada?: string;
      configuracao?: typeof CONFIGURACAO;
    } = {},
  ) {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    fixture.componentRef.setInput('retorno', opcoes.retorno ?? null);
    fixture.componentRef.setInput('selecionadaId', opcoes.selecionada ?? null);
    fixture.componentRef.setInput('contexto', { integracaoId: 'we1', nome: 'Meu Facebook' });
    fixture.detectChanges();
    responderCarga(conexoes, opcoes.configuracao);
    await aguardar();
  }

  function escolherToken(): void {
    const radioToken = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Colar um token de página'))!;
    radioToken.click();
    fixture.detectChanges();
  }

  function terminarNaOutraJanela(valor: Record<string, unknown>): void {
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: CHAVE_DO_RETORNO, newValue: JSON.stringify(valor) }),
    );
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!achado) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return achado;
  }

  function campo(rotulo: string): HTMLInputElement {
    const id = Array.from(elemento().querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith(rotulo))
      ?.getAttribute('for');
    return elemento().querySelector<HTMLInputElement>(`#${id}`)!;
  }

  function digitar(entrada: HTMLInputElement, valor: string): void {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
  }

  it('mostra o aviso das permissões da Meta e a lista com a situação de cada conexão', async () => {
    await abrir([CONEXAO_FACEBOOK, CONEXAO_COM_ATENCAO]);
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('leads_retrieval');
    expect(texto).toContain('Leads Access');
    expect(texto).toContain('H3 Facebook (OAuth)');
    expect(texto).toContain('Conectada');
    expect(texto).toContain('Precisa de atenção');
    expect(texto).toContain('crie outra conexão com um token novo');
    const radios = elemento().querySelectorAll<HTMLInputElement>(
      'input[type=radio][name=conexao-facebook]',
    );
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
  });

  it('marca a conexão que já vale e avisa quem escolhe outra', async () => {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    const escolhidas: (ConexaoFacebook | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    fixture.componentRef.setInput('selecionadaId', 'cx1');
    fixture.detectChanges();
    responderCarga([CONEXAO_FACEBOOK]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe('cx1');
    expect(elemento().querySelector('.conexao--marcada')).not.toBeNull();
  });

  it('a conexão nova pede só o nome: nenhum campo de ID nem de segredo de app', async () => {
    await abrir([]);
    expect(elemento().textContent).toContain('Nenhuma conexão ainda');
    const rotulos = Array.from(elemento().querySelectorAll('label')).map(
      (l) => l.textContent ?? '',
    );
    expect(rotulos.some((r) => /Id do app|Segredo do app/i.test(r))).toBe(false);
    expect(rotulos.some((r) => r.startsWith('Nome da conexão'))).toBe(true);
  });

  it('"Entrar com o Facebook" abre a janela na hora, sem ID nem segredo, e a leva ao diálogo', async () => {
    await abrir([]);
    digitar(campo('Nome da conexão'), 'Facebook da escola');
    fixture.detectChanges();
    botao('Entrar com o Facebook').click();
    // A janela abriu no clique, antes de a API responder.
    expect(abertas).toEqual(['']);
    const pedido = http.expectOne(`${BASE}/oauth/iniciar`);
    expect(pedido.request.body).toEqual({ nome: 'Facebook da escola', modo: 'janela' });
    pedido.flush(INICIADO);
    await aguardar();
    expect(janela?.location.href).toBe(DIALOGO);
    expect(destino).toEqual([]);
    expect(elemento().querySelector('[data-teste="espera-do-login"]')?.textContent).toContain(
      'Aguardando o login na outra janela…',
    );
    expect(botao('Entrar com o Facebook').disabled).toBe(true);
  });

  it('quando a outra janela termina, o passo recarrega as conexões e marca a nova', async () => {
    await abrir([]);
    const escolhidas: (ConexaoFacebook | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    botao('Entrar com o Facebook').click();
    http.expectOne(`${BASE}/oauth/iniciar`).flush(INICIADO);
    await aguardar();

    terminarNaOutraJanela({ app: 'facebook', resultado: 'conectado', conexao: NOVA });
    await aguardar();
    responderCarga([
      { ...CONEXAO_FACEBOOK, id: NOVA, nome: 'Facebook novo', appDasConfiguracoes: true },
    ]);
    await aguardar();

    expect(escolhidas.at(-1)?.id).toBe(NOVA);
    expect(elemento().textContent).toContain('Conexão feita com o Facebook');
    expect(elemento().querySelector('[data-teste="espera-do-login"]')).toBeNull();
  });

  it('o retorno de outra conexão não vale; "Cancelar" a espera não chama a API', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    botao('Conectar de novo').click();
    http.expectOne(`${BASE}/oauth/iniciar`).flush({ ...INICIADO, conexaoId: 'cx1' });
    await aguardar();
    terminarNaOutraJanela({
      app: 'facebook',
      resultado: 'conectado',
      conexao: '44444444-4444-4444-8444-444444444444',
    });
    await aguardar();
    expect(elemento().querySelector('[data-teste="espera-do-login"]')).not.toBeNull();
    botao('Cancelar').click();
    await aguardar();
    expect(elemento().querySelector('[data-teste="espera-do-login"]')).toBeNull();
    expect(janela?.close).toHaveBeenCalled();
  });

  it('"Conectar de novo" pede o diálogo da conexão em modo janela', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    botao('Conectar de novo').click();
    const pedido = http.expectOne(`${BASE}/oauth/iniciar`);
    expect(pedido.request.body).toEqual({ conexaoId: 'cx1', modo: 'janela' });
    pedido.flush({ ...INICIADO, conexaoId: 'cx1' });
    await aguardar();
    expect(janela?.location.href).toBe(DIALOGO);
  });

  it('pop-up bloqueado: cai na mesma aba, em modo página, guardando o contexto', async () => {
    janela = null;
    await abrir([CONEXAO_FACEBOOK]);
    botao('Conectar de novo').click();
    const pedido = http.expectOne(`${BASE}/oauth/iniciar`);
    expect(pedido.request.body).toEqual({ conexaoId: 'cx1', modo: 'pagina' });
    pedido.flush({ ...INICIADO, conexaoId: 'cx1' });
    await aguardar();
    expect(destino).toEqual([DIALOGO]);
    expect(consumirContextoDoLogin()).toEqual({ integracaoId: 'we1', nome: 'Meu Facebook' });
  });

  it('recusa levar a janela a um endereço que não é http(s) e a fecha', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    botao('Conectar de novo').click();
    http
      .expectOne(`${BASE}/oauth/iniciar`)
      .flush({ ...INICIADO, conexaoId: 'cx1', urlDialogo: 'javascript:alert(1)' });
    await aguardar();
    expect(janela?.location.href).toBe('about:blank');
    expect(janela?.close).toHaveBeenCalled();
    expect(destino).toEqual([]);
    expect(elemento().querySelector('[role=alert]')?.textContent).toContain('não é válido');
  });

  it('app da Meta não cadastrado: avisa com o link e não deixa entrar', async () => {
    await abrir([], { configuracao: { ...CONFIGURACAO, appCadastrado: false } });
    const aviso = elemento().querySelector('[data-teste="app-nao-cadastrado"]')!;
    expect(aviso.textContent).toContain('O app da Meta ainda não foi cadastrado');
    expect(aviso.querySelector('a')?.getAttribute('href')).toBe('/configuracoes/apps-de-login');
    expect(aviso.querySelector('a')?.textContent).toContain('Configurações > Apps de login');
    expect(botao('Entrar com o Facebook').disabled).toBe(true);
  });

  it('com o app cadastrado o aviso não aparece', async () => {
    await abrir([]);
    expect(elemento().querySelector('[data-teste="app-nao-cadastrado"]')).toBeNull();
  });

  it('o 422 de app não cadastrado (configuração antiga na tela) também mostra o aviso e fecha a janela', async () => {
    await abrir([]);
    botao('Entrar com o Facebook').click();
    http.expectOne(`${BASE}/oauth/iniciar`).flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem:
          'O app da Meta ainda não foi cadastrado. Cadastre-o em Configurações > Apps de login.',
        detalhes: { appNaoCadastrado: true },
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await aguardar();
    expect(elemento().querySelector('[data-teste="app-nao-cadastrado"]')).not.toBeNull();
    expect(janela?.close).toHaveBeenCalled();
  });

  it('a alternativa "colar token de página" manda só o token e o id da página', async () => {
    await abrir([]);
    const escolhidas: (ConexaoFacebook | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    escolherToken();
    const segredo = campo('Token da página');
    expect(segredo.getAttribute('autocomplete')).toBe('new-password');
    expect(segredo.hasAttribute('data-1p-ignore')).toBe(true);
    digitar(segredo, 'la-pagina-300000000000002');
    digitar(campo('Id da página'), '300000000000002');
    fixture.detectChanges();
    botao('Conectar com o token').click();
    const pedido = http.expectOne(`${BASE}/conexoes/token-de-pagina`);
    expect(pedido.request.body).toEqual({
      tokenPagina: 'la-pagina-300000000000002',
      paginaId: '300000000000002',
    });
    pedido.flush({ ...CONEXAO_FACEBOOK, id: 'cx3', tipo: 'PAGINA', nome: 'Clínica' });
    await microtarefas();
    responderCarga([
      CONEXAO_FACEBOOK,
      { ...CONEXAO_FACEBOOK, id: 'cx3', tipo: 'PAGINA', nome: 'Clínica' },
    ]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe('cx3');
  });

  it('mostra um token recusado como erro do formulário', async () => {
    await abrir([]);
    escolherToken();
    digitar(campo('Token da página'), 'la-expirado');
    fixture.detectChanges();
    botao('Conectar com o token').click();
    http
      .expectOne(`${BASE}/conexoes/token-de-pagina`)
      .flush(
        { statusCode: 422, erro: 'regra_violada', mensagem: 'O Facebook recusou o token.' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await aguardar();
    expect(elemento().querySelector('[role=alert]')?.textContent).toContain('recusou');
  });

  it('explica o retorno do login: sucesso, cancelamento e erro', async () => {
    await abrir([CONEXAO_FACEBOOK], {
      retorno: { resultado: 'conectado', conexaoId: 'cx1', motivo: null, mensagem: null },
      selecionada: 'cx1',
    });
    expect(elemento().textContent).toContain('Conexão feita com o Facebook');
    fixture.destroy();

    await abrir([CONEXAO_FACEBOOK], {
      retorno: { resultado: 'cancelado', conexaoId: null, motivo: null, mensagem: null },
    });
    expect(elemento().textContent).toContain('Você cancelou o login no Facebook');
    fixture.destroy();

    await abrir([CONEXAO_FACEBOOK], {
      retorno: { resultado: 'erro', conexaoId: null, motivo: 'state_usado', mensagem: '<b>x</b>' },
    });
    const alerta = elemento().querySelector('[role=alert]')!;
    expect(alerta.textContent).toContain('Este login já foi usado');
    expect(alerta.textContent).toContain('<b>x</b>');
    expect(alerta.querySelector('b')).toBeNull();
  });

  it('o cancelamento feito na outra janela aparece como "cancelou", sem conectar', async () => {
    await abrir([]);
    botao('Entrar com o Facebook').click();
    http.expectOne(`${BASE}/oauth/iniciar`).flush(INICIADO);
    await aguardar();
    terminarNaOutraJanela({
      app: 'facebook',
      resultado: 'cancelado',
      conexao: NOVA,
      motivo: 'access_denied',
    });
    await aguardar();
    expect(elemento().textContent).toContain('Você cancelou o login no Facebook');
    expect(elemento().querySelector('[data-teste="espera-do-login"]')).toBeNull();
  });

  it('mostra o erro ao carregar e deixa tentar de novo', async () => {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    fixture.detectChanges();
    http
      .expectOne(`${BASE}/conexoes`)
      .flush({ mensagem: 'falhou' }, { status: 500, statusText: 'Erro' });
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    await aguardar();
    expect(elemento().textContent).toContain('Não conseguimos carregar as conexões');
    botao('Tentar de novo').click();
    responderCarga([CONEXAO_FACEBOOK]);
    await aguardar();
    expect(elemento().textContent).toContain('H3 Facebook (OAuth)');
  });

  it('conexão antiga, com app próprio: o webhook de páginas ainda aparece, com endereço e token', async () => {
    await abrir([CONEXAO_FACEBOOK], { selecionada: 'cx1' });
    const secao = elemento().querySelector<HTMLElement>('[data-teste="webhook-paginas"]')!;
    expect(secao).not.toBeNull();
    const texto = secao.textContent ?? '';
    expect(texto).toContain('Webhook de páginas no app da Meta');
    expect(texto).toContain('leadgen');
    expect(texto).toContain('https://crm.exemplo.com.br/api/v1/publico/meta/webhook');
    expect(texto).toContain('token-verificacao-cx1');
    expect(secao.querySelectorAll('app-botao-copiar')).toHaveLength(2);
  });

  it('conexão com o app das Configurações: o quadro do webhook sai do assistente', async () => {
    await abrir([{ ...CONEXAO_FACEBOOK, appDasConfiguracoes: true }], { selecionada: 'cx1' });
    expect(elemento().querySelector('[data-teste="webhook-paginas"]')).toBeNull();
  });

  it('sem conexão marcada não mostra o webhook de páginas', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    expect(elemento().querySelector('[data-teste="webhook-paginas"]')).toBeNull();
  });
});
