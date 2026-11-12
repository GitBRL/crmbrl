import { describe, expect, it } from 'vitest';

import { descreverPrimeiroAtendimento, duracaoAteAtendimento } from './primeiro-atendimento';

describe('primeiro atendimento (R6.7)', () => {
  const criadoEm = '2026-11-11T12:00:00.000Z';

  it('mostra "Ainda não atendido" sem primeira interação', () => {
    expect(descreverPrimeiroAtendimento({ criadoEm, primeiraInteracao: null })).toBe(
      'Ainda não atendido',
    );
    expect(descreverPrimeiroAtendimento({ criadoEm })).toBe('Ainda não atendido');
  });

  it('descreve tipo, pessoa e o tempo até o atendimento', () => {
    const texto = descreverPrimeiroAtendimento({
      criadoEm,
      primeiraInteracao: {
        em: '2026-11-11T14:10:00.000Z',
        tipo: 'LIGACAO',
        por: { id: 'u1', nome: 'Fulano' },
      },
    });
    expect(texto).toContain('Ligação · por Fulano (em 2 h 10 min)');
  });

  it('omite a pessoa excluída e nomeia os outros tipos', () => {
    const texto = descreverPrimeiroAtendimento({
      criadoEm,
      primeiraInteracao: { em: '2026-11-11T12:30:00.000Z', tipo: 'EMAIL', por: null },
    });
    expect(texto).toContain('E-mail (em 30 min)');
    expect(texto).not.toContain('por');
  });

  it('formata a duração em minutos, horas e dias', () => {
    const mais = (min: number) => new Date(Date.parse(criadoEm) + min * 60_000).toISOString();
    expect(duracaoAteAtendimento(criadoEm, criadoEm)).toBe('menos de 1 min');
    expect(duracaoAteAtendimento(criadoEm, mais(59))).toBe('59 min');
    expect(duracaoAteAtendimento(criadoEm, mais(120))).toBe('2 h');
    expect(duracaoAteAtendimento(criadoEm, mais(60 * 24))).toBe('1 dia');
    expect(duracaoAteAtendimento(criadoEm, mais(60 * 24 * 3 + 300))).toBe('3 dias');
  });
});
