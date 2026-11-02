import { semQuebraNumeroUnidade } from './indicadores';

describe('semQuebraNumeroUnidade', () => {
  it('prende o número à palavra seguinte com um espaço inseparável', () => {
    expect(semQuebraNumeroUnidade('Leads em 30 dias')).toBe('Leads em 30\u00a0dias');
    expect(semQuebraNumeroUnidade('Leads em 7 dias')).toBe('Leads em 7\u00a0dias');
  });

  it('não mexe no resto do texto', () => {
    expect(semQuebraNumeroUnidade('Leads no trimestre')).toBe('Leads no trimestre');
    expect(semQuebraNumeroUnidade('Receita recorrente (MRR)')).toBe('Receita recorrente (MRR)');
    expect(semQuebraNumeroUnidade('Top 3 (CS)')).toBe('Top 3 (CS)');
  });
});
