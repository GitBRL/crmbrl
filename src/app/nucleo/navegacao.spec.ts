import { LucideLayoutDashboard } from '@lucide/angular';

import { MODULOS_BASE, moduloBasePorRota } from './modulos';
import { agruparModulos, GRUPOS, MODULOS, moduloPorId, moduloPorRota } from './navegacao';
import { listarPapeis } from './papeis';

describe('navegacao', () => {
  it('ids e rotas são únicos; módulos "em breve" têm fase e funcionalidades', () => {
    expect(new Set(MODULOS.map((modulo) => modulo.id)).size).toBe(MODULOS.length);
    expect(new Set(MODULOS.map((modulo) => modulo.rota)).size).toBe(MODULOS.length);
    for (const modulo of MODULOS.filter((item) => item.status === 'em-breve')) {
      expect(modulo.fase).toMatch(/^Fase \d$/);
      expect(modulo.funcionalidades.length).toBeGreaterThan(0);
      expect(modulo.descricao.length).toBeGreaterThan(0);
    }
  });

  it('acha o módulo pelo id e pela rota (com subcaminho, query e fragmento)', () => {
    expect(moduloPorId('funil-cs')?.rota).toBe('/funis/cs');
    expect(moduloPorId(null)).toBeUndefined();
    expect(moduloPorRota('/funis/cs/negocio/1?x=1#y')?.id).toBe('funil-cs');
    expect(moduloPorRota('/design-system#cores')?.id).toBe('design-system');
    expect(moduloPorRota('/nada')).toBeUndefined();
  });

  it('cada módulo tem o seu ícone; os dados sem ícone são os mesmos', () => {
    expect(MODULOS.map((modulo) => modulo.id)).toEqual(MODULOS_BASE.map((modulo) => modulo.id));
    const comIconePadrao = MODULOS.filter((modulo) => modulo.icone === LucideLayoutDashboard);
    expect(comIconePadrao.map((modulo) => modulo.id)).toEqual(['inicio']);
    expect(new Set(MODULOS.map((modulo) => modulo.icone)).size).toBe(MODULOS.length);
    expect(moduloBasePorRota('/empresas/1')?.id).toBe('contatos');
    expect('icone' in (moduloBasePorRota('/inicio') ?? {})).toBe(false);
  });

  it('agrupa para o menu: soltos primeiro, depois os grupos na ordem', () => {
    const secoes = agruparModulos();
    expect(secoes[0].grupo).toBeNull();
    expect(secoes[0].modulos.map((modulo) => modulo.id)).toEqual(['inicio', 'atendimento']);
    expect(secoes.slice(1).map((secao) => secao.grupo?.id)).toEqual(GRUPOS.map((g) => g.id));
    expect(agruparModulos([moduloPorId('bi')!]).map((secao) => secao.grupo?.id)).toEqual([
      'gestao',
    ]);
  });

  it('lista papéis em português', () => {
    expect(listarPapeis(['ADMIN', 'C_LEVEL', 'LIDER_CS'])).toBe('Admin, C-level e Líder CS');
    expect(listarPapeis(['ADMIN'])).toBe('Admin');
  });
});
