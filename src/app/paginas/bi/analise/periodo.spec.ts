import { describe, expect, it } from 'vitest';

import { textoDoPeriodo } from './periodo';

describe('textoDoPeriodo', () => {
  it('mostra o último dia: o fim da API é a meia-noite do dia seguinte', () => {
    const de = new Date(2026, 9, 1).toISOString();
    const ate = new Date(2026, 9, 31).toISOString(); // exclusivo: vai até 30/10
    expect(textoDoPeriodo({ de, ate })).toBe('01/10/2026 a 30/10/2026');
  });
});
