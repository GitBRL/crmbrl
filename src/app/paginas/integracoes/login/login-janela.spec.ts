import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

import {
  ABRIR_JANELA,
  CANAL_DO_LOGIN,
  CHAVE_DO_RETORNO,
  INTERVALO_DA_CONSULTA_MS,
  IR_PARA_ENDERECO,
  LIMITE_DA_ESPERA_MS,
  LoginJanela,
  type PedidoDeJanela,
} from './login-janela';
import type { LoginIniciado, SituacaoDaConexao } from './login.tipos';

const CONEXAO = '11111111-1111-4111-8111-111111111111';
const OUTRA = '22222222-2222-4222-8222-222222222222';
const DIALOGO = 'http://127.0.0.1:3296/typeform/oauth/authorize?state=x';

interface JanelaFalsa {
  location: { href: string };
  close: ReturnType<typeof vi.fn>;
  document: { title: string; body: { textContent: string } };
  closed: boolean;
}

function janelaFalsa(): JanelaFalsa {
  return {
    location: { href: 'about:blank' },
    close: vi.fn(),
    document: { title: '', body: { textContent: '' } },
    closed: false,
  };
}

describe('LoginJanela', () => {
  let abertas: { endereco: string; nome: string; recursos: string }[];
  let janela: JanelaFalsa | null;
  let irPara: string[];
  let situacao: SituacaoDaConexao;
  let consultas: number;
  let iniciar: Mock<(modo: string) => Promise<LoginIniciado>>;

  function servico(): LoginJanela {
    return TestBed.inject(LoginJanela);
  }

  function pedido(extra: Partial<PedidoDeJanela> = {}): PedidoDeJanela {
    return {
      app: 'typeform',
      iniciar: (modo) => iniciar(modo),
      situacao: () => {
        consultas++;
        return Promise.resolve(situacao);
      },
      contexto: { integracaoId: null, nome: 'Minha integração' },
      ...extra,
    };
  }

  beforeEach(() => {
    abertas = [];
    irPara = [];
    consultas = 0;
    janela = janelaFalsa();
    situacao = { conectada: false, precisaAtencao: false, conectadaEm: null };
    iniciar = vi.fn((_modo: string) =>
      Promise.resolve({
        conexaoId: CONEXAO,
        urlDialogo: DIALOGO,
        expiraEm: '2026-11-05T12:10:00Z',
        enderecoDeRetorno: 'https://crm/retorno',
      }),
    );
    globalThis.sessionStorage?.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ABRIR_JANELA,
          useValue: (endereco: string, nome: string, recursos: string) => {
            abertas.push({ endereco, nome, recursos });
            return janela as unknown as Window | null;
          },
        },
        { provide: IR_PARA_ENDERECO, useValue: (endereco: string) => irPara.push(endereco) },
      ],
    });
  });

  afterEach(() => {
    servico().cancelar();
    vi.useRealTimers();
  });

  function retornoNoStorage(valor: Record<string, unknown>): void {
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: CHAVE_DO_RETORNO, newValue: JSON.stringify(valor) }),
    );
  }

  it('abre a janela na hora, antes de a API responder, e só depois a leva ao diálogo', async () => {
    vi.useFakeTimers();
    let liberar!: (login: LoginIniciado) => void;
    iniciar.mockReturnValue(new Promise<LoginIniciado>((resolve) => (liberar = resolve)));
    const resultado = servico().entrar(pedido());

    expect(abertas).toEqual([
      { endereco: '', nome: 'crmbrl-login', recursos: 'popup,width=600,height=720' },
    ]);
    expect(janela?.location.href).toBe('about:blank');
    expect(iniciar).toHaveBeenCalledWith('janela');

    liberar({ conexaoId: CONEXAO, urlDialogo: DIALOGO, expiraEm: '', enderecoDeRetorno: '' });
    await vi.advanceTimersByTimeAsync(0);
    expect(janela?.location.href).toBe(DIALOGO);
    expect(servico().espera()).toEqual({ app: 'typeform', conexaoId: CONEXAO, bloqueada: false });

    servico().cancelar();
    await expect(resultado).resolves.toEqual({ tipo: 'desistiu' });
    expect(servico().espera()).toBeNull();
  });

  it('se o início falha, fecha a janela e repassa o erro', async () => {
    iniciar.mockRejectedValue(new Error('422'));
    await expect(servico().entrar(pedido())).rejects.toThrow('422');
    expect(janela?.close).toHaveBeenCalled();
    expect(servico().espera()).toBeNull();
  });

  it('recusa um endereço que não é http(s) e fecha a janela', async () => {
    iniciar.mockResolvedValue({
      conexaoId: CONEXAO,
      urlDialogo: 'javascript:alert(1)',
      expiraEm: '',
      enderecoDeRetorno: '',
    });
    await expect(servico().entrar(pedido())).rejects.toThrow();
    expect(janela?.close).toHaveBeenCalled();
    expect(janela?.location.href).toBe('about:blank');
  });

  it('pop-up bloqueado: segue na mesma aba, em modo página, guardando o contexto', async () => {
    janela = null;
    const resultado = await servico().entrar(pedido());
    expect(resultado).toEqual({ tipo: 'pagina' });
    expect(iniciar).toHaveBeenCalledWith('pagina');
    expect(irPara).toEqual([DIALOGO]);
    expect(JSON.parse(sessionStorage.getItem('crmbrl.facebook.contexto-do-login') ?? '{}')).toEqual(
      {
        integracaoId: null,
        nome: 'Minha integração',
      },
    );
    expect(servico().espera()).toBeNull();
  });

  it('a mensagem da página de retorno (BroadcastChannel) conclui, e só a da conexão iniciada', async () => {
    const resultado = servico().entrar(pedido());
    await new Promise((r) => setTimeout(r, 20));
    const canal = new BroadcastChannel(CANAL_DO_LOGIN);
    canal.postMessage({ app: 'typeform', resultado: 'conectado', conexao: OUTRA });
    canal.postMessage({ app: 'facebook', resultado: 'conectado', conexao: CONEXAO });
    canal.postMessage({ app: 'typeform', resultado: 'conectado', conexao: CONEXAO });
    const feito = await resultado;
    canal.close();
    expect(feito).toEqual({
      tipo: 'concluido',
      retorno: {
        app: 'typeform',
        resultado: 'conectado',
        conexaoId: CONEXAO,
        motivo: null,
        mensagem: null,
      },
    });
    expect(janela?.close).toHaveBeenCalled();
  });

  it('reserva por localStorage: o evento storage da conexão certa conclui; o da errada, não', async () => {
    const resultado = servico().entrar(pedido());
    await new Promise((r) => setTimeout(r, 10));
    retornoNoStorage({ app: 'typeform', resultado: 'cancelado', conexao: OUTRA });
    expect(servico().espera()).not.toBeNull();
    retornoNoStorage({
      app: 'typeform',
      resultado: 'erro',
      conexao: CONEXAO,
      motivo: 'servico_recusou',
      mensagem: 'invalid_client',
    });
    const feito = await resultado;
    expect(feito).toEqual({
      tipo: 'concluido',
      retorno: {
        app: 'typeform',
        resultado: 'erro',
        conexaoId: CONEXAO,
        motivo: 'servico_recusou',
        mensagem: 'invalid_client',
      },
    });
  });

  it('erro de state sem conexão, do mesmo app, encerra a espera; sem conexão de outro tipo ou app, não', async () => {
    const resultado = servico().entrar(pedido());
    await new Promise((r) => setTimeout(r, 10));
    retornoNoStorage({ app: 'typeform', resultado: 'cancelado' });
    retornoNoStorage({ app: 'typeform', resultado: 'erro', motivo: 'servico_recusou' });
    retornoNoStorage({ app: 'facebook', resultado: 'erro', motivo: 'state_vencido' });
    retornoNoStorage({ app: 'typeform', resultado: 'erro', conexao: OUTRA, motivo: 'state_usado' });
    expect(servico().espera()).not.toBeNull();
    retornoNoStorage({ app: 'typeform', resultado: 'erro', motivo: 'state_vencido' });
    await expect(resultado).resolves.toEqual({
      tipo: 'concluido',
      retorno: {
        app: 'typeform',
        resultado: 'erro',
        conexaoId: null,
        motivo: 'state_vencido',
        mensagem: null,
      },
    });
    expect(servico().espera()).toBeNull();
  });

  it('consulta a situação a cada 3 s e conclui quando a conexão fica conectada', async () => {
    vi.useFakeTimers();
    const resultado = servico().entrar(pedido());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS);
    expect(consultas).toBe(1);
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS);
    expect(consultas).toBe(2);
    situacao = { conectada: true, precisaAtencao: false, conectadaEm: '2026-11-05T12:00:00Z' };
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS);
    await expect(resultado).resolves.toMatchObject({
      tipo: 'concluido',
      retorno: { resultado: 'conectado', conexaoId: CONEXAO },
    });
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS * 3);
    expect(consultas).toBe(3);
  });

  it('reconexão: só conta quando conectadaEm muda (ou a atenção some)', async () => {
    vi.useFakeTimers();
    const antes = { conectadaEm: '2026-11-04T10:00:00Z', precisaAtencao: false };
    situacao = { conectada: true, precisaAtencao: false, conectadaEm: antes.conectadaEm };
    const resultado = servico().entrar(pedido({ antes }));
    let terminou = false;
    void resultado.then(() => (terminou = true));
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS * 2);
    expect(terminou).toBe(false);
    situacao = { conectada: true, precisaAtencao: false, conectadaEm: '2026-11-05T12:00:00Z' };
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS);
    await expect(resultado).resolves.toMatchObject({ tipo: 'concluido' });
  });

  it('consulta também quando a janela do assistente recupera o foco', async () => {
    vi.useFakeTimers();
    const resultado = servico().entrar(pedido());
    await vi.advanceTimersByTimeAsync(0);
    situacao = { conectada: true, precisaAtencao: false, conectadaEm: 'agora' };
    globalThis.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    await expect(resultado).resolves.toMatchObject({ tipo: 'concluido' });
    expect(consultas).toBe(1);
  });

  it('janela fechada (closed) não é cancelamento: segue esperando', async () => {
    vi.useFakeTimers();
    const resultado = servico().entrar(pedido());
    let terminou = false;
    void resultado.then(() => (terminou = true));
    await vi.advanceTimersByTimeAsync(0);
    (janela as JanelaFalsa).closed = true;
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONSULTA_MS * 5);
    expect(terminou).toBe(false);
    expect(servico().espera()).not.toBeNull();
  });

  it('para de esperar depois de 10 minutos', async () => {
    vi.useFakeTimers();
    const resultado = servico().entrar(pedido());
    await vi.advanceTimersByTimeAsync(LIMITE_DA_ESPERA_MS);
    await expect(resultado).resolves.toEqual({ tipo: 'expirou' });
    expect(servico().espera()).toBeNull();
    expect(consultas).toBeLessThanOrEqual(
      Math.ceil(LIMITE_DA_ESPERA_MS / INTERVALO_DA_CONSULTA_MS),
    );
  });

  it('"Abrir de novo" reabre o diálogo na mesma janela; bloqueado, avisa', async () => {
    vi.useFakeTimers();
    const resultado = servico().entrar(pedido());
    await vi.advanceTimersByTimeAsync(0);
    servico().abrirDeNovo();
    expect(abertas.at(-1)).toEqual({
      endereco: DIALOGO,
      nome: 'crmbrl-login',
      recursos: 'popup,width=600,height=720',
    });
    expect(servico().espera()?.bloqueada).toBe(false);

    janela = null;
    servico().abrirDeNovo();
    expect(servico().espera()?.bloqueada).toBe(true);
    servico().cancelar();
    await resultado;
  });

  it('um login novo encerra o anterior', async () => {
    vi.useFakeTimers();
    const primeiro = servico().entrar(pedido());
    await vi.advanceTimersByTimeAsync(0);
    const segundo = servico().entrar(pedido({ app: 'facebook' }));
    await expect(primeiro).resolves.toEqual({ tipo: 'desistiu' });
    await vi.advanceTimersByTimeAsync(0);
    expect(servico().espera()?.app).toBe('facebook');
    servico().cancelar();
    await segundo;
  });
});
