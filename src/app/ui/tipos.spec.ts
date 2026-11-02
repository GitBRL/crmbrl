import { gerarId, partirTitulo } from './tipos';

describe('tipos (utilitários de ui/)', () => {
  it('partirTitulo: o "·" fica preso ao título e o complemento vem à parte', () => {
    expect(partirTitulo('Visão geral', '· outubro de 2026')).toEqual({
      principal: 'Visão geral ',
      ponto: '· ',
      complemento: 'outubro de 2026',
    });
    expect(partirTitulo('Análise com IA', 'beta')).toEqual({
      principal: 'Análise com IA ',
      ponto: '',
      complemento: 'beta',
    });
    expect(partirTitulo('Atividades recentes', null)).toEqual({
      principal: 'Atividades recentes',
      ponto: '',
      complemento: '',
    });
  });

  it('gerarId: ids únicos com o prefixo', () => {
    const a = gerarId('dica');
    const b = gerarId('dica');
    expect(a).toMatch(/^dica-\d+$/);
    expect(a).not.toBe(b);
  });
});
