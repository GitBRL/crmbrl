import { PAPEIS } from '../papeis';
import { podeImportarContatos } from './perfil';
import { perfilDeTeste } from './sessao-de-teste';

describe('podeImportarContatos (R16.1)', () => {
  it('Admin, C-level e líderes importam; membros não', () => {
    const podem = PAPEIS.filter((papel) => {
      const perfil = perfilDeTeste(papel);
      return podeImportarContatos(perfil.permissoes, perfil);
    });
    expect(podem).toEqual(['ADMIN', 'C_LEVEL', 'LIDER']);
  });

  it('sem a permissão no perfil, vale o papel', () => {
    const perfil = perfilDeTeste('COMERCIAL');
    const { importarContatos: _ignorada, ...resto } = perfil.permissoes;
    expect(podeImportarContatos(resto, perfil)).toBe(false);
    const lider = perfilDeTeste('LIDER_CS');
    const { importarContatos: _outra, ...restoLider } = lider.permissoes;
    expect(podeImportarContatos(restoLider, lider)).toBe(true);
  });
});
