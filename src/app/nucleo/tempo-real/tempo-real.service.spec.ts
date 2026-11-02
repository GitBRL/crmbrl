import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { interceptarErros } from '../api/interceptor-erros';
import { SessaoService } from '../sessao/sessao.service';
import { perfilDeTeste } from '../sessao/sessao-de-teste';
import { acompanharSala, aoReceber, digitandoEm, EXPIRA_DIGITANDO_MS } from './auxiliares';
import { lerNaoLidas, type EventoMensagemNova } from './eventos';
import { CAMINHO_SOCKET, NAMESPACE_TEMPO_REAL } from './socket';
import { ESPERA_MAXIMA_MS, TempoRealService } from './tempo-real.service';
import { provideSocketFalso } from './tempo-real-de-teste';

/** Deixa as continuações das promessas (then/finally) rodarem. */
async function microtarefas(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe('TempoRealService', () => {
  let falso: ReturnType<typeof provideSocketFalso>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    falso = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        // O interceptor leva para /entrar quando a sessão acaba.
        provideRouter([{ path: 'entrar', children: [] }]),
        provideHttpClient(withInterceptors([interceptarErros])),
        provideHttpClientTesting(),
        falso.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function entrar(papel: Parameters<typeof perfilDeTeste>[0] = 'COMERCIAL') {
    const servico = TestBed.inject(TempoRealService);
    TestBed.inject(SessaoService).definirPerfil(perfilDeTeste(papel));
    TestBed.tick();
    await microtarefas();
    return servico;
  }

  it('sem sessão não conecta; com sessão conecta em /api/socket.io, namespace /tempo-real', async () => {
    const servico = TestBed.inject(TempoRealService);
    TestBed.tick();
    await microtarefas();
    expect(falso.sockets).toHaveLength(0);
    expect(servico.estado()).toBe('desligado');

    await entrar();
    expect(falso.sockets).toHaveLength(1);
    const socket = falso.ultimo();
    expect(socket.namespace).toBe(NAMESPACE_TEMPO_REAL);
    expect(socket.opcoes.path).toBe(CAMINHO_SOCKET);
    expect(socket.opcoes.withCredentials).toBe(true);
    expect(servico.estado()).toBe('conectando');

    socket.simularConexao();
    expect(servico.estado()).toBe('conectado');
    expect(servico.conectado()).toBe(true);
  });

  it('com a troca de senha pendente não conecta; a sessão acabar desconecta e zera as não lidas', async () => {
    const servico = TestBed.inject(TempoRealService);
    const sessao = TestBed.inject(SessaoService);
    sessao.definirPerfil(perfilDeTeste('CS', { deveTrocarSenha: true }));
    TestBed.tick();
    await microtarefas();
    expect(falso.sockets).toHaveLength(0);

    sessao.definirPerfil(perfilDeTeste('CS'));
    TestBed.tick();
    await microtarefas();
    const socket = falso.ultimo();
    socket.simularConexao();
    socket.receber('nao-lidas', { atendimento: 4, chat: 2 });
    expect(servico.naoLidas()).toEqual({ atendimento: 4, chat: 2 });
    // Cada evento traz só o que mudou.
    socket.receber('nao-lidas', { chat: 5, notificacoes: 9 });
    expect(servico.naoLidas()).toEqual({ atendimento: 4, chat: 5 });

    sessao.encerrarLocalmente();
    TestBed.tick();
    expect(socket.desconectado).toBe(true);
    expect(servico.estado()).toBe('desligado');
    expect(servico.naoLidas()).toEqual({ atendimento: 0, chat: 0 });
  });

  it('entrega os eventos a quem ouve; um ouvinte com defeito não atrapalha os outros', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    socket.simularConexao();
    const recebidos: EventoMensagemNova[] = [];
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    servico.ouvir('mensagem.nova', () => {
      throw new Error('defeito');
    });
    const parar = servico.ouvir('mensagem.nova', (dados) => recebidos.push(dados));

    socket.receber('mensagem.nova', { conversaId: 'c1', mensagem: { id: 'm1' } });
    expect(recebidos).toEqual([{ conversaId: 'c1', mensagem: { id: 'm1' } }]);
    expect(erro).toHaveBeenCalled();

    parar();
    socket.receber('mensagem.nova', { conversaId: 'c1', mensagem: { id: 'm2' } });
    expect(recebidos).toHaveLength(1);
    erro.mockRestore();
  });

  it('salas: entra quando conecta, conta quem pede, sai na última liberação e entra de novo ao reconectar', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    const sairA = servico.entrar({ tipo: 'conversa', id: 'c1' });
    const sairB = servico.entrar({ tipo: 'conversa', id: 'c1' });
    expect(socket.emitidos).toEqual([]); // ainda não conectou

    socket.simularConexao();
    expect(socket.emitidos).toEqual([{ evento: 'conversa.entrar', dados: { conversaId: 'c1' } }]);

    servico.entrar({ tipo: 'chat', id: 'geral' });
    expect(socket.emitidos.at(-1)).toEqual({ evento: 'chat.entrar', dados: { canalId: 'geral' } });

    sairA();
    sairA(); // liberar duas vezes não conta duas
    expect(socket.emitidos.some((e) => e.evento === 'conversa.sair')).toBe(false);
    sairB();
    expect(socket.emitidos.at(-1)).toEqual({
      evento: 'conversa.sair',
      dados: { conversaId: 'c1' },
    });

    socket.emitidos.length = 0;
    const reconexoes: number[] = [];
    servico.aoReconectar(() => reconexoes.push(servico.reconexoes()));
    socket.simularQueda();
    expect(servico.estado()).toBe('reconectando');
    socket.simularConexao();
    expect(socket.emitidos).toEqual([{ evento: 'chat.entrar', dados: { canalId: 'geral' } }]);
    expect(reconexoes).toEqual([1]);
  });

  it('servidor derrubou a conexão: confere a sessão e tenta de novo com espera crescente', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    socket.simularConexao();

    socket.simularQueda('io server disconnect');
    expect(servico.estado()).toBe('reconectando');
    http.expectOne('/api/v1/auth/eu').flush(perfilDeTeste('COMERCIAL'));
    await microtarefas();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(socket.conexoesPedidas).toBe(0); // espera ~2 s
    await vi.advanceTimersByTimeAsync(2_000);
    expect(socket.conexoesPedidas).toBe(1);

    // Recusada de novo: a próxima espera é maior.
    socket.simularFalha(true);
    http.expectOne('/api/v1/auth/eu').flush(perfilDeTeste('COMERCIAL'));
    await microtarefas();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(socket.conexoesPedidas).toBe(1);
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS);
    expect(socket.conexoesPedidas).toBe(2);
  });

  it('servidor recusou e a sessão acabou: o interceptor encerra a sessão e o socket desliga', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    socket.simularFalha(true);
    expect(servico.estado()).toBe('conectando');
    http
      .expectOne('/api/v1/auth/eu')
      .flush({ mensagem: 'Sessão expirada.' }, { status: 401, statusText: 'Unauthorized' });
    await microtarefas();
    TestBed.tick();
    expect(TestBed.inject(SessaoService).autenticado()).toBe(false);
    expect(servico.estado()).toBe('desligado');
    expect(socket.desconectado).toBe(true);
  });

  it('falha de rede comum não pede nada: o socket.io reconecta sozinho', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    socket.simularFalha();
    expect(servico.estado()).toBe('conectando');
    http.expectNone('/api/v1/auth/eu');
  });

  it('digitando: só emite com a conexão de pé', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    servico.digitando({ conversaId: 'c1' }, true);
    expect(socket.emitidos).toEqual([]);
    socket.simularConexao();
    servico.digitando({ conversaId: 'c1' }, true);
    expect(socket.emitidos).toEqual([
      { evento: 'digitando', dados: { conversaId: 'c1', ativo: true } },
    ]);
  });

  it('lerNaoLidas não confia no formato e mantém o que não veio', () => {
    expect(lerNaoLidas({ atendimento: 3.7, chat: -2 })).toEqual({ atendimento: 3, chat: 0 });
    expect(lerNaoLidas(null)).toEqual({ atendimento: 0, chat: 0 });
    const atual = { atendimento: 2, chat: 6 };
    expect(lerNaoLidas({ atendimento: '5' }, atual)).toEqual(atual);
    expect(lerNaoLidas({ atendimento: 0 }, atual)).toEqual({ atendimento: 0, chat: 6 });
  });

  it('pedido de sala recusado pelo servidor fica só no registro (console.warn)', async () => {
    const servico = await entrar();
    const socket = falso.ultimo();
    socket.simularConexao();
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    servico.entrar({ tipo: 'conversa', id: 'c9' });
    socket.confirmar(0, { ok: true });
    expect(aviso).not.toHaveBeenCalled();
    servico.entrar({ tipo: 'chat', id: 'privado' });
    socket.confirmar(1, {
      ok: false,
      erro: 'sem_permissao',
      mensagem: 'Você não participa deste canal.',
    });
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('Você não participa deste canal.'));
    aviso.mockRestore();
  });
});

describe('auxiliares do tempo real', () => {
  const conversa = signal<string | null>('c1');

  @Component({ template: '' })
  class TelaFalsa {
    readonly recebidas: string[] = [];
    readonly digitando = digitandoEm(
      () => {
        const id = conversa();
        return id ? { conversaId: id } : null;
      },
      { nomeDoContato: () => 'Maria Souza' },
    );

    constructor() {
      acompanharSala(() => {
        const id = conversa();
        return id ? { tipo: 'conversa', id } : null;
      });
      aoReceber('mensagem.nova', (evento) => this.recebidas.push(evento.mensagem.id));
    }
  }

  let falso: ReturnType<typeof provideSocketFalso>;

  beforeEach(async () => {
    vi.useFakeTimers();
    conversa.set('c1');
    falso = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        falso.providers,
      ],
    });
    TestBed.inject(TempoRealService);
    TestBed.inject(SessaoService).definirPerfil(
      perfilDeTeste('COMERCIAL', { usuario: { id: 'eu' } }),
    );
    TestBed.tick();
    await microtarefas();
    falso.ultimo().simularConexao();
  });
  afterEach(() => vi.useRealTimers());

  it('acompanharSala segue o signal e sai ao destruir; aoReceber para ao destruir', () => {
    const fixture = TestBed.createComponent(TelaFalsa);
    fixture.detectChanges();
    const socket = falso.ultimo();
    expect(socket.emitidos).toEqual([{ evento: 'conversa.entrar', dados: { conversaId: 'c1' } }]);

    conversa.set('c2');
    TestBed.tick();
    expect(socket.emitidos.slice(1)).toEqual([
      { evento: 'conversa.sair', dados: { conversaId: 'c1' } },
      { evento: 'conversa.entrar', dados: { conversaId: 'c2' } },
    ]);

    socket.receber('mensagem.nova', { conversaId: 'c2', mensagem: { id: 'm1' } });
    expect(fixture.componentInstance.recebidas).toEqual(['m1']);

    fixture.destroy();
    expect(socket.emitidos.at(-1)).toEqual({
      evento: 'conversa.sair',
      dados: { conversaId: 'c2' },
    });
    socket.receber('mensagem.nova', { conversaId: 'c2', mensagem: { id: 'm2' } });
  });

  it('digitandoEm: pessoas da conversa atual, sem o próprio usuário, expirando sem novo aviso', async () => {
    const fixture = TestBed.createComponent(TelaFalsa);
    fixture.detectChanges();
    const socket = falso.ultimo();
    const tela = fixture.componentInstance;

    socket.receber('digitando', { conversaId: 'c1', ativo: true, contato: true, nome: 'Maria' });
    socket.receber('digitando', {
      conversaId: 'c1',
      ativo: true,
      usuario: { id: 'u2', nome: 'Ana' },
    });
    socket.receber('digitando', {
      conversaId: 'c1',
      ativo: true,
      usuario: { id: 'eu', nome: 'Eu' },
    });
    socket.receber('digitando', { conversaId: 'outra', ativo: true, nome: 'Zé' });
    expect(tela.digitando().map((p) => p.nome)).toEqual(['Maria', 'Ana']);

    socket.receber('digitando', {
      conversaId: 'c1',
      ativo: false,
      usuario: { id: 'u2', nome: 'Ana' },
    });
    expect(tela.digitando().map((p) => p.nome)).toEqual(['Maria']);

    await vi.advanceTimersByTimeAsync(EXPIRA_DIGITANDO_MS + 1);
    expect(tela.digitando()).toEqual([]);

    // O contato digitando sem nome no evento: o nome vem da tela.
    socket.receber('digitando', { conversaId: 'c1', ativo: true, contato: true });
    expect(tela.digitando()).toEqual([{ chave: 'contato', nome: 'Maria Souza', contato: true }]);

    socket.receber('digitando', { conversaId: 'c1', ativo: true, nome: 'Maria' });
    conversa.set('c2');
    TestBed.tick();
    expect(tela.digitando()).toEqual([]);
  });
});
