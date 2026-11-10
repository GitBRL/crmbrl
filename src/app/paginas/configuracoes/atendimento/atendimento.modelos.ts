import type { Papel } from '../../../nucleo/papeis';
import type { Area } from '../../../nucleo/sessao/perfil';
import type { HorarioDeAtendimento, TipoCanal } from '../canais/canais.modelos';

/**
 * Contratos da configuração do Atendimento (R12): crmbrl-api, `src/atendimento/dto/fila.dto.ts`,
 * `resposta-rapida.dto.ts` e `canal-atendimento.dto.ts`. Filas e respostas rápidas: Admin, C-level
 * e o líder do setor; horário e satisfação dos canais: Admin e C-level (o líder vê).
 */

export type { HorarioDeAtendimento };

/** Áreas que atendem (o Marketing não usa o Atendimento). */
/** Setor que atende (chave): todos os ativos, menos o Marketing (R12). */
export type AreaDoAtendimento = string;

export type EstrategiaFila = 'RODIZIO' | 'MENOR_CARGA' | 'MANUAL';

/** Por que a pessoa está (ou não) na distribuição da fila. */
export type MotivoNaFila =
  | 'AREA'
  | 'NA_LISTA'
  | 'RETIRADO'
  | 'FORA_DA_LISTA'
  | 'LIDER'
  | 'CONVITE_PENDENTE'
  | 'PRIMEIRO_ACESSO_PENDENTE';

export interface Pessoa {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl: string | null;
}

export interface PessoaNaFila extends Pessoa {
  readonly papel: Papel;
  /** Recebe conversas desta fila agora. */
  readonly participa: boolean;
  readonly motivo: MotivoNaFila;
  /** Conversas em aberto com a pessoa agora. */
  readonly emAberto: number;
}

export interface ResumoCanal {
  readonly id: string;
  readonly tipo: TipoCanal;
  readonly nome: string;
  readonly ativo: boolean;
}

export interface Fila {
  readonly id: string;
  /** Filas criadas pelo sistema. */
  readonly chave: string | null;
  readonly nome: string;
  readonly area: AreaDoAtendimento;
  readonly descricao: string | null;
  /** Minutos para a primeira resposta (`null` = sem SLA). */
  readonly slaPrimeiraRespostaMinutos: number | null;
  /** Minutos para resolver (`null` = sem SLA). */
  readonly slaResolucaoMinutos: number | null;
  readonly estrategia: EstrategiaFila;
  readonly ativa: boolean;
  /** `AREA`: todos os membros ativos do setor (menos os retirados); `LISTA`: só a lista. */
  readonly modoParticipantes: 'AREA' | 'LISTA';
  /** Pessoas ativas do setor, na ordem do rodízio. */
  readonly pessoas: readonly PessoaNaFila[];
  /** Quem recebe a próxima conversa (`null`: ninguém; fica na fila). */
  readonly proximo: Pessoa | null;
  readonly canais: readonly ResumoCanal[];
  readonly conversasEmAberto: number;
  readonly conversasSemResponsavel: number;
  readonly podeEditar: boolean;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface DadosFila {
  readonly nome?: string;
  readonly area?: AreaDoAtendimento;
  readonly descricao?: string | null;
  readonly slaPrimeiraRespostaMinutos?: number | null;
  readonly slaResolucaoMinutos?: number | null;
  readonly estrategia?: EstrategiaFila;
  readonly ativa?: boolean;
  /** Substitui a lista (vazia = o setor inteiro). */
  readonly participantes?: readonly string[];
}

/** SLA: até 30 dias para a primeira resposta e 365 dias para a resolução (em minutos). */
export const SLA_PRIMEIRA_RESPOSTA_MAXIMO = 30 * 24 * 60;
export const SLA_RESOLUCAO_MAXIMO = 365 * 24 * 60;

// Canais (horário e satisfação) -----------------------------------------------------------

export interface SituacaoDoHorario {
  readonly aberto: boolean;
  /** Fechado: quando abre de novo. */
  readonly proximaAbertura: string | null;
  /** Aberto: quando fecha (`null` = não fecha nos próximos dias). */
  readonly proximoFechamento: string | null;
}

export interface CanalDoAtendimento {
  readonly id: string;
  readonly tipo: TipoCanal;
  readonly nome: string;
  readonly ativo: boolean;
  /** O módulo do canal está instalado nesta API. */
  readonly disponivel: boolean;
  readonly filaPadrao: { readonly id: string; readonly nome: string; readonly area: Area } | null;
  /** `null` = atende 24 horas. */
  readonly horarioAtendimento: HorarioDeAtendimento | null;
  readonly situacaoHorario: SituacaoDoHorario;
  /** Resposta automática fora do horário (`null` = não responde). */
  readonly mensagemForaHorario: string | null;
  readonly pesquisaSatisfacao: boolean;
  /** `null` = a pergunta padrão. */
  readonly mensagemSatisfacao: string | null;
  readonly perguntaPadrao: string;
  readonly conversasEmAberto: number;
  readonly ultimoErro: string | null;
  readonly ultimoErroEm: string | null;
  readonly podeEditar: boolean;
}

export interface DadosAtendimentoDoCanal {
  readonly filaPadraoId?: string | null;
  readonly horarioAtendimento?: HorarioDeAtendimento | null;
  readonly mensagemForaHorario?: string | null;
  readonly pesquisaSatisfacao?: boolean;
  readonly mensagemSatisfacao?: string | null;
}

export const TAMANHO_MAXIMO_AUTOMATICA = 1000;

// Respostas rápidas --------------------------------------------------------------------------

export interface ArquivoDaResposta {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly tamanho: number;
}

export interface RespostaRapida {
  readonly id: string;
  /** Sem a barra: no compositor, "/boas-vindas". */
  readonly atalho: string;
  readonly titulo: string;
  readonly texto: string;
  /** `null` = vale para todos os setores. */
  readonly area: Area | null;
  readonly arquivo: ArquivoDaResposta | null;
  readonly ativa: boolean;
  readonly variaveis: readonly string[];
  readonly criadoPor: Pessoa | null;
  readonly podeEditar: boolean;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface DadosRespostaRapida {
  readonly atalho?: string;
  readonly titulo?: string;
  readonly texto?: string;
  readonly area?: AreaDoAtendimento | null;
  readonly ativa?: boolean;
}

export interface Variavel {
  /** `contato.primeiroNome` (sem as chaves). */
  readonly nome: string;
  readonly descricao: string;
  readonly exemplo: string;
}

export interface FiltroRespostas {
  readonly busca?: string;
  readonly area?: AreaDoAtendimento | 'GLOBAL';
  readonly incluirInativas?: boolean;
}

/** Tamanho máximo do texto de uma mensagem (crmbrl-api, `dto/mensagem.dto.ts`). */
export const TAMANHO_MAXIMO_TEXTO_RESPOSTA = 4096;
