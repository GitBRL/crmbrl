import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import type { ConversaDetalhe, MensagemDaConversa } from './atendimento.tipos';
import { Conversa } from './conversa';
import {
  ANA,
  assentar,
  CANAL_INSTAGRAM,
  conversaDetalhe,
  conversaResumo,
  EU,
  ha,
  mensagemDto,
  paginaConversas,
  paginaMensagens,
  texto,
} from './dados-de-teste';
import { EstadoAtendimento } from './estado-atendimento';

const DETALHE = '/api/v1/atendimento/conversas/c1';
const MENSAGENS = '/api/v1/atendimento/conversas/c1/mensagens';

@Component({
  imports: [Conversa],
  template: `<div style="display: grid; height: 700px">
    <app-atendimento-conversa [conversaId]="conversaId()" />
  </div>`,
})
class Hospedeiro {
  readonly conversaId = signal('c1');
}

function digitar(campo: HTMLTextAreaElement, valor: string): void {
  campo.focus();
  campo.value = valor;
  campo.setSelectionRange(valor.length, valor.length);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

function enter(campo: Element): void {
  campo.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
}

describe('Conversa (Atendimento)', () => {
  let http: HttpTestingController;
  let socket: ReturnType<typeof provideSocketFalso>;
  let avisos: AvisosService;

  beforeEach(() => {
    localStorage.clear();
    socket = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
        EstadoAtendimento,
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosService);
    entrarComo('COMERCIAL');
  });
  afterEach(() => http.verify());

  /** O painel do contato (ao lado, sem ResizeObserver no jsdom) carrega os dados dele. */
  function responderPainel(): void {
    http.match('/api/v1/contatos/ct1').forEach((p) =>
      p.flush({
        id: 'ct1',
        nome: 'Marina Lopes',
        email: null,
        telefone: '5511987654321',
        cargo: 'Diretora',
        empresa: { id: 'e1', nome: 'Escola Horizonte' },
        responsavel: null,
        etiquetas: ['escola'],
        optOutMarketing: false,
        criadoEm: ha(100),
      }),
    );
    http
      .match((r) => r.url === '/api/v1/negocios')
      .forEach((p) =>
        p.flush({
          itens: [
            {
              id: 'n1',
              titulo: 'Escola Horizonte — plano Rede',
              status: 'ABERTO',
              valor: '1200.00',
              funil: { id: 'f1', nome: 'Comercial', area: 'COMERCIAL' },
              etapa: { id: 'e1', nome: 'Proposta', tipo: 'ABERTA' },
            },
          ],
          total: 1,
          pagina: 1,
          porPagina: 100,
        }),
      );
    http
      .match((r) => r.url === '/api/v1/atividades')
      .forEach((p) => p.flush({ itens: [], total: 0, pagina: 1, porPagina: 10 }));
    http
      .match((r) => r.url === '/api/v1/atendimento/conversas' && r.params.has('contatoId'))
      .forEach((p) =>
        p.flush(paginaConversas([conversaResumo({ id: 'c0', status: 'RESOLVIDA' })])),
      );
  }

  async function criar(
    detalhe: ConversaDetalhe = conversaDetalhe(),
    mensagens: MensagemDaConversa[] = [mensagemDto()],
  ) {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    // O estado da página (lista e apoio) carrega junto.
    http
      .match((r) => r.url === '/api/v1/atendimento/conversas')
      .forEach((p) => p.flush(paginaConversas([conversaResumo()])));
    for (const apoio of ['canais', 'filas', 'etiquetas', 'respostas-rapidas']) {
      http.match(`/api/v1/atendimento/${apoio}`).forEach((p) => p.flush([]));
    }
    http.expectOne(DETALHE).flush(detalhe);
    http.expectOne((r) => r.url === MENSAGENS).flush(paginaMensagens(mensagens));
    await assentar();
    await fixture.whenStable();
    await assentar();
    responderPainel();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const bolhas = () => [...raiz.querySelectorAll('app-bolha-mensagem')].map((b) => texto(b));
    const campo = () => raiz.querySelector<HTMLTextAreaElement>('app-compositor textarea');
    const ultimoStatus = () =>
      [...raiz.querySelectorAll('app-bolha-mensagem app-status-entrega')]
        .at(-1)
        ?.getAttribute('aria-label') ??
      [...raiz.querySelectorAll('app-bolha-mensagem app-status-entrega [role=img]')]
        .at(-1)
        ?.getAttribute('aria-label');
    return { fixture, raiz, bolhas, campo, ultimoStatus };
  }

  it('abre a conversa: contato, canal, fila, responsável e as mensagens', async () => {
    const { raiz, bolhas } = await criar();
    expect(texto(raiz.querySelector('.cabeca__nome'))).toBe('Marina Lopes');
    expect(texto(raiz.querySelector('.cabeca__detalhe'))).toContain('WhatsApp Vendas');
    expect(texto(raiz.querySelector('.cabeca__detalhe'))).toContain('Vendas');
    expect(texto(raiz.querySelector('.cabeca__detalhe'))).toContain('Com você');
    expect(bolhas()).toEqual([expect.stringContaining('Oi! Queria saber dos planos.')]);
    expect(TestBed.inject(EstadoAtendimento).selecionadaId()).toBe('c1');
  });

  it('mostra o painel do contato ao lado: dados, negócios e outras conversas', async () => {
    const { raiz } = await criar();
    const painel = raiz.querySelector('app-painel-contato')!;
    expect(texto(painel)).toContain('+55 (11) 98765-4321');
    expect(texto(painel)).toContain('Diretora · Escola Horizonte');
    expect(texto(painel)).toContain('Escola Horizonte — plano Rede');
    expect(texto(painel)).toContain('Comercial · Proposta');
    expect(texto(painel)).toContain('Nenhuma atividade pendente.');
    expect(texto(painel)).toContain('Resolvida');
  });

  it('entra na sala da conversa e marca como lida o que chegou', async () => {
    await criar(conversaDetalhe({ naoLidas: 2 }));
    await Promise.resolve();
    socket.ultimo().simularConexao();
    expect(socket.ultimo().emitidos).toContainEqual({
      evento: 'conversa.entrar',
      dados: { conversaId: 'c1' },
    });
    await assentar();
    const lida = http.expectOne(`${DETALHE}/lida`);
    expect(lida.request.method).toBe('POST');
    lida.flush(conversaDetalhe());
  });

  it('envia uma mensagem: a bolha entra enviando e avança pelo tempo real', async () => {
    const { fixture, campo, bolhas, ultimoStatus } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    digitar(campo()!, 'Atendemos redes, sim!');
    enter(campo()!);
    await fixture.whenStable();
    expect(bolhas().at(-1)).toContain('Atendemos redes, sim!');
    expect(ultimoStatus()).toBe('Enviando');

    const envio = http.expectOne(MENSAGENS);
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body).toEqual({ texto: 'Atendemos redes, sim!' });
    envio.flush(
      mensagemDto({
        id: 'm2',
        direcao: 'SAIDA',
        texto: 'Atendemos redes, sim!',
        autor: { id: EU.id, nome: EU.nome },
        status: 'PENDENTE',
        ocorridaEm: ha(0),
      }),
    );
    await assentar();
    await fixture.whenStable();
    expect(bolhas().filter((b) => b.includes('Atendemos redes'))).toHaveLength(1);

    socket
      .ultimo()
      .receber('mensagem.status', { conversaId: 'c1', mensagemId: 'm2', status: 'LIDA' });
    await fixture.whenStable();
    expect(ultimoStatus()).toBe('Lida');
  });

  it('a falha no envio devolve o texto ao compositor e avisa', async () => {
    const { fixture, campo, bolhas } = await criar();
    const erro = vi.spyOn(avisos, 'erro');
    digitar(campo()!, 'Olá!');
    enter(campo()!);
    await fixture.whenStable();
    http.expectOne(MENSAGENS).flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'O canal não aceita resposta agora.',
        requisicaoId: 'r',
      },
      { status: 422, statusText: 'Erro' },
    );
    await assentar();
    await fixture.whenStable();
    // A conversa é conferida de novo depois do 422.
    await new Promise((r) => setTimeout(r, 10));
    http.match(DETALHE).forEach((p) => p.flush(conversaDetalhe()));
    expect(bolhas().some((b) => b.includes('Olá!'))).toBe(false);
    expect(campo()!.value).toBe('Olá!');
    expect(erro).toHaveBeenCalled();
  });

  it('nota interna vai para as notas e aparece como nota', async () => {
    const { fixture, raiz, campo, bolhas } = await criar();
    const nota = [...raiz.querySelectorAll<HTMLButtonElement>('.compositor__modo')].find((b) =>
      b.textContent?.includes('Nota interna'),
    )!;
    nota.click();
    await fixture.whenStable();
    digitar(campo()!, 'Ligar amanhã.');
    enter(campo()!);
    await fixture.whenStable();
    const pedido = http.expectOne(`${DETALHE}/notas`);
    expect(pedido.request.body).toEqual({ texto: 'Ligar amanhã.' });
    pedido.flush(
      mensagemDto({
        id: 'n1',
        direcao: 'INTERNA',
        texto: 'Ligar amanhã.',
        autor: { id: EU.id, nome: EU.nome },
        ocorridaEm: ha(0),
      }),
    );
    await assentar();
    await fixture.whenStable();
    expect(bolhas().at(-1)).toContain('Nota interna');
    expect(bolhas().at(-1)).toContain('Ligar amanhã.');
  });

  it('mensagem nova do contato chega pelo tempo real (as de outras conversas, não)', async () => {
    const { fixture, bolhas } = await criar();
    await Promise.resolve();
    socket.ultimo().simularConexao();
    socket.ultimo().receber('mensagem.nova', {
      conversaId: 'c1',
      mensagem: mensagemDto({ id: 'm3', texto: 'E a implantação?', ocorridaEm: ha(0) }),
    });
    socket.ultimo().receber('mensagem.nova', {
      conversaId: 'outra',
      mensagem: mensagemDto({ id: 'x', texto: 'Outra conversa', ocorridaEm: ha(0) }),
    });
    await fixture.whenStable();
    expect(bolhas().at(-1)).toContain('E a implantação?');
    expect(bolhas().some((b) => b.includes('Outra conversa'))).toBe(false);
    await new Promise((r) => setTimeout(r, 900));
    http.expectOne(`${DETALHE}/lida`).flush(conversaDetalhe());
  });

  it('janela de 24 h fechada: o compositor mostra o motivo e a nota interna continua liberada', async () => {
    const { fixture, raiz } = await criar(
      conversaDetalhe({
        canal: CANAL_INSTAGRAM,
        janelaAte: ha(60 * 30),
        podeResponder: {
          pode: false,
          motivo: 'Passaram mais de 24 horas desde a última mensagem do contato.',
        },
        acoes: {
          assumir: false,
          transferir: true,
          resolver: true,
          reabrir: false,
          responder: false,
          criarNegocio: true,
        },
      }),
    );
    expect(texto(raiz.querySelector('.compositor__bloqueio'))).toContain(
      'Passaram mais de 24 horas',
    );
    expect(texto(raiz.querySelector('.faixa'))).toContain('Janela de 24 h fechou');
    const escrever = [
      ...raiz.querySelectorAll<HTMLButtonElement>('.conversa__bloqueio-acoes button'),
    ].find((b) => b.textContent?.includes('Escrever nota interna'))!;
    escrever.click();
    await fixture.whenStable();
    await assentar();
    expect(raiz.querySelector('.compositor__bloqueio')).toBeNull();
    expect(raiz.querySelector('app-compositor textarea')).not.toBeNull();
  });

  it('sem responsável: "Assumir" chama a API e a conversa passa a ser sua', async () => {
    const { fixture, raiz } = await criar(
      conversaDetalhe({
        responsavel: null,
        acoes: {
          assumir: true,
          transferir: false,
          resolver: false,
          reabrir: false,
          responder: true,
          criarNegocio: true,
        },
      }),
    );
    const sucesso = vi.spyOn(avisos, 'sucesso');
    expect(texto(raiz.querySelector('.cabeca__detalhe'))).toContain('Sem responsável');
    raiz.querySelector<HTMLButtonElement>('.cabeca__principal-texto')!.click();
    const pedido = http.expectOne(`${DETALHE}/assumir`);
    pedido.flush(conversaDetalhe());
    await assentar();
    await fixture.whenStable();
    expect(sucesso).toHaveBeenCalledWith('A conversa agora é sua.');
    expect(texto(raiz.querySelector('.cabeca__detalhe'))).toContain('Com você');
  });

  it('resolver avisa com "Desfazer", que reabre', async () => {
    const { fixture, raiz } = await criar();
    const sucesso = vi.spyOn(avisos, 'sucesso');
    raiz.querySelector<HTMLButtonElement>('.cabeca__principal-texto')!.click();
    const pedido = http.expectOne(`${DETALHE}/resolver`);
    expect(pedido.request.body).toEqual({ enviarPesquisa: true });
    pedido.flush(
      conversaDetalhe({
        status: 'RESOLVIDA',
        acoes: {
          assumir: false,
          transferir: false,
          resolver: false,
          reabrir: true,
          responder: false,
          criarNegocio: true,
        },
      }),
    );
    await assentar();
    await fixture.whenStable();
    expect(texto(raiz.querySelector('.faixa'))).toContain('Resolvida');
    expect(texto(raiz.querySelector('.compositor__bloqueio'))).toContain('Reabra para responder');
    const [mensagem, opcoes] = sucesso.mock.calls.at(-1)!;
    expect(mensagem).toBe('Conversa resolvida.');
    opcoes!.acao!.executar();
    http.expectOne(`${DETALHE}/reabrir`).flush(conversaDetalhe());
    await assentar();
  });

  it('transferir para outra pessoa: um membro volta para a lista', async () => {
    const { fixture, raiz } = await criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    raiz.querySelector<HTMLButtonElement>('.cabeca__transferir')!.click();
    await fixture.whenStable();
    http.expectOne('/api/v1/atendimento/atendentes').flush([
      {
        ...ANA,
        papel: 'COMERCIAL',
        rotuloPapel: 'Comercial',
        area: 'COMERCIAL',
        emAberto: 2,
        conectado: true,
      },
    ]);
    await assentar();
    await fixture.whenStable();
    const dialogo = raiz.querySelector('app-transferir-conversa')!;
    const seletor = dialogo.querySelector<HTMLSelectElement>('select')!;
    expect([...seletor.options].map((o) => o.text)).toContain('Ana Souza · Comercial (2) · online');
    seletor.value = [...seletor.options].find((o) => o.text.startsWith('Ana'))!.value;
    seletor.dispatchEvent(new Event('change', { bubbles: true }));
    const nota = dialogo.querySelector<HTMLTextAreaElement>('textarea')!;
    nota.value = 'Ela quer a proposta.';
    nota.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    dialogo
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    const pedido = http.expectOne(`${DETALHE}/transferir`);
    expect(pedido.request.body).toEqual({ usuarioId: 'u-ana', nota: 'Ela quer a proposta.' });
    pedido.flush(conversaDetalhe({ responsavel: ANA }));
    await assentar();
    expect(navegar).toHaveBeenCalledWith(['/atendimento']);
  });

  it('conversa que não existe (ou que a pessoa não vê): estado com o caminho de volta', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    http
      .match(() => true)
      .forEach((pedido) => {
        if (pedido.request.url === DETALHE) {
          pedido.flush(
            {
              statusCode: 404,
              erro: 'nao_encontrado',
              mensagem: 'Conversa não encontrada.',
              requisicaoId: 'r',
            },
            { status: 404, statusText: 'Não encontrado' },
          );
        } else if (pedido.request.url === MENSAGENS) {
          pedido.flush(
            { statusCode: 404, erro: 'nao_encontrado', mensagem: 'x', requisicaoId: 'r' },
            { status: 404, statusText: 'x' },
          );
        } else if (pedido.request.url === '/api/v1/atendimento/conversas') {
          pedido.flush(paginaConversas([]));
        } else {
          pedido.flush([]);
        }
      });
    await assentar();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(texto(raiz)).toContain('Conversa não encontrada');
    expect(texto(raiz)).toContain('Voltar para a lista');
  });
});
