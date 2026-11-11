import { LucideLayoutDashboard, LucideSquareKanban } from '@lucide/angular';

import { MODULOS_BASE, moduloBasePorRota } from './modulos';
import {
  agruparModulos,
  GRUPOS,
  MODULOS,
  moduloDaNavegacaoPorRota,
  moduloDoFunil,
  moduloPorId,
  moduloPorRota,
  modulosDaNavegacao,
} from './navegacao';
import { listarPapeis } from './papeis';
import { perfilDeTeste, setoresDeTeste } from './sessao/sessao-de-teste';
import { definirRegistroDeSetores } from './setores/setores';

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

  it('R12: o setor de Marketing (líder e membro) não vê o Atendimento (a API recusa)', () => {
    const modulo = moduloPorId('atendimento');
    const acesso = (papel: Parameters<typeof perfilDeTeste>[0]) => {
      const perfil = perfilDeTeste(papel);
      return modulo?.acesso?.(perfil.permissoes, perfil.usuario) ?? true;
    };
    expect(acesso('LIDER_MARKETING')).toBe(false);
    expect(acesso('MARKETING')).toBe(false);
    expect(acesso('LIDER_CS')).toBe(true);
    expect(acesso('COMERCIAL')).toBe(true);
    expect(acesso('C_LEVEL')).toBe(true);
  });

  describe('funis por setor (setores criados depois)', () => {
    const POS_VENDA = { chave: 'POS_VENDA', nome: 'Pós-venda' };
    const idsDosFunis = (areas?: readonly string[]) =>
      modulosDaNavegacao(areas)
        .filter((modulo) => modulo.grupo === 'funis')
        .map((modulo) => modulo.id);
    afterEach(() => definirRegistroDeSetores([]));

    it('antes de a lista chegar, os de base (e o setor da própria pessoa)', () => {
      definirRegistroDeSetores([]);
      expect(idsDosFunis()).toEqual(['funil-marketing', 'funil-comercial', 'funil-cs']);
      expect(idsDosFunis(['POS_VENDA'])).toEqual([
        'funil-marketing',
        'funil-comercial',
        'funil-cs',
        'funil-pos_venda',
      ]);
    });

    it('um item por setor ativo, na ordem da jornada; o desativado some', () => {
      // `ordem` 0: o setor novo vem antes de todos; empate de ordem desempata pelo nome.
      definirRegistroDeSetores(setoresDeTeste([{ ...POS_VENDA, ordem: 0 }]));
      expect(idsDosFunis()).toEqual([
        'funil-pos_venda',
        'funil-marketing',
        'funil-comercial',
        'funil-cs',
      ]);
      definirRegistroDeSetores(setoresDeTeste([{ ...POS_VENDA, ordem: 2 }]));
      expect(idsDosFunis()).toEqual([
        'funil-marketing',
        'funil-comercial',
        'funil-pos_venda',
        'funil-cs',
      ]);
      definirRegistroDeSetores(setoresDeTeste([POS_VENDA]));
      const novo = modulosDaNavegacao().find((modulo) => modulo.id === 'funil-pos_venda');
      expect(novo).toMatchObject({
        rotulo: 'Pós-venda',
        rota: '/funis/pos_venda',
        grupo: 'funis',
        status: 'pronto',
        icone: LucideSquareKanban,
      });
      // Os de base mantêm ícone e descrição; o nome é o atual do setor.
      const cs = modulosDaNavegacao().find((modulo) => modulo.id === 'funil-cs');
      expect(cs?.icone).toBe(moduloPorId('funil-cs')?.icone);
      expect(cs?.descricao).toBe(moduloPorId('funil-cs')?.descricao);
      definirRegistroDeSetores(setoresDeTeste([{ ...POS_VENDA, ativo: false }]));
      expect(idsDosFunis(['POS_VENDA'])).not.toContain('funil-pos_venda');
    });

    it('Admin e C-level acessam o funil de qualquer setor; os demais, os do areasVisiveis', () => {
      const modulo = moduloDoFunil('POS_VENDA');
      const pode = (perfil: ReturnType<typeof perfilDeTeste>) =>
        modulo.acesso?.(perfil.permissoes, perfil.usuario);
      // A sessão do Admin é anterior ao setor: o areasVisiveis dela não o tem.
      expect(pode(perfilDeTeste('ADMIN'))).toBe(true);
      expect(pode(perfilDeTeste('C_LEVEL'))).toBe(true);
      expect(pode(perfilDeTeste('COMERCIAL'))).toBe(false);
      expect(pode(perfilDeTeste('LIDER_CS'))).toBe(false);
      const membro = perfilDeTeste('MEMBRO', {
        usuario: { area: 'POS_VENDA' },
        permissoes: { areasVisiveis: ['POS_VENDA'] },
      });
      expect(pode(membro)).toBe(true);
    });

    it('acha o funil de qualquer setor pela URL (o id de funil na URL não é setor)', () => {
      definirRegistroDeSetores([]);
      expect(moduloDaNavegacaoPorRota('/funis/pos_venda/123?funil=x')?.rotulo).toBe('Pos venda');
      definirRegistroDeSetores(setoresDeTeste([POS_VENDA]));
      expect(moduloDaNavegacaoPorRota('/funis/pos_venda')?.rotulo).toBe('Pós-venda');
      expect(moduloDaNavegacaoPorRota('/funis/cs/9')?.id).toBe('funil-cs');
      expect(moduloDaNavegacaoPorRota('/empresas/1')?.id).toBe('contatos');
      expect(
        moduloDaNavegacaoPorRota('/funis/0b8f3c2e-1d4a-4f6b-9c7d-2e5f8a1b3c4d'),
      ).toBeUndefined();
      expect(moduloDaNavegacaoPorRota('/nada')).toBeUndefined();
    });
  });

  it('lista papéis em português', () => {
    expect(listarPapeis(['ADMIN', 'C_LEVEL', 'LIDER'])).toBe('Admin, C-level e Líder');
    expect(listarPapeis(['ADMIN'])).toBe('Admin');
  });
});
