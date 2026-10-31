import { describe, expect, it } from 'vitest';

import {
  formatarCelula,
  formatarDia,
  formatarDuracao,
  formatarMes,
  valorDoCartao,
} from './bi.formatos';

describe('formatos do BI', () => {
  it('duração em segundos, minutos, horas e dias', () => {
    expect(formatarDuracao(45)).toBe('45 s');
    expect(formatarDuracao(314)).toBe('5 min 14 s');
    expect(formatarDuracao(300)).toBe('5 min');
    expect(formatarDuracao(4420)).toBe('1 h 14 min');
    expect(formatarDuracao(200_000)).toBe('2 d 8 h');
  });

  it('datas e meses da API', () => {
    expect(formatarDia('2026-10-18')).toBe('18/10/2026');
    expect(formatarDia('2026-10-18', true)).toBe('18/10');
    expect(formatarMes('2026-03')).toBe('mar/26');
    expect(formatarDia('texto')).toBe('texto');
  });

  it('células: código da API traduzido, moeda, percentual, nota e vazio', () => {
    expect(formatarCelula('SITE', 'texto', 'origem')).toBe('Site');
    expect(formatarCelula('EM_ANDAMENTO', 'texto', 'status')).toBe('Em andamento');
    expect(formatarCelula('90+', 'texto', 'faixa')).toBe('Mais de 90 dias');
    expect(formatarCelula('Qualquer coisa', 'texto', 'nome')).toBe('Qualquer coisa');
    expect(formatarCelula(1234.5, 'moeda')).toBe('R$ 1.235');
    expect(formatarCelula(37.84, 'percentual')).toBe('37,8%');
    expect(formatarCelula(3.65, 'nota')).toBe('3,7');
    expect(formatarCelula(null, 'numero')).toBe('—');
    expect(formatarCelula('2026-10-18', 'data', 'previsao')).toBe('18/10/2026');
    expect(formatarCelula(14, 'numero', 'hora')).toBe('14 h');
  });

  it('valor do cartão: prefixo e unidade pequenos, sem valor vira nulo', () => {
    expect(valorDoCartao({ valor: 119500, unidade: 'moeda' })).toMatchObject({
      valor: '119,5',
      prefixo: 'R$',
      unidade: 'mil',
    });
    expect(valorDoCartao({ valor: 300, unidade: 'segundos' })).toMatchObject({
      valor: 5,
      unidade: 'min',
    });
    expect(valorDoCartao({ valor: 40, unidade: 'segundos' })).toMatchObject({
      valor: 40,
      unidade: 's',
    });
    expect(valorDoCartao({ valor: 72.5, unidade: 'percentual' })).toMatchObject({ unidade: '%' });
    expect(valorDoCartao({ valor: 3.65, unidade: 'nota' })).toMatchObject({ unidade: '/ 5' });
    expect(valorDoCartao({ valor: 12, unidade: 'numero' })?.casas).toBe('1.0-0');
    expect(valorDoCartao({ valor: null, unidade: 'numero' })).toBeNull();
  });
});
