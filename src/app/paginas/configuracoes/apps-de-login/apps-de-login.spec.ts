import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErroApi } from '../../../nucleo/api/erro-api';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { AppsDeLogin } from './apps-de-login';
import { AppsDeLoginApi } from './apps-de-login.api';
import { type AppDeLogin, haUso, resumoDoUso } from './apps-de-login.tipos';

const SEM_USO = { conexoes: 0, canais: 0, integracoes: 0 };

function app(extra: Partial<AppDeLogin> & Pick<AppDeLogin, 'aplicativo' | 'nome'>): AppDeLogin {
  return {
    configurado: false,
    clientId: null,
    segredoMascarado: null,
    enderecoDeRetorno: 'https://crm.exemplo/api/v1/publico/conexoes/oauth/retorno',
    emUso: SEM_USO,
    escopos: [],
    webhook: null,
    atualizadoEm: null,
    atualizadoPor: null,
    ...extra,
  };
}

const META = app({
  aplicativo: 'META',
  nome: 'Meta (Facebook, Instagram e Messenger)',
  configurado: true,
  clientId: '900000000000001',
  segredoMascarado: '••••••••3f9a',
  enderecoDeRetorno: 'https://crm.exemplo/api/v1/publico/facebook/oauth/retorno',
  emUso: { conexoes: 3, canais: 1, integracoes: 0 },
  escopos: ['leads_retrieval', 'pages_show_list'],
  webhook: {
    url: 'https://crm.exemplo/api/v1/publico/meta/webhook',
    tokenVerificacao: 'token-de-verificacao',
    campos: ['leadgen'],
  },
  atualizadoEm: '2026-11-05T12:00:00Z',
  atualizadoPor: { id: 'u1', nome: 'Admin' },
});
const TYPEFORM = app({ aplicativo: 'TYPEFORM', nome: 'Typeform', escopos: ['forms:read'] });
const RD = app({ aplicativo: 'RD_STATION', nome: 'RD Station' });

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Apps de login (Configurações)', () => {
  let api: Record<'listar' | 'salvar' | 'remover', ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AppsDeLogin>;
  let raiz: HTMLElement;

  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };
  const cartao = (id: string) => raiz.querySelector(`[data-teste="app-${id}"]`) as HTMLElement;
  const campo = (id: string, n: number) =>
    cartao(id).querySelectorAll('input')[n] as HTMLInputElement;
  const digitar = async (entrada: HTMLInputElement, valor: string) => {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
    await esperar();
  };
  const enviar = async (id: string) => {
    (cartao(id).querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await esperar();
  };

  beforeEach(async () => {
    api = {
      listar: vi.fn(() => Promise.resolve([RD, META, TYPEFORM])),
      salvar: vi.fn(),
      remover: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AppsDeLoginApi, useValue: api }],
    });
    fixture = TestBed.createComponent(AppsDeLogin);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('mostra os três apps na ordem Meta, Typeform, RD Station, com a situação e o uso', () => {
    const nomes = Array.from(raiz.querySelectorAll('.app__nome')).map(texto);
    expect(nomes).toEqual(['Meta (Facebook, Instagram e Messenger)', 'Typeform', 'RD Station']);
    expect(texto(cartao('META'))).toContain('Configurado');
    expect(texto(cartao('META').querySelector('[data-teste="uso"]'))).toBe('3 conexões, 1 canal');
    expect(texto(cartao('TYPEFORM'))).toContain('Não configurado');
    expect(texto(cartao('TYPEFORM').querySelector('[data-teste="uso"]'))).toBe(
      'Nada usa este app ainda',
    );
  });

  it('o ID aparece e o segredo nunca: o campo vem vazio, com a máscara na dica', () => {
    expect(campo('META', 0).value).toBe('900000000000001');
    expect(campo('META', 1).value).toBe('');
    expect(texto(cartao('META'))).toContain('••••••••3f9a');
  });

  it('os campos de segredo e de ID não são preenchidos pelo navegador', () => {
    const segredo = campo('META', 1);
    expect(segredo.getAttribute('autocomplete')).toBe('new-password');
    expect(segredo.hasAttribute('data-1p-ignore')).toBe(true);
    expect(campo('META', 0).getAttribute('autocomplete')).toBe('off');
  });

  it('a Meta traz o webhook de páginas, as permissões e o aviso do App Review; os outros, não', () => {
    const webhook = cartao('META').querySelector('[data-teste="webhook-meta"]');
    expect(texto(webhook)).toContain('https://crm.exemplo/api/v1/publico/meta/webhook');
    expect(texto(webhook)).toContain('token-de-verificacao');
    expect(texto(webhook)).toContain('leadgen');
    expect(texto(cartao('META'))).toContain('leads_retrieval');
    expect(cartao('META').querySelector('[data-teste="aviso-app-review"]')).not.toBeNull();
    expect(cartao('TYPEFORM').querySelector('[data-teste="webhook-meta"]')).toBeNull();
    expect(texto(cartao('TYPEFORM'))).toContain(RD.enderecoDeRetorno);
  });

  it('cadastra um app novo: exige ID e segredo, e manda os dois', async () => {
    await enviar('TYPEFORM');
    expect(api.salvar).not.toHaveBeenCalled();
    expect(texto(cartao('TYPEFORM'))).toContain('Informe o Client ID');
    expect(texto(cartao('TYPEFORM'))).toContain('Informe o client secret');

    api.salvar.mockResolvedValue({
      ...TYPEFORM,
      configurado: true,
      clientId: 'typeform-demo-client',
      segredoMascarado: '••••••••ente',
    });
    await digitar(campo('TYPEFORM', 0), ' typeform-demo-client ');
    await digitar(campo('TYPEFORM', 1), 'typeform-demo-segredo');
    await enviar('TYPEFORM');
    expect(api.salvar).toHaveBeenCalledWith('TYPEFORM', {
      clientId: 'typeform-demo-client',
      segredo: 'typeform-demo-segredo',
    });
    expect(texto(cartao('TYPEFORM'))).toContain('Configurado');
    expect(campo('TYPEFORM', 1).value).toBe('');
  });

  it('o ID da Meta tem só números', async () => {
    await digitar(campo('META', 0), '12ab');
    await enviar('META');
    expect(api.salvar).not.toHaveBeenCalled();
    expect(texto(cartao('META'))).toContain('tem só números');
  });

  it('salvar sem digitar o segredo mantém o atual (só o ID segue)', async () => {
    api.salvar.mockResolvedValue(META);
    await enviar('META');
    expect(api.salvar).toHaveBeenCalledWith('META', { clientId: '900000000000001' });
  });

  it('a Meta recusou o par (422): o erro aparece no campo do segredo', async () => {
    api.salvar.mockRejectedValue(
      new ErroApi({
        status: 422,
        codigo: 'regra_violada',
        mensagemDaApi: 'A Meta não reconheceu este par de ID e segredo.',
        detalhes: { campo: 'segredo' },
      }),
    );
    await digitar(campo('META', 1), 'errado');
    await enviar('META');
    expect(texto(cartao('META'))).toContain('A Meta não reconheceu este par');
  });

  it('trocar o ID de um app em uso (409) pede confirmação e reenvia com confirmarTroca', async () => {
    api.salvar.mockRejectedValueOnce(
      new ErroApi({
        status: 409,
        codigo: 'conflito',
        mensagemDaApi: 'O app está em uso.',
        detalhes: { emUso: META.emUso, confirmarTroca: true },
      }),
    );
    await digitar(campo('META', 0), '900000000000002');
    await digitar(campo('META', 1), 'segredo-novo');
    await enviar('META');

    const confirmacao = TestBed.inject(ConfirmacaoService);
    const aberta = confirmacao.aberta();
    expect(aberta?.pedido.detalhes).toEqual(['3 conexões, 1 canal']);
    api.salvar.mockResolvedValueOnce({ ...META, clientId: '900000000000002' });
    await aberta?.pedido.executar?.();
    aberta?.responder(true);
    await esperar();

    expect(api.salvar).toHaveBeenLastCalledWith('META', {
      clientId: '900000000000002',
      segredo: 'segredo-novo',
      confirmarTroca: true,
    });
  });

  it('remover um app em uso não chama a API e explica', async () => {
    const botao = Array.from(cartao('META').querySelectorAll('button')).find((b) =>
      texto(b).includes('Remover o app'),
    ) as HTMLButtonElement;
    botao.click();
    await esperar();
    expect(api.remover).not.toHaveBeenCalled();
    expect(texto(cartao('META'))).toContain(
      'Não dá para remover: 3 conexões, 1 canal usam este app',
    );
  });

  it('remover um app sem uso confirma, apaga e volta a "Não configurado"', async () => {
    const livre = { ...META, emUso: SEM_USO };
    api.listar.mockResolvedValueOnce([livre, TYPEFORM, RD]);
    fixture = TestBed.createComponent(AppsDeLogin);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
    api.listar.mockResolvedValueOnce([app({ aplicativo: 'META', nome: META.nome }), TYPEFORM, RD]);
    const botao = Array.from(cartao('META').querySelectorAll('button')).find((b) =>
      texto(b).includes('Remover o app'),
    ) as HTMLButtonElement;
    botao.click();
    await esperar();
    const aberta = TestBed.inject(ConfirmacaoService).aberta();
    await aberta?.pedido.executar?.();
    aberta?.responder(true);
    await esperar();
    expect(api.remover).toHaveBeenCalledWith('META');
    expect(texto(cartao('META'))).toContain('Não configurado');
  });

  it('erro ao carregar mostra "Tentar de novo"', async () => {
    api.listar.mockRejectedValueOnce(new ErroApi({ status: 500, codigo: 'erro_interno' }));
    fixture = TestBed.createComponent(AppsDeLogin);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
    expect(texto(raiz)).toContain('Não conseguimos carregar os apps de login');
    api.listar.mockResolvedValueOnce([META, TYPEFORM, RD]);
    (
      Array.from(raiz.querySelectorAll('button')).find((b) =>
        texto(b).includes('Tentar de novo'),
      ) as HTMLButtonElement
    ).click();
    await esperar();
    expect(raiz.querySelectorAll('.app__nome')).toHaveLength(3);
  });
});

describe('resumo do uso', () => {
  it('conta no singular e no plural, e diz quando nada usa', () => {
    expect(resumoDoUso({ conexoes: 1, canais: 0, integracoes: 2 })).toBe(
      '1 conexão, 2 integrações',
    );
    expect(resumoDoUso(SEM_USO)).toBe('Nada usa este app ainda');
    expect(haUso(SEM_USO)).toBe(false);
    expect(haUso({ conexoes: 0, canais: 1, integracoes: 0 })).toBe(true);
  });
});
