import { definirRegistroDeSetores } from '../../nucleo/setores/setores';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { TestBed } from '@angular/core/testing';
import { funilDeTeste } from './funis-de-teste';
import {
  agruparPorSetor,
  falhaClara,
  mensagemDeNivel,
  nivelDoFunil,
  opcoesDeFunisPorSetor,
  podeAgirNoFunil,
  podeConfigurarPorNivel,
} from './nivel-funil';
import { ErroApi } from '../../nucleo/api/erro-api';

describe('níveis no funil (R5.12)', () => {
  it('só VER não age; MEMBRO, GESTOR e CONFIGURAR agem; só CONFIGURAR configura', () => {
    expect(podeAgirNoFunil('VER')).toBe(false);
    expect(podeAgirNoFunil('MEMBRO')).toBe(true);
    expect(podeAgirNoFunil('GESTOR')).toBe(true);
    expect(podeAgirNoFunil('CONFIGURAR')).toBe(true);
    expect(podeConfigurarPorNivel('GESTOR')).toBe(false);
    expect(podeConfigurarPorNivel('CONFIGURAR')).toBe(true);
  });

  it('usa o nível da API; sem ele, cai nas permissões do perfil', () => {
    const perfil = entrarComo('LIDER_COMERCIAL');
    expect(nivelDoFunil(funilDeTeste({ nivel: 'VER' }), perfil)).toBe('VER');
    expect(nivelDoFunil(funilDeTeste(), perfil)).toBe('CONFIGURAR');
    expect(nivelDoFunil(funilDeTeste({ area: 'CS' }), perfil)).toBe('GESTOR');
    expect(nivelDoFunil(null, perfil)).toBe('VER');
    expect(TestBed.inject(SessaoService).perfil()).not.toBeNull();
  });

  it('mensagens claras para R5.12, R5.13 e R5.5; o resto passa como veio', () => {
    expect(mensagemDeNivel('R5.12', 'x')).toContain('só pode ver');
    expect(mensagemDeNivel('R5.13', 'x')).toContain('não pode ser responsável');
    expect(mensagemDeNivel('R5.5', 'x')).toContain('reabre negócios');
    expect(mensagemDeNivel(null, 'padrão')).toBe('padrão');
  });

  it('falhaClara troca só os 403/422 de nível', () => {
    const erro = (status: number, regra: string) =>
      new ErroApi({
        status,
        codigo: status === 403 ? 'sem_permissao' : 'regra_violada',
        mensagemDaApi: 'da API',
        detalhes: { regra },
      } as never);
    expect(falhaClara(erro(403, 'R5.12'))).toContain('só pode ver');
    expect(falhaClara(erro(422, 'R5.13'))).toContain('não pode ser responsável');
    const outro = erro(422, 'R5.2');
    expect(falhaClara(outro)).toBe(outro);
  });
});

describe('agrupamento por setor', () => {
  beforeEach(() => definirRegistroDeSetores([]));

  const funis = [
    funilDeTeste({
      id: 'cs',
      nome: 'Pós-venda',
      area: 'CS',
      nomeSetor: 'Customer Success',
      base: false,
    }),
    funilDeTeste({ id: 'c2', nome: 'Parcerias', base: false }),
    funilDeTeste({ id: 'c1', nome: 'Comercial' }),
    funilDeTeste({ id: 'sup', nome: 'Suporte', area: 'SUPORTE', nomeSetor: 'Suporte', base: true }),
    funilDeTeste({ id: 'm', nome: 'Marketing', area: 'MARKETING', nomeSetor: 'Marketing' }),
  ];

  it('setores de base primeiro, os demais por nome; funil-base antes dos extras', () => {
    const grupos = agruparPorSetor(funis);
    expect(grupos.map((g) => g.nome)).toEqual([
      'Marketing',
      'Comercial',
      'Customer Success',
      'Suporte',
    ]);
    expect(grupos[1].funis.map((f) => f.nome)).toEqual(['Comercial', 'Parcerias']);
  });

  it('as opções do seletor levam o nome do setor como grupo e pulam os arquivados', () => {
    const opcoes = opcoesDeFunisPorSetor([
      ...funis,
      funilDeTeste({ id: 'x', nome: 'Velho', ativo: false }),
    ]);
    expect(opcoes.map((o) => `${o.grupo}/${o.rotulo}`)).toEqual([
      'Marketing/Marketing',
      'Comercial/Comercial',
      'Comercial/Parcerias',
      'Customer Success/Pós-venda',
      'Suporte/Suporte',
    ]);
  });
});
