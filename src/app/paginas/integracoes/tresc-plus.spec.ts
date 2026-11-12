import { TestBed } from '@angular/core/testing';

import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import type { ConexaoTrescPlus } from '../../nucleo/tresc-plus/tresc-plus.tipos';
import { TrescPlusIntegracao } from './tresc-plus';

const CONEXAO: ConexaoTrescPlus = {
  ativa: true,
  urlApi: 'http://apoio:8097/api/v1',
  urlSocket: 'http://apoio:8097',
  caminhoSocket: '/socket.io',
  formatoEnvelope: 'AUTO',
  tokenConfigurado: true,
  token: '••••r-3c',
  campanhaPadrao: { id: 1, nome: 'Prospecção Demo' },
  teste: {
    em: '2026-11-12T13:44:05.727Z',
    ok: true,
    mensagem: 'Conectado ao 3C+ como Gestor Sim.',
  },
  ouvinte: { estado: 'conectado', em: '2026-11-12T13:49:46.962Z' },
  reconciliadaEm: '2026-11-12T13:50:24.682Z',
};

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
  }
}

describe('TrescPlusIntegracao (Integrações, aba 3C+)', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let confirmar: ReturnType<typeof vi.fn>;

  async function montar() {
    const fixture = TestBed.createComponent(TrescPlusIntegracao);
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
    return fixture;
  }

  const botao = (el: HTMLElement, texto: string) =>
    [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;

  beforeEach(() => {
    api = {
      conexao: vi.fn(() => Promise.resolve(CONEXAO)),
      alterarConexao: vi.fn(() => Promise.resolve(CONEXAO)),
      testarConexao: vi.fn(() =>
        Promise.resolve({ ok: true, mensagem: 'Conectado ao 3C+ como Gestor Sim.' }),
      ),
      reconciliar: vi.fn(() => Promise.resolve({})),
      vinculos: vi.fn(() =>
        Promise.resolve([
          {
            vinculado: true,
            usuarioId: 'u1',
            usuarioNome: 'Lucas Pereira',
            nome3c: 'Vendedor Um Sim',
            ramal: '1001',
            token: '••••-101',
            vinculadoEm: '2026-11-12T13:44:08.781Z',
          },
        ]),
      ),
      desvincular: vi.fn(() => Promise.resolve()),
      campanhas: vi.fn(() =>
        Promise.resolve([
          { id: 1, nome: 'Prospecção Demo' },
          { id: 2, nome: 'Retomada Demo' },
        ]),
      ),
    };
    confirmar = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: TrescPlusApi, useValue: api },
        { provide: ConfirmacaoService, useValue: { confirmar } },
      ],
    });
  });

  it('mostra a conexão, o estado do ouvinte e o token só mascarado', async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ouvinte conectado');
    expect(el.textContent).toContain('Ativa');
    expect(el.textContent).toContain('Conectado ao 3C+ como Gestor Sim.');
    const token = el.querySelector('input[type=password]') as HTMLInputElement;
    expect(token.value).toBe('');
    expect(token.getAttribute('placeholder')).toContain('••••r-3c');
  });

  it('lista os vendedores conectados e desvincula depois de confirmar', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lucas Pereira');
    expect(el.textContent).toContain('1001');
    botao(el, 'Desvincular').click();
    await microtarefas();
    expect(confirmar).toHaveBeenCalled();
    expect(api['desvincular']).toHaveBeenCalledWith('u1');
    expect(api['vinculos']).toHaveBeenCalledTimes(2);
  });

  it('Testar conexão e Reconciliar chamam a API', async () => {
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;
    botao(el, 'Testar conexão').click();
    await microtarefas();
    fixture.detectChanges();
    expect(api['testarConexao']).toHaveBeenCalled();
    expect(el.querySelector('.tresc__resultado')?.textContent).toContain('Conexão ok');
    botao(el, 'Reconciliar agora').click();
    await microtarefas();
    expect(api['reconciliar']).toHaveBeenCalled();
  });

  it('salvar não manda o token quando o campo está vazio', async () => {
    const fixture = await montar();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect(api['alterarConexao']).toHaveBeenCalledTimes(1);
    const dados = api['alterarConexao'].mock.calls[0][0] as Record<string, unknown>;
    expect('token' in dados).toBe(false);
    expect(dados['ativa']).toBe(true);
    expect(dados['urlApi']).toBe('http://apoio:8097/api/v1');
  });

  it('salvar com token novo envia só o token digitado', async () => {
    const fixture = await montar();
    const token = fixture.nativeElement.querySelector('input[type=password]') as HTMLInputElement;
    token.value = 'novo-token';
    token.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect((api['alterarConexao'].mock.calls[0][0] as Record<string, unknown>)['token']).toBe(
      'novo-token',
    );
  });

  it('trocar o host avisa antes de salvar e desistir não salva', async () => {
    confirmar.mockResolvedValue(false);
    const fixture = await montar();
    const url = fixture.nativeElement.querySelector('app-campo-texto input') as HTMLInputElement;
    url.value = 'https://outro.exemplo.com/api/v1';
    url.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect(confirmar).toHaveBeenCalled();
    expect(confirmar.mock.calls[0][0].mensagem).toContain('conectar de novo');
    expect(api['alterarConexao']).not.toHaveBeenCalled();
  });

  it('mudar só o caminho da URL não pede confirmação', async () => {
    const fixture = await montar();
    const url = fixture.nativeElement.querySelector('app-campo-texto input') as HTMLInputElement;
    url.value = 'http://apoio:8097/api/v2';
    url.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await microtarefas();
    expect(confirmar).not.toHaveBeenCalled();
    expect(api['alterarConexao']).toHaveBeenCalled();
  });

  it('sem ninguém conectado, mostra o estado vazio', async () => {
    api['vinculos'].mockResolvedValue([]);
    const el = (await montar()).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ninguém conectou ainda');
  });

  it('erro de carga mostra Tentar de novo', async () => {
    api['conexao'].mockRejectedValueOnce(new Error('x'));
    const fixture = await montar();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Não conseguimos carregar a conexão com o 3C+');
    botao(el, 'Tentar de novo').click();
    await microtarefas();
    fixture.detectChanges();
    expect(el.textContent).toContain('Vendedores conectados');
  });

  it('ouvinte com erro aparece com o texto', async () => {
    api['conexao'].mockResolvedValue({ ...CONEXAO, ouvinte: { estado: 'erro', em: null } });
    const el = (await montar()).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ouvinte com erro');
  });
});
