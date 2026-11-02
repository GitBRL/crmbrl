import { TestBed } from '@angular/core/testing';

import {
  alternarDia,
  descreverDias,
  descreverJanela,
  erroDaJanela,
  horaCurta,
  JANELA_COMERCIAL,
  JANELA_SEMPRE,
} from './janela-envio';
import { SeletorJanelaEnvio } from './seletor-janela-envio';

describe('janela de envio (funções)', () => {
  it('descreve os dias em linguagem simples', () => {
    expect(descreverDias([1, 2, 3, 4, 5])).toBe('de segunda a sexta');
    expect(descreverDias([0, 1, 2, 3, 4, 5, 6])).toBe('todos os dias');
    expect(descreverDias([6, 0])).toBe('aos domingos e sábados');
    expect(descreverDias([1, 3, 5])).toBe('às segundas, quartas e sextas');
  });

  it('formata as horas e a frase da janela', () => {
    expect(horaCurta('08:00')).toBe('8h');
    expect(horaCurta('18:30')).toBe('18h30');
    expect(descreverJanela(JANELA_COMERCIAL)).toBe(
      'Envia de segunda a sexta, das 8h às 18h (horário de Brasília).',
    );
  });

  it('aponta janelas que não servem', () => {
    expect(erroDaJanela(JANELA_COMERCIAL)).toBeNull();
    expect(erroDaJanela({ ...JANELA_COMERCIAL, dias: [] })).toContain('ao menos um dia');
    expect(erroDaJanela({ ...JANELA_COMERCIAL, inicio: '18:00', fim: '08:00' })).toContain(
      'depois da hora de início',
    );
    expect(erroDaJanela({ ...JANELA_COMERCIAL, inicio: '' })).toContain('hora de início');
  });

  it('alterna um dia mantendo a ordem', () => {
    expect(alternarDia([1, 5], 3)).toEqual([1, 3, 5]);
    expect(alternarDia([1, 3, 5], 3)).toEqual([1, 5]);
  });
});

describe('SeletorJanelaEnvio', () => {
  function criar() {
    const fixture = TestBed.createComponent(SeletorJanelaEnvio);
    return { fixture, raiz: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
  }

  it('mostra sete dias com nome completo, marca os escolhidos e resume a regra', async () => {
    const { fixture, raiz } = criar();
    await fixture.whenStable();
    const dias = [...raiz.querySelectorAll<HTMLButtonElement>('.dias__dia')];
    expect(dias.length).toBe(7);
    expect(dias[1].getAttribute('aria-label')).toBe('segunda-feira');
    expect(dias.map((d) => d.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'true',
      'true',
      'true',
      'true',
      'false',
    ]);
    expect(raiz.querySelector('.janela__resumo')?.textContent).toContain('das 8h às 18h');
  });

  it('clicar no dia alterna; o atalho "Todos os dias" troca a janela e o fuso fica', async () => {
    const { fixture, raiz, c } = criar();
    await fixture.whenStable();
    raiz.querySelectorAll<HTMLButtonElement>('.dias__dia')[0].click();
    expect(c.valor().dias).toEqual([0, 1, 2, 3, 4, 5]);
    const atalhos = raiz.querySelectorAll<HTMLButtonElement>('.janela__atalhos button');
    atalhos[1].click();
    expect(c.valor()).toEqual(JANELA_SEMPRE);
    atalhos[0].click();
    expect(c.valor()).toEqual(JANELA_COMERCIAL);
  });

  it('sem dia marcado, a frase vira o erro em role=alert', async () => {
    const { fixture, raiz, c } = criar();
    c.valor.set({ ...JANELA_COMERCIAL, dias: [] });
    await fixture.whenStable();
    const alerta = raiz.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('ao menos um dia');
  });
});
