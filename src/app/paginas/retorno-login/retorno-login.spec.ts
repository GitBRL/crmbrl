import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CANAL_DO_LOGIN, CHAVE_DO_RETORNO } from '../integracoes/login/login-janela';
import { FECHAR_ESTA_JANELA, RetornoLogin } from './retorno-login';

const CONEXAO = '11111111-1111-4111-8111-111111111111';

describe('RetornoLogin (/retorno-login)', () => {
  let fechou: number;

  beforeEach(() => {
    fechou = 0;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FECHAR_ESTA_JANELA, useValue: () => fechou++ }],
    });
  });

  async function abrir(entradas: Record<string, string | null>) {
    const fixture = TestBed.createComponent(RetornoLogin);
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('conectado: avisa a janela do assistente (canal e reserva), tenta fechar e mostra o aviso', async () => {
    const recebidas: unknown[] = [];
    const canal = new BroadcastChannel(CANAL_DO_LOGIN);
    canal.onmessage = (e) => recebidas.push(e.data);

    const raiz = await abrir({ app: 'typeform', resultado: 'conectado', conexao: CONEXAO });
    await new Promise((r) => setTimeout(r, 30));
    canal.close();

    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]).toMatchObject({
      app: 'typeform',
      resultado: 'conectado',
      conexao: CONEXAO,
    });
    expect(JSON.parse(localStorage.getItem(CHAVE_DO_RETORNO) ?? '{}')).toMatchObject({
      app: 'typeform',
      conexao: CONEXAO,
    });
    expect(fechou).toBe(1);
    expect(raiz.querySelector('[data-teste="pode-fechar"]')?.textContent).toContain(
      'Pronto! Pode fechar esta janela',
    );
    expect(raiz.querySelector('a[href="/integracoes"]')?.textContent).toContain('Voltar ao CRM');
  });

  it('erro: mostra o motivo e a mensagem do serviço só como texto', async () => {
    const raiz = await abrir({
      app: 'facebook',
      resultado: 'erro',
      conexao: CONEXAO,
      motivo: 'meta_recusou',
      mensagem: '<img src=x onerror=alert(1)>',
    });
    const mensagem = raiz.querySelector('[data-teste="mensagem-do-servico"]');
    expect(mensagem?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(raiz.querySelector('img[src="x"]')).toBeNull();
    expect(raiz.textContent).toContain('O Facebook recusou o acesso');
  });

  it('cancelado: avisa e diz que nada foi conectado', async () => {
    const raiz = await abrir({ app: 'rd-station', resultado: 'cancelado', conexao: CONEXAO });
    expect(raiz.textContent).toContain('Login cancelado');
    expect(raiz.textContent).toContain('Nada foi conectado');
    expect(fechou).toBe(1);
  });

  it('sem um retorno válido na URL: não avisa ninguém nem tenta fechar', async () => {
    const raiz = await abrir({ app: 'outro', resultado: 'conectado' });
    expect(localStorage.getItem(CHAVE_DO_RETORNO)).toBeNull();
    expect(fechou).toBe(0);
    expect(raiz.textContent).toContain('Nada por aqui');
  });
});
