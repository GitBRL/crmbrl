import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { Atendimento, TEXTO_ATALHOS } from './atendimento';
import { assentar, conversaResumo, paginaConversas, texto } from './dados-de-teste';
import { EstadoAtendimento } from './estado-atendimento';

describe('Atendimento (página)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function criar(papel: Parameters<typeof entrarComo>[0] = 'COMERCIAL') {
    entrarComo(papel);
    const fixture = TestBed.createComponent(Atendimento);
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === '/api/v1/atendimento/conversas')
      .flush(
        paginaConversas([conversaResumo({ id: 'a' }), conversaResumo({ id: 'b' })], {
          contadores: { minhas: 2, semResponsavel: 0, todas: 2, naoLidas: 0 },
        }),
      );
    http.match(() => true).forEach((p) => p.flush([]));
    await assentar();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const estado = fixture.debugElement.injector.get(EstadoAtendimento);
    return { fixture, raiz, estado };
  }

  it('título com as em aberto, a frase e as dicas de filas e atalhos', async () => {
    const { raiz } = await criar();
    expect(texto(raiz.querySelector('h1'))).toBe('Atendimento · 2 em aberto');
    expect(texto(raiz.querySelector('.cabecalho__frase'))).toContain('num só lugar');
    expect(raiz.querySelectorAll('.cabecalho__dicas app-dica')).toHaveLength(2);
    expect(TEXTO_ATALHOS).toContain('Alt+↓');
    // Sem conversa aberta: o convite para escolher uma.
    expect(texto(raiz.querySelector('.caixa__conversa'))).toContain('Escolha uma conversa');
  });

  it('a dica de filas diz o que cada posição vê', async () => {
    const membro = await criar('COMERCIAL');
    const dica = membro.raiz.querySelector('.cabecalho__dicas app-dica')!;
    expect(dica.textContent).toContain('sem responsável das filas do seu setor');
  });

  it('Alt+↓ e Alt+↑ abrem a próxima e a anterior; Alt+B pede o foco na busca', async () => {
    const { fixture, estado } = await criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(navegar).toHaveBeenLastCalledWith(['/atendimento', 'a']);
    estado.selecionadaId.set('a');
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(navegar).toHaveBeenLastCalledWith(['/atendimento', 'b']);
    estado.selecionadaId.set('b');
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        code: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(navegar).toHaveBeenLastCalledWith(['/atendimento', 'a']);

    const evento = new KeyboardEvent('keydown', {
      key: 'b',
      code: 'KeyB',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(evento);
    await fixture.whenStable();
    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement?.closest('app-campo-busca')).not.toBeNull();
  });

  it('Líder Marketing: explica que o Atendimento não é do papel, sem pedir dados à API', async () => {
    entrarComo('LIDER_MARKETING');
    const fixture = TestBed.createComponent(Atendimento);
    await fixture.whenStable();
    await assentar();
    http.expectNone(() => true);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(texto(raiz.querySelector('.sem-acesso'))).toContain(
      'O Atendimento não faz parte do seu papel',
    );
    expect(raiz.querySelector<HTMLElement>('.caixa')!.hidden).toBe(true);
  });

  it('sem conversa aberta, Alt+M não faz nada (não há compositor)', async () => {
    await criar();
    const evento = new KeyboardEvent('keydown', {
      key: 'm',
      code: 'KeyM',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
  });
});
