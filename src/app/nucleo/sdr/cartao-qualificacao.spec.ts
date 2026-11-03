import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { entrarComo } from '../sessao/sessao-de-teste';
import { provideSocketFalso } from '../tempo-real/tempo-real-de-teste';
import { CartaoQualificacao } from './cartao-qualificacao';
import { criterioDeTeste, qualificacaoDeTeste } from './sdr-de-teste';

const texto = (e: Element | null) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('CartaoQualificacao', () => {
  let http: HttpTestingController;
  let socket: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    socket = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        socket.providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL');
  });
  afterEach(() => {
    http
      .match((p) => p.url.startsWith('/api/v1/ligacoes'))
      .forEach((p) =>
        p.flush(p.request.url.endsWith('/ativas') ? { emAndamento: null, tocando: [] } : []),
      );
    http.verify();
  });

  function montar(entrada: { contatoId?: string; negocioId?: string }) {
    const fixture = TestBed.createComponent(CartaoQualificacao);
    for (const [nome, valor] of Object.entries(entrada)) {
      fixture.componentRef.setInput(nome, valor);
    }
    return fixture;
  }

  it('carrega pelo contato e mostra critérios, valores, origem, confiança, nota e temperatura', async () => {
    const fixture = montar({ contatoId: 'ct1' });
    fixture.detectChanges();
    expect(texto(fixture.nativeElement)).toContain('Carregando a qualificação');
    http.expectOne('/api/v1/sdr/contatos/ct1/qualificacao').flush({
      qualificacao: qualificacaoDeTeste({
        temperatura: 'QUENTE',
        nota: 100,
        situacao: 'QUALIFICADA',
        resumo: 'Quer Direito.',
        criterios: [
          criterioDeTeste(),
          criterioDeTeste({
            chave: 'cidade',
            rotulo: 'Cidade',
            descoberto: false,
            valorFormatado: null,
            confianca: null,
            origem: null,
          }),
          criterioDeTeste({
            chave: 'pagamento',
            rotulo: 'Pagamento',
            valorFormatado: 'À vista',
            origem: 'PESSOA',
            confianca: 1,
          }),
        ],
      }),
    });
    await fixture.whenStable();
    const t = texto(fixture.nativeElement);
    expect(t).toContain('Qualificada');
    expect(t).toContain('Quente');
    expect(t).toContain('Nota 100 de 100');
    expect(t).toContain('2 de 3');
    expect(t).toContain('Direito');
    expect(t).toContain('IA · confiança 90%');
    expect(t).toContain('Ainda não descoberto');
    expect(t).toContain('Pessoa · confiança 100%');
    expect(t).toContain('Resumo da IA');
  });

  it('usa a rota do negócio quando recebe o negócio', async () => {
    const fixture = montar({ negocioId: 'n1' });
    fixture.detectChanges();
    http.expectOne('/api/v1/sdr/negocios/n1/qualificacao').flush({ qualificacao: null });
    await fixture.whenStable();
  });

  it('sem conversa da IA: estado vazio que explica', async () => {
    const fixture = montar({ contatoId: 'ct1' });
    fixture.detectChanges();
    http.expectOne('/api/v1/sdr/contatos/ct1/qualificacao').flush({ qualificacao: null });
    await fixture.whenStable();
    expect(texto(fixture.nativeElement)).toContain('A IA ainda não conversou com este lead');
  });

  it('erro: avisa e deixa tentar de novo', async () => {
    const fixture = montar({ contatoId: 'ct1' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ mensagem: 'Falhou.' }, { status: 500, statusText: 'Erro' });
    await fixture.whenStable();
    expect(texto(fixture.nativeElement)).toContain('Não deu para carregar a qualificação');
    [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Tentar de novo'))!
      .click();
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver));
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ qualificacao: qualificacaoDeTeste() });
    await fixture.whenStable();
    expect(texto(fixture.nativeElement)).toContain('Nota 40 de 100');
  });

  it('sem permissão: diz que não há acesso, sem botão de tentar de novo', async () => {
    const fixture = montar({ contatoId: 'ct1' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ mensagem: 'Sem acesso.' }, { status: 403, statusText: 'Proibido' });
    await fixture.whenStable();
    expect(texto(fixture.nativeElement)).toContain('Você não tem acesso à qualificação');
    expect(texto(fixture.nativeElement)).not.toContain('Tentar de novo');
  });

  it('o tempo real da conversa do cartão recarrega os dados', async () => {
    const fixture = montar({ contatoId: 'ct1' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ qualificacao: qualificacaoDeTeste() });
    await fixture.whenStable();
    socket.ultimo().simularConexao();
    socket.ultimo().receber('sdr.atualizado', {
      conversaId: 'outra',
      situacao: 'ATIVA',
      modo: 'AUTOMATICO',
      nota: 0,
      temperatura: null,
      sugestaoPendente: false,
      motivo: 'turno',
    });
    fixture.detectChanges();
    http.expectNone('/api/v1/sdr/contatos/ct1/qualificacao');
    socket.ultimo().receber('sdr.atualizado', {
      conversaId: 'c1',
      situacao: 'QUALIFICADA',
      modo: 'AUTOMATICO',
      nota: 100,
      temperatura: 'QUENTE',
      sugestaoPendente: false,
      motivo: 'qualificada',
    });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/sdr/contatos/ct1/qualificacao')
      .flush({ qualificacao: qualificacaoDeTeste({ nota: 100, temperatura: 'QUENTE' }) });
    await fixture.whenStable();
    expect(texto(fixture.nativeElement)).toContain('Nota 100 de 100');
  });
});
