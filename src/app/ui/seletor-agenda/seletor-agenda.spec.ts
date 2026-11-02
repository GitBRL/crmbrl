import { TestBed } from '@angular/core/testing';

import { agendaPadrao, descreverAgenda, erroDaAgenda } from './agenda';
import { SeletorAgenda } from './seletor-agenda';

describe('agenda (funções)', () => {
  const campos = [{ valor: 'vencimento', rotulo: 'Vencimento da renovação' }];

  it('descreve cada modo em linguagem simples', () => {
    expect(descreverAgenda(agendaPadrao('agora'))).toBe('Começa assim que você confirmar.');
    expect(descreverAgenda({ ...agendaPadrao('data'), dataHora: '2027-03-05T14:30' })).toBe(
      'Começa em 05/03/2027 às 14h30 (horário de Brasília).',
    );
    expect(descreverAgenda({ ...agendaPadrao('recorrente'), diasSemana: [1, 3] })).toBe(
      'Toda semana, às segundas e quartas, às 9h.',
    );
    expect(
      descreverAgenda({ ...agendaPadrao('recorrente'), frequencia: 'mensal', diaMes: 5 }),
    ).toBe('Todo mês, no dia 5, às 9h.');
    expect(descreverAgenda({ ...agendaPadrao('relativa'), campo: 'vencimento' }, campos)).toBe(
      '3 dias antes de “Vencimento da renovação”, às 9h.',
    );
  });

  it('aponta o que falta', () => {
    expect(erroDaAgenda(agendaPadrao('data'))).toBe('Escolha o dia e a hora.');
    const passado = { ...agendaPadrao('data'), dataHora: '2020-01-01T10:00' };
    expect(erroDaAgenda(passado)).toBe('Escolha um momento no futuro.');
    expect(erroDaAgenda({ ...agendaPadrao('recorrente'), diasSemana: [] })).toContain(
      'dia da semana',
    );
    expect(
      erroDaAgenda({ ...agendaPadrao('recorrente'), frequencia: 'mensal', diaMes: 31 }),
    ).toContain('1 a 28');
    expect(erroDaAgenda(agendaPadrao('relativa'))).toBe('Escolha a data de referência.');
    expect(erroDaAgenda({ ...agendaPadrao('relativa'), campo: 'x', quantidade: 1.5 })).toContain(
      '0 a 365',
    );
    expect(erroDaAgenda(agendaPadrao('agora'))).toBeNull();
  });
});

describe('SeletorAgenda', () => {
  function criar(
    modos: readonly ('agora' | 'data' | 'recorrente' | 'relativa')[] = ['agora', 'data'],
  ) {
    const fixture = TestBed.createComponent(SeletorAgenda);
    fixture.componentRef.setInput('modos', modos);
    return { fixture, raiz: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
  }

  it('oferece só os modos pedidos e mostra os campos do modo escolhido', async () => {
    const { fixture, raiz, c } = criar();
    await fixture.whenStable();
    const radios = [...raiz.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.length).toBe(2);
    expect(raiz.querySelector('app-campo-data')).toBeNull();

    radios[1].click();
    await fixture.whenStable();
    expect(c.valor().modo).toBe('data');
    expect(raiz.querySelector('app-campo-data')).not.toBeNull();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toBe('Escolha o dia e a hora.');
  });

  it('recorrente semanal mostra os dias; mensal troca por dia do mês', async () => {
    const { fixture, raiz, c } = criar(['recorrente', 'relativa']);
    c.valor.set(agendaPadrao('recorrente'));
    await fixture.whenStable();
    expect(raiz.querySelectorAll('.dias__dia').length).toBe(7);
    c.valor.set({ ...c.valor(), frequencia: 'mensal' });
    await fixture.whenStable();
    expect(raiz.querySelector('.dias__dia')).toBeNull();
    expect(raiz.querySelector('app-campo-texto')).not.toBeNull();
    expect(raiz.querySelector('.agenda__resumo')?.textContent).toContain('Todo mês, no dia 1');
  });

  it('relativa usa os campos de data informados', async () => {
    const { fixture, raiz, c } = criar(['relativa']);
    fixture.componentRef.setInput('camposData', [{ valor: 'vencimento', rotulo: 'Vencimento' }]);
    c.valor.set({ ...agendaPadrao('relativa'), campo: 'vencimento' });
    await fixture.whenStable();
    expect(raiz.querySelector('.agenda__resumo')?.textContent).toBe(
      '3 dias antes de “Vencimento”, às 9h.',
    );
  });
});
