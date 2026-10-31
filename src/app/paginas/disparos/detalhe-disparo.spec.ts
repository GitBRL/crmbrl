import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../nucleo/tempo-real/tempo-real-de-teste';
import { detalhe, SEM_ACOES } from './dados-de-teste';
import { DetalheDisparo } from './detalhe-disparo';
import { type Campanha, CONTADORES_ZERADOS } from './disparos.tipos';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const rotulosDosBotoes = (raiz: HTMLElement) =>
  [...raiz.querySelectorAll('header button, header a')].map((b) => texto(b));

describe('DetalheDisparo', () => {
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
    entrarComo('LIDER_COMERCIAL');
  });

  async function passar(fixture: ComponentFixture<unknown>) {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
  }

  async function abrir(campanha: Campanha) {
    const fixture = TestBed.createComponent(DetalheDisparo);
    fixture.componentRef.setInput('id', campanha.id);
    fixture.detectChanges();
    http.expectOne(`/api/v1/disparos/campanhas/${campanha.id}`).flush(campanha);
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('mostra só os botões que as ações da API permitem', async () => {
    const { raiz } = await abrir(detalhe('a'));
    const botoes = rotulosDosBotoes(raiz).join(' | ');
    expect(botoes).toContain('Pausar');
    expect(botoes).not.toContain('Retomar');
    expect(botoes).not.toContain('Aprovar');
    expect(texto(raiz)).toContain('Andamento');
    expect(texto(raiz)).toContain('Etiqueta: Cliente');
  });

  it('rascunho convida a continuar editando e não mostra as abas de resultado', async () => {
    const { raiz } = await abrir(
      detalhe('r', {
        status: 'RASCUNHO',
        contadores: { ...CONTADORES_ZERADOS },
        acoes: { ...SEM_ACOES, editar: true, editarConteudo: true, excluir: true, duplicar: true },
      }),
    );
    expect(rotulosDosBotoes(raiz)).toContain('Continuar editando');
    expect(raiz.querySelector('app-abas')).toBeNull();
    expect(texto(raiz)).toContain('ainda é um rascunho');
  });

  it('campanha pausada avisa o motivo e oferece retomar', async () => {
    const { raiz } = await abrir(
      detalhe('p', {
        status: 'PAUSADA',
        pausaMotivo: '5 falhas seguidas',
        acoes: { ...SEM_ACOES, retomar: true, cancelar: true },
      }),
    );
    expect(texto(raiz.querySelector('.aviso'))).toContain('5 falhas seguidas');
    expect(rotulosDosBotoes(raiz)).toContain('Retomar');
  });

  it('aguardando aprovação: o líder vê Aprovar e Reprovar', async () => {
    const { raiz } = await abrir(
      detalhe('g', {
        status: 'AGUARDANDO_APROVACAO',
        acoes: { ...SEM_ACOES, aprovar: true, reprovar: true },
      }),
    );
    const botoes = rotulosDosBotoes(raiz);
    expect(botoes).toContain('Aprovar');
    expect(botoes).toContain('Reprovar');
    expect(texto(raiz.querySelector('.aviso'))).toContain('aprovação do líder');
  });

  it('fora da janela de envio explica quando volta a enviar', async () => {
    const { raiz } = await abrir(
      detalhe('j', { aguardando: { motivo: 'janela_de_envio', ate: '2026-10-31T11:00:00.000Z' } }),
    );
    expect(texto(raiz.querySelector('.aviso'))).toContain('Fora do horário de envio');
  });

  it('o progresso ao vivo mexe nos números sem recarregar', async () => {
    const { fixture, raiz } = await abrir(detalhe('a'));
    socket.ultimo().simularConexao();
    socket.ultimo().receber('campanha.progresso', {
      campanhaId: 'a',
      status: 'EM_ANDAMENTO',
      contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 0, enviados: 10 },
      proximoEnvioEm: null,
      pausaMotivo: null,
      em: '2026-10-30T12:10:00.000Z',
    });
    await passar(fixture);
    expect(texto(raiz)).toContain('100% concluído');
    http.expectNone('/api/v1/disparos/campanhas/a');
  });

  it('campanha de outra área (404) mostra "não encontrada"', async () => {
    const fixture = TestBed.createComponent(DetalheDisparo);
    fixture.componentRef.setInput('id', 'x');
    fixture.detectChanges();
    http
      .expectOne('/api/v1/disparos/campanhas/x')
      .flush(
        { statusCode: 404, erro: 'nao_encontrado', mensagem: 'x' },
        { status: 404, statusText: 'Not Found' },
      );
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(texto(fixture.nativeElement)).toContain('Campanha não encontrada');
  });
});
