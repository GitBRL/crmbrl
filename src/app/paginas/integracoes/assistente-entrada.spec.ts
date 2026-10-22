import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { AssistenteEntrada, lerExemplo, separarEtiquetas } from './assistente-entrada';
import {
  FUNIS,
  microtarefas,
  MODELOS,
  pagina,
  PREVIA_VALIDA,
  USUARIOS,
  webhookEntrada,
} from './dados-de-teste';
import type { WebhookEntradaCriado } from './tipos';

describe('separarEtiquetas e lerExemplo', () => {
  it('separa por vírgula, sem vazios nem repetidas', () => {
    expect(separarEtiquetas(' Landing, Black Friday ,landing,, ')).toEqual([
      'Landing',
      'Black Friday',
    ]);
    expect(separarEtiquetas('')).toEqual([]);
  });

  it('aceita só objeto JSON e explica o erro', () => {
    expect(lerExemplo('{"name":"Ana"}')).toEqual({ valor: { name: 'Ana' } });
    expect(lerExemplo('[1]')).toEqual({ erro: expect.stringContaining('objeto JSON') });
    expect(lerExemplo('{name: Ana}')).toEqual({ erro: expect.stringContaining('não é um JSON') });
    expect(lerExemplo('  ')).toEqual({ erro: expect.stringContaining('Cole') });
  });
});

describe('AssistenteEntrada (novo webhook de entrada, em passos)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AssistenteEntrada>;

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

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    );
    if (!encontrado) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return encontrado;
  }

  function digitar(rotulo: string, valor: string): void {
    const campo = Array.from(elemento().querySelectorAll('label'))
      .find((label) => label.textContent?.trim().startsWith(rotulo))
      ?.getAttribute('for');
    const entrada = elemento().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${campo}`)!;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
  }

  async function abrir(webhook: ReturnType<typeof webhookEntrada> | null = null) {
    fixture = TestBed.createComponent(AssistenteEntrada);
    fixture.componentRef.setInput('webhook', webhook);
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/funis').flush(FUNIS);
    http.expectOne('/api/v1/usuarios?ativo=true&porPagina=100').flush(pagina(USUARIOS));
    http.expectOne('/api/v1/webhooks/entradas/modelos').flush(MODELOS);
    await microtarefas();
    fixture.detectChanges();
  }

  it('começa no funil de Marketing, na primeira etapa aberta, sem a etapa de perda', async () => {
    await abrir();
    const seletores = elemento().querySelectorAll<HTMLSelectElement>('select');
    const [funil, etapa] = Array.from(seletores);
    expect(funil.selectedOptions[0].textContent?.trim()).toBe('Marketing');
    expect(etapa.selectedOptions[0].textContent?.trim()).toBe('Novo lead');
    const etapas = Array.from(etapa.options).map((opcao) => opcao.textContent?.trim());
    expect(etapas).toContain('Qualificado (MQL) (etapa de ganho)');
    expect(etapas).not.toContain('Descartado');
    expect(elemento().querySelector('[aria-current="step"]')?.textContent).toContain(
      'Nome e destino',
    );
  });

  it('não avança sem nome e mostra o erro no campo', async () => {
    await abrir();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Preencha este campo.');
    expect(elemento().querySelector('[aria-current="step"]')?.textContent).toContain(
      'Nome e destino',
    );
  });

  it('responsável fixo só oferece quem vê o funil e passa a ser obrigatório', async () => {
    await abrir();
    digitar('Nome', 'Landing — teste');
    const fixo = elemento().querySelectorAll<HTMLInputElement>('input[type="radio"]')[1];
    fixo.click();
    fixture.detectChanges();
    const responsavel = Array.from(elemento().querySelectorAll('select')).at(-1)!;
    const nomes = Array.from(responsavel.options).map((opcao) => opcao.textContent?.trim());
    expect(nomes).toContain('Camila Rocha — Líder Marketing');
    expect(nomes).toContain('Administrador — Admin');
    expect(nomes.some((nome) => nome?.startsWith('Lucas'))).toBe(false);
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Escolha uma opção.');
  });

  it('cria em três passos: prévia do mapeamento, segredo gerado, endereço e curl no fim', async () => {
    await abrir();
    const criados: WebhookEntradaCriado[] = [];
    fixture.componentInstance.criado.subscribe((criado) => criados.push(criado));
    digitar('Nome', 'Landing — teste');
    botao('Continuar').click();
    fixture.detectChanges();

    // Passo 2: a prévia roda sozinha com o exemplo do modelo.
    const previa = http.expectOne('/api/v1/webhooks/entradas/previa');
    expect(previa.request.body).toEqual({
      modeloMapeamento: 'GENERICO',
      etiquetasFixas: [],
      exemplo: { name: 'Maria Souza', email: 'maria@empresa.com.br' },
    });
    previa.flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Funcionaria');
    expect(elemento().textContent).toContain('+55 11 98765-4321');
    digitar('Etiquetas fixas', 'Landing, Black Friday');
    botao('Continuar').click();
    fixture.detectChanges();

    // Passo 3: gerar segredo.
    expect(elemento().querySelector('[aria-current="step"]')?.textContent).toContain('Segurança');
    const gerar = elemento().querySelectorAll<HTMLInputElement>('input[type="radio"]')[1];
    gerar.click();
    fixture.detectChanges();
    botao('Criar webhook').click();
    const criar = http.expectOne('/api/v1/webhooks/entradas');
    expect(criar.request.body).toEqual({
      nome: 'Landing — teste',
      funilId: 'f-mkt',
      etapaId: 'e-novo',
      estrategia: 'RODIZIO',
      responsavelFixoId: null,
      modeloMapeamento: 'GENERICO',
      etiquetasFixas: ['Landing', 'Black Friday'],
      gerarSegredo: true,
    });
    criar.flush({
      webhook: webhookEntrada({ nome: 'Landing — teste', exigeAssinatura: true }),
      url: 'http://localhost:4200/api/v1/webhooks/entrada/TOKEN123',
      segredo: 'segredo-gerado-1234567890',
    });
    await microtarefas();
    fixture.detectChanges();

    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Copie o endereço agora');
    expect(texto).toContain('http://localhost:4200/api/v1/webhooks/entrada/TOKEN123');
    expect(texto).toContain('segredo-gerado-1234567890');
    expect(texto).toContain("openssl dgst -sha256 -hmac 'segredo-gerado-1234567890'");
    expect(texto).toContain('X-Assinatura: sha256=$ASSINATURA');
    expect(criados).toHaveLength(1);

    // O aviso curto só vem ao fechar, para não cobrir os botões do resultado.
    const avisos = TestBed.inject(AvisosService);
    expect(avisos.lista()).toHaveLength(0);
    botao('Concluir').click();
    fixture.detectChanges();
    await microtarefas();
    expect(avisos.lista().map((aviso) => aviso.mensagem)).toEqual([
      'Webhook “Landing — teste” criado.',
    ]);
  });

  it('personalizado exige regra de nome e de e-mail ou telefone antes de avançar', async () => {
    await abrir();
    digitar('Nome', 'Sistema próprio');
    botao('Continuar').click();
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas/previa').flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();

    const personalizado = Array.from(
      elemento().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).find((radio) => radio.closest('label')?.textContent?.includes('Personalizado'))!;
    personalizado.click();
    fixture.detectChanges();
    // Começa com as regras do modelo anterior (Genérico) e refaz a prévia.
    const previa = http.expectOne('/api/v1/webhooks/entradas/previa');
    expect(previa.request.body.modeloMapeamento).toBe('PERSONALIZADO');
    expect(previa.request.body.mapeamento.campos).toEqual([
      { caminho: 'name', destino: 'nome' },
      { caminho: 'email', destino: 'email' },
      { caminho: 'phone', destino: 'telefone' },
    ]);
    previa.flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();

    // Tira a regra do nome: não avança e explica.
    elemento().querySelector<HTMLButtonElement>('[aria-label="Remover a regra 1"]')!.click();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    expect(elemento().querySelector('[role="alert"]')?.textContent).toContain('Nome do contato');
  });

  it('nome repetido (409) volta ao passo 1 com o erro no campo', async () => {
    await abrir();
    digitar('Nome', 'Disparos BRL — WhatsApp');
    botao('Continuar').click();
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas/previa').flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();
    botao('Continuar').click();
    fixture.detectChanges();
    botao('Criar webhook').click();
    http.expectOne('/api/v1/webhooks/entradas').flush(
      {
        statusCode: 409,
        erro: 'conflito',
        mensagem: 'Já existe um webhook de entrada com este nome.',
        requisicaoId: 'r1',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().querySelector('[aria-current="step"]')?.textContent).toContain(
      'Nome e destino',
    );
    expect(elemento().textContent).toContain('Já existe um webhook de entrada com este nome.');
  });

  it('edita em dois passos e salva com PATCH', async () => {
    await abrir(webhookEntrada({ modeloMapeamento: 'GENERICO' }));
    const salvos: unknown[] = [];
    fixture.componentInstance.salvo.subscribe((salvo) => salvos.push(salvo));
    expect(elemento().querySelectorAll('.assistente__passo')).toHaveLength(2);
    botao('Continuar').click();
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/entradas/previa').flush(PREVIA_VALIDA);
    await microtarefas();
    fixture.detectChanges();
    botao('Salvar alterações').click();
    const patch = http.expectOne('/api/v1/webhooks/entradas/we1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toMatchObject({
      nome: 'Disparos BRL — WhatsApp',
      funilId: 'f-mkt',
      etapaId: 'e-novo',
      modeloMapeamento: 'GENERICO',
      etiquetasFixas: ['Disparos BRL'],
    });
    patch.flush(webhookEntrada());
    await microtarefas();
    expect(salvos).toHaveLength(1);
    expect(fixture.componentInstance.aberto()).toBe(false);
  });
});
