import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { Canal } from './canal';
import { ChatEstado } from './chat-estado';
import type { ChatPessoa } from './chat.tipos';
import {
  ANA,
  assentar,
  canal,
  digitarNoCampo,
  entrarNoChat,
  membro,
  mensagem,
  paginaDeMensagens,
  teclar,
} from './dados-de-teste';

const MENSAGENS = '/api/v1/chat/canais/c1/mensagens';
const MEMBROS = '/api/v1/chat/canais/c1/membros';

@Component({
  imports: [Canal],
  template: `<div style="display: flex; flex-direction: column; height: 600px">
    <app-chat-canal [canalId]="canalId()" />
  </div>`,
})
class Hospedeiro {
  readonly canalId = signal('c1');
}

describe('Canal (chat)', () => {
  let http: HttpTestingController;
  let eu: ChatPessoa;
  let socket: ReturnType<typeof provideSocketFalso>;
  let consulta: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    socket = provideSocketFalso();
    consulta = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
        ChatEstado,
        { provide: ActivatedRoute, useValue: { queryParamMap: consulta.asObservable() } },
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    eu = entrarNoChat('COMERCIAL');
  });
  afterEach(() => http.verify());

  async function criar(
    ajustes: {
      canal?: Parameters<typeof canal>[0];
      mensagens?: ReturnType<typeof mensagem>[];
    } = {},
  ) {
    const estado = TestBed.inject(ChatEstado);
    estado.guardar(canal({ nome: 'Comercial', ...ajustes.canal }));
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    http.expectOne(MEMBROS).flush([membro(eu), membro(ANA)]);
    const pedido = http.expectOne((r) => r.url === MENSAGENS);
    pedido.flush(
      paginaDeMensagens(ajustes.mensagens ?? [mensagem({ id: 'm1', texto: 'Bom dia!' })]),
    );
    await assentar();
    await fixture.whenStable();
    await assentar();
    const raiz = fixture.nativeElement as HTMLElement;
    const bolhas = () =>
      [...raiz.querySelectorAll('app-bolha-mensagem')].map((bolha) =>
        bolha.textContent?.replace(/\s+/g, ' ').trim(),
      );
    const campo = () => raiz.querySelector<HTMLTextAreaElement>('app-chat-composicao textarea')!;
    return { fixture, raiz, estado, bolhas, campo, pedido };
  }

  it('abre o canal: cabeçalho, mensagens e o compositor com o nome do canal', async () => {
    const { raiz, bolhas, campo, estado } = await criar();
    expect(raiz.querySelector('.canal__nome')?.textContent).toBe('Comercial');
    expect(raiz.querySelector('.canal__meta')?.textContent).toContain('3 pessoas · Grupo');
    expect(bolhas()).toEqual([expect.stringContaining('Bom dia!')]);
    expect(campo().getAttribute('placeholder')).toBe('Mensagem para Comercial');
    expect(estado.aberto()).toBe('c1');
  });

  it('entra na sala do canal pelo tempo real e recebe as mensagens novas, editadas e excluídas', async () => {
    const { fixture, bolhas } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    expect(socket.ultimo().emitidos).toContainEqual({
      evento: 'chat.entrar',
      dados: { canalId: 'c1' },
    });
    const nova = mensagem({
      id: 'm2',
      texto: 'Chegou agora',
      criadaEm: '2026-10-26T13:01:00.000Z',
    });
    socket.ultimo().receber('chat.mensagem', { canalId: 'c1', mensagem: nova });
    // De outro canal: ignorada.
    socket.ultimo().receber('chat.mensagem', { canalId: 'outro', mensagem: { ...nova, id: 'x' } });
    await fixture.whenStable();
    await assentar();
    expect(bolhas()).toEqual([
      expect.stringContaining('Bom dia!'),
      expect.stringContaining('Chegou agora'),
    ]);
    socket.ultimo().receber('chat.mensagem', {
      canalId: 'c1',
      mensagem: { ...nova, texto: null, partes: [], excluida: true },
    });
    await fixture.whenStable();
    await assentar();
    expect(bolhas()[1]).toContain('Mensagem apagada');
  });

  it('marca como lido quando a conversa aberta tem não lidas', async () => {
    const { estado } = await criar({ canal: { naoLidas: 2 } });
    const leitura = http.expectOne('/api/v1/chat/canais/c1/leitura');
    expect(leitura.request.body).toEqual({ mensagemId: 'm1' });
    expect(estado.canal('c1')?.naoLidas).toBe(0);
    leitura.flush(canal({ nome: 'Comercial', naoLidas: 0 }));
  });

  it('envia: a bolha aparece "enviando" e fica a da API quando ela responde', async () => {
    const { fixture, bolhas, campo } = await criar();
    digitarNoCampo(campo(), 'Proposta enviada');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    await assentar();
    expect(bolhas().at(-1)).toContain('Proposta enviada');
    expect(
      fixture.nativeElement.querySelector('app-status-entrega')?.getAttribute('aria-label'),
    ).toBe('Enviando');
    const envio = http.expectOne((r) => r.method === 'POST' && r.url === MENSAGENS);
    expect(envio.request.body).toEqual({ texto: 'Proposta enviada' });
    envio.flush(
      mensagem({
        id: 'm2',
        autor: eu,
        texto: 'Proposta enviada',
        criadaEm: '2026-10-26T13:02:00Z',
      }),
    );
    await fixture.whenStable();
    await assentar();
    expect(bolhas()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-status-entrega')).toBeNull();
  });

  it('falha no envio: mostra o motivo e "Tentar de novo" envia outra vez', async () => {
    const { fixture, raiz, campo } = await criar();
    digitarNoCampo(campo(), 'Vai falhar');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    http
      .expectOne((r) => r.method === 'POST' && r.url === MENSAGENS)
      .flush(
        {
          statusCode: 422,
          erro: 'regra_violada',
          mensagem: 'O grupo está arquivado.',
          requisicaoId: 'r1',
        },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();
    await assentar();
    expect(raiz.querySelector('.bolha__falha')?.textContent).toContain('O grupo está arquivado.');
    raiz.querySelector<HTMLButtonElement>('.bolha__falha button')!.click();
    await fixture.whenStable();
    const segunda = http.expectOne((r) => r.method === 'POST' && r.url === MENSAGENS);
    expect(segunda.request.body).toEqual({ texto: 'Vai falhar' });
    segunda.flush(
      mensagem({ id: 'm3', autor: eu, texto: 'Vai falhar', criadaEm: '2026-10-26T13:03:00Z' }),
    );
    await fixture.whenStable();
    await assentar();
    expect(raiz.querySelector('.bolha__falha')).toBeNull();
  });

  it('anexos: cada arquivo sobe antes e vai numa mensagem (o texto com o primeiro)', async () => {
    const { fixture } = await criar();
    const canalComp = fixture.debugElement.children[0].children[0].componentInstance as Canal;
    const foto = new File(['png'], 'foto.png', { type: 'image/png' });
    const pdf = new File(['pdf'], 'roteiro.pdf', { type: 'application/pdf' });
    const envio = (canalComp as unknown as { enviar: (e: unknown) => Promise<void> }).enviar({
      texto: 'Veja',
      visivel: 'Veja',
      anexos: [foto, pdf],
      audio: false,
      respostaA: null,
    });
    await assentar();
    const subida1 = http.expectOne((r) => r.url === '/api/v1/arquivos');
    expect(subida1.request.params.get('contexto')).toBe('CHAT');
    expect((subida1.request.body as FormData).get('arquivo')).toBeInstanceOf(File);
    subida1.flush({
      id: 'a1',
      nome: 'foto.png',
      mime: 'image/png',
      tamanho: 3,
      url: '/api/v1/arquivos/a1',
    });
    await assentar();
    const primeira = http.expectOne((r) => r.method === 'POST' && r.url === MENSAGENS);
    expect(primeira.request.body).toEqual({ texto: 'Veja', arquivoId: 'a1' });
    primeira.flush(mensagem({ id: 'm2', autor: eu, criadaEm: '2026-10-26T13:02:00Z' }));
    await assentar();
    http
      .expectOne((r) => r.url === '/api/v1/arquivos')
      .flush({
        id: 'a2',
        nome: 'roteiro.pdf',
        mime: 'application/pdf',
        tamanho: 3,
        url: '/api/v1/arquivos/a2',
      });
    await assentar();
    const segunda = http.expectOne((r) => r.method === 'POST' && r.url === MENSAGENS);
    expect(segunda.request.body).toEqual({ texto: null, arquivoId: 'a2' });
    segunda.flush(mensagem({ id: 'm3', autor: eu, criadaEm: '2026-10-26T13:02:01Z' }));
    await envio;
  });

  it('?mensagem= abre já na mensagem (janela em volta e o que veio depois)', async () => {
    consulta.next(convertToParamMap({ mensagem: 'm5' }));
    const estado = TestBed.inject(ChatEstado);
    estado.guardar(canal());
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    http.expectOne(MEMBROS).flush([]);
    const janela = http.expectOne((r) => r.url === MENSAGENS);
    expect(janela.request.params.get('aoRedorDe')).toBe('m5');
    janela.flush(
      paginaDeMensagens([mensagem({ id: 'm5', criadaEm: '2026-10-26T10:00:00Z' })], {
        temAnteriores: true,
        temPosteriores: true,
      }),
    );
    await assentar();
    const depois = http.expectOne((r) => r.url === MENSAGENS);
    expect(depois.request.params.get('depoisDe')).toBe('m5');
    depois.flush(
      paginaDeMensagens([
        mensagem({ id: 'm6', texto: 'Depois', criadaEm: '2026-10-26T11:00:00Z' }),
      ]),
    );
    await assentar();
    await fixture.whenStable();
    await assentar();
    const textos = [...fixture.nativeElement.querySelectorAll('app-bolha-mensagem')].map(
      (b: Element) => b.textContent,
    );
    expect(textos.at(-1)).toContain('Depois');
    // Perto do topo, a lista pede as anteriores (havia mais antes da janela).
    for (const anteriores of http.match((r) => r.params.has('antesDe'))) {
      expect(anteriores.request.params.get('antesDe')).toBe('m5');
      anteriores.flush(paginaDeMensagens([]));
    }
  });

  it('canal que não existe (ou de que a pessoa não faz parte): "Conversa não encontrada"', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    TestBed.inject(ChatEstado).guardar(canal({ id: 'outro' }));
    await fixture.whenStable();
    const erro = {
      statusCode: 404,
      erro: 'nao_encontrado',
      mensagem: 'Canal não encontrado.',
      requisicaoId: 'r',
    };
    http.expectOne(MEMBROS).flush(erro, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((r) => r.url === MENSAGENS)
      .flush(erro, { status: 404, statusText: 'Not Found' });
    await assentar();
    for (const pedido of http.match('/api/v1/chat/canais/c1')) {
      pedido.flush(erro, { status: 404, statusText: 'Not Found' });
    }
    await fixture.whenStable();
    await assentar();
    expect(fixture.nativeElement.textContent).toContain('Conversa não encontrada');
    expect(fixture.nativeElement.querySelector('a[href="/chat"]')?.textContent).toContain(
      'Voltar para as conversas',
    );
  });

  it('ao reconectar, busca o que chegou enquanto a conexão esteve fora', async () => {
    const { fixture, bolhas } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    socket.ultimo().simularQueda();
    socket.ultimo().simularConexao();
    await assentar();
    // A lista de canais (ChatEstado) e as mensagens recentes do canal.
    for (const pedido of http.match('/api/v1/chat/canais')) {
      pedido.flush([canal({ nome: 'Comercial' })]);
    }
    http
      .expectOne((r) => r.url === MENSAGENS)
      .flush(
        paginaDeMensagens([
          mensagem({ id: 'm1', texto: 'Bom dia!' }),
          mensagem({ id: 'm2', texto: 'Perdida na queda', criadaEm: '2026-10-26T13:05:00Z' }),
        ]),
      );
    await assentar();
    http.expectOne(MEMBROS).flush([membro(eu), membro(ANA)]);
    await fixture.whenStable();
    await assentar();
    expect(bolhas().at(-1)).toContain('Perdida na queda');
  });

  it('↑ edita a última própria e salvar manda o PATCH; excluir pede confirmação', async () => {
    const minha = mensagem({
      id: 'm2',
      autor: eu,
      texto: 'Minha mensagem',
      criadaEm: '2026-10-26T13:01:00Z',
    });
    const { fixture, campo, bolhas } = await criar({ mensagens: [mensagem(), minha] });
    teclar(campo(), 'ArrowUp');
    await fixture.whenStable();
    await assentar();
    expect(campo().value).toBe('Minha mensagem');
    digitarNoCampo(campo(), 'Minha mensagem corrigida');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    const patch = http.expectOne('/api/v1/chat/mensagens/m2');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ texto: 'Minha mensagem corrigida' });
    patch.flush({
      ...minha,
      texto: 'Minha mensagem corrigida',
      partes: [{ tipo: 'texto', texto: 'Minha mensagem corrigida' }],
      editadaEm: '2026-10-26T13:06:00Z',
    });
    await fixture.whenStable();
    await assentar();
    expect(bolhas().at(-1)).toContain('editada');

    const confirmar = vi
      .spyOn(TestBed.inject(ConfirmacaoService), 'confirmar')
      .mockImplementation(async (pedido) => {
        await pedido.executar?.();
        return true;
      });
    const canalComp = fixture.debugElement.children[0].children[0].componentInstance as Canal;
    const agir = (canalComp as unknown as { agir: (a: unknown) => Promise<void> }).agir({
      tipo: 'excluir',
      mensagem: minha,
    });
    await assentar();
    http
      .expectOne('/api/v1/chat/mensagens/m2')
      .flush(null, { status: 204, statusText: 'No Content' });
    await agir;
    await fixture.whenStable();
    await assentar();
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ confirmar: 'Excluir', perigo: true }),
    );
    expect(bolhas().at(-1)).toContain('Mensagem apagada');
  });
});
