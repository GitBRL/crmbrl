import { TestBed } from '@angular/core/testing';

import { ehLider, rotuloDoPapel, type Papel } from '../papeis';
import { definirRegistroDeSetores, nomeDoSetor, type Setor } from '../setores/setores';
import type { Area, NivelUsuario, Perfil, Permissoes, UsuarioDoPerfil } from './perfil';
import { SessaoService } from './sessao.service';

/**
 * **Só para testes (specs).** Perfis falsos por papel, com as mesmas permissões que a API
 * calcula (crmbrl-api, comum/dominio/permissoes.ts). Nenhum código do app importa isto.
 *
 * O papel de teste aceita os atalhos `LIDER_COMERCIAL`, `COMERCIAL`, `LIDER_MARKETING`,
 * `MARKETING`, `LIDER_CS` e `CS` (= Líder/Membro do setor); `LIDER` e `MEMBRO` sozinhos valem
 * para o setor Comercial.
 *
 * ```ts
 * beforeEach(() => entrarComo('LIDER_COMERCIAL'));
 * entrarComo('ADMIN', { deveTrocarSenha: true });
 * const perfil = perfilDeTeste('CS', { usuario: { nome: 'Lucas Prado' } });
 * ```
 */
export type PapelDeTeste =
  Papel | 'LIDER_COMERCIAL' | 'COMERCIAL' | 'LIDER_MARKETING' | 'MARKETING' | 'LIDER_CS' | 'CS';

/** Papel e setor de um papel de teste. */
export function desdobrarPapel(papel: PapelDeTeste): { papel: Papel; area: Area | null } {
  switch (papel) {
    case 'ADMIN':
    case 'C_LEVEL':
      return { papel, area: null };
    case 'LIDER':
    case 'LIDER_COMERCIAL':
      return { papel: 'LIDER', area: 'COMERCIAL' };
    case 'MEMBRO':
    case 'COMERCIAL':
      return { papel: 'MEMBRO', area: 'COMERCIAL' };
    case 'LIDER_MARKETING':
      return { papel: 'LIDER', area: 'MARKETING' };
    case 'MARKETING':
      return { papel: 'MEMBRO', area: 'MARKETING' };
    case 'LIDER_CS':
      return { papel: 'LIDER', area: 'CS' };
    case 'CS':
      return { papel: 'MEMBRO', area: 'CS' };
  }
}

/** Nomes fictícios, um por papel de teste. */
export const NOMES_DE_TESTE: Readonly<Record<PapelDeTeste, string>> = {
  ADMIN: 'Ana Ribeiro',
  C_LEVEL: 'Marcos Andrade',
  LIDER: 'Carla Nogueira',
  MEMBRO: 'João Batista',
  LIDER_COMERCIAL: 'Carla Nogueira',
  COMERCIAL: 'João Batista',
  LIDER_MARKETING: 'Beatriz Lima',
  MARKETING: 'Rafael Souto',
  LIDER_CS: 'Fernanda Rocha',
  CS: 'Lucas Prado',
};

/** Final do id de cada papel de teste (estável: os specs comparam ids). */
const NUMERO_DO_PAPEL: Readonly<Record<PapelDeTeste, number>> = {
  ADMIN: 1,
  C_LEVEL: 2,
  LIDER: 3,
  LIDER_COMERCIAL: 3,
  MEMBRO: 4,
  COMERCIAL: 4,
  LIDER_MARKETING: 5,
  MARKETING: 6,
  LIDER_CS: 7,
  CS: 8,
};

/** Os três setores de base, como a API os devolve em `GET /setores` (para specs). */
export function setoresDeTeste(extras: readonly Partial<Setor>[] = []): readonly Setor[] {
  const base = (chave: string, nome: string, ordem: number, cor: string): Setor => ({
    chave,
    nome,
    descricao: null,
    cor,
    base: true,
    ativo: true,
    ordem,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    lideres: null,
    contagens: null,
  });
  return [
    base('MARKETING', 'Marketing', 1, 'ciano'),
    base('COMERCIAL', 'Comercial', 2, 'menta'),
    base('CS', 'Customer Success', 3, 'lima'),
    ...extras.map((extra, indice): Setor => ({
      ...base(extra.chave ?? `SETOR_${indice}`, extra.nome ?? 'Setor', 10 + indice, 'coral'),
      base: false,
      ...extra,
    })),
  ];
}

export function permissoesDoPapel(papelDeTeste: PapelDeTeste): Permissoes {
  const { papel, area } = desdobrarPapel(papelDeTeste);
  const admin = papel === 'ADMIN';
  const diretoria = admin || papel === 'C_LEVEL';
  const lider = ehLider({ papel });
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
  return ehLider({ papel }) ? 'LIDER' : 'MEMBRO';
}

export interface AjustesPerfil {
  readonly usuario?: Partial<UsuarioDoPerfil>;
  readonly permissoes?: Partial<Permissoes>;
  readonly deveTrocarSenha?: boolean;
}

export function perfilDeTeste(
  papelDeTeste: PapelDeTeste = 'ADMIN',
  ajustes: AjustesPerfil = {},
): Perfil {
  const { papel, area } = desdobrarPapel(papelDeTeste);
  definirRegistroDeSetores(setoresDeTeste());
  const nome = NOMES_DE_TESTE[papelDeTeste];
  const email = `${nome.split(' ')[0].toLowerCase()}@brl.com.br`;
  return {
    usuario: {
      id: `00000000-0000-4000-8000-00000000000${NUMERO_DO_PAPEL[papelDeTeste]}`,
      nome,
      email,
      papel,
      rotuloPapel: rotuloDoPapel(papel, area ? nomeDoSetor(area) : null),
      area,
      nomeSetor: area ? nomeDoSetor(area) : null,
      nivel: nivelDoPapel(papel),
      lider: null,
      avatarUrl: null,
      telefone: null,
      ultimoAcessoEm: null,
      ...ajustes.usuario,
    },
    deveTrocarSenha: ajustes.deveTrocarSenha ?? false,
    permissoes: { ...permissoesDoPapel(papelDeTeste), ...ajustes.permissoes },
    sessao: { criadaEm: '2026-10-21T12:00:00.000Z', expiraEm: '2026-11-20T12:00:00.000Z' },
  };
}

/** Põe um perfil falso como sessão atual do `SessaoService` do TestBed. */
export function entrarComo(papel: PapelDeTeste = 'ADMIN', ajustes: AjustesPerfil = {}): Perfil {
  return TestBed.inject(SessaoService).definirPerfil(perfilDeTeste(papel, ajustes));
}
