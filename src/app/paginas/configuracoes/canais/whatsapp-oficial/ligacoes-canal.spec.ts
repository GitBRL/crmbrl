import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../../../nucleo/avisos.service';
import type { ConfiguracaoLigacoes } from '../../../../nucleo/ligacoes/ligacoes.tipos';
import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { microtarefas } from '../dados-de-teste';
import { explicarRecusa, LigacoesCanal, REQUISITOS_DA_META } from './ligacoes-canal';

const URL = '/api/v1/whatsapp-oficial/canais/o-1/ligacoes';

function configuracao(extra: Partial<ConfiguracaoLigacoes> = {}): ConfiguracaoLigacoes {
  return {
    canalId: 'o-1',
    ativa: false,
    botaoVisivel: true,
    horario: null,
    horarioEfetivo: null,
    filaId: null,
    filaEfetivaId: null,
    gravar: true,
    retencaoDias: 365,
    avisoArquivoId: null,
    tempoDeToqueSegundos: 25,
    mensagemPerdidaAtiva: false,
    mensagemPerdida: null,
    sincronizadaEm: null,
    ultimoErroMeta: null,
    campoDoWebhook: 'calls',
    ...extra,
  };
}

describe('LigacoesCanal (aba "Ligações" do WhatsApp oficial)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LigacoesCanal>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;

  async function abrir(config = configuracao()) {
    fixture = TestBed.createComponent(LigacoesCanal);
    fixture.componentRef.setInput('canalId', 'o-1');
    fixture.componentRef.setInput('nomeDoCanal', 'WhatsApp Oficial');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([{ id: 'f-1', nome: 'Pré-vendas' }]);
    http.expectOne(URL).flush(config);
    await microtarefas();
    fixture.detectChanges();
  }

  it('mostra o estado, os campos da configuração e os requisitos da Meta em linguagem simples', async () => {
    await abrir();
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Ligações desativadas');
    expect(texto).toContain('Ativar ligações');
    for (const campo of [
      'Fila que atende as ligações',
      'Mostrar o botão Ligar para o cliente',
      'Horário das ligações',
      'Tempo de toque (segundos)',
      'Gravar as ligações',
      'Responder ao cliente com uma mensagem',
    ]) {
      expect(texto).toContain(campo);
    }
    for (const requisito of REQUISITOS_DA_META) {
      expect(texto).toContain(requisito.titulo);
    }
    expect(texto).toContain('2.000');
    expect(texto).toContain('forma de pagamento');
    expect(texto).toContain('calls');
  });

  it('ativar chama a Meta (PATCH ativa) e mostra o resultado', async () => {
    await abrir();
    botao('Ativar ligações').click();
    await microtarefas();
    const pedido = http.expectOne(URL);
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ ativa: true });
    pedido.flush(configuracao({ ativa: true, sincronizadaEm: '2026-11-02T12:00:00.000Z' }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Ligações ativas');
    expect(raiz().textContent).toContain('Confirmado na Meta em');
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain('ativadas');
  });

  it('a Meta recusou (limite de mensagens baixo): nada muda e o motivo é explicado', async () => {
    await abrir();
    botao('Ativar ligações').click();
    await microtarefas();
    http.expectOne(URL).flush(
      {
        statusCode: 422,
        erro: 'regra_violada',
        mensagem: 'A Meta recusou.',
        detalhes: { motivo: 'limite_de_mensagens_baixo', codigoDaMeta: 138015 },
        requisicaoId: 'r1',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('abaixo de 2.000');
    expect(raiz().textContent).toContain('Ligações desativadas');
  });

  it('salva só os ajustes (sem tocar em "ativa") e confere o tempo de toque', async () => {
    await abrir(configuracao({ ativa: true }));
    const toque = raiz().querySelector<HTMLInputElement>('input[type="number"]')!;
    toque.value = '5';
    toque.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    botao('Salvar').click();
    fixture.detectChanges();
    http.expectNone(URL);
    expect(raiz().textContent).toContain('No mínimo 10 segundos');

    toque.value = '30';
    toque.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    botao('Salvar').click();
    await microtarefas();
    const pedido = http.expectOne(URL);
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toMatchObject({
      tempoDeToqueSegundos: 30,
      botaoVisivel: true,
      gravar: true,
      horario: null,
      mensagemPerdida: null,
    });
    expect('ativa' in pedido.request.body).toBe(false);
    pedido.flush(configuracao({ ativa: true, tempoDeToqueSegundos: 30 }));
    await microtarefas();
  });

  it('guarda: manda o prazo de guarda e recusa valor fora do limite', async () => {
    await abrir(configuracao({ ativa: true }));
    const campos = raiz().querySelectorAll<HTMLInputElement>('input[type="number"]');
    const guarda = campos[1]!;
    expect(guarda.value).toBe('365');
    guarda.value = '0';
    guarda.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    botao('Salvar').click();
    fixture.detectChanges();
    http.expectNone(URL);
    expect(raiz().textContent).toContain('No mínimo 1 dia');
    guarda.value = '90';
    guarda.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    botao('Salvar').click();
    await microtarefas();
    const pedido = http.expectOne(URL);
    expect(pedido.request.body).toMatchObject({ retencaoDias: 90, gravar: true });
    pedido.flush(configuracao({ ativa: true, retencaoDias: 90 }));
    await microtarefas();
  });

  it('áudio de aviso: envia o arquivo na hora e mostra o nome', async () => {
    await abrir(configuracao({ ativa: true }));
    expect(raiz().textContent).toContain('Nenhum áudio de aviso');
    const campo = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
    const arquivo = new File(['x'], 'aviso.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(campo, 'files', { value: [arquivo], configurable: true });
    campo.dispatchEvent(new Event('change'));
    await microtarefas();
    const envio = http.expectOne((r) => r.url === '/api/v1/arquivos');
    expect(envio.request.method).toBe('POST');
    expect(envio.request.params.get('contexto')).toBe('LIGACAO');
    expect((envio.request.body as FormData).get('arquivo')).toBeInstanceOf(File);
    envio.flush({ id: 'arq-1', nome: 'aviso.mp3', tamanho: 2048 });
    await microtarefas();
    const vinculo = http.expectOne(URL);
    expect(vinculo.request.method).toBe('PATCH');
    expect(vinculo.request.body).toEqual({ avisoArquivoId: 'arq-1' });
    vinculo.flush(configuracao({ ativa: true, avisoArquivoId: 'arq-1' }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('aviso.mp3');
    expect(raiz().textContent).toContain('2 KB');
  });

  it('áudio de aviso: arquivo que não é áudio ou grande demais nem sai do navegador', async () => {
    await abrir(configuracao({ ativa: true }));
    const campo = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(campo, 'files', {
      value: [new File(['x'], 'a.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    campo.dispatchEvent(new Event('change'));
    await microtarefas();
    fixture.detectChanges();
    http.expectNone('/api/v1/arquivos');
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('arquivo de áudio');
  });

  it('erro ao abrir: mostra a falha e deixa tentar de novo', async () => {
    fixture = TestBed.createComponent(LigacoesCanal);
    fixture.componentRef.setInput('canalId', 'o-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http
      .expectOne(URL)
      .flush(
        { statusCode: 500, erro: 'erro_interno', mensagem: 'Falha.', requisicaoId: 'r9' },
        { status: 500, statusText: 'Server Error' },
      );
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não conseguimos abrir as ligações do canal');
    expect(botao('Tentar de novo')).toBeTruthy();
  });

  it('explicarRecusa: traduz os motivos mais comuns', () => {
    const erro = (detalhes: Record<string, unknown>) => ({ detalhes, mensagem: 'padrão' }) as never;
    expect(explicarRecusa(erro({ motivo: 'sip_ativo' }))).toContain('SIP');
    expect(explicarRecusa(erro({ motivo: 'token_invalido' }))).toContain('token');
    expect(explicarRecusa(erro({ motivo: 'sem_forma_de_pagamento' }))).toContain('pagamento');
    expect(explicarRecusa(erro({}))).toBe('padrão');
  });
});
