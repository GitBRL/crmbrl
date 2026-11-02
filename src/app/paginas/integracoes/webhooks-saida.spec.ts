import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService, type PedidoConfirmacao } from '../../nucleo/confirmacao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { entrega, entregaDetalhe, microtarefas, pagina, webhookSaida } from './dados-de-teste';
import { saudeDoDestino } from './detalhe-saida';
import { WebhooksSaida } from './webhooks-saida';

const LISTA = '/api/v1/webhooks/saidas?pagina=1&porPagina=20';

const DESATIVADO = webhookSaida({
  id: 'ws2',
  nome: 'Destino com falha (dev)',
  url: 'http://apoio:8090/falhar',
  eventos: ['negocio.perdido'],
  ativo: false,
  falhasConsecutivas: 20,
  desativadoAutomaticamenteEm: '2026-10-21T21:47:56.237Z',
  entregas: { pendentes: 5, falhas: 0 },
});

describe('saudeDoDestino', () => {
  it('resume a saúde em selos', () => {
    expect(saudeDoDestino(webhookSaida())).toEqual([{ variante: 'menta', texto: 'Entregando' }]);
    expect(saudeDoDestino(DESATIVADO)).toEqual([
      { variante: 'coral', texto: 'Desativado após falhas' },
    ]);
    expect(
      saudeDoDestino(
        webhookSaida({ falhasConsecutivas: 3, entregas: { pendentes: 2, falhas: 1 } }),
      ),
    ).toEqual([
      { variante: 'coral', texto: '3 falhas seguidas' },
      { variante: 'coral', texto: '1 falhou' },
      { variante: 'lima', texto: '2 pendentes' },
    ]);
  });
});

describe('WebhooksSaida (Integrações › Webhooks de saída)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<WebhooksSaida>;
  let pedidos: PedidoConfirmacao[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: WebhooksSaida }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    pedidos = [];
    vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(async (pedido) => {
      pedidos.push(pedido);
      await pedido.executar?.();
      return true;
    });
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function criar(itens = [webhookSaida(), DESATIVADO]) {
    fixture = TestBed.createComponent(WebhooksSaida);
    fixture.detectChanges();
    http.expectOne(LISTA).flush(pagina(itens));
    await microtarefas();
    fixture.detectChanges();
  }

  function agir(acao: string, w: ReturnType<typeof webhookSaida>): void {
    (fixture.componentInstance as unknown as { agir(a: string, w: unknown): void }).agir(acao, w);
  }

  it('lista nome, URL, eventos, saúde e status', async () => {
    await criar();
    const linhas = Array.from(elemento().querySelectorAll('tbody tr.tabela__linha')).map(
      (linha) => linha.textContent?.replace(/\s+/g, ' ') ?? '',
    );
    expect(linhas[0]).toContain('Receptor de testes (dev)');
    expect(linhas[0]).toContain('http://apoio:8090/webhooks/brl-crm');
    expect(linhas[0]).toContain('Contato criado e Negócio ganho');
    expect(linhas[0]).toContain('Entregando');
    expect(linhas[1]).toContain('Desativado após falhas');
    expect(linhas[1]).toContain('Desativado');
  });

  it('destaca o destino desativado automaticamente, com o motivo e "Reativar"', async () => {
    await criar();
    const alerta = elemento().querySelector('.alerta')!;
    expect(alerta.getAttribute('role')).toBe('alert');
    expect(alerta.textContent).toContain(
      '“Destino com falha (dev)” foi desativado automaticamente',
    );
    expect(alerta.textContent).toContain('20 falhas seguidas');
    const reativar = Array.from(alerta.querySelectorAll('button')).find((botao) =>
      botao.textContent?.includes('Reativar'),
    )!;
    reativar.click();
    await microtarefas();
    const patch = http.expectOne('/api/v1/webhooks/saidas/ws2');
    expect(patch.request.body).toEqual({ ativo: true });
    patch.flush({
      ...DESATIVADO,
      ativo: true,
      falhasConsecutivas: 0,
      desativadoAutomaticamenteEm: null,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelector('.alerta')).toBeNull();
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain(
      'as falhas seguidas voltaram a zero',
    );
  });

  it('"Enviar teste" diz o que o destino respondeu', async () => {
    await criar();
    const avisos = TestBed.inject(AvisosService);
    agir('testar', webhookSaida());
    http.expectOne('/api/v1/webhooks/saidas/ws1/testar').flush(
      entregaDetalhe({
        evento: 'webhook.teste',
        status: 'ENTREGUE',
        statusHttp: 200,
        duracaoMs: 3,
        erro: null,
      }),
    );
    await microtarefas();
    http.expectOne('/api/v1/webhooks/saidas/ws1').flush(webhookSaida());
    await microtarefas();
    expect(avisos.lista().at(-1)?.mensagem).toBe(
      'Teste entregue a “Receptor de testes (dev)”: HTTP 200 · 3 ms.',
    );

    agir('testar', DESATIVADO);
    http.expectOne('/api/v1/webhooks/saidas/ws2/testar').flush(entregaDetalhe());
    await microtarefas();
    http.expectOne('/api/v1/webhooks/saidas/ws2').flush(DESATIVADO);
    await microtarefas();
    expect(avisos.lista().at(-1)?.tipo).toBe('atencao');
    expect(avisos.lista().at(-1)?.mensagem).toContain('não aceitou o teste: HTTP 500 · 2 ms');
  });

  it('abre o painel pelo link da notificação (?webhookSaida=) com as entregas', async () => {
    await criar();
    fixture.componentRef.setInput('webhookSaida', 'ws2');
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/saidas/ws2').flush(DESATIVADO);
    await microtarefas();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/webhooks/saidas/ws2/entregas?pagina=1&porPagina=10')
      .flush(pagina([entrega()], 10));
    await microtarefas();
    fixture.detectChanges();
    const painel = elemento().querySelector('app-painel-lateral')!;
    expect(painel.textContent).toContain('Desativado automaticamente');
    expect(painel.textContent).toContain('Negócio perdido');
    expect(painel.textContent).toContain('próxima às');
  });

  it('gerar novo segredo confirma e mostra o segredo uma vez', async () => {
    await criar();
    agir('segredo', webhookSaida());
    await microtarefas();
    http
      .expectOne('/api/v1/webhooks/saidas/ws1/regenerar-segredo')
      .flush({ webhook: webhookSaida(), segredo: 'novo-segredo-abc' });
    await microtarefas();
    fixture.detectChanges();
    expect(pedidos[0].mensagem).toContain('Atualize o sistema de destino');
    expect(elemento().querySelector('app-resultado-unico')?.textContent).toContain(
      'novo-segredo-abc',
    );
  });

  it('mostra como validar a assinatura, com exemplo de código', async () => {
    await criar();
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Como validar a assinatura');
    expect(texto).toContain('X-CRM-Assinatura');
    expect(texto).toContain('timingSafeEqual');
  });
});
