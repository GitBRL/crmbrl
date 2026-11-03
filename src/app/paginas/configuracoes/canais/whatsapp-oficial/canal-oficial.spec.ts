import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { falhaDaApi, microtarefas, oficial, templateDoCanal } from '../dados-de-teste';
import { CanalOficial } from './canal-oficial';

describe('CanalOficial (WhatsApp pela API da Meta)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CanalOficial>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
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

  function botao(texto: string): HTMLButtonElement {
    return Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  async function abrirSalvo(
    canal = oficial(),
    templates: unknown = [
      templateDoCanal(),
      templateDoCanal({ id: 't-2', nome: 'boas_vindas', status: 'PENDING', usavel: false }),
    ],
  ) {
    fixture = TestBed.createComponent(CanalOficial);
    fixture.componentRef.setInput('id', 'o-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/whatsapp-oficial/canais/o-1').flush(canal);
    await microtarefas();
    http.expectOne('/api/v1/whatsapp-oficial/canais/o-1/templates').flush(templates as object);
    await microtarefas();
    fixture.detectChanges();
  }

  it('novo: passo a passo aberto, campos obrigatórios e cria sem mostrar segredos', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CanalOficial);
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(raiz().textContent).toContain('Regra das 24 horas');
    botao('Criar canal').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/whatsapp-oficial/canais');
    digitar('Nome do canal', 'Oficial BRL');
    digitar('ID do número de telefone', 'abc');
    botao('Criar canal').click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Use só os números do ID');
    digitar('ID do número de telefone', '100000000000001');
    digitar('ID da conta (WABA)', '200000000000001');
    digitar('Token de acesso', 'EAAtoken');
    digitar('Chave secreta do app', 'segredo');
    botao('Criar canal').click();
    const pedido = http.expectOne('/api/v1/whatsapp-oficial/canais');
    expect(pedido.request.body).toEqual({
      nome: 'Oficial BRL',
      phoneNumberId: '100000000000001',
      wabaId: '200000000000001',
      numeroExibido: null,
      token: 'EAAtoken',
      appSecret: 'segredo',
      filaPadraoId: null,
      ativo: true,
    });
    pedido.flush(oficial({ id: 'o-9' }));
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'whatsapp-oficial', 'o-9'], {
      replaceUrl: true,
    });
  });

  it('número repetido (409) marca o campo do ID', async () => {
    fixture = TestBed.createComponent(CanalOficial);
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    await microtarefas();
    fixture.detectChanges();
    digitar('Nome do canal', 'Oficial BRL');
    digitar('ID do número de telefone', '100000000000001');
    digitar('ID da conta (WABA)', '200000000000001');
    digitar('Token de acesso', 't');
    digitar('Chave secreta do app', 's');
    botao('Criar canal').click();
    const falha = falhaDaApi(409, 'conflito', 'Já existe');
    http.expectOne('/api/v1/whatsapp-oficial/canais').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Já existe um canal com este ID de número.');
  });

  it('salvo: segredos mascarados, webhook para copiar, estado e templates; salvar não reenvia segredos', async () => {
    await abrirSalvo();
    expect(raiz().querySelector('details')?.hasAttribute('open')).toBe(false);
    const marcadores = Array.from(raiz().querySelectorAll('input')).map((i) =>
      i.getAttribute('placeholder'),
    );
    expect(marcadores).toContain('Mantém o gravado (••••••••Zx0P)');
    expect(marcadores).toContain('Mantém a gravada (••••••••3f9a)');
    const webhook = raiz().querySelector('.webhook')!;
    expect(webhook.textContent).toContain('/api/v1/publico/meta/webhook');
    expect(webhook.textContent).toContain('vt_oficial');
    expect(webhook.querySelectorAll('.webhook__campos li')).toHaveLength(1);
    expect(raiz().querySelector('.estado')?.textContent).toContain('BRL Educação');
    expect(raiz().querySelectorAll('.template')).toHaveLength(2);
    expect(raiz().textContent).toContain('Em análise');

    botao('Salvar').click();
    const pedido = http.expectOne('/api/v1/whatsapp-oficial/canais/o-1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).not.toHaveProperty('token');
    expect(pedido.request.body).not.toHaveProperty('appSecret');
    pedido.flush(oficial());
    await microtarefas();
  });

  it('testar conexão com erro mostra o motivo e atualiza o estado do canal', async () => {
    await abrirSalvo();
    botao('Testar conexão').click();
    http.expectOne('/api/v1/whatsapp-oficial/canais/o-1/testar').flush({
      ok: false,
      mensagem: 'O token não é válido.',
      numeroExibido: null,
      nomeVerificado: null,
      qualidade: null,
    });
    await microtarefas();
    http.expectOne('/api/v1/whatsapp-oficial/canais/o-1').flush(
      oficial({
        estado: {
          situacao: 'ERRO',
          motivo: 'O token não é válido.',
          conferidoEm: '2026-10-26T12:00:00.000Z',
          nomeVerificado: null,
          qualidade: null,
        },
      }),
    );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não funcionou.');
    expect(raiz().textContent).toContain('Com erro');
    expect(raiz().textContent).toContain('Motivo do erro:');
  });

  it('sincronizar templates atualiza a lista; a falha (503) mostra o motivo', async () => {
    await abrirSalvo(oficial(), []);
    expect(raiz().textContent).toContain('A conta ainda não tem templates');
    botao('Sincronizar templates').click();
    const falha = falhaDaApi(503, 'servico_indisponivel', 'A Meta recusou o token.');
    http
      .expectOne('/api/v1/whatsapp-oficial/canais/o-1/templates/sincronizar')
      .flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não deu para sincronizar');
    expect(raiz().textContent).toContain('A Meta recusou o token.');

    botao('Sincronizar templates').click();
    http.expectOne('/api/v1/whatsapp-oficial/canais/o-1/templates/sincronizar').flush({
      total: 1,
      aprovados: 1,
      sincronizadoEm: '2026-10-26T12:00:00.000Z',
      itens: [templateDoCanal()],
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.template')).toHaveLength(1);
    expect(raiz().textContent).not.toContain('Não deu para sincronizar');
  });

  it('canal inexistente mostra o estado de não encontrado', async () => {
    fixture = TestBed.createComponent(CanalOficial);
    fixture.componentRef.setInput('id', 'x');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    const falha = falhaDaApi(404, 'nao_encontrado', 'Canal não encontrado');
    http.expectOne('/api/v1/whatsapp-oficial/canais/x').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Canal não encontrado');
  });
});
