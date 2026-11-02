import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../../nucleo/tempo-real/tempo-real-de-teste';
import { Canais } from './canais';
import { email, falhaDaApi, meta, microtarefas, numero, site } from './dados-de-teste';

const URLS = {
  whatsapp: '/api/v1/whatsapp/numeros',
  site: '/api/v1/webchat/canais',
  email: '/api/v1/email/canais',
  meta: '/api/v1/meta/canais',
};

describe('Canais (lista por tipo)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Canais>;
  let falso: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    falso = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        falso.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function criar(respostas: Partial<Record<keyof typeof URLS, unknown>> = {}) {
    fixture = TestBed.createComponent(Canais);
    fixture.detectChanges();
    for (const [chave, url] of Object.entries(URLS) as [keyof typeof URLS, string][]) {
      const resposta = respostas[chave];
      const pedido = http.expectOne(url);
      if (resposta && typeof resposta === 'object' && 'corpo' in resposta) {
        const falha = resposta as ReturnType<typeof falhaDaApi>;
        pedido.flush(falha.corpo, falha.opcoes);
      } else {
        pedido.flush(resposta ?? []);
      }
    }
    await microtarefas();
    fixture.detectChanges();
  }

  function grupo(titulo: string): HTMLElement {
    const cartao = Array.from(raiz().querySelectorAll<HTMLElement>('app-cartao')).find((item) =>
      item.querySelector('h3.cartao__h')?.textContent?.includes(titulo),
    );
    if (!cartao) {
      throw new Error(`Cartão ${titulo} não encontrado`);
    }
    return cartao;
  }

  it('sem nenhum canal: cada tipo explica o que faz e convida a começar pelo WhatsApp', async () => {
    await criar();
    expect(raiz().textContent).toContain('Comece pelo WhatsApp');
    const whatsapp = grupo('WhatsApp');
    expect(whatsapp.textContent).toContain('nenhum ainda');
    expect(whatsapp.textContent).toContain('lendo um QR');
    expect(grupo('E-mail').textContent).toContain('Nova caixa de e-mail');
    expect(grupo('Messenger').textContent).toContain('nenhuma ainda');
  });

  it('mostra cada canal com a situação, o detalhe e o link da tela dele', async () => {
    await criar({
      whatsapp: [
        numero(),
        numero({
          id: 'n-2',
          nome: 'Suporte',
          status: 'AGUARDANDO_QR',
          telefone: null,
          pausa: { pausadoEm: '2026-10-26T12:00:00Z', motivo: null, automatica: false },
        }),
      ],
      site: [site()],
      email: [email({ ultimoErro: 'Senha recusada pelo servidor.' })],
      meta: [meta(), meta({ id: 'm-2', tipo: 'MESSENGER', nome: 'Página BRL' })],
    });
    const whatsapp = grupo('WhatsApp');
    expect(whatsapp.textContent).toContain('2 números');
    const linhas = whatsapp.querySelectorAll<HTMLAnchorElement>('a.canal');
    expect(linhas).toHaveLength(2);
    expect(linhas[0].getAttribute('href')).toBe('/configuracoes/canais/whatsapp/n-1');
    expect(linhas[0].textContent).toContain('+55 (11) 98888-7777');
    expect(linhas[0].textContent).toContain('Conectado');
    expect(linhas[0].textContent).toContain('42 de 214 envios hoje');
    expect(linhas[0].textContent).toContain('Aquecendo: dia 3 de 14');
    expect(linhas[1].textContent).toContain('Esperando o QR');
    expect(linhas[1].textContent).toContain('Envios pausados');
    expect(linhas[1].textContent).toContain('Telefone aparece depois do QR');

    expect(grupo('Chat do site').querySelector('a.canal')?.getAttribute('href')).toBe(
      '/configuracoes/canais/site/s-1',
    );
    expect(grupo('E-mail').textContent).toContain('Com erro');
    expect(grupo('Instagram').querySelector('a.canal')?.getAttribute('href')).toBe(
      '/configuracoes/canais/meta/m-1',
    );
    expect(grupo('Messenger').textContent).toContain('Página BRL');
    expect(raiz().textContent).not.toContain('Comece pelo WhatsApp');
  });

  it('um tipo que falha mostra o erro só no cartão dele', async () => {
    await criar({
      email: falhaDaApi(500, 'erro_interno', 'boom'),
      whatsapp: [numero()],
    });
    expect(grupo('E-mail').textContent).toContain('Não conseguimos carregar E-mail');
    expect(grupo('WhatsApp').querySelectorAll('a.canal')).toHaveLength(1);
  });

  it('o status do número muda ao vivo pelo evento whatsapp.conexao', async () => {
    await criar({ whatsapp: [numero({ status: 'AGUARDANDO_QR', telefone: null })] });
    await microtarefas();
    falso.ultimo().simularConexao();
    falso.ultimo().receber('whatsapp.conexao', {
      numeroId: 'n-1',
      canalId: 'c-wa-1',
      status: 'CONECTADO',
      telefone: '5511977776666',
    });
    fixture.detectChanges();
    const linha = grupo('WhatsApp').querySelector('a.canal')!;
    expect(linha.textContent).toContain('Conectado');
    expect(linha.textContent).toContain('+55 (11) 97777-6666');
  });

  it('“Novo canal”: o WhatsApp abre o modal do número; os outros vão para a tela de criar', async () => {
    await criar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const novo = Array.from(raiz().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Novo canal'),
    )!;
    novo.click();
    fixture.detectChanges();
    const opcoes = Array.from(
      document.querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    );
    expect(opcoes).toHaveLength(5);
    const email = opcoes.find((input) => input.closest('label')?.textContent?.includes('E-mail'))!;
    email.click();
    fixture.detectChanges();
    const continuar = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Continuar'),
    )!;
    continuar.click();
    fixture.detectChanges();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'email', 'novo']);
  });

  it('criar um número abre a tela dele pedindo a conexão', async () => {
    await criar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const novoNumero = grupo('WhatsApp').querySelector<HTMLButtonElement>(
      'button[aria-label="Novo número"]',
    )!;
    novoNumero.click();
    fixture.detectChanges();
    http
      .expectOne('/api/v1/atendimento/filas')
      .flush([{ id: 'f-com', nome: 'Comercial', area: 'COMERCIAL' }]);
    await microtarefas();
    fixture.detectChanges();
    const nome = document.querySelector<HTMLInputElement>('app-novo-numero app-campo-texto input')!;
    nome.value = 'Vendas';
    nome.dispatchEvent(new Event('input'));
    const criarBotao = Array.from(
      document.querySelectorAll<HTMLButtonElement>('app-novo-numero button'),
    ).find((b) => b.textContent?.includes('Criar e mostrar o QR'))!;
    criarBotao.click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/whatsapp/numeros');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({ nome: 'Vendas', filaPadraoId: null });
    pedido.flush(numero({ id: 'n-9', nome: 'Vendas', status: 'DESCONECTADO' }));
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'whatsapp', 'n-9'], {
      queryParams: { conectar: '1' },
    });
  });
});
