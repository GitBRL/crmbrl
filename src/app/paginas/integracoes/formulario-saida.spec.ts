import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EVENTOS, FORMATO_CLINT, FUNIS, microtarefas, webhookSaida } from './dados-de-teste';
import { FormularioSaida } from './formulario-saida';

describe('FormularioSaida (cadastro e edição de webhook de saída)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<FormularioSaida>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(elemento().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() === texto,
    )!;
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

  function caixa(rotulo: string): HTMLInputElement {
    const componente = Array.from(elemento().querySelectorAll('app-caixa-selecao')).find(
      (item) => item.querySelector('.caixa__rotulo')?.textContent?.trim() === rotulo,
    );
    return componente!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  }

  async function abrir(webhook: ReturnType<typeof webhookSaida> | null = null) {
    fixture = TestBed.createComponent(FormularioSaida);
    fixture.componentRef.setInput('webhook', webhook);
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/webhooks/saidas/eventos').flush(EVENTOS);
    await microtarefas();
    fixture.detectChanges();
  }

  it('lista os eventos com a descrição, sem o evento de teste', async () => {
    await abrir();
    const texto = elemento().textContent ?? '';
    expect(texto).toContain('Negócio perdido');
    expect(texto).toContain('Negócio perdido, com o motivo.');
    expect(texto).not.toContain('Evento de teste');
  });

  it('exige ao menos um evento e uma URL completa', async () => {
    await abrir();
    digitar(campo('Nome'), 'TicketHub');
    digitar(campo('URL do destino'), 'tickethub.local');
    fixture.detectChanges();
    botao('Cadastrar destino').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Escolha pelo menos um evento.');
    expect(elemento().textContent).toContain('começando com https://');
  });

  it('cadastra com eventos e cabeçalhos e mostra o segredo uma vez', async () => {
    await abrir();
    digitar(campo('Nome'), 'TicketHub');
    digitar(campo('URL do destino'), 'https://tickethub.exemplo.com/webhooks');
    caixa('Negócio ganho').click();
    caixa('Negócio perdido').click();
    botao('Adicionar cabeçalho').click();
    fixture.detectChanges();
    digitar(campo('Nome do cabeçalho 1'), 'Authorization');
    digitar(campo('Valor do cabeçalho 1'), 'Bearer abc');
    fixture.detectChanges();
    botao('Cadastrar destino').click();
    const criar = http.expectOne('/api/v1/webhooks/saidas');
    expect(criar.request.body).toEqual({
      nome: 'TicketHub',
      url: 'https://tickethub.exemplo.com/webhooks',
      eventos: ['negocio.ganho', 'negocio.perdido'],
      cabecalhos: { Authorization: 'Bearer abc' },
    });
    criar.flush({ webhook: webhookSaida({ nome: 'TicketHub' }), segredo: 'segredo-123' });
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('segredo-123');
    expect(botao('Já copiei')).toBeTruthy();
  });

  it('URL interna recusada (R9.1) aparece no campo da URL', async () => {
    await abrir();
    digitar(campo('Nome'), 'Interno');
    digitar(campo('URL do destino'), 'http://10.0.0.5/hook');
    caixa('Todos os eventos').click();
    fixture.detectChanges();
    botao('Cadastrar destino').click();
    const criar = http.expectOne('/api/v1/webhooks/saidas');
    expect(criar.request.body.eventos).toEqual([
      'contato.criado',
      'negocio.ganho',
      'negocio.perdido',
    ]);
    criar.flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'Endereços da rede interna não são aceitos.',
        detalhes: { regra: 'R9.1' },
        requisicaoId: 'r1',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await microtarefas();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Endereços da rede interna não são aceitos.');
  });

  it('na edição, remover um cabeçalho salvo manda null para ele', async () => {
    await abrir(webhookSaida());
    expect(caixa('Contato criado').checked).toBe(true);
    botao('Remover').click();
    fixture.detectChanges();
    expect(elemento().textContent).toContain('Sai ao salvar.');
    botao('Salvar alterações').click();
    const patch = http.expectOne('/api/v1/webhooks/saidas/ws1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({
      nome: 'Receptor de testes (dev)',
      url: 'http://apoio:8090/webhooks/brl-crm',
      eventos: ['contato.criado', 'negocio.ganho'],
      cabecalhos: { Authorization: null },
    });
    patch.flush(webhookSaida({ cabecalhos: [] }));
    await microtarefas();
    expect(fixture.componentInstance.aberto()).toBe(false);
  });

  describe('formato Clint', () => {
    async function escolherClint() {
      const radio = Array.from(
        elemento().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ).find((item) => item.closest('label')?.textContent?.includes('Formato Clint'))!;
      radio.click();
      fixture.detectChanges();
      http.expectOne('/api/v1/webhooks/saidas/formato-clint').flush(FORMATO_CLINT);
      http.expectOne('/api/v1/funis').flush(FUNIS);
      await microtarefas();
      fixture.detectChanges();
    }

    it('mostra método, gatilhos e campos com identificador editável; cadastra no formato', async () => {
      await abrir();
      digitar(campo('Nome'), 'CRM do parceiro');
      digitar(campo('URL do destino'), 'https://parceiro.exemplo.com/hook');
      await escolherClint();
      const texto = elemento().textContent ?? '';
      expect(texto).toContain('Quando enviar');
      expect(texto).toContain('Campos enviados');
      expect(texto).toContain('POST (JSON)');
      expect(texto).toContain('GET (URL)');
      // Os eventos do envelope somem.
      expect(texto).not.toContain('Todos os eventos');
      // Nome, e-mail, telefone e valor já vêm marcados, com o identificador padrão.
      expect(campo('Identificador de E-mail do contato').value).toBe('email');
      digitar(campo('Identificador de E-mail do contato'), 'email_lead');
      fixture.detectChanges();
      botao('Cadastrar destino').click();
      const criar = http.expectOne('/api/v1/webhooks/saidas');
      expect(criar.request.body).toEqual({
        nome: 'CRM do parceiro',
        url: 'https://parceiro.exemplo.com/hook',
        formato: 'CLINT',
        metodo: 'POST',
        gatilhos: [{ tipo: 'NEGOCIO_CRIADO' }],
        campos: [
          { origem: 'contato.nome', identificador: 'nome' },
          { origem: 'contato.email', identificador: 'email_lead' },
          { origem: 'contato.telefone', identificador: 'telefone' },
          { origem: 'negocio.valor', identificador: 'valor' },
        ],
      });
      criar.flush({
        webhook: webhookSaida({ nome: 'CRM do parceiro', formato: 'CLINT' }),
        segredo: 'seg',
      });
      await microtarefas();
    });

    it('identificadores repetidos ou inválidos são recusados antes de enviar', async () => {
      await abrir();
      digitar(campo('Nome'), 'CRM do parceiro');
      digitar(campo('URL do destino'), 'https://parceiro.exemplo.com/hook');
      await escolherClint();
      digitar(campo('Identificador de Nome do contato'), 'email');
      fixture.detectChanges();
      botao('Cadastrar destino').click();
      fixture.detectChanges();
      expect(elemento().textContent).toContain('aparece em mais de um campo');
      digitar(campo('Identificador de Nome do contato'), 'nome completo');
      fixture.detectChanges();
      botao('Cadastrar destino').click();
      fixture.detectChanges();
      expect(elemento().textContent).toContain('letras, números e _ - . [ ]');
      http.expectNone('/api/v1/webhooks/saidas');
    });

    it('gatilho de etapa exige a etapa e usa as etapas do funil escolhido', async () => {
      await abrir();
      digitar(campo('Nome'), 'CRM do parceiro');
      digitar(campo('URL do destino'), 'https://parceiro.exemplo.com/hook');
      await escolherClint();
      const tipo = elemento().querySelector<HTMLSelectElement>('select')!;
      const opcao = Array.from(tipo.options).find(
        (o) => o.textContent?.trim() === 'Negócio entra na etapa…',
      )!;
      tipo.value = opcao.value;
      tipo.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      botao('Cadastrar destino').click();
      fixture.detectChanges();
      expect(elemento().textContent).toContain('Escolha a etapa do gatilho');
    });
  });
});
