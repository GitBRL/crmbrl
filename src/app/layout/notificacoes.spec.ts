import { TestBed } from '@angular/core/testing';

import { Notificacoes } from './notificacoes';

describe('Notificacoes', () => {
  function criar() {
    const fixture = TestBed.createComponent(Notificacoes);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const sino = raiz.querySelector('button') as HTMLButtonElement;
    return { fixture, raiz, sino };
  }

  it('sino com ponto e o número de novidades no nome acessível', () => {
    const { sino, raiz } = criar();
    expect(sino.getAttribute('aria-label')).toBe('Notificações, 3 novas');
    expect(sino.getAttribute('aria-expanded')).toBe('false');
    expect(sino.querySelector('.botao-icone__ponto')).not.toBeNull();
    expect(raiz.querySelector('section')).toBeNull();
  });

  it('abre o painel de exemplo e marca tudo como lido', async () => {
    const { fixture, raiz, sino } = criar();
    sino.click();
    await fixture.whenStable();

    const painel = raiz.querySelector('section') as HTMLElement;
    expect(sino.getAttribute('aria-expanded')).toBe('true');
    expect(sino.getAttribute('aria-controls')).toBe(painel.id);
    expect(raiz.querySelector(`#${painel.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Notificações',
    );
    expect(painel.textContent).toContain('Dados de exemplo');
    // Os mesmos fatos e horários das "Atividades recentes" da visão geral.
    expect(painel.textContent).toContain(
      'O webhook “Site” criou o lead Maria Souza; o rodízio entregou para Rafael Souto.',
    );
    const tempos = [...painel.querySelectorAll('time')].map((tempo) => tempo.textContent?.trim());
    expect(tempos).toEqual(['há 4 min', 'há 47 min', 'ontem']);
    expect(painel.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(sino.getAttribute('aria-label')).toBe('Notificações');
    expect(sino.querySelector('.botao-icone__ponto')).toBeNull();
  });

  it('os tempos envelhecem: são recalculados a cada abertura do painel', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { fixture, raiz, sino } = criar();
      vi.setSystemTime(Date.now() + 10 * 60_000);
      sino.click();
      await fixture.whenStable();
      const primeiro = () => raiz.querySelector('section time')?.textContent?.trim();
      expect(primeiro()).toBe('há 14 min');

      sino.click(); // fecha
      vi.setSystemTime(Date.now() + 60 * 60_000);
      sino.click(); // abre de novo, uma hora depois
      await fixture.whenStable();
      expect(primeiro()).toBe('há 1 h');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Esc fecha e devolve o foco ao sino; novo clique alterna', async () => {
    const { fixture, raiz, sino } = criar();
    sino.click();
    await fixture.whenStable();
    raiz
      .querySelector('section')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(raiz.querySelector('section')).toBeNull();
    expect(document.activeElement).toBe(sino);

    sino.click();
    await fixture.whenStable();
    sino.click();
    await fixture.whenStable();
    expect(raiz.querySelector('section')).toBeNull();
  });

  it('fecha com toque fora', async () => {
    const { fixture, raiz, sino } = criar();
    sino.click();
    await fixture.whenStable();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(raiz.querySelector('section')).toBeNull();
  });
});
