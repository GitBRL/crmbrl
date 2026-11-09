import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import {
  AssistenteAplicativo,
  DESTINO_DO_CONTATO,
  DESTINO_DO_NEGOCIO,
  juntarDestino,
  lerExemplo,
  separarDestino,
  separarEtiquetas,
} from './assistente-aplicativo';
import {
  APLICATIVO_ELEMENTOR,
  APLICATIVO_FACEBOOK,
  APLICATIVO_HOTMART_COM_EVENTOS,
  CONEXAO_FACEBOOK,
  APLICATIVO_TYPEFORM,
  APLICATIVO_WEBHOOK,
  CATALOGO,
  FUNIS,
  integracaoElementor,
  microtarefas,
  MODELOS,
  pagina,
  USUARIOS,
  webhookEntrada,
} from './dados-de-teste';
import type { AplicativoDoCatalogo, WebhookEntrada } from './tipos';

describe('apoio do assistente', () => {
  it('separa etiquetas por vírgula, sem vazios nem repetidas', () => {
    expect(separarEtiquetas(' Landing, Black Friday ,landing,, ')).toEqual([
      'Landing',
      'Black Friday',
    ]);
    expect(separarEtiquetas('')).toEqual([]);
  });

  it('aceita só objeto JSON no exemplo e explica o erro', () => {
    expect(lerExemplo('{"name":"Ana"}')).toEqual({ valor: { name: 'Ana' } });
    expect(lerExemplo('[1]')).toEqual({ erro: expect.stringContaining('objeto JSON') });
    expect(lerExemplo('{name: Ana}')).toEqual({ erro: expect.stringContaining('não é um JSON') });
    expect(lerExemplo('  ')).toEqual({ erro: expect.stringContaining('Cole') });
  });

  it('separa e junta os destinos de campo personalizado (contato e negócio)', () => {
    expect(separarDestino('nome')).toEqual({ destino: 'nome', chave: '' });
    expect(separarDestino('camposPersonalizados.cidade')).toEqual({
      destino: DESTINO_DO_CONTATO,
      chave: 'cidade',
    });
    expect(separarDestino('negocio.camposPersonalizados.curso')).toEqual({
      destino: DESTINO_DO_NEGOCIO,
      chave: 'curso',
    });
    expect(juntarDestino({ destino: DESTINO_DO_CONTATO, chave: ' cidade ' })).toBe(
      'camposPersonalizados.cidade',
    );
    expect(juntarDestino({ destino: DESTINO_DO_NEGOCIO, chave: 'curso' })).toBe(
      'negocio.camposPersonalizados.curso',
    );
    expect(juntarDestino({ destino: 'email', chave: '' })).toBe('email');
  });
});

describe('AssistenteAplicativo (um aplicativo, em passos)', () => {
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

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!achado) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return achado;
  }

  /** Os passos viram botões na edição (o nome fica num span próprio, ao lado do número). */
  function passo(nome: string): HTMLButtonElement {
    const achado = Array.from(
      elemento().querySelectorAll<HTMLButtonElement>('button.assistente__passo-botao'),
    ).find((item) => item.querySelector('.assistente__nome-passo')?.textContent?.trim() === nome);
    if (!achado) {
      throw new Error(`Passo "${nome}" não encontrado`);
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

  async function aguardar(): Promise<void> {
    await microtarefas();
    fixture.detectChanges();
  }

  async function abrir(
    app: AplicativoDoCatalogo,
    integracao: WebhookEntrada | null = null,
    funilInicial: string | null = null,
  ) {
    fixture = TestBed.createComponent(AssistenteAplicativo);
    fixture.componentRef.setInput('aplicativo', app);
    fixture.componentRef.setInput('integracao', integracao);
    fixture.componentRef.setInput('destinos', CATALOGO.destinos);
    fixture.componentRef.setInput('funilInicial', funilInicial);
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/funis').flush(FUNIS);
    http.expectOne('/api/v1/usuarios?ativo=true&porPagina=100').flush(pagina(USUARIOS));
    if (app.aplicativo === 'WEBHOOK') {
      http.expectOne('/api/v1/webhooks/entradas/modelos').flush(MODELOS);
    }
    await aguardar();
  }

  function passoAtual(): string {
    return (
      elemento().querySelector('[aria-current="step"]')?.textContent?.replace(/\s+/g, ' ').trim() ??
      ''
    );
  }

  it('começa pelo "Começar": o que faz e o passo a passo da ferramenta, vindos da API', async () => {
    await abrir(APLICATIVO_ELEMENTOR);
    expect(passoAtual()).toContain('Começar');
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('O que esta integração faz');
    expect(texto).toContain('No Elementor');
    expect(texto).toContain('Adicione a ação "Webhook" ao formulário.');
    expect(elemento().querySelector('app-logotipo-aplicativo img')?.getAttribute('src')).toBe(
      '/assets/integracoes/elementor.svg',
    );
    // Na criação, os passos seguintes ainda não são botões.
    expect(elemento().querySelectorAll('button.assistente__passo-botao')).toHaveLength(0);
  });

  it('o funil vem do funil de origem, quando há (Nova integração nas configurações do funil)', async () => {
    await abrir(APLICATIVO_ELEMENTOR, null, 'f-com');
    botao('Começar').click();
    fixture.detectChanges();
    botao('Criar e continuar').click();
    fixture.detectChanges();
    const nome = campo('Nome da integração');
    expect(nome.value).toBe('Elementor — ');
    digitar(nome, 'Elementor — site');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body.funilId).toBe('f-com');
    expect(criar.request.body.etapaId).toBe('c-novo');
    criar.flush({
      webhook: integracaoElementor({ ativo: false }),
      url: 'http://x/api/v1/webhooks/entrada/tok',
    });
    await aguardar();
    http.expectOne('/api/v1/webhooks/entradas/we-el/campos-recebidos?limite=20').flush({
      campos: [],
      recebimentosLidos: 0,
      ultimoRecebimentoEm: null,
    });
    await aguardar();
  });

  it('cria inativa ao sair de "Ação e nome", mostra o endereço, mapeia e salva ativando', async () => {
    await abrir(APLICATIVO_ELEMENTOR);
    const criados: unknown[] = [];
    fixture.componentInstance.criado.subscribe((c) => criados.push(c));
    botao('Começar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Ação e nome');

    // Sem nome não avança.
    digitar(campo('Nome da integração'), '');
    botao('Criar e continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Dê um nome à integração.');
    expect(passoAtual()).toContain('Ação e nome');

    digitar(campo('Nome da integração'), 'Elementor — Black Friday');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.method).toBe('POST');
    expect(criar.request.body).toMatchObject({
      nome: 'Elementor — Black Friday',
      aplicativo: 'ELEMENTOR',
      alvo: 'NEGOCIO',
      modo: 'CRIAR_OU_ATUALIZAR',
      ativo: false,
      modeloMapeamento: 'DO_APLICATIVO',
    });
    criar.flush({
      webhook: integracaoElementor({ nome: 'Elementor — Black Friday', ativo: false }),
      url: 'http://localhost:4200/api/v1/webhooks/entrada/ABCDEFGH1234',
    });
    await aguardar();
    http.expectOne('/api/v1/webhooks/entradas/we-el/campos-recebidos?limite=20').flush({
      campos: [],
      recebimentosLidos: 0,
      ultimoRecebimentoEm: null,
    });
    await aguardar();
    expect(criados).toHaveLength(1);
    expect(passoAtual()).toContain('Endereço');
    expect(elemento().querySelector('output')?.textContent).toContain(
      '/webhooks/entrada/ABCDEFGH1234',
    );

    // Mapeamento: o que chegou aparece à esquerda; escolher o destino vira personalizado.
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Mapeamento');
    http.expectOne('/api/v1/webhooks/entradas/we-el/campos-recebidos?limite=20').flush({
      campos: [
        { caminho: 'name', tipo: 'texto', exemplo: 'Ma…', ocorrencias: 3 },
        { caminho: 'cidade', tipo: 'texto', exemplo: 'Sã…', ocorrencias: 3 },
      ],
      recebimentosLidos: 3,
      ultimoRecebimentoEm: '2026-11-04T12:00:00Z',
    });
    await aguardar();
    const caminhos = Array.from(elemento().querySelectorAll('.linha-mapa__caminho')).map((c) =>
      c.textContent?.trim(),
    );
    expect(caminhos).toContain('cidade');
    expect(elemento().textContent).toContain('ex.: Sã…');
    const linhaCidade = Array.from(elemento().querySelectorAll('.linha-mapa')).find(
      (l) => l.querySelector('.linha-mapa__caminho')?.textContent?.trim() === 'cidade',
    )!;
    const seletor = linhaCidade.querySelector<HTMLSelectElement>('select')!;
    const opcao = Array.from(seletor.options).find(
      (o) => o.textContent?.trim() === 'Campo personalizado do contato…',
    )!;
    seletor.value = opcao.value;
    seletor.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    digitar(linhaCidade.querySelector<HTMLInputElement>('input')!, 'cidade_lead');
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Voltar ao modelo');
    expect(elemento().textContent).not.toContain('Campo personalizado do contato…Campo');

    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Configurações');
    expect(elemento().textContent).toContain('Status inicial');
    expect(elemento().textContent).toContain('Quem fica com o lead');
    digitar(campo('Etiquetas fixas'), 'Landing, Black Friday');
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Salvar');
    botao('Salvar e ativar').click();
    const salvar = http.expectOne('/api/v1/webhooks/entradas/we-el');
    expect(salvar.request.method).toBe('PATCH');
    expect(salvar.request.body).toMatchObject({
      ativo: true,
      alvo: 'NEGOCIO',
      funilId: 'f-mkt',
      etapaId: 'e-novo',
      statusInicial: 'ABERTO',
      estrategia: 'RODIZIO',
      modeloMapeamento: 'PERSONALIZADO',
      etiquetasFixas: ['Landing', 'Black Friday'],
    });
    expect(salvar.request.body.mapeamento.campos).toContainEqual({
      caminho: 'cidade',
      destino: 'camposPersonalizados.cidade_lead',
    });
    expect(salvar.request.body.mapeamento.campos).toContainEqual({
      caminho: 'name',
      destino: 'nome',
    });
    const salvos: WebhookEntrada[] = [];
    fixture.componentInstance.salvo.subscribe((s) => salvos.push(s));
    salvar.flush(integracaoElementor({ nome: 'Elementor — Black Friday' }));
    await aguardar();
    expect(fixture.componentInstance.aberto()).toBe(false);
    expect(salvos).toHaveLength(1);
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('criada e ativa');
  });

  it('nome repetido (409) volta para o passo "Ação e nome", no campo', async () => {
    await abrir(APLICATIVO_ELEMENTOR);
    botao('Começar').click();
    fixture.detectChanges();
    digitar(campo('Nome da integração'), 'H1 Elementor');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    http.expectOne('/api/v1/webhooks/entradas').flush(
      {
        statusCode: 409,
        erro: 'conflito',
        mensagem: 'Já existe uma integração com esse nome.',
        requisicaoId: 'r',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await aguardar();
    expect(passoAtual()).toContain('Ação e nome');
    expect(elemento().textContent).toContain('Já existe uma integração com esse nome.');
  });

  it('credencial: "Testar" confere sem gravar e mostra o resultado', async () => {
    await abrir(APLICATIVO_TYPEFORM);
    botao('Começar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Credencial');
    // Sem a credencial, não avança.
    digitar(campo('Nome da integração'), 'Typeform — matrículas');
    fixture.detectChanges();
    botao('Criar e continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Preencha: Personal token.');

    digitar(campo('Personal token'), 'tfp_abc123');
    fixture.detectChanges();
    botao('Testar').click();
    const teste = http.expectOne('/api/v1/webhooks/entradas/testar-credencial');
    expect(teste.request.body).toEqual({
      aplicativo: 'TYPEFORM',
      credencial: { token: 'tfp_abc123' },
    });
    teste.flush({ valida: true, mensagem: 'Conta Escola Demo.' });
    await aguardar();
    expect(elemento().textContent).toContain('Funcionou. Conta Escola Demo.');
  });

  it('Webhook: oferece o segredo opcional e o formato do envio', async () => {
    await abrir(APLICATIVO_WEBHOOK);
    botao('Começar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Assinatura das chamadas');
    expect(elemento().textContent).toContain('Gerar um segredo');
  });

  it('edição reabre todos os passos e carrega o mapeamento salvo', async () => {
    await abrir(
      APLICATIVO_ELEMENTOR,
      integracaoElementor({
        modeloMapeamento: 'PERSONALIZADO',
        mapeamento: {
          campos: [
            { caminho: 'name', destino: 'nome' },
            { caminho: 'email', destino: 'email' },
            { caminho: 'cidade', destino: 'camposPersonalizados.cidade_lead' },
          ],
          ignorarQuando: [],
        },
        etiquetasFixas: ['h1'],
      }),
    );
    expect(elemento().querySelectorAll('button.assistente__passo-botao')).toHaveLength(6);
    expect(elemento().querySelector('.modal__titulo, h2')?.textContent).toContain(
      'Editar integração',
    );
    passo('Mapeamento').click();
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas/we-el/campos-recebidos?limite=20').flush({
      campos: [],
      recebimentosLidos: 0,
      ultimoRecebimentoEm: null,
    });
    await aguardar();
    const linhas = Array.from(elemento().querySelectorAll('.linha-mapa'));
    expect(linhas).toHaveLength(3);
    const cidade = linhas.find(
      (l) => l.querySelector('.linha-mapa__caminho')?.textContent?.trim() === 'cidade',
    )!;
    expect(
      cidade.querySelector<HTMLSelectElement>('select')!.selectedOptions[0].textContent,
    ).toContain('Campo personalizado do contato');
    expect(cidade.querySelector<HTMLInputElement>('input')!.value).toBe('cidade_lead');
    passo('Configurações').click();
    fixture.detectChanges();
    expect(campo('Etiquetas fixas').value).toBe('h1');
  });

  it('integração antiga: explica que o endereço não pode ser mostrado e oferece gerar outro', async () => {
    await abrir(
      { ...APLICATIVO_WEBHOOK },
      webhookEntrada({ id: 'we-antiga', nome: 'Landing antiga', enderecoDisponivel: false }),
    );
    passo('Endereço').click();
    fixture.detectChanges();
    const aviso = elemento().querySelector('[data-teste="endereco-antigo"]')!;
    expect(aviso.textContent).toContain('antiga');
    expect(aviso.textContent).toContain('Gerar novo endereço');
    // Nenhuma chamada a /endereco: a API responderia 422.
    http.expectNone('/api/v1/webhooks/entradas/we-antiga/endereco');
  });

  it('com status inicial perdido, o motivo padrão passa a ser obrigatório', async () => {
    await abrir(APLICATIVO_ELEMENTOR, integracaoElementor());
    passo('Configurações').click();
    fixture.detectChanges();
    const perdido = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Perdido'))!;
    perdido.click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Informe o motivo de perda padrão');
    expect(passoAtual()).toContain('Configurações');
  });

  function escolher(rotulo: string, texto: string): void {
    const seletor = Array.from(elemento().querySelectorAll('app-seletor')).find((s) =>
      s.textContent?.replace(/\s+/g, ' ').includes(rotulo),
    )!;
    const selecao = seletor.querySelector<HTMLSelectElement>('select')!;
    const opcao = Array.from(selecao.options).find((o) => o.textContent?.trim().startsWith(texto))!;
    selecao.value = opcao.value;
    selecao.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('Facebook: Conexão antes de tudo; a integração só nasce depois da página e do formulário', async () => {
    await abrir(APLICATIVO_FACEBOOK);
    expect(
      Array.from(elemento().querySelectorAll('.assistente__nome-passo')).map((e) =>
        e.textContent?.trim(),
      ),
    ).toEqual([
      'Começar',
      'Conexão',
      'Ação e nome',
      'Página e formulário',
      'Mapeamento',
      'Configurações',
      'Salvar',
    ]);
    botao('Começar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Conexão');
    http.expectOne('/api/v1/webhooks/facebook/conexoes').flush([CONEXAO_FACEBOOK]);
    http.expectOne('/api/v1/webhooks/facebook/configuracao').flush({
      appCadastrado: true,
      enderecoDeRetorno: 'https://crm.exemplo.com.br/api/v1/publico/facebook/oauth/retorno',
      escopos: [],
      versaoDaGraph: 'v24.0',
      enderecoPublicoHttps: true,
    });
    await aguardar();

    // Sem escolher a conexão, não avança.
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Escolha uma conexão com o Facebook');
    elemento().querySelector<HTMLInputElement>('input[name="conexao-facebook"]')!.click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Ação e nome');

    // "Ação e nome" não cria nada: a API exige conexão, página e formulário.
    digitar(campo('Nome da integração'), 'Facebook — matrículas');
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Página e formulário');
    http.expectNone('/api/v1/webhooks/entradas');
    botao('Criar e continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Escolha a página e o formulário de leads.');

    escolher('Página do Facebook', 'Escola Demo BRL');
    http.expectOne('/api/v1/webhooks/facebook/conexoes/cx1/paginas/p1/formularios').flush([
      {
        id: 'f1',
        nome: 'Interesse 2027',
        status: 'ACTIVE',
        idioma: 'pt_BR',
        criadoEm: null,
        leads: 10,
      },
    ]);
    await aguardar();
    escolher('Formulário de leads', 'Interesse 2027');
    botao('Criar e continuar').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).toMatchObject({
      aplicativo: 'FACEBOOK_LEAD_ADS',
      nome: 'Facebook — matrículas',
      ativo: false,
      configuracao: { conexaoId: 'cx1', paginaId: 'p1', formularioId: 'f1' },
    });
    criar.flush({
      webhook: webhookEntrada({
        id: 'we-fb',
        aplicativo: 'FACEBOOK_LEAD_ADS',
        aplicativoNome: 'Facebook Lead Ads',
        ativo: false,
        configuracao: { conexaoId: 'cx1', paginaId: 'p1', formularioId: 'f1' },
      }),
      url: 'http://x/api/v1/webhooks/entrada/inutil',
    });
    await aguardar();
    http.expectOne('/api/v1/webhooks/entradas/we-fb/campos-recebidos?limite=20').flush({
      campos: [],
      recebimentosLidos: 0,
      ultimoRecebimentoEm: null,
    });
    await aguardar();
    expect(passoAtual()).toContain('Mapeamento');
    // As perguntas do formulário são buscadas na Meta ao entrar no mapeamento.
    http.expectOne('/api/v1/webhooks/entradas/we-fb/buscar-campos').flush({
      campos: [{ caminho: 'cidade', rotulo: 'Cidade', tipo: 'texto' }],
      buscadosEm: '2026-11-04T12:00:00Z',
    });
    await aguardar();
    expect(elemento().textContent).toContain('1 perguntas e dados do lead buscados no formulário.');
    expect(elemento().textContent).toContain('Buscar perguntas do formulário');
  });

  it('plataforma de curso: passo Eventos com a tabela salva; perda sem motivo exige o motivo padrão', async () => {
    await abrir(
      APLICATIVO_HOTMART_COM_EVENTOS,
      webhookEntrada({
        id: 'we-ht',
        nome: 'Hotmart — cursos',
        aplicativo: 'HOTMART',
        aplicativoNome: 'Hotmart',
        funil: { id: 'f-com', nome: 'Comercial', area: 'COMERCIAL' },
        etapa: { id: 'c-novo', nome: 'Novo', tipo: 'ABERTA' },
        configuracao: {
          produtos: ['Curso A'],
          eventos: { PURCHASE_BILLET_PRINTED: { acao: 'IGNORAR' } },
        },
      }),
    );
    expect(elemento().querySelectorAll('button.assistente__passo-botao')).toHaveLength(7);
    passo('Eventos').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('O que fazer em cada evento');
    expect(
      elemento()
        .querySelector('[data-evento="PURCHASE_BILLET_PRINTED"] select')
        ?.querySelector('option:checked')
        ?.textContent?.trim(),
    ).toBe('Ignorar');
    expect(elemento().querySelector<HTMLInputElement>('.eventos__filtro input')?.value).toBe(
      'Curso A',
    );

    // O reembolso fica sem motivo próprio: o motivo padrão passa a ser obrigatório.
    const motivo = elemento().querySelector<HTMLInputElement>(
      '[data-evento="PURCHASE_REFUNDED"] input[type=text]',
    )!;
    digitar(motivo, '');
    fixture.detectChanges();
    passo('Configurações').click();
    fixture.detectChanges();
    expect(elemento().textContent).not.toContain('Status inicial');
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Informe o motivo de perda padrão');
    digitar(campo('Motivo de perda padrão'), 'Cancelou');
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(passoAtual()).toContain('Salvar');
    expect(elemento().textContent).toContain('Definida por evento');
    expect(elemento().textContent).toContain('Curso A');

    botao('Salvar alterações').click();
    const salvar = http.expectOne('/api/v1/webhooks/entradas/we-ht');
    expect(salvar.request.method).toBe('PATCH');
    expect(salvar.request.body.statusInicial).toBe('ABERTO');
    expect(salvar.request.body.motivoPerdaPadrao).toBe('Cancelou');
    expect(salvar.request.body.configuracao.produtos).toEqual(['Curso A']);
    expect(salvar.request.body.configuracao.eventos.PURCHASE_BILLET_PRINTED).toEqual({
      acao: 'IGNORAR',
      etapaId: null,
      motivoPerda: null,
      etiquetas: [],
    });
    expect(salvar.request.body.configuracao.eventos.PURCHASE_REFUNDED).toMatchObject({
      acao: 'PERDIDO',
      motivoPerda: null,
    });
    salvar.flush(webhookEntrada({ id: 'we-ht', aplicativo: 'HOTMART' }));
    await aguardar();
    expect(fixture.componentInstance.aberto()).toBe(false);
  });
});
