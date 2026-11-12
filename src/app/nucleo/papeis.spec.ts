import { describe, expect, it } from 'vitest';

import {
  ehDiretoria,
  ehDoSetor,
  ehLiderDe,
  ehMembroDe,
  listarPapeis,
  papelExigeSetor,
  rotuloDe,
  rotuloDoPapel,
} from './papeis';

describe('papéis', () => {
  it('rótulo: Líder leva o nome do setor, Membro é o próprio setor', () => {
    expect(rotuloDoPapel('ADMIN')).toBe('Admin');
    expect(rotuloDoPapel('C_LEVEL')).toBe('C-level');
    expect(rotuloDoPapel('LIDER', 'Comercial')).toBe('Líder Comercial');
    expect(rotuloDoPapel('MEMBRO', 'Customer Success')).toBe('Customer Success');
    expect(rotuloDoPapel('LIDER')).toBe('Líder');
    expect(rotuloDoPapel('MEMBRO')).toBe('Membro');
  });

  it('prefere o rótulo que vem da API', () => {
    expect(rotuloDe({ papel: 'LIDER', rotuloPapel: 'Líder Pós-venda' })).toBe('Líder Pós-venda');
    expect(rotuloDe({ papel: 'LIDER', nomeSetor: 'Marketing' })).toBe('Líder Marketing');
  });

  it('só Líder e Membro exigem setor', () => {
    expect(papelExigeSetor('LIDER')).toBe(true);
    expect(papelExigeSetor('MEMBRO')).toBe(true);
    expect(papelExigeSetor('ADMIN')).toBe(false);
    expect(papelExigeSetor('C_LEVEL')).toBe(false);
    expect(papelExigeSetor(null)).toBe(false);
  });

  it('confere papel e setor', () => {
    const lider = { papel: 'LIDER', area: 'CS' } as const;
    const membro = { papel: 'MEMBRO', area: 'POS_VENDA' } as const;
    expect(ehLiderDe(lider, 'CS')).toBe(true);
    expect(ehLiderDe(lider, 'COMERCIAL')).toBe(false);
    expect(ehMembroDe(membro, 'POS_VENDA')).toBe(true);
    expect(ehDoSetor(membro, 'POS_VENDA')).toBe(true);
    expect(ehDoSetor({ papel: 'C_LEVEL', area: 'CS' }, 'CS')).toBe(false);
    expect(ehDiretoria({ papel: 'C_LEVEL' })).toBe(true);
    expect(ehDiretoria(lider)).toBe(false);
  });

  it('lista papéis em texto corrido', () => {
    expect(listarPapeis(['ADMIN', 'C_LEVEL', 'LIDER'])).toBe('Admin, C-level e Líder');
    expect(listarPapeis(['ADMIN'])).toBe('Admin');
  });
});
