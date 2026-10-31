import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { botaoComTexto, campoPeloRotulo, digitar, microtarefas } from './dados-de-teste';
import { DisparosConfig, motivoDaPalavra, normalizarPalavra } from './disparos-config';
import { SECOES_CONFIGURACOES } from './secoes';

const URL = '/api/v1/disparos/configuracao';
const BASE = {
  aprovacaoDoLider: false,
  palavrasDeSaida: ['SAIR', 'PARAR'],
  mensagemDeSaida: 'Pronto, você não receberá mais mensagens.',
};

describe('DisparosConfig', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<DisparosConfig>;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function abrir() {
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(DisparosConfig);
    fixture.detectChanges();
    http.expectOne(URL).flush(BASE);
    await microtarefas();
    fixture.detectChanges();
  }

  it('só Admin e C-level veem a seção', () => {
    const secao = SECOES_CONFIGURACOES.find((s) => s.caminho === 'disparos')!;
    const permite = (papel: Parameters<typeof entrarComo>[0]) =>
      secao.permite({} as never, entrarComo(papel));
    expect(permite('ADMIN')).toBe(true);
    expect(permite('C_LEVEL')).toBe(true);
    expect(permite('LIDER_MARKETING')).toBe(false);
    expect(permite('COMERCIAL')).toBe(false);
  });

  it('mostra o estado atual e salva as mudanças por PUT', async () => {
    await abrir();
    expect(raiz().textContent).toContain('SAIR');
    const salvar = botaoComTexto(raiz(), 'Salvar');
    expect(salvar.disabled).toBe(true);

    digitar(raiz(), 'Nova palavra', ' encerrar ');
    botaoComTexto(raiz(), 'Adicionar').click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('ENCERRAR');
    campoPeloRotulo<HTMLInputElement>(raiz(), 'Campanhas de membros').click();
    fixture.detectChanges();
    expect(salvar.disabled).toBe(false);

    salvar.click();
    const pedido = http.expectOne(URL);
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({
      aprovacaoDoLider: true,
      palavrasDeSaida: ['SAIR', 'PARAR', 'ENCERRAR'],
      mensagemDeSaida: BASE.mensagemDeSaida,
    });
    pedido.flush({
      ...BASE,
      aprovacaoDoLider: true,
      palavrasDeSaida: pedido.request.body.palavrasDeSaida,
    });
    await microtarefas();
    fixture.detectChanges();
    expect(botaoComTexto(raiz(), 'Salvar').disabled).toBe(true);
  });

  it('não deixa salvar sem nenhuma palavra', async () => {
    await abrir();
    raiz()
      .querySelectorAll<HTMLButtonElement>('.config__remover')
      .forEach((b) => b.click());
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Informe ao menos uma palavra');
    expect(botaoComTexto(raiz(), 'Salvar').disabled).toBe(true);
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(DisparosConfig);
    fixture.detectChanges();
    http.expectOne(URL).flush({ message: 'x' }, { status: 500, statusText: 'Erro' });
    await microtarefas();
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Tentar de novo').click();
    http.expectOne(URL).flush(BASE);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('PARAR');
  });

  it('valida palavras repetidas e vazias', () => {
    expect(normalizarPalavra(' sair ')).toBe('SAIR');
    expect(motivoDaPalavra('  ', [])).toBeTruthy();
    expect(motivoDaPalavra('sair', ['SAIR'])).toBeTruthy();
    expect(motivoDaPalavra('x'.repeat(41), [])).toBeTruthy();
    expect(motivoDaPalavra('novo', ['SAIR'])).toBeNull();
  });
});
