import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { Chat } from './chat';
import { ChatEstado } from './chat-estado';
import { abrirDiretaComPessoa, abrirNegocio } from './chat.routes';
import { assentar, canal, entrarNoChat } from './dados-de-teste';

describe('Chat da equipe (página)', () => {
  let http: HttpTestingController;
  let socket: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    socket = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarNoChat('COMERCIAL');
  });
  afterEach(() => http.verify());

  async function criar() {
    const fixture = TestBed.createComponent(Chat);
    await fixture.whenStable();
    http
      .expectOne('/api/v1/chat/canais')
      .flush([
        canal({ id: 'geral', tipo: 'GERAL', nome: 'Geral', naoLidas: 1 }),
        canal({ id: 'g1', nome: 'Lançamento' }),
      ]);
    await assentar();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const estado = fixture.debugElement.injector.get(ChatEstado);
    const nomes = () => [...raiz.querySelectorAll('.item__nome')].map((n) => n.textContent);
    return { fixture, raiz, estado, nomes };
  }

  it('título, frase, ações e a lista de canais; sem canal aberto, o convite para escolher', async () => {
    const { raiz, nomes } = await criar();
    expect(raiz.querySelector('h1')?.textContent).toBe('Chat da equipe');
    expect(raiz.querySelector('.chat__frase')?.textContent).toContain(
      'Digite @ para chamar alguém',
    );
    expect(
      [...raiz.querySelectorAll('.chat__acoes button')].map((b) => b.textContent?.trim()),
    ).toEqual(['Conversa direta', 'Novo grupo']);
    expect(nomes()).toEqual(['Geral', 'Lançamento']);
    expect(raiz.textContent).toContain('Escolha uma conversa');
  });

  it('ao vivo: canal novo entra na lista, o que mudou é trocado e o removido sai', async () => {
    const { fixture, nomes, raiz } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    socket.ultimo().receber('chat.atualizado', {
      canalId: 'd1',
      canal: canal({ id: 'd1', tipo: 'DIRETO', nome: 'Ana Lima' }),
    });
    socket.ultimo().receber('chat.atualizado', {
      canalId: 'geral',
      canal: canal({ id: 'geral', tipo: 'GERAL', nome: 'Geral', naoLidas: 4 }),
    });
    socket.ultimo().receber('chat.atualizado', { canalId: 'g1', removido: true });
    await fixture.whenStable();
    expect(nomes()).toEqual(['Geral', 'Ana Lima']);
    expect(raiz.querySelector('.item__contagem')?.textContent).toBe('4');
  });

  it('ao reconectar, busca a lista de novo', async () => {
    const { fixture, nomes } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    socket.ultimo().simularQueda();
    socket.ultimo().simularConexao();
    http.expectOne('/api/v1/chat/canais').flush([canal({ id: 'g2', nome: 'Novo grupo' })]);
    await assentar();
    await fixture.whenStable();
    expect(nomes()).toEqual(['Novo grupo']);
  });

  it('o canal aberto que some da lista avisa quem estava nele', async () => {
    const { estado } = await criar();
    estado.aberto.set('g1');
    estado.remover('g1');
    expect(estado.removido()).toEqual({ id: 'g1', nome: 'Lançamento' });
    estado.guardar(canal({ id: 'g1' }));
    expect(estado.removido()).toBeNull();
  });

  it('"Novo grupo" e "Conversa direta" abrem os modais', async () => {
    const { fixture, raiz } = await criar();
    [...raiz.querySelectorAll<HTMLButtonElement>('.chat__acoes button')][1].click();
    await fixture.whenStable();
    expect(raiz.querySelector('app-chat-novo-grupo form')).not.toBeNull();
    await assentar();
    http
      .expectOne((r) => r.url === '/api/v1/chat/pessoas')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 100 });
  });

  it('rascunho por canal: guardado só com texto', async () => {
    const { estado } = await criar();
    estado.guardarRascunho('g1', {
      texto: 'Oi @Ana',
      marcacoes: [{ visivel: '@Ana', marcacao: '<@u>' }],
    });
    expect(estado.rascunho('g1')?.texto).toBe('Oi @Ana');
    estado.guardarRascunho('g1', { texto: '  ', marcacoes: [] });
    expect(estado.rascunho('g1')).toBeNull();
  });
});

describe('Rotas do chat', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const rota = (parametros: Record<string, string>) =>
    ({ paramMap: { get: (nome: string) => parametros[nome] ?? null } }) as never;

  it('menção: abre (ou cria) a conversa direta e vai para ela', async () => {
    const resultado = TestBed.runInInjectionContext(() =>
      abrirDiretaComPessoa(rota({ usuarioId: 'u-ana' }), {} as never),
    ) as Promise<UrlTree>;
    const pedido = http.expectOne('/api/v1/chat/diretas');
    expect(pedido.request.body).toEqual({ usuarioId: 'u-ana' });
    pedido.flush({ criada: false, canal: canal({ id: 'd1', tipo: 'DIRETO' }) });
    expect(TestBed.inject(Router).serializeUrl(await resultado)).toBe('/chat/d1');
  });

  it('menção a quem não dá (desligado): avisa e não sai do lugar', async () => {
    const erro = vi.spyOn(TestBed.inject(AvisosService), 'erro');
    const resultado = TestBed.runInInjectionContext(() =>
      abrirDiretaComPessoa(rota({ usuarioId: 'u-pedro' }), {} as never),
    ) as Promise<unknown>;
    http.expectOne('/api/v1/chat/diretas').flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'Pedro foi desligado.',
        requisicaoId: 'r',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    const destino = await resultado;
    expect(erro).toHaveBeenCalled();
    expect(TestBed.inject(Router).serializeUrl(destino as UrlTree)).toBe('/chat');
  });

  it('referência a negócio: vai para o funil pelo id, com o negócio na consulta', () => {
    const destino = TestBed.runInInjectionContext(() =>
      abrirNegocio(rota({ funilId: 'f1', negocioId: 'n1' }), {} as never),
    ) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(destino)).toBe('/funis/f1?negocio=n1');
  });
});
