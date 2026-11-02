import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  INTERVALO_NOTIFICACOES_MS,
  type Notificacao,
  NotificacoesService,
  rotaDaNotificacao,
} from './notificacoes.service';
import { SessaoService } from './sessao/sessao.service';
import { perfilDeTeste } from './sessao/sessao-de-teste';
import { provideSocketFalso } from './tempo-real/tempo-real-de-teste';

function notificacao(id: string, criadoEm: string, lida = false): Notificacao {
  return {
    id,
    tipo: 'negocio.atribuido',
    titulo: `Notificação ${id}`,
    texto: null,
    link: null,
    dados: null,
    lidaEm: lida ? criadoEm : null,
    criadoEm,
  };
}

const URL_LISTA = '/api/v1/notificacoes?pagina=1&porPagina=20';

/** Deixa as continuações das promessas (then/finally) rodarem. */
async function microtarefas(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe('NotificacoesService', () => {
  let http: HttpTestingController;
  let falso: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    vi.useFakeTimers();
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
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function iniciar() {
    const servico = TestBed.inject(NotificacoesService);
    TestBed.inject(SessaoService).definirPerfil(perfilDeTeste('COMERCIAL'));
    TestBed.tick();
    return servico;
  }

  function responder(itens: Notificacao[], naoLidas: number) {
    http
      .expectOne(URL_LISTA)
      .flush({ itens, total: itens.length, pagina: 1, porPagina: 20, naoLidas });
  }

  it('sem sessão não consulta; com sessão consulta e põe as não lidas primeiro', async () => {
    const servico = TestBed.inject(NotificacoesService);
    TestBed.tick();
    http.expectNone(URL_LISTA);

    TestBed.inject(SessaoService).definirPerfil(perfilDeTeste('COMERCIAL'));
    TestBed.tick();
    expect(servico.carregando()).toBe(true);
    responder(
      [
        notificacao('a', '2026-10-21T12:00:00Z', true),
        notificacao('b', '2026-10-21T10:00:00Z'),
        notificacao('c', '2026-10-21T11:00:00Z'),
      ],
      2,
    );
    await microtarefas();
    expect(servico.itens().map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(servico.naoLidas()).toBe(2);
    expect(servico.carregando()).toBe(false);
  });

  it('busca de reserva a cada 60 s; com a troca de senha pendente não consulta', async () => {
    expect(INTERVALO_NOTIFICACOES_MS).toBe(60_000);
    const servico = iniciar();
    responder([], 0);
    await microtarefas();
    await vi.advanceTimersByTimeAsync(INTERVALO_NOTIFICACOES_MS);
    responder([notificacao('n', '2026-10-21T12:00:00Z')], 1);
    await microtarefas();
    expect(servico.naoLidas()).toBe(1);

    TestBed.inject(SessaoService).definirPerfil(
      perfilDeTeste('COMERCIAL', { deveTrocarSenha: true }),
    );
    TestBed.tick();
    expect(servico.naoLidas()).toBe(0);
    await vi.advanceTimersByTimeAsync(INTERVALO_NOTIFICACOES_MS * 2);
    http.expectNone(URL_LISTA);
  });

  it('notificacao.nova entra no topo e soma nas não lidas; repetida substitui', async () => {
    const servico = iniciar();
    responder([notificacao('a', '2026-10-21T10:00:00Z')], 1);
    await microtarefas();
    const socket = falso.ultimo();
    socket.simularConexao();

    socket.receber('notificacao.nova', { notificacao: notificacao('b', '2026-10-21T12:00:00Z') });
    expect(servico.itens().map((item) => item.id)).toEqual(['b', 'a']);
    expect(servico.naoLidas()).toBe(2);

    socket.receber('notificacao.nova', {
      notificacao: { ...notificacao('b', '2026-10-21T12:00:00Z'), titulo: 'Novo' },
    });
    expect(servico.itens()).toHaveLength(2);
    expect(servico.itens()[0].titulo).toBe('Novo');
    expect(servico.naoLidas()).toBe(2);

    // O total que a API manda (junto ou no `nao-lidas` que vem logo depois) vale mais que a conta
    // local.
    socket.receber('notificacao.nova', {
      notificacao: notificacao('c', '2026-10-21T13:00:00Z'),
      naoLidas: 7,
    });
    expect(servico.naoLidas()).toBe(7);
    socket.receber('notificacao.nova', { notificacao: notificacao('d', '2026-10-21T14:00:00Z') });
    expect(servico.naoLidas()).toBe(8);
    socket.receber('nao-lidas', { notificacoes: 5 });
    expect(servico.naoLidas()).toBe(5);
    socket.receber('nao-lidas', { chat: 2 });
    expect(servico.naoLidas()).toBe(5);
  });

  it('ao reconectar busca de novo; uma busca em andamento não desfaz o que chegou ao vivo', async () => {
    const servico = iniciar();
    responder([], 0);
    await microtarefas();
    const socket = falso.ultimo();
    socket.simularConexao();
    socket.simularQueda();
    socket.simularConexao();
    const velha = http.expectOne(URL_LISTA);
    socket.receber('notificacao.nova', { notificacao: notificacao('n', '2026-10-21T12:00:00Z') });
    velha.flush({ itens: [], total: 0, pagina: 1, porPagina: 20, naoLidas: 0 });
    await microtarefas();
    expect(servico.itens().map((item) => item.id)).toEqual(['n']);
    expect(servico.naoLidas()).toBe(1);
  });

  it('falha vira erro() sem lançar', async () => {
    const servico = iniciar();
    http.expectOne(URL_LISTA).flush(null, { status: 500, statusText: 'x' });
    await microtarefas();
    expect(servico.erro()).toContain('Algo deu errado');
  });

  it('marcar como lida é otimista e volta atrás se a API recusar', async () => {
    const servico = iniciar();
    responder(
      [notificacao('a', '2026-10-21T12:00:00Z'), notificacao('b', '2026-10-21T11:00:00Z')],
      2,
    );
    await microtarefas();

    const marcando = servico.marcarComoLida('a');
    expect(servico.naoLidas()).toBe(1);
    const req = http.expectOne('/api/v1/notificacoes/a/marcar-lida');
    expect(req.request.method).toBe('POST');
    req.flush({ ...notificacao('a', '2026-10-21T12:00:00Z', true) });
    await marcando;
    expect(servico.itens().find((item) => item.id === 'a')?.lidaEm).not.toBeNull();

    const falhando = servico.marcarComoLida('b');
    expect(servico.naoLidas()).toBe(0);
    http.expectOne('/api/v1/notificacoes/b/marcar-lida').flush(
      { statusCode: 404, erro: 'nao_encontrado', mensagem: 'Não encontrada.' },
      {
        status: 404,
        statusText: 'x',
      },
    );
    await expect(falhando).rejects.toMatchObject({ mensagem: 'Não encontrada.' });
    expect(servico.naoLidas()).toBe(1);
  });

  it('marcar todas zera a contagem e devolve quantas a API marcou', async () => {
    const servico = iniciar();
    responder(
      [notificacao('a', '2026-10-21T12:00:00Z'), notificacao('b', '2026-10-21T11:00:00Z')],
      2,
    );
    await microtarefas();
    const marcando = servico.marcarTodasComoLidas();
    expect(servico.naoLidas()).toBe(0);
    expect(servico.itens().every((item) => item.lidaEm)).toBe(true);
    http.expectOne('/api/v1/notificacoes/marcar-todas-lidas').flush({ marcadas: 2 });
    expect(await marcando).toBe(2);
  });

  it('links: só internos; a gestão de usuários fica em Configurações', () => {
    expect(rotaDaNotificacao('/atividades?atividade=1')).toBe('/atividades?atividade=1');
    expect(rotaDaNotificacao('/administracao/usuarios')).toBe('/configuracoes/usuarios');
    expect(rotaDaNotificacao('https://fora.com')).toBeNull();
    expect(rotaDaNotificacao('//fora.com')).toBeNull();
    expect(rotaDaNotificacao(null)).toBeNull();
  });
});
