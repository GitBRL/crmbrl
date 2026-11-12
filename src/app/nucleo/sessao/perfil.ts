import type { Papel } from '../papeis';

/**
 * Contrato do `GET /api/v1/auth/eu` (também a resposta de `auth/entrar` e `auth/senha`):
 * crmbrl-api, auth/dto/auth.dto.ts (`PerfilDto`).
 */

/** Setor da pessoa: a chave do setor (`COMERCIAL`, `POS_VENDA`…). Admin e C-level não têm setor. */
export type Area = string;

/**
 * Alcance de uma permissão (matriz da §12 das regras):
 * `TODOS` sem restrição · `AREA` o que é do setor do usuário · `EQUIPE` ele e os liderados ·
 * `PROPRIOS` só o que é dele (em negócios, também os sem responsável do setor, R5.9) ·
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
  /**
   * Onda A — configurar os canais de atendimento (WhatsApp, chat do site, e-mail, Instagram,
   * Messenger). Opcional até a API mandar; sem ele vale `podeGerenciarCanais()`.
   */
  readonly gerenciarCanais?: boolean;
  /**
   * Onda A — filas, SLA, horário, satisfação e respostas rápidas do Atendimento. Opcional até
   * a API mandar; sem ele vale `podeConfigurarAtendimento()`.
   */
  readonly configurarAtendimento?: Escopo;
  /**
   * Onda B — importar contatos e empresas de planilha (R16). Opcional até a API mandar; sem
   * ele vale `podeImportarContatos()`.
   */
  readonly importarContatos?: boolean;
}

export type NivelUsuario = 'ADMINISTRADOR' | 'DIRETORIA' | 'LIDER' | 'MEMBRO';

export interface ResumoUsuario {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
  readonly area?: Area | null;
}

export interface UsuarioDoPerfil {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  /** "Líder Comercial". */
  readonly rotuloPapel: string;
  /** Chave do setor; `null` para Admin e C-level. */
  readonly area: Area | null;
  /** Nome do setor; `null` para Admin e C-level. */
  readonly nomeSetor?: string | null;
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

/**
 * Configurações → Canais: a permissão `gerenciarCanais` quando a API a manda; sem ela, só o
 * Admin (como as Integrações). A API continua conferindo cada operação.
 */
export function podeGerenciarCanais(permissoes: Permissoes, perfil: Perfil): boolean {
  return permissoes.gerenciarCanais ?? perfil.usuario.papel === 'ADMIN';
}

/**
 * Configurações → Atendimento: a permissão `configurarAtendimento` quando a API a manda; sem
 * ela, Admin, C-level e os líderes dos setores que atendem (todos menos o Marketing, R12).
 */
export function podeConfigurarAtendimento(permissoes: Permissoes, perfil: Perfil): boolean {
  if (permissoes.configurarAtendimento !== undefined) {
    return permissoes.configurarAtendimento !== 'NENHUM';
  }
  const { papel, area } = perfil.usuario;
  return papel === 'ADMIN' || papel === 'C_LEVEL' || (papel === 'LIDER' && area !== 'MARKETING');
}

/**
 * Contatos → Importar (R16): a permissão `importarContatos` quando a API a manda; sem ela,
 * Admin, C-level e os líderes.
 */
export function podeImportarContatos(permissoes: Permissoes, perfil: Perfil): boolean {
  return (
    permissoes.importarContatos ?? ['ADMIN', 'C_LEVEL', 'LIDER'].includes(perfil.usuario.papel)
  );
}
