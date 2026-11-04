import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { CONEXAO_COM_ATENCAO, CONEXAO_FACEBOOK, microtarefas } from './dados-de-teste';
import {
  consumirContextoDoLogin,
  type ConexaoFacebook,
  type RetornoDoFacebook,
} from './facebook.tipos';
import { IR_PARA_ENDERECO, PassoConexaoFacebook } from './passo-conexao-facebook';

const BASE = '/api/v1/webhooks/facebook';
const CONFIGURACAO = {
  enderecoDeRetorno: 'https://crm.exemplo.com.br/api/v1/publico/facebook/oauth/retorno',
  escopos: ['leads_retrieval'],
  versaoDaGraph: 'v24.0',
  enderecoPublicoHttps: true,
};

describe('PassoConexaoFacebook', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PassoConexaoFacebook>;
  let destino: string[];

  beforeEach(() => {
    destino = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IR_PARA_ENDERECO, useValue: (endereco: string) => destino.push(endereco) },
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

  async function abrir(
    conexoes: readonly ConexaoFacebook[],
    opcoes: { retorno?: RetornoDoFacebook; selecionada?: string; canais?: unknown[] } = {},
  ) {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    fixture.componentRef.setInput('retorno', opcoes.retorno ?? null);
    fixture.componentRef.setInput('selecionadaId', opcoes.selecionada ?? null);
    fixture.componentRef.setInput('contexto', { integracaoId: 'we1', nome: 'Meu Facebook' });
    fixture.detectChanges();
    http.expectOne(`${BASE}/conexoes`).flush(conexoes);
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    http.expectOne(`${BASE}/canais`).flush(opcoes.canais ?? []);
    await aguardar();
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
    const radios = elemento().querySelectorAll<HTMLInputElement>('input[type=radio]');
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
    expect(elemento().querySelector('.conexao__retorno-oauth')?.textContent).toContain(
      'https://crm.exemplo.com.br/api/v1/publico/facebook/oauth/retorno',
    );
  });

  it('marca a conexão que já vale e avisa quem escolhe outra', async () => {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    const escolhidas: (ConexaoFacebook | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    fixture.componentRef.setInput('selecionadaId', 'cx1');
    fixture.detectChanges();
    http.expectOne(`${BASE}/conexoes`).flush([CONEXAO_FACEBOOK]);
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    http.expectOne(`${BASE}/canais`).flush([]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe('cx1');
    expect(elemento().querySelector('.conexao--marcada')).not.toBeNull();
  });

  it('"Conectar de novo" pede o diálogo da conexão, guarda o contexto e leva o navegador ao Facebook', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    botao('Conectar de novo').click();
    const pedido = http.expectOne(`${BASE}/oauth/iniciar`);
    expect(pedido.request.body).toEqual({ conexaoId: 'cx1' });
    pedido.flush({
      conexaoId: 'cx1',
      urlDialogo: 'http://127.0.0.1:3296/v24.0/dialog/oauth?state=abc',
      expiraEm: '2026-11-04T12:10:00Z',
      enderecoDeRetorno: CONFIGURACAO.enderecoDeRetorno,
    });
    await aguardar();
    expect(destino).toEqual(['http://127.0.0.1:3296/v24.0/dialog/oauth?state=abc']);
    expect(consumirContextoDoLogin()).toEqual({ integracaoId: 'we1', nome: 'Meu Facebook' });
  });

  it('recusa levar o navegador a um endereço que não é http(s)', async () => {
    await abrir([CONEXAO_FACEBOOK]);
    const avisos = TestBed.inject(AvisosService);
    const erro = vi.spyOn(avisos, 'erro');
    botao('Conectar de novo').click();
    http.expectOne(`${BASE}/oauth/iniciar`).flush({
      conexaoId: 'cx1',
      urlDialogo: 'javascript:alert(1)',
      expiraEm: '2026-11-04T12:10:00Z',
      enderecoDeRetorno: CONFIGURACAO.enderecoDeRetorno,
    });
    await aguardar();
    expect(destino).toEqual([]);
    expect(erro).toHaveBeenCalled();
  });

  it('"Entrar com o Facebook" exige o id e o segredo do app e depois abre o login', async () => {
    await abrir([]);
    expect(elemento().textContent).toContain('Nenhuma conexão ainda');
    botao('Entrar com o Facebook').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Informe o id do app.');
    expect(elemento().textContent).toContain('Informe o segredo do app.');
    http.expectNone(`${BASE}/oauth/iniciar`);

    digitar(campo('Id do app'), '900000000000001');
    digitar(campo('Segredo do app'), 'segredo-de-teste');
    digitar(campo('Nome da conexão'), 'Facebook da escola');
    fixture.detectChanges();
    botao('Entrar com o Facebook').click();
    const pedido = http.expectOne(`${BASE}/oauth/iniciar`);
    expect(pedido.request.body).toEqual({
      appId: '900000000000001',
      appSecret: 'segredo-de-teste',
      nome: 'Facebook da escola',
    });
    pedido.flush({
      conexaoId: 'novo',
      urlDialogo: 'https://www.facebook.com/v24.0/dialog/oauth?state=z',
      expiraEm: '2026-11-04T12:10:00Z',
      enderecoDeRetorno: CONFIGURACAO.enderecoDeRetorno,
    });
    await aguardar();
    expect(destino[0]).toContain('facebook.com/v24.0/dialog/oauth');
  });

  it('a alternativa "colar token de página" cria a conexão e a marca', async () => {
    await abrir([]);
    const escolhidas: (ConexaoFacebook | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    const radioToken = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Colar um token de página'))!;
    radioToken.click();
    fixture.detectChanges();
    digitar(campo('Id do app'), '900000000000001');
    digitar(campo('Segredo do app'), 'segredo-de-teste');
    digitar(campo('Token da página'), 'la-pagina-300000000000002');
    digitar(campo('Id da página'), '300000000000002');
    fixture.detectChanges();
    botao('Conectar com o token').click();
    const pedido = http.expectOne(`${BASE}/conexoes/token-de-pagina`);
    expect(pedido.request.body).toEqual({
      tokenPagina: 'la-pagina-300000000000002',
      paginaId: '300000000000002',
      appId: '900000000000001',
      appSecret: 'segredo-de-teste',
    });
    pedido.flush({ ...CONEXAO_FACEBOOK, id: 'cx3', tipo: 'PAGINA', nome: 'Clínica' });
    await microtarefas();
    http
      .expectOne(`${BASE}/conexoes`)
      .flush([
        CONEXAO_FACEBOOK,
        { ...CONEXAO_FACEBOOK, id: 'cx3', tipo: 'PAGINA', nome: 'Clínica' },
      ]);
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    http.expectOne(`${BASE}/canais`).flush([]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe('cx3');
  });

  it('mostra um token recusado como erro do formulário', async () => {
    await abrir([]);
    const radioToken = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Colar um token de página'))!;
    radioToken.click();
    fixture.detectChanges();
    digitar(campo('Id do app'), '1');
    digitar(campo('Segredo do app'), 's');
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

  it('mostra o erro ao carregar e deixa tentar de novo', async () => {
    fixture = TestBed.createComponent(PassoConexaoFacebook);
    fixture.detectChanges();
    http
      .expectOne(`${BASE}/conexoes`)
      .flush({ mensagem: 'falhou' }, { status: 500, statusText: 'Erro' });
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    http.expectOne(`${BASE}/canais`).flush([]);
    await aguardar();
    expect(elemento().textContent).toContain('Não conseguimos carregar as conexões');
    botao('Tentar de novo').click();
    http.expectOne(`${BASE}/conexoes`).flush([CONEXAO_FACEBOOK]);
    http.expectOne(`${BASE}/configuracao`).flush(CONFIGURACAO);
    http.expectOne(`${BASE}/canais`).flush([]);
    await aguardar();
    expect(elemento().textContent).toContain('H3 Facebook (OAuth)');
  });
});
