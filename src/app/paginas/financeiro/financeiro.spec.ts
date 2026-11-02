import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { Contratos } from './contratos';
import { contrato, parcela } from './dados-de-teste';
import { ModalBaixa } from './modais-parcela';
import { Parcelas } from './parcelas';
import { RiscoChurnCartao } from './risco-churn';
import { ROTAS_FINANCEIRO } from './financeiro.routes';
import { rotuloDoMarco, rotuloDoMes } from './financeiro.tipos';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function estabilizar(fixture: ComponentFixture<unknown>) {
  await new Promise((resolver) => setTimeout(resolver));
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('rótulos do Financeiro', () => {
  it('marco da régua e mês', () => {
    expect(rotuloDoMarco(-7)).toBe('D-7');
    expect(rotuloDoMarco(0)).toBe('D0');
    expect(rotuloDoMarco(15)).toBe('D+15');
    expect(rotuloDoMes('2026-03')).toBe('mar/26');
  });
});

describe('Financeiro (telas)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSocketFalso().providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  describe('Contratos', () => {
    const ehLista = (r: { url: string; method: string }) =>
      r.method === 'GET' && r.url === '/api/v1/financeiro/contratos';

    it('lista contratos e oferece "Novo contrato" para CS', async () => {
      entrarComo('CS');
      const fixture = TestBed.createComponent(Contratos);
      fixture.detectChanges();
      http.expectOne(ehLista).flush({
        itens: [contrato('a'), contrato('b', { codigo: 'C-000013', status: 'SUSPENSO' })],
        total: 2,
        pagina: 1,
        porPagina: 20,
      });
      await estabilizar(fixture);
      const raiz = fixture.nativeElement as HTMLElement;
      const conteudo = texto(raiz);
      expect(conteudo).toContain('Suporte Premium');
      expect(conteudo).toContain('Indústria Norte Ltda');
      expect(conteudo).toContain('R$');
      expect(conteudo).toContain('Suspenso');
      expect(conteudo).toContain('2 contratos');
      expect(raiz.querySelector('a[href="/financeiro/contratos/novo"]')).not.toBeNull();
    });

    it('Comercial só consulta: sem "Novo contrato"', async () => {
      entrarComo('COMERCIAL');
      const fixture = TestBed.createComponent(Contratos);
      fixture.detectChanges();
      http.expectOne(ehLista).flush({ itens: [contrato('a')], total: 1, pagina: 1, porPagina: 20 });
      await estabilizar(fixture);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          'a[href="/financeiro/contratos/novo"]',
        ),
      ).toBeNull();
    });

    it('vazio e acesso negado têm estado próprio', async () => {
      entrarComo('LIDER_CS');
      const fixture = TestBed.createComponent(Contratos);
      fixture.detectChanges();
      http.expectOne(ehLista).flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
      await estabilizar(fixture);
      expect(texto(fixture.nativeElement)).toContain('Nenhum contrato ainda');

      const outro = TestBed.createComponent(Contratos);
      outro.detectChanges();
      http
        .expectOne(ehLista)
        .flush(
          { statusCode: 403, erro: 'sem_permissao', mensagem: 'x' },
          { status: 403, statusText: 'Forbidden' },
        );
      await estabilizar(outro);
      expect(texto(outro.nativeElement)).toContain('Você não tem acesso a isto');
    });
  });

  describe('Parcelas', () => {
    it('lista parcelas com situação e totais', async () => {
      entrarComo('LIDER_CS');
      const fixture = TestBed.createComponent(Parcelas);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/api/v1/financeiro/parcelas' && r.method === 'GET')
        .flush({
          itens: [
            parcela('p1'),
            parcela('p2', { numero: 'T-0002', status: 'PAGO', diasEmAtraso: 0 }),
          ],
          total: 2,
          pagina: 1,
          porPagina: 20,
        });
      http
        .expectOne((r) => r.url === '/api/v1/financeiro/parcelas/totais')
        .flush({
          quantidade: 2,
          porStatus: {
            ATRASADO: { quantidade: 1, valor: '1500.00' },
            PAGO: { quantidade: 1, valor: '1500.00' },
          },
        });
      await estabilizar(fixture);
      const raiz = fixture.nativeElement as HTMLElement;
      const conteudo = texto(raiz);
      expect(conteudo).toContain('T-0001');
      expect(conteudo).toContain('Atrasada');
      expect(conteudo).toContain('21 dias em atraso');
      expect(conteudo).toContain('Paga');
      expect(conteudo).toContain('A receber');
      expect(raiz.querySelector('a[href="/financeiro/parcelas/importar"]')).not.toBeNull();
    });

    it('só a gestão vê "Importar planilha"', async () => {
      entrarComo('CS');
      const fixture = TestBed.createComponent(Parcelas);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/api/v1/financeiro/parcelas' && r.method === 'GET')
        .flush({ itens: [], total: 0, pagina: 1, porPagina: 20 });
      http
        .expectOne((r) => r.url === '/api/v1/financeiro/parcelas/totais')
        .flush({ quantidade: 0, porStatus: {} });
      await estabilizar(fixture);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          'a[href="/financeiro/parcelas/importar"]',
        ),
      ).toBeNull();
    });
  });

  describe('Baixa', () => {
    it('envia a baixa com data, valor e forma e avisa quem chamou', async () => {
      entrarComo('LIDER_CS');
      const fixture = TestBed.createComponent(ModalBaixa);
      let recebida: unknown = null;
      fixture.componentInstance.concluido.subscribe((p) => (recebida = p));
      fixture.componentRef.setInput('parcela', parcela('p1'));
      fixture.componentInstance.aberto.set(true);
      await estabilizar(fixture);
      const formulario = (fixture.nativeElement as HTMLElement).querySelector('form')!;
      formulario.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise((r) => setTimeout(r));
      const pedido = http.expectOne('/api/v1/financeiro/parcelas/p1/baixa');
      expect(pedido.request.method).toBe('POST');
      expect(pedido.request.body.valorPago).toBe('1500.00');
      pedido.flush(parcela('p1', { status: 'PAGO' }));
      await estabilizar(fixture);
      expect(recebida).not.toBeNull();
    });
  });

  describe('Risco de cancelamento', () => {
    it('mostra o nível e os motivos; some quando a API devolve null', async () => {
      entrarComo('CS');
      const fixture = TestBed.createComponent(RiscoChurnCartao);
      fixture.componentRef.setInput('contatoId', 'c1');
      fixture.detectChanges();
      http.expectOne('/api/v1/financeiro/risco-churn/contatos/c1').flush({
        risco: {
          contatoId: 'c1',
          pontuacao: 80,
          nivel: 'ALTO',
          fatores: [{ tipo: 'ATRASO', pontos: 50, detalhe: 'Título atrasado há 10 dia(s)' }],
        },
      });
      await estabilizar(fixture);
      expect(texto(fixture.nativeElement)).toContain('Risco alto');
      expect(texto(fixture.nativeElement)).toContain('80 de 100');
      expect(texto(fixture.nativeElement)).toContain('Título atrasado há 10 dia(s)');

      const vazio = TestBed.createComponent(RiscoChurnCartao);
      vazio.componentRef.setInput('negocioId', 'n1');
      vazio.detectChanges();
      http.expectOne('/api/v1/financeiro/risco-churn/negocios/n1').flush({ risco: null });
      await estabilizar(vazio);
      expect(texto(vazio.nativeElement)).toBe('');
    });

    it('Marketing nem consulta', async () => {
      entrarComo('MARKETING');
      const fixture = TestBed.createComponent(RiscoChurnCartao);
      fixture.componentRef.setInput('contatoId', 'c1');
      fixture.detectChanges();
      await estabilizar(fixture);
      http.expectNone('/api/v1/financeiro/risco-churn/contatos/c1');
    });
  });
});

describe('rotas do Financeiro', () => {
  it('novo contrato e importar parcelas exigem o mesmo papel que mostra o botão', () => {
    const filhas = ROTAS_FINANCEIRO[0].children ?? [];
    const guardas = (caminho: string) =>
      filhas.find((rota) => rota.path === caminho)?.canActivate?.length ?? 0;
    expect(guardas('contratos/novo')).toBe(1);
    expect(guardas('parcelas/importar')).toBe(1);
  });
});
