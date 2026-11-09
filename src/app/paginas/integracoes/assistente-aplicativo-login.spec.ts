import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { AssistenteAplicativo } from './assistente-aplicativo';
import {
  APLICATIVO_ELEMENTOR,
  APLICATIVO_TYPEFORM,
  CATALOGO,
  FUNIS,
  microtarefas,
  pagina,
  USUARIOS,
  webhookEntrada,
} from './dados-de-teste';
import type { ConexaoAplicativo } from './login/login.tipos';
import type { AplicativoDoCatalogo, WebhookEntrada } from './tipos';

const CX_TF = '77777777-7777-4777-8777-777777777777';
const CX_RD = '88888888-8888-4888-8888-888888888888';

const TYPEFORM_LOGIN: AplicativoDoCatalogo = { ...APLICATIVO_TYPEFORM, login: 'TYPEFORM' };
const RD: AplicativoDoCatalogo = {
  ...APLICATIVO_ELEMENTOR,
  aplicativo: 'RD_STATION',
  nome: 'RD Station',
  descricao: 'Receba as conversões do RD Station.',
  autenticidade: {
    tipo: 'CABECALHO_FIXO',
    descricao: 'Uma chave no cabeçalho.',
    segredo: 'OPCIONAL',
    rotuloDoSegredo: 'Chave do RD',
    cabecalho: 'X-RD-Chave',
  },
  credencial: null,
  buscaCampos: true,
  escolheFormulario: false,
  login: 'RD_STATION',
};

function conta(id: string, aplicativo: 'TYPEFORM' | 'RD_STATION', nome: string): ConexaoAplicativo {
  return {
    id,
    aplicativo,
    nome,
    conta: `Conta de ${nome}`,
    conectada: true,
    conectadaEm: '2026-11-05T12:00:00Z',
    expiraEm: '2026-11-12T12:00:00Z',
    integracoes: 0,
    precisaAtencao: false,
    atencaoMotivo: null,
    criadoEm: '2026-11-05T11:00:00Z',
  };
}

function appDeLogin(aplicativo: string) {
  return {
    aplicativo,
    nome: aplicativo,
    configurado: true,
    clientId: 'id',
    segredoMascarado: '••••',
    enderecoDeRetorno: 'https://crm/retorno',
    emUso: { conexoes: 0, canais: 0, integracoes: 0 },
    escopos: [],
    webhook: null,
    atualizadoEm: null,
    atualizadoPor: null,
  };
}

describe('AssistenteAplicativo: Typeform e RD Station por login (R32.25 e R32.26)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AssistenteAplicativo>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

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

  function campo(rotulo: string): HTMLInputElement {
    const id = Array.from(elemento().querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith(rotulo))
      ?.getAttribute('for');
    return elemento().querySelector<HTMLInputElement>(`#${id}`)!;
  }

  function digitar(entrada: HTMLInputElement, valor: string): void {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
  }

  function escolherOpcao(texto: string): void {
    const radio = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('app-grupo-opcoes input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes(texto))!;
    radio.click();
    fixture.detectChanges();
  }

  function passoAtual(): string {
    return (
      elemento().querySelector('[aria-current="step"]')?.textContent?.replace(/\s+/g, ' ').trim() ??
      ''
    );
  }

  const passos = () =>
    Array.from(elemento().querySelectorAll('.assistente__nome-passo')).map((e) =>
      e.textContent?.trim(),
    );

  async function abrir(app: AplicativoDoCatalogo, integracao: WebhookEntrada | null = null) {
    fixture = TestBed.createComponent(AssistenteAplicativo);
    fixture.componentRef.setInput('aplicativo', app);
    fixture.componentRef.setInput('integracao', integracao);
    fixture.componentRef.setInput('destinos', CATALOGO.destinos);
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/funis').flush(FUNIS);
    http.expectOne('/api/v1/usuarios?ativo=true&porPagina=100').flush(pagina(USUARIOS));
    await aguardar();
  }

  /** O passo "Conta" carrega as conexões do aplicativo e a situação do app de login. */
  async function responderConta(
    aplicativo: 'TYPEFORM' | 'RD_STATION',
    conexoes: readonly ConexaoAplicativo[],
  ) {
    http.expectOne(`/api/v1/conexoes-aplicativo?aplicativo=${aplicativo}`).flush(conexoes);
    http.expectOne('/api/v1/configuracoes/apps-de-login').flush([appDeLogin(aplicativo)]);
    await aguardar();
  }

  async function esvaziarRecebidos() {
    for (const pedido of http.match((r) => r.url.includes('/campos-recebidos'))) {
      pedido.flush({ campos: [], recebimentosLidos: 0, ultimoRecebimentoEm: null });
    }
    await aguardar();
  }

  it('Typeform com login: o passo "Conta" vem antes e o token pessoal some do passo "Ação e nome"', async () => {
    await abrir(TYPEFORM_LOGIN);
    expect(passos()).toEqual([
      'Começar',
      'Conta',
      'Ação e nome',
      'Formulário',
      'Mapeamento',
      'Configurações',
      'Salvar',
    ]);
    botao('Começar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Conta');
    await responderConta('TYPEFORM', [conta(CX_TF, 'TYPEFORM', 'H4 Typeform')]);

    // Sem escolher a conta, não avança.
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Escolha uma conta conectada');
    elemento().querySelector<HTMLInputElement>('input[name="conexao-aplicativo"]')!.click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Ação e nome');
    expect(elemento().querySelector('[data-teste="conta-escolhida"]')?.textContent).toContain(
      'H4 Typeform',
    );
    expect(elemento().textContent).not.toContain('Credencial');
    expect(elemento().textContent).not.toContain('Personal token');

    digitar(campo('Nome da integração'), 'Typeform — matrículas');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).toMatchObject({
      aplicativo: 'TYPEFORM',
      ativo: false,
      configuracao: { conexaoId: CX_TF },
    });
    expect(criar.request.body).not.toHaveProperty('credencial');
    criar.flush({
      webhook: webhookEntrada({
        id: 'we-tf',
        aplicativo: 'TYPEFORM',
        aplicativoNome: 'Typeform',
        ativo: false,
        configuracao: { conexaoId: CX_TF },
      }),
      url: 'http://x/api/v1/webhooks/entrada/inutil',
    });
    await aguardar();
    await esvaziarRecebidos();
    expect(passoAtual()).toContain('Formulário');
    http
      .expectOne('/api/v1/webhooks/entradas/we-tf/formularios')
      .flush([{ id: 'aB3dE5gH', titulo: 'Matrículas 2027', url: 'https://x', atualizadoEm: null }]);
    await aguardar();
    expect(elemento().textContent).toContain('Escolha o formulário');
  });

  it('Typeform: "Colar um token pessoal" traz a credencial de volta e não manda conexão', async () => {
    await abrir(TYPEFORM_LOGIN);
    botao('Começar').click();
    fixture.detectChanges();
    await responderConta('TYPEFORM', [conta(CX_TF, 'TYPEFORM', 'H4 Typeform')]);
    escolherOpcao('Colar um token pessoal');
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Ação e nome');
    expect(elemento().textContent).toContain('Credencial');
    digitar(campo('Personal token'), 'tfp_abc123');
    digitar(campo('Nome da integração'), 'Typeform — matrículas');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).toMatchObject({
      aplicativo: 'TYPEFORM',
      credencial: { token: 'tfp_abc123' },
    });
    expect(criar.request.body).not.toHaveProperty('configuracao');
    criar.flush({
      webhook: webhookEntrada({ id: 'we-tf', aplicativo: 'TYPEFORM', ativo: false }),
      url: 'http://x/api/v1/webhooks/entrada/inutil',
    });
    await aguardar();
    await esvaziarRecebidos();
    http.expectOne('/api/v1/webhooks/entradas/we-tf/formularios').flush([]);
    await aguardar();
  });

  it('o catálogo sem "login" mantém o Typeform como antes (token no passo "Ação e nome", sem passo "Conta")', async () => {
    await abrir(APLICATIVO_TYPEFORM);
    expect(passos()).not.toContain('Conta');
  });

  it('RD com login: passos com "Gatilho", webhook sem endereço, busca de campos e erro com "Tentar de novo"', async () => {
    await abrir(RD);
    expect(passos()).toEqual([
      'Começar',
      'Conta',
      'Ação e nome',
      'Gatilho',
      'Mapeamento',
      'Configurações',
      'Salvar',
    ]);
    botao('Começar').click();
    fixture.detectChanges();
    await responderConta('RD_STATION', [conta(CX_RD, 'RD_STATION', 'H4 RD')]);
    elemento().querySelector<HTMLInputElement>('input[name="conexao-aplicativo"]')!.click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();

    // Com o login, o CRM cria o webhook e protege o endereço: nada de "Segurança" aqui.
    expect(elemento().textContent).not.toContain('Assinatura das chamadas');
    digitar(campo('Nome da integração'), 'RD — matrículas');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).toMatchObject({
      aplicativo: 'RD_STATION',
      ativo: false,
      configuracao: { conexaoId: CX_RD, gatilho: 'CONVERSAO', conversoes: [] },
    });
    const noRd = webhookEntrada({
      id: 'we-rd',
      aplicativo: 'RD_STATION',
      aplicativoNome: 'RD Station',
      ativo: false,
      modeloMapeamento: 'DO_APLICATIVO',
      configuracao: { conexaoId: CX_RD, gatilho: 'CONVERSAO', conversoes: [] },
    });
    criar.flush({ webhook: noRd, url: 'http://x/api/v1/webhooks/entrada/inutil' });
    await aguardar();
    await esvaziarRecebidos();

    // Gatilho: nenhuma chamada ao endereço; escolhe oportunidade e grava.
    expect(passoAtual()).toContain('Gatilho');
    expect(elemento().textContent).toContain('Gatilho no RD Station');
    escolherOpcao('Oportunidade');
    expect(elemento().textContent).not.toContain('Conversões específicas');
    botao('Continuar').click();
    const gatilho = http.expectOne('/api/v1/webhooks/entradas/we-rd');
    expect(gatilho.request.method).toBe('PATCH');
    expect(gatilho.request.body).toEqual({
      configuracao: { gatilho: 'OPORTUNIDADE', conversoes: [] },
    });
    gatilho.flush({
      ...noRd,
      configuracao: { conexaoId: CX_RD, gatilho: 'OPORTUNIDADE', conversoes: [] },
    });
    await aguardar();
    await esvaziarRecebidos();
    expect(passoAtual()).toContain('Mapeamento');
    expect(elemento().textContent).toContain('Buscar campos do RD Station');

    botao('Buscar campos do RD Station').click();
    http.expectOne('/api/v1/webhooks/entradas/we-rd/buscar-campos').flush({
      campos: [{ caminho: 'cf_escola', rotulo: 'Escola', tipo: 'texto' }],
      buscadosEm: '2026-11-05T12:00:00Z',
    });
    await aguardar();
    expect(elemento().textContent).toContain('1 campos buscados na ferramenta.');

    botao('Continuar').click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Salvar');
    expect(elemento().textContent).toContain('Oportunidade');

    // O RD recusou o webhook: a integração foi salva, o assistente fica aberto com o erro.
    botao('Salvar e ativar').click();
    const salvar = http.expectOne('/api/v1/webhooks/entradas/we-rd');
    expect(salvar.request.body).toMatchObject({ ativo: true });
    const comErro = {
      ...noRd,
      ativo: true,
      configuracao: {
        conexaoId: CX_RD,
        gatilho: 'OPORTUNIDADE',
        conversoes: [],
        webhookErro: 'O RD Station não conseguiu chamar o endereço.',
      },
    } as WebhookEntrada;
    salvar.flush(comErro);
    await aguardar();
    expect(fixture.componentInstance.aberto()).toBe(true);
    const alerta = elemento().querySelector('[data-teste="erro-do-webhook"]')!;
    expect(alerta.textContent).toContain('O RD Station não conseguiu chamar o endereço.');

    // "Tentar de novo": POST sincronizar, depois relê a integração e fecha.
    botao('Tentar de novo').click();
    const sincronizar = http.expectOne('/api/v1/webhooks/entradas/we-rd/sincronizar');
    expect(sincronizar.request.method).toBe('POST');
    sincronizar.flush({ registrado: true, erro: null });
    await aguardar();
    http.expectOne('/api/v1/webhooks/entradas/we-rd').flush({
      ...comErro,
      configuracao: {
        conexaoId: CX_RD,
        gatilho: 'OPORTUNIDADE',
        conversoes: [],
        webhookRegistrado: { em: '2026-11-05T12:00:00Z', uuid: 'u1', gatilho: 'OPORTUNIDADE' },
      },
    });
    await aguardar();
    expect(fixture.componentInstance.aberto()).toBe(false);
  });

  it('RD manual: o endereço volta, sem gatilho e sem buscar campos pela API', async () => {
    await abrir(RD);
    botao('Começar').click();
    fixture.detectChanges();
    await responderConta('RD_STATION', []);
    escolherOpcao('Colar o endereço no RD');
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Assinatura das chamadas');
    digitar(campo('Nome da integração'), 'RD manual');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).not.toHaveProperty('configuracao');
    criar.flush({
      webhook: webhookEntrada({
        id: 'we-rdm',
        aplicativo: 'RD_STATION',
        ativo: false,
        modeloMapeamento: 'DO_APLICATIVO',
      }),
      url: 'http://localhost:4200/api/v1/webhooks/entrada/ABCDEFGH1234',
    });
    await aguardar();
    await esvaziarRecebidos();
    expect(passoAtual()).toContain('Endereço');
    expect(elemento().querySelector('output')?.textContent).toContain('ABCDEFGH1234');
    botao('Continuar').click();
    fixture.detectChanges();
    await esvaziarRecebidos();
    expect(elemento().textContent).not.toContain('Buscar campos do RD Station');
  });

  it('editar uma integração do RD com conexão reabre no login, com a conta carregada', async () => {
    const existente = webhookEntrada({
      id: 'we-rd',
      aplicativo: 'RD_STATION',
      aplicativoNome: 'RD Station',
      modeloMapeamento: 'DO_APLICATIVO',
      configuracao: { conexaoId: CX_RD, gatilho: 'CONVERSAO', conversoes: ['matricula'] },
    });
    await abrir(RD, existente);
    http
      .expectOne(`/api/v1/conexoes-aplicativo/${CX_RD}`)
      .flush(conta(CX_RD, 'RD_STATION', 'H4 RD'));
    await aguardar();
    for (const pedido of http.match((r) => r.url.includes('/campos-recebidos'))) {
      pedido.flush({ campos: [], recebimentosLidos: 0, ultimoRecebimentoEm: null });
    }
    expect(passos()).toContain('Gatilho');
    // O passo "Gatilho" mostra as conversões salvas.
    const botaoGatilho = Array.from(
      elemento().querySelectorAll<HTMLButtonElement>('button.assistente__passo-botao'),
    ).find((b) => b.textContent?.includes('Gatilho'))!;
    botaoGatilho.click();
    fixture.detectChanges();
    expect(campo('Conversões específicas').value).toBe('matricula');
  });

  it('editar um RD manual e escolher "Entrar com o RD Station" avisa para apagar o webhook antigo no RD', async () => {
    const manual = webhookEntrada({
      id: 'we-rd-manual',
      aplicativo: 'RD_STATION',
      aplicativoNome: 'RD Station',
      modeloMapeamento: 'DO_APLICATIVO',
      configuracao: {},
    });
    await abrir(RD, manual);
    await esvaziarRecebidos();
    const botaoConta = Array.from(
      elemento().querySelectorAll<HTMLButtonElement>('button.assistente__passo-botao'),
    ).find((b) => b.textContent?.includes('Conta'))!;
    botaoConta.click();
    fixture.detectChanges();
    await responderConta('RD_STATION', []);
    const aviso = () => elemento().querySelector('[data-teste="aviso-webhook-manual"]');
    // Manual: nada a avisar.
    expect(aviso()).toBeNull();
    escolherOpcao('Entrar com o RD Station');
    expect(aviso()?.textContent).toContain('apague o webhook antigo');
    escolherOpcao('Colar o endereço no RD');
    expect(aviso()).toBeNull();
  });
});
