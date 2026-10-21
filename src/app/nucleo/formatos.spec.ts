import { abreviarNumero, formatarMoedaAbreviada, formatarTempoRelativo } from './formatos';

describe('formatos', () => {
  it('abrevia números e moeda em pt-BR', () => {
    expect(abreviarNumero(48200, 'pt-BR')).toEqual({ numero: '48,2', sufixo: 'mil' });
    expect(abreviarNumero(950, 'pt-BR')).toEqual({ numero: '950', sufixo: '' });
    expect(formatarMoedaAbreviada(186000, 'pt-BR')).toBe('R$ 186 mil');
    expect(formatarMoedaAbreviada(1250000, 'pt-BR')).toBe('R$ 1,3 mi');
    expect(formatarMoedaAbreviada(980, 'pt-BR')).toBe('R$ 980');
  });

  it('escreve tempos relativos curtos', () => {
    const agora = new Date(2026, 9, 20, 15, 0, 0);
    const antes = (segundos: number) => new Date(agora.getTime() - segundos * 1000);
    expect(formatarTempoRelativo(antes(10), agora)).toBe('agora');
    expect(formatarTempoRelativo(antes(5 * 60), agora)).toBe('há 5 min');
    expect(formatarTempoRelativo(antes(2 * 3600), agora)).toBe('há 2 h');
    expect(formatarTempoRelativo(antes(26 * 3600), agora)).toBe('ontem');
    expect(formatarTempoRelativo(antes(3 * 86400), agora)).toBe('há 3 dias');
    expect(formatarTempoRelativo(new Date(2026, 8, 2), agora)).toBe('02/09/2026');
  });
});
