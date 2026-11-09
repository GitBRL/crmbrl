import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ConfirmacaoService } from '../../../../nucleo/confirmacao.service';
import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { meta, microtarefas } from '../dados-de-teste';
import { CanalMeta } from './canal-meta';

describe('CanalMeta (Instagram e Messenger, R14)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CanalMeta>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      await pedido.executar?.();
      return true;
    });
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  function digitar(rotulo: string, valor: string): void {
    const label = Array.from(raiz().querySelectorAll('label')).find((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim().startsWith(rotulo),
    )!;
    const campo = raiz().querySelector<HTMLInputElement>(
      `#${CSS.escape(label.getAttribute('for')!)}`,
    )!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Os rótulos dos campos (o passo a passo também cita "Chave secreta do app"). */
  function rotulos(): string[] {
    return Array.from(raiz().querySelectorAll('label')).map((l) =>
      (l.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  const APP_META = {
    aplicativo: 'META',
    nome: 'Meta (Facebook, Instagram e Messenger)',
    configurado: true,
    clientId: '900000000000001',
    segredoMascarado: '••••••••3f9a',
    enderecoDeRetorno: 'https://crm/api/v1/publico/facebook/oauth/retorno',
    emUso: { conexoes: 0, canais: 0, integracoes: 0 },
    escopos: [],
    webhook: null,
    atualizadoEm: null,
    atualizadoPor: null,
  };
  const SEM_APP = [{ ...APP_META, configurado: false, clientId: null, segredoMascarado: null }];

  async function novo(tipo: 'INSTAGRAM' | 'MESSENGER', apps: readonly unknown[] = SEM_APP) {
    fixture = TestBed.createComponent(CanalMeta);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/configuracoes/apps-de-login').flush(apps);
    await microtarefas();
    fixture.detectChanges();
  }

  it('novo Messenger: passo a passo aberto, sem o id do Instagram, cria com o tipo', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await novo('MESSENGER');
    expect(raiz().querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(raiz().textContent).toContain('pages_messaging');
    expect(raiz().textContent).not.toContain('ID da conta do Instagram');
    expect(raiz().textContent).toContain('Regra das 24 horas da Meta');
    digitar('Nome do canal', 'Página BRL');
    digitar('ID do app', '1234567890');
    digitar('Chave secreta do app', 'segredo');
    digitar('ID da página', '109876543210987');
    digitar('Token da página', 'EAAB...');
    botao('Criar canal').click();
    const pedido = http.expectOne('/api/v1/meta/canais');
    expect(pedido.request.body).toEqual({
      tipo: 'MESSENGER',
      nome: 'Página BRL',
      appId: '1234567890',
      pageId: '109876543210987',
      appSecret: 'segredo',
      tokenPagina: 'EAAB...',
      instagramId: null,
      filaPadraoId: null,
      ativo: true,
    });
    pedido.flush(meta({ id: 'm-9', tipo: 'MESSENGER' }));
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'meta', 'm-9'], {
      replaceUrl: true,
    });
  });

  it('novo Instagram: o id da conta é obrigatório e os ids só aceitam números', async () => {
    await novo('INSTAGRAM');
    digitar('Nome do canal', 'Instagram');
    digitar('ID do app', 'abc');
    digitar('Chave secreta do app', 's');
    digitar('ID da página', '109876543210987');
    digitar('Token da página', 't');
    botao('Criar canal').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/meta/canais');
    expect(raiz().textContent).toContain('Use só os números do ID');
    expect(raiz().textContent).toContain('ID da conta do Instagram');
  });

  it('salvo: webhook para copiar, testar a conexão e gerar outro token', async () => {
    fixture = TestBed.createComponent(CanalMeta);
    fixture.componentRef.setInput('id', 'm-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/configuracoes/apps-de-login').flush(SEM_APP);
    http.expectOne('/api/v1/meta/canais/m-1').flush(meta());
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('details')?.hasAttribute('open')).toBe(false);
    const webhook = raiz().querySelector('.webhook')!;
    expect(webhook.textContent).toContain('http://localhost:4200/api/v1/publico/meta/webhook');
    expect(webhook.textContent).toContain('vt_123456');
    expect(webhook.querySelectorAll('.webhook__campos li')).toHaveLength(4);

    botao('Testar conexão').click();
    http
      .expectOne('/api/v1/meta/canais/m-1/testar')
      .flush({ ok: true, mensagem: 'Conectado à página "Loja BRL".', nome: 'Loja BRL' });
    await microtarefas();
    http.expectOne('/api/v1/meta/canais/m-1').flush(meta());
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Funcionou.');

    (fixture.componentInstance as unknown as { agir(acao: string): void }).agir('token');
    await microtarefas(2);
    http
      .expectOne('/api/v1/meta/canais/m-1/token-verificacao')
      .flush({ tokenVerificacao: 'vt_novo' });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.webhook')?.textContent).toContain('vt_novo');
  });

  it('sem o app da Meta cadastrado, o formulário pede o ID e a chave e sugere cadastrar o app', async () => {
    await novo('MESSENGER');
    expect(raiz().querySelector('[data-teste="app-das-configuracoes"]')).toBeNull();
    expect(raiz().querySelector('[data-teste="dica-apps-de-login"]')?.textContent).toContain(
      'Configurações → Apps de login',
    );
    expect(raiz().textContent).toContain('Chave secreta do app');
  });

  it('com o app cadastrado, o canal novo usa o das Configurações e não manda ID nem segredo', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await novo('MESSENGER', [APP_META]);
    const quadro = raiz().querySelector('[data-teste="app-das-configuracoes"]')!;
    expect(quadro.textContent).toContain('900000000000001');
    expect(quadro.querySelector('a')?.getAttribute('href')).toBe('/configuracoes/apps-de-login');
    expect(rotulos()).not.toContain('Chave secreta do app');
    expect(rotulos()).not.toContain('ID do app');

    digitar('Nome do canal', 'Página BRL');
    digitar('ID da página', '109876543210987');
    digitar('Token da página', 'EAAB...');
    botao('Criar canal').click();
    const pedido = http.expectOne('/api/v1/meta/canais');
    expect(pedido.request.body).toEqual({
      tipo: 'MESSENGER',
      nome: 'Página BRL',
      pageId: '109876543210987',
      tokenPagina: 'EAAB...',
      instagramId: null,
      filaPadraoId: null,
      ativo: true,
    });
    pedido.flush(meta({ id: 'm-9', tipo: 'MESSENGER' }));
    await microtarefas();
    expect(navegar).toHaveBeenCalled();
  });

  it('"Usar outro app" mostra o ID e a chave secreta, exigidos, e manda os dois', async () => {
    await novo('MESSENGER', [APP_META]);
    botao('Usar outro app').click();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-teste="app-das-configuracoes"]')).toBeNull();
    expect(raiz().textContent).toContain('Chave secreta do app');

    digitar('Nome do canal', 'Página BRL');
    digitar('ID da página', '109876543210987');
    digitar('Token da página', 'EAAB...');
    botao('Criar canal').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/meta/canais');
    expect(raiz().textContent).toContain('Confira os campos marcados.');

    digitar('ID do app', '555555555');
    digitar('Chave secreta do app', 'outro-segredo');
    botao('Criar canal').click();
    const pedido = http.expectOne('/api/v1/meta/canais');
    expect(pedido.request.body).toMatchObject({ appId: '555555555', appSecret: 'outro-segredo' });
    pedido.flush(meta({ id: 'm-8' }));
    await microtarefas();
  });

  it('"Usar o app das Configurações" volta ao padrão', async () => {
    await novo('MESSENGER', [APP_META]);
    botao('Usar outro app').click();
    fixture.detectChanges();
    botao('Usar o app das Configurações').click();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-teste="app-das-configuracoes"]')).not.toBeNull();
  });

  it('canal salvo com o app das Configurações: não mostra ID nem segredo, e o PATCH não os manda', async () => {
    fixture = TestBed.createComponent(CanalMeta);
    fixture.componentRef.setInput('id', 'm-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/configuracoes/apps-de-login').flush([APP_META]);
    http.expectOne('/api/v1/meta/canais/m-1').flush(meta({ appDasConfiguracoes: true }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-teste="app-das-configuracoes"]')).not.toBeNull();
    expect(rotulos()).not.toContain('Chave secreta do app');
    botao('Salvar').click();
    const pedido = http.expectOne('/api/v1/meta/canais/m-1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).not.toHaveProperty('appId');
    expect(pedido.request.body).not.toHaveProperty('appSecret');
    pedido.flush(meta({ appDasConfiguracoes: true }));
    await microtarefas();
  });

  it('o campo da chave secreta do app não é preenchido pelo navegador', async () => {
    await novo('MESSENGER');
    const campos = Array.from(raiz().querySelectorAll('input[type=password]'));
    expect(campos.length).toBeGreaterThan(0);
    for (const campo of campos) {
      expect(campo.getAttribute('autocomplete')).toBe('new-password');
      expect(campo.hasAttribute('data-1p-ignore')).toBe(true);
    }
  });
});
