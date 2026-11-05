import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmacaoService, type PedidoConfirmacao } from '../../nucleo/confirmacao.service';
import { microtarefas } from './dados-de-teste';
import { consumirContextoDoLogin } from './facebook.tipos';
import { ABRIR_JANELA, CHAVE_DO_RETORNO, IR_PARA_ENDERECO } from './login/login-janela';
import type { AplicativoDeConexao, ConexaoAplicativo, RetornoDoLogin } from './login/login.tipos';
import { PassoContaLogin } from './passo-conta-login';

const CX = '55555555-5555-4555-8555-555555555555';
const NOVA = '66666666-6666-4666-8666-666666666666';
const DIALOGO = 'http://127.0.0.1:3296/typeform/oauth/authorize?state=abc';

function conexao(extra: Partial<ConexaoAplicativo> = {}): ConexaoAplicativo {
  return {
    id: CX,
    aplicativo: 'TYPEFORM',
    nome: 'H4 Typeform',
    conta: 'Escola Demo (Typeform)',
    conectada: true,
    conectadaEm: '2026-11-05T12:00:00Z',
    expiraEm: '2026-11-12T12:00:00Z',
    integracoes: 1,
    precisaAtencao: false,
    atencaoMotivo: null,
    criadoEm: '2026-11-05T11:00:00Z',
    ...extra,
  };
}

function app(aplicativo: string, configurado: boolean) {
  return {
    aplicativo,
    nome: aplicativo,
    configurado,
    clientId: configurado ? 'id' : null,
    segredoMascarado: configurado ? '••••' : null,
    enderecoDeRetorno: 'https://crm/retorno',
    emUso: { conexoes: 0, canais: 0, integracoes: 0 },
    escopos: [],
    webhook: null,
    atualizadoEm: null,
    atualizadoPor: null,
  };
}

describe('PassoContaLogin (Typeform e RD Station)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PassoContaLogin>;
  let destino: string[];
  let abertas: string[];
  let janela: { location: { href: string }; close: ReturnType<typeof vi.fn> } | null;

  beforeEach(() => {
    destino = [];
    abertas = [];
    janela = { location: { href: 'about:blank' }, close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: IR_PARA_ENDERECO, useValue: (e: string) => destino.push(e) },
        {
          provide: ABRIR_JANELA,
          useValue: (endereco: string) => {
            abertas.push(endereco);
            return janela as unknown as Window | null;
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const elemento = () => fixture.nativeElement as HTMLElement;
  const aguardar = async () => {
    await microtarefas();
    fixture.detectChanges();
  };

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!achado) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return achado;
  }

  function responder(
    aplicativo: AplicativoDeConexao,
    conexoes: readonly ConexaoAplicativo[],
    appCadastrado = true,
  ) {
    http.expectOne(`/api/v1/conexoes-aplicativo?aplicativo=${aplicativo}`).flush(conexoes);
    http
      .expectOne('/api/v1/configuracoes/apps-de-login')
      .flush([app('META', true), app(aplicativo, appCadastrado)]);
  }

  async function abrir(
    aplicativo: AplicativoDeConexao,
    conexoes: readonly ConexaoAplicativo[],
    opcoes: {
      appCadastrado?: boolean;
      selecionada?: string;
      retorno?: RetornoDoLogin;
    } = {},
  ) {
    fixture = TestBed.createComponent(PassoContaLogin);
    fixture.componentRef.setInput('aplicativo', aplicativo);
    fixture.componentRef.setInput('selecionadaId', opcoes.selecionada ?? null);
    fixture.componentRef.setInput('retorno', opcoes.retorno ?? null);
    fixture.componentRef.setInput('contexto', { integracaoId: 'we9', nome: 'Meu Typeform' });
    fixture.detectChanges();
    responder(aplicativo, conexoes, opcoes.appCadastrado ?? true);
    await aguardar();
  }

  function terminarNaOutraJanela(valor: Record<string, unknown>): void {
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: CHAVE_DO_RETORNO, newValue: JSON.stringify(valor) }),
    );
  }

  it('lista as conexões do serviço para reaproveitar, com conta, uso e situação', async () => {
    await abrir('TYPEFORM', [
      conexao(),
      conexao({
        id: 'cx-ruim',
        nome: 'Conta velha',
        precisaAtencao: true,
        atencaoMotivo: 'Conecte o Typeform de novo.',
      }),
    ]);
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Conta do Typeform');
    expect(texto).toContain('H4 Typeform');
    expect(texto).toContain('Escola Demo (Typeform)');
    expect(texto).toContain('1 integração usa');
    expect(texto).toContain('Conectada');
    expect(texto).toContain('Precisa de atenção');
    expect(texto).toContain('Conecte o Typeform de novo.');
    const radios = elemento().querySelectorAll<HTMLInputElement>(
      'input[name="conexao-aplicativo"]',
    );
    expect(radios[0].disabled).toBe(false);
    expect(radios[1].disabled).toBe(true);
  });

  it('escolher uma conexão a envia ao assistente; a que já vale vem marcada', async () => {
    fixture = TestBed.createComponent(PassoContaLogin);
    const escolhidas: (ConexaoAplicativo | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    fixture.componentRef.setInput('aplicativo', 'TYPEFORM');
    fixture.componentRef.setInput('selecionadaId', CX);
    fixture.detectChanges();
    responder('TYPEFORM', [conexao()]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe(CX);
    expect(elemento().querySelector('.conexao--marcada')).not.toBeNull();
  });

  it('"Entrar com o Typeform" abre a janela na hora, leva ao diálogo e conclui pela outra janela', async () => {
    await abrir('TYPEFORM', []);
    const escolhidas: (ConexaoAplicativo | null)[] = [];
    fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
    expect(elemento().textContent).toContain('Nenhuma conexão ainda');
    botao('Entrar com o Typeform').click();
    expect(abertas).toEqual(['']);
    const pedido = http.expectOne('/api/v1/conexoes-aplicativo/oauth/iniciar');
    expect(pedido.request.body).toEqual({ aplicativo: 'TYPEFORM', modo: 'janela' });
    pedido.flush({
      conexaoId: NOVA,
      urlDialogo: DIALOGO,
      expiraEm: '',
      enderecoDeRetorno: '',
    });
    await aguardar();
    expect(janela?.location.href).toBe(DIALOGO);
    expect(elemento().querySelector('[data-teste="espera-do-login"]')).not.toBeNull();

    terminarNaOutraJanela({ app: 'typeform', resultado: 'conectado', conexao: NOVA });
    await aguardar();
    responder('TYPEFORM', [conexao({ id: NOVA, nome: 'Conta nova' })]);
    await aguardar();
    expect(escolhidas.at(-1)?.id).toBe(NOVA);
    expect(elemento().textContent).toContain('Conexão feita com o Typeform');
  });

  it('"Conectar de novo" reconecta a conexão existente (modo janela)', async () => {
    await abrir('TYPEFORM', [conexao({ precisaAtencao: true, atencaoMotivo: 'x' })]);
    botao('Conectar de novo').click();
    const pedido = http.expectOne('/api/v1/conexoes-aplicativo/oauth/iniciar');
    expect(pedido.request.body).toEqual({ aplicativo: 'TYPEFORM', conexaoId: CX, modo: 'janela' });
    pedido.flush({ conexaoId: CX, urlDialogo: DIALOGO, expiraEm: '', enderecoDeRetorno: '' });
    await aguardar();
    expect(janela?.location.href).toBe(DIALOGO);
  });

  it('pop-up bloqueado: segue na mesma aba e guarda o contexto', async () => {
    janela = null;
    await abrir('RD_STATION', []);
    botao('Entrar com o RD Station').click();
    const pedido = http.expectOne('/api/v1/conexoes-aplicativo/oauth/iniciar');
    expect(pedido.request.body).toEqual({ aplicativo: 'RD_STATION', modo: 'pagina' });
    pedido.flush({ conexaoId: NOVA, urlDialogo: DIALOGO, expiraEm: '', enderecoDeRetorno: '' });
    await aguardar();
    expect(destino).toEqual([DIALOGO]);
    expect(consumirContextoDoLogin()).toEqual({ integracaoId: 'we9', nome: 'Meu Typeform' });
  });

  it('app não cadastrado: avisa com o link e não deixa entrar; o jeito manual segue possível', async () => {
    await abrir('TYPEFORM', [], { appCadastrado: false });
    const aviso = elemento().querySelector('[data-teste="app-nao-cadastrado"]')!;
    expect(aviso.textContent).toContain('O app do Typeform ainda não foi cadastrado');
    expect(aviso.querySelector('a')?.getAttribute('href')).toBe('/configuracoes/apps-de-login');
    expect(botao('Entrar com o Typeform').disabled).toBe(true);

    // O jeito de hoje (token pessoal) continua à mão.
    const manual = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Colar um token pessoal'))!;
    manual.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.modo()).toBe('MANUAL');
    expect(elemento().querySelector('[data-teste="conta-manual"]')).not.toBeNull();
    expect(elemento().querySelector('[data-teste="app-nao-cadastrado"]')).toBeNull();
  });

  it('o 422 de app não cadastrado também mostra o aviso e fecha a janela', async () => {
    await abrir('RD_STATION', []);
    botao('Entrar com o RD Station').click();
    http.expectOne('/api/v1/conexoes-aplicativo/oauth/iniciar').flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'O app do RD Station ainda não foi cadastrado.',
        detalhes: { appNaoCadastrado: true, aplicativo: 'RD_STATION' },
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await aguardar();
    expect(elemento().querySelector('[data-teste="app-nao-cadastrado"]')).not.toBeNull();
    expect(janela?.close).toHaveBeenCalled();
  });

  it('explica o retorno do login (mesma aba): sucesso, cancelamento e erro com a mensagem só como texto', async () => {
    const base = { app: 'typeform', conexaoId: CX, motivo: null, mensagem: null } as const;
    await abrir('TYPEFORM', [conexao()], { retorno: { ...base, resultado: 'conectado' } });
    expect(elemento().textContent).toContain('Conexão feita com o Typeform');
    fixture.destroy();

    await abrir('TYPEFORM', [conexao()], { retorno: { ...base, resultado: 'cancelado' } });
    expect(elemento().textContent).toContain('Você cancelou o login no Typeform');
    fixture.destroy();

    await abrir('TYPEFORM', [conexao()], {
      retorno: { ...base, resultado: 'erro', motivo: 'servico_recusou', mensagem: '<b>x</b>' },
    });
    const alerta = elemento().querySelector('[role=alert]')!;
    expect(alerta.textContent).toContain('O serviço recusou o acesso');
    expect(alerta.textContent).toContain('<b>x</b>');
    expect(alerta.querySelector('b')).toBeNull();
  });

  it('no modo manual do RD explica o que muda e não mostra a lista de conexões', async () => {
    await abrir('RD_STATION', [conexao({ aplicativo: 'RD_STATION' })]);
    const manual = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Colar o endereço no RD'))!;
    manual.click();
    fixture.detectChanges();
    expect(elemento().querySelector('[data-teste="conta-manual"]')?.textContent).toContain(
      'cola na automação do RD',
    );
    expect(elemento().querySelector('input[name="conexao-aplicativo"]')).toBeNull();
  });

  it('mostra o erro ao carregar e deixa tentar de novo', async () => {
    fixture = TestBed.createComponent(PassoContaLogin);
    fixture.componentRef.setInput('aplicativo', 'TYPEFORM');
    fixture.detectChanges();
    http
      .expectOne('/api/v1/conexoes-aplicativo?aplicativo=TYPEFORM')
      .flush({ mensagem: 'falhou' }, { status: 500, statusText: 'Erro' });
    http.expectOne('/api/v1/configuracoes/apps-de-login').flush([]);
    await aguardar();
    expect(elemento().textContent).toContain('Não conseguimos carregar as conexões');
    botao('Tentar de novo').click();
    responder('TYPEFORM', [conexao()]);
    await aguardar();
    expect(elemento().textContent).toContain('H4 Typeform');
  });

  describe('remover conexão', () => {
    let pedidos: PedidoConfirmacao[];
    let respostas: boolean[];

    beforeEach(() => {
      pedidos = [];
      respostas = [true];
      vi.spyOn(TestBed.inject(ConfirmacaoService), 'confirmar').mockImplementation(
        async (pedido) => {
          pedidos.push(pedido);
          return respostas.shift() ?? false;
        },
      );
    });

    const conflito = (detalhes: Record<string, unknown>, mensagem: string) => ({
      corpo: { statusCode: 409, erro: 'conflito', mensagem, detalhes },
      opcoes: { status: 409, statusText: 'Conflict' },
    });

    it('confirma, chama o DELETE, recarrega e limpa a escolha da conexão removida', async () => {
      fixture = TestBed.createComponent(PassoContaLogin);
      const escolhidas: (ConexaoAplicativo | null)[] = [];
      fixture.componentInstance.escolhida.subscribe((c) => escolhidas.push(c));
      fixture.componentRef.setInput('aplicativo', 'TYPEFORM');
      fixture.componentRef.setInput('selecionadaId', CX);
      fixture.detectChanges();
      responder('TYPEFORM', [conexao()]);
      await aguardar();
      botao('Remover').click();
      await aguardar();
      http.expectOne({ method: 'DELETE', url: `/api/v1/conexoes-aplicativo/${CX}` }).flush(null, {
        status: 204,
        statusText: 'No Content',
      });
      await aguardar();
      responder('TYPEFORM', []);
      await aguardar();
      expect(escolhidas.at(-1)).toBeNull();
      expect(elemento().textContent).toContain('Nenhuma conexão ainda');
    });

    it('409 em uso: mostra a mensagem da API', async () => {
      await abrir('TYPEFORM', [conexao()]);
      botao('Remover').click();
      await aguardar();
      const { corpo, opcoes } = conflito(
        { regra: 'R32.25', integracoes: 1 },
        'Esta conexão é usada por 1 integração(ões): exclua-as antes.',
      );
      http
        .expectOne({ method: 'DELETE', url: `/api/v1/conexoes-aplicativo/${CX}` })
        .flush(corpo, opcoes);
      await aguardar();
      expect(elemento().querySelector('[data-teste="erro-remocao"]')?.textContent).toContain(
        'usada por 1 integração',
      );
    });

    it('409 com pendências: lista os webhooks e, no segundo passo, remove com descartarPendencias=true', async () => {
      respostas = [true, true];
      await abrir('TYPEFORM', [conexao()]);
      botao('Remover').click();
      await aguardar();
      const { corpo, opcoes } = conflito(
        {
          regra: 'R32.26',
          pendencias: [
            {
              integracaoId: 'i1',
              nome: 'Formulário de matrícula',
              aplicativo: 'TYPEFORM',
              webhookId: 'crm-i1',
            },
          ],
        },
        'O CRM ainda não conseguiu remover 1 webhook(s).',
      );
      http
        .expectOne({ method: 'DELETE', url: `/api/v1/conexoes-aplicativo/${CX}` })
        .flush(corpo, opcoes);
      await aguardar();
      expect(pedidos).toHaveLength(2);
      expect(pedidos[1].confirmar).toBe('Remover mesmo assim');
      expect(pedidos[1].detalhes).toEqual(['Formulário de matrícula (id crm-i1)']);
      expect(pedidos[1].mensagem).toContain('à mão');
      http
        .expectOne({
          method: 'DELETE',
          url: `/api/v1/conexoes-aplicativo/${CX}?descartarPendencias=true`,
        })
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardar();
      responder('TYPEFORM', []);
      await aguardar();
      expect(elemento().textContent).toContain('Nenhuma conexão ainda');
    });

    it('409 com pendências e o usuário desiste no segundo passo: nada mais é chamado', async () => {
      respostas = [true, false];
      await abrir('TYPEFORM', [conexao()]);
      botao('Remover').click();
      await aguardar();
      const { corpo, opcoes } = conflito(
        { regra: 'R32.26', pendencias: [{ integracaoId: 'i1', nome: 'Form', webhookId: null }] },
        'Pendências.',
      );
      http
        .expectOne({ method: 'DELETE', url: `/api/v1/conexoes-aplicativo/${CX}` })
        .flush(corpo, opcoes);
      await aguardar();
      expect(pedidos).toHaveLength(2);
      expect(elemento().querySelectorAll('li.conexao')).toHaveLength(1);
    });
  });
});
