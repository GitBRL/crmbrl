import { TestBed } from '@angular/core/testing';

import { entrarComo } from '../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../nucleo/tempo-real/tempo-real-de-teste';
import {
  ATRASO_RECONECTANDO_MS,
  DURACAO_RECONECTADO_MS,
  IndicadorConexao,
} from './indicador-conexao';

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe('IndicadorConexao', () => {
  let falso: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    vi.useFakeTimers();
    falso = provideSocketFalso();
    TestBed.configureTestingModule({ providers: [falso.providers] });
  });
  afterEach(() => vi.useRealTimers());

  async function criar() {
    const fixture = TestBed.createComponent(IndicadorConexao);
    entrarComo('COMERCIAL');
    TestBed.tick();
    await microtarefas();
    fixture.detectChanges();
    const pilula = () => fixture.nativeElement.querySelector('.conexao') as HTMLElement;
    const passar = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, pilula, passar, socket: falso.ultimo() };
  }

  it('a região viva existe sempre e não mostra nada enquanto a conexão vai bem', async () => {
    const { fixture, pilula, socket } = await criar();
    expect(pilula().getAttribute('role')).toBe('status');
    socket.simularConexao();
    fixture.detectChanges();
    expect(pilula().textContent?.trim()).toBe('');
    expect(pilula().classList).not.toContain('conexao--visivel');
  });

  it('primeira conexão demorando: "Conectando…" depois do atraso e "Conectado" quando dá certo', async () => {
    const { fixture, pilula, passar, socket } = await criar();
    passar(ATRASO_RECONECTANDO_MS - 100);
    expect(pilula().textContent?.trim()).toBe('');
    passar(100);
    expect(pilula().textContent).toContain('Conectando…');
    expect(pilula().classList).toContain('conexao--visivel');

    socket.simularConexao();
    fixture.detectChanges();
    expect(pilula().textContent?.trim()).toBe('Conectado');
    expect(pilula().classList).toContain('conexao--ok');
    passar(DURACAO_RECONECTADO_MS);
    expect(pilula().textContent?.trim()).toBe('');
  });

  it('queda: "Reconectando…" só se durar mais que o atraso; ao voltar, "Conectado de novo"', async () => {
    const { fixture, pilula, passar, socket } = await criar();
    socket.simularConexao();
    fixture.detectChanges();

    // Queda curta não aparece.
    socket.simularQueda();
    fixture.detectChanges();
    passar(ATRASO_RECONECTANDO_MS / 2);
    socket.simularConexao();
    fixture.detectChanges();
    passar(ATRASO_RECONECTANDO_MS);
    expect(pilula().textContent?.trim()).toBe('');

    socket.simularQueda();
    fixture.detectChanges();
    passar(ATRASO_RECONECTANDO_MS);
    expect(pilula().textContent).toContain('Reconectando…');
    expect(pilula().querySelector('.visualmente-oculto')?.textContent).toContain(
      'atualizações ao vivo',
    );

    socket.simularConexao();
    fixture.detectChanges();
    expect(pilula().textContent?.trim()).toBe('Conectado de novo');
    passar(DURACAO_RECONECTADO_MS);
    expect(pilula().classList).not.toContain('conexao--visivel');
  });
});
