import type { Papel } from '../papeis';

/**
 * Contrato do `GET /api/v1/auth/eu` (também a resposta de `auth/entrar` e `auth/senha`):
 * crmbrl-api, auth/dto/auth.dto.ts (`PerfilDto`).
 */

/** Áreas de negócio (enum `Area` do banco). Admin e C-level não têm área. */
export type Area = 'MARKETING' | 'COMERCIAL' | 'CS';

export const AREAS: readonly Area[] = ['MARKETING', 'COMERCIAL', 'CS'];

export const ROTULO_AREA: Readonly<Record<Area, string>> = {
  MARKETING: 'Marketing',
  COMERCIAL: 'Comercial',
  CS: 'Customer Success',
};

/** Pedaço da URL de cada funil: `/funis/marketing`, `/funis/comercial`, `/funis/cs`. */
export type SlugArea = 'marketing' | 'comercial' | 'cs';

export const SLUG_AREA: Readonly<Record<Area, SlugArea>> = {
  MARKETING: 'marketing',
  COMERCIAL: 'comercial',
  CS: 'cs',
};

/** `"comercial"` → `"COMERCIAL"`; outro texto → `null`. */
export function areaDoSlug(slug: string | null | undefined): Area | null {
  const area = AREAS.find((item) => SLUG_AREA[item] === slug?.toLowerCase());
  return area ?? null;
}

/**
 * Alcance de uma permissão (matriz da §12 das regras):
 * `TODOS` sem restrição · `AREA` o que é da área do usuário · `EQUIPE` ele e os liderados ·
 * `PROPRIOS` só o que é dele (em negócios, também os sem responsável da área, R5.9) ·
 * `NENHUM` não pode.
 */
export type Escopo = 'TODOS' | 'AREA' | 'EQUIPE' | 'PROPRIOS' | 'NENHUM';

/** Permissões derivadas do papel (a API continua conferindo cada operação). */
export interface Permissoes {
  /** Criar, editar, desligar, reativar e redefinir senha de usuários (R1.5). */
  readonly gerenciarUsuarios: boolean;
  readonly verUsuarios: Escopo;
  /** Configurar funis e etapas (R5.1). */
  readonly configurarFunis: Escopo;
  /** Ver e mover negócios (R5.9). */
  readonly verNegocios: Escopo;
  /** Reabrir negócio ganho ou perdido (R5.5). */
  readonly reabrirNegocios: Escopo;
  readonly verContatos: boolean;
  readonly editarContatos: Escopo;
  /** Excluir com anonimização (R4.6). */
  readonly anonimizarContatos: boolean;
  /** Ver atividades (R6.4). */
  readonly verAtividades: Escopo;
  /** Passagens entre funis (R5.7). */
  readonly configurarPassagens: boolean;
  /** Rodízio de leads (R5.8). */
  readonly configurarRodizio: Escopo;
  /** Webhooks de entrada e saída (R8, R9). */
  readonly gerenciarWebhooks: boolean;
  /** Auditoria (R3.4). */
  readonly verAuditoria: boolean;
  /** Logs técnicos (R3.6). */
  readonly verLogsTecnicos: boolean;
  readonly verDocumentacaoApi: boolean;
  /** Áreas cujos funis o usuário vê (Admin e C-level: todas). */
  readonly areasVisiveis: readonly Area[];
}

export type NivelUsuario = 'ADMINISTRADOR' | 'DIRETORIA' | 'LIDER' | 'MEMBRO';

export interface ResumoUsuario {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
}

export interface UsuarioDoPerfil {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  /** "Líder Comercial". */
  readonly rotuloPapel: string;
  /** `null` para Admin e C-level. */
  readonly area: Area | null;
  readonly nivel: NivelUsuario;
  readonly lider: ResumoUsuario | null;
  readonly avatarUrl: string | null;
  readonly telefone: string | null;
  readonly ultimoAcessoEm: string | null;
}

export interface Perfil {
  readonly usuario: UsuarioDoPerfil;
  /** Troca de senha obrigatória (primeiro acesso ou senha temporária, R2.7). */
  readonly deveTrocarSenha: boolean;
  readonly permissoes: Permissoes;
  readonly sessao: { readonly criadaEm: string; readonly expiraEm: string };
}

/** Resposta de `POST /auth/senha/token` (o link do convite ou da redefinição ainda vale?). */
export interface ConsultaToken {
  readonly valido: boolean;
  readonly tipo?: 'CONVITE' | 'REDEFINICAO';
  readonly nome?: string;
  readonly email?: string;
  readonly expiraEm?: string;
}

/** Senha: de 8 a 128 caracteres (R2.1). */
export const SENHA_MINIMO = 8;
export const SENHA_MAXIMO = 128;
