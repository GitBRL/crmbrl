import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService, type PedidoConfirmacao } from '../../nucleo/confirmacao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { microtarefas, pagina, recebimento, webhookEntrada } from './dados-de-teste';
import { WebhooksEntrada } from './webhooks-entrada';

const LISTA = '/api/v1/webhooks/entradas?pagina=1&porPagina=20';

describe('WebhooksEntrada (Integrações › Webhooks de entrada)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<WebhooksEntrada>;
  let pedidos: PedidoConfirmacao[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: WebhooksEntrada }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    pedidos = [];
    // Confirma na hora, rodando a ação como o modal de confirmação faria.
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

  async function criar(
    itens = [
      webhookEntrada(),
      webhookEntrada({
        id: 'we2',
        nome: 'Landing page',
        ativo: false,
        exigeAssinatura: true,
        recebimentos24h: { total: 0, erros: 0 },
      }),
    ],
  ) {
    fixture = TestBed.createComponent(WebhooksEntrada);
    fixture.detectChanges();
    http.expectOne(LISTA).flush(pagina(itens));
    await microtarefas();
    fixture.detectChanges();
  }

  function linhas(): string[] {
    return Array.from(elemento().querySelectorAll('tbody tr.tabela__linha')).map(
      (linha) => linha.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  it('lista nome, endereço mascarado, destino, distribuição, volume e status', async () => {
    await criar();
    const [disparos, landing] = linhas();
    expect(disparos).toContain('Disparos BRL — WhatsApp');
    // O fim do endereço (o que diferencia um webhook do outro); o inteiro fica no title.
    expect(disparos).toContain('…/entrada/yxBjWicA…');
    expect(disparos).not.toContain('localhost');
    expect(elemento().querySelector('.lista__endereco')?.getAttribute('title')).toBe(
      'http://localhost:4200/api/v1/webhooks/entrada/yxBjWicA…',
    );
    expect(disparos).toContain('Marketing, etapa Novo lead');
    expect(disparos).toContain('Rodízio da área');
    expect(disparos).toContain('1 com erro');
    expect(disparos).toContain('Ativo');
    expect(landing).toContain('Desativado');
    expect(landing).toContain('Com assinatura');
  });

  it('filtra por desativados na API', async () => {
    await criar();
    const botao = Array.from(elemento().querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === 'Desativados',
    )!;
    botao.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas?pagina=1&porPagina=20&ativo=false').flush(pagina([]));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum webhook desativado');
  });

  it('mostra o erro com "Tentar de novo" quando a lista falha', async () => {
    fixture = TestBed.createComponent(WebhooksEntrada);
    fixture.detectChanges();
    http
      .expectOne(LISTA)
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falhou.', requisicaoId: 'req-1' },
        { status: 500, statusText: 'Erro' },
      );
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Não conseguimos carregar os webhooks');
    const tentar = Array.from(elemento().querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Tentar de novo'),
    )!;
    tentar.click();
    http.expectOne(LISTA).flush(pagina([webhookEntrada()]));
    await microtarefas();
    fixture.detectChanges();
    expect(linhas()).toHaveLength(1);
  });

  it('abre o painel com ?webhook=<id>, com os recebimentos do webhook', async () => {
    await criar();
    fixture.componentRef.setInput('webhook', 'we1');
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas/we1').flush(webhookEntrada());
    await microtarefas();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/webhooks/entradas/we1/recebimentos?pagina=1&porPagina=10')
      .flush(pagina([recebimento()], 10));
    await microtarefas();
    fixture.detectChanges();
    const painel = elemento().querySelector('app-painel-lateral')!;
    expect(painel.textContent).toContain('Disparos BRL — WhatsApp');
    expect(painel.textContent).toContain('Sem e-mail nem telefone');
    expect(painel.textContent).toContain('8 recebimentos');
  });

  it('clicar na linha põe o webhook na URL', async () => {
    await criar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    elemento().querySelector<HTMLButtonElement>('tbody .tabela__abrir')!.click();
    expect(navegar).toHaveBeenCalledWith([], {
      queryParams: { webhook: 'we1' },
      queryParamsHandling: 'merge',
    });
  });

  it('desativar pede confirmação, salva ativo=false e atualiza a linha', async () => {
    await criar();
    const avisos = TestBed.inject(AvisosService);
    const componente = fixture.componentInstance as unknown as {
      agir(acao: string, w: ReturnType<typeof webhookEntrada>): void;
    };
    componente.agir('desativar', webhookEntrada());
    await microtarefas();
    const patch = http.expectOne('/api/v1/webhooks/entradas/we1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ ativo: false });
    patch.flush(webhookEntrada({ ativo: false }));
    await microtarefas();
    fixture.detectChanges();
    expect(pedidos[0].titulo).toBe('Desativar “Disparos BRL — WhatsApp”?');
    expect(pedidos[0].mensagem).toContain('410');
    expect(linhas()[0]).toContain('Desativado');
    expect(avisos.lista().at(-1)?.mensagem).toBe('“Disparos BRL — WhatsApp” desativado.');
  });

  it('gerar novo endereço mostra a URL nova uma vez, com o curl', async () => {
    await criar();
    const componente = fixture.componentInstance as unknown as {
      agir(acao: string, w: ReturnType<typeof webhookEntrada>): void;
    };
    componente.agir('endereco', webhookEntrada());
    await microtarefas();
    http.expectOne('/api/v1/webhooks/entradas/we1/regenerar-token').flush({
      webhook: webhookEntrada(),
      url: 'http://localhost:4200/api/v1/webhooks/entrada/NOVO',
    });
    await microtarefas();
    fixture.detectChanges();
    const modal = elemento().querySelector('app-resultado-unico')!;
    expect(modal.textContent).toContain('http://localhost:4200/api/v1/webhooks/entrada/NOVO');
    expect(modal.textContent).toContain(
      "curl -X POST 'http://localhost:4200/api/v1/webhooks/entrada/NOVO'",
    );
    expect(pedidos[0].mensagem).toContain('para de funcionar na hora');
  });

  it('excluir exige digitar o nome e recarrega a lista', async () => {
    await criar();
    const componente = fixture.componentInstance as unknown as {
      agir(acao: string, w: ReturnType<typeof webhookEntrada>): void;
    };
    componente.agir('excluir', webhookEntrada());
    await microtarefas();
    const excluir = http.expectOne('/api/v1/webhooks/entradas/we1');
    expect(excluir.request.method).toBe('DELETE');
    excluir.flush(null);
    await microtarefas();
    expect(pedidos[0].exigirTexto).toBe('Disparos BRL — WhatsApp');
    http.expectOne(LISTA).flush(pagina([]));
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Nenhum webhook de entrada ainda');
  });
});
