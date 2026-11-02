import { TestBed } from '@angular/core/testing';

import { LIDERES, PAPEIS, ROTULO_PAPEL, type Papel } from '../papeis';
import type { Area, NivelUsuario, Perfil, Permissoes, UsuarioDoPerfil } from './perfil';
import { SessaoService } from './sessao.service';

/**
 * **Só para testes (specs).** Perfis falsos por papel, com as mesmas permissões que a API
 * calcula (crmbrl-api, comum/dominio/permissoes.ts). Nenhum código do app importa isto.
 *
 * ```ts
 * beforeEach(() => entrarComo('LIDER_COMERCIAL'));
 * entrarComo('ADMIN', { deveTrocarSenha: true });
 * const perfil = perfilDeTeste('CS', { usuario: { nome: 'Lucas Prado' } });
 * ```
 */

const AREA_DO_PAPEL: Readonly<Record<Papel, Area | null>> = {
  ADMIN: null,
  C_LEVEL: null,
  LIDER_COMERCIAL: 'COMERCIAL',
  COMERCIAL: 'COMERCIAL',
  LIDER_MARKETING: 'MARKETING',
  MARKETING: 'MARKETING',
  LIDER_CS: 'CS',
  CS: 'CS',
};

/** Nomes fictícios, um por papel. */
export const NOMES_DE_TESTE: Readonly<Record<Papel, string>> = {
  ADMIN: 'Ana Ribeiro',
  C_LEVEL: 'Marcos Andrade',
  LIDER_COMERCIAL: 'Carla Nogueira',
  COMERCIAL: 'João Batista',
  LIDER_MARKETING: 'Beatriz Lima',
  MARKETING: 'Rafael Souto',
  LIDER_CS: 'Fernanda Rocha',
  CS: 'Lucas Prado',
};

export function permissoesDoPapel(papel: Papel): Permissoes {
  const admin = papel === 'ADMIN';
  const diretoria = admin || papel === 'C_LEVEL';
  const lider = LIDERES.includes(papel);
  const area = AREA_DO_PAPEL[papel];
  return {
    gerenciarUsuarios: admin,
    verUsuarios: diretoria ? 'TODOS' : lider ? 'EQUIPE' : 'PROPRIOS',
    configurarFunis: diretoria ? 'TODOS' : lider ? 'AREA' : 'NENHUM',
    verNegocios: diretoria ? 'TODOS' : lider ? 'AREA' : 'PROPRIOS',
    reabrirNegocios: diretoria ? 'TODOS' : lider ? 'AREA' : 'NENHUM',
    verContatos: true,
    editarContatos: diretoria ? 'TODOS' : lider ? 'EQUIPE' : 'PROPRIOS',
    anonimizarContatos: admin,
    verAtividades: diretoria ? 'TODOS' : lider ? 'EQUIPE' : 'PROPRIOS',
    configurarPassagens: diretoria,
    configurarRodizio: diretoria ? 'TODOS' : lider ? 'AREA' : 'NENHUM',
    importarContatos: diretoria || lider,
    gerenciarWebhooks: admin,
    verAuditoria: diretoria,
    verLogsTecnicos: admin,
    verDocumentacaoApi: admin,
    areasVisiveis: diretoria ? ['MARKETING', 'COMERCIAL', 'CS'] : area ? [area] : [],
  };
}

function nivelDoPapel(papel: Papel): NivelUsuario {
  if (papel === 'ADMIN') {
    return 'ADMINISTRADOR';
  }
  if (papel === 'C_LEVEL') {
    return 'DIRETORIA';
  }
  return LIDERES.includes(papel) ? 'LIDER' : 'MEMBRO';
}

export interface AjustesPerfil {
  readonly usuario?: Partial<UsuarioDoPerfil>;
  readonly permissoes?: Partial<Permissoes>;
  readonly deveTrocarSenha?: boolean;
}

export function perfilDeTeste(papel: Papel = 'ADMIN', ajustes: AjustesPerfil = {}): Perfil {
  const nome = NOMES_DE_TESTE[papel];
  const email = `${nome.split(' ')[0].toLowerCase()}@brl.com.br`;
  return {
    usuario: {
      id: `00000000-0000-4000-8000-00000000000${PAPEIS.indexOf(papel) + 1}`,
      nome,
      email,
      papel,
      rotuloPapel: ROTULO_PAPEL[papel],
      area: AREA_DO_PAPEL[papel],
      nivel: nivelDoPapel(papel),
      lider: null,
      avatarUrl: null,
      telefone: null,
      ultimoAcessoEm: null,
      ...ajustes.usuario,
    },
    deveTrocarSenha: ajustes.deveTrocarSenha ?? false,
    permissoes: { ...permissoesDoPapel(papel), ...ajustes.permissoes },
    sessao: { criadaEm: '2026-10-21T12:00:00.000Z', expiraEm: '2026-11-20T12:00:00.000Z' },
  };
}

/** Põe um perfil falso como sessão atual do `SessaoService` do TestBed. */
export function entrarComo(papel: Papel = 'ADMIN', ajustes: AjustesPerfil = {}): Perfil {
  return TestBed.inject(SessaoService).definirPerfil(perfilDeTeste(papel, ajustes));
}
