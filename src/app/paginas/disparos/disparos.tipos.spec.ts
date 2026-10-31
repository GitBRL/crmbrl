import { describe, expect, it } from 'vitest';

import {
  aplicarProgresso,
  CONTADORES_ZERADOS,
  type EventoCampanhaProgresso,
  formatarPercentual,
  type ResumoCampanha,
} from './disparos.tipos';

describe('formatarPercentual', () => {
  it('usa vírgula e uma casa', () => {
    expect(formatarPercentual(33.333)).toBe('33,3%');
    expect(formatarPercentual(100)).toBe('100%');
    expect(formatarPercentual(null)).toBe('—');
  });
});

describe('aplicarProgresso', () => {
  const base = {
    id: 'c1',
    status: 'EM_ANDAMENTO',
    contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 10 },
    progresso: 0,
    proximoEnvioEm: null,
    pausaMotivo: null,
  } as unknown as ResumoCampanha;

  it('atualiza contadores, situação e o percentual (sem contar quem está enviando)', () => {
    const evento: EventoCampanhaProgresso = {
      campanhaId: 'c1',
      status: 'PAUSADA',
      contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 4, enviando: 1, enviados: 5 },
      proximoEnvioEm: null,
      pausaMotivo: 'falhas seguidas',
      em: '2026-10-30T12:00:00Z',
    };
    const novo = aplicarProgresso(base, evento);
    expect(novo.status).toBe('PAUSADA');
    expect(novo.progresso).toBe(50);
    expect(novo.pausaMotivo).toBe('falhas seguidas');
    expect(novo.contadores.enviados).toBe(5);
    expect(base.progresso).toBe(0);
  });
});
