/**
 * Formatos do SDR com IA nas telas do Atendimento, do contato e do negócio
 * (`crmbrl-api/src/sdr`, rotas `/api/v1/sdr/conversas`, `/sdr/sugestoes`, `/sdr/contatos` e
 * `/sdr/negocios`; regras na R31). Os nomes e os enums são os da API.
 */

export type SituacaoSdr =
  'ATIVA' | 'HUMANO' | 'PASSADA_HUMANO' | 'QUALIFICADA' | 'DESQUALIFICADA' | 'ENCERRADA';
export type ModoSdr = 'DESLIGADO' | 'AUTOMATICO' | 'SUGESTAO';
export type TemperaturaSdr = 'QUENTE' | 'MORNO' | 'FRIO';
export type AcaoSdr = 'CONTINUAR' | 'QUALIFICADO' | 'DESQUALIFICADO' | 'PASSAR_HUMANO';
export type TipoDecisaoSdr =
  | 'ASSUMIU'
  | 'TURNO'
  | 'QUALIFICADO'
  | 'DESQUALIFICADO'
  | 'PASSOU_HUMANO'
  | 'HUMANO_ASSUMIU'
  | 'DEVOLVIDA'
  | 'BLOQUEIO'
  | 'FALHA';

/** O que a linha da lista e o cabeçalho da conversa sabem do SDR (`SdrDaConversaDto`). */
export interface SdrDaConversa {
  readonly situacao: SituacaoSdr;
  readonly modo: ModoSdr;
  readonly nota: number | null;
  readonly temperatura: TemperaturaSdr | null;
}

/** O que o cartão do negócio no funil mostra (`SdrDoCartaoDto`). */
export interface SdrDoCartao {
  readonly temperatura: TemperaturaSdr;
  readonly nota: number | null;
  readonly situacao: SituacaoSdr;
}

export interface CriterioDaQualificacao {
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo: string;
  readonly obrigatorio: boolean;
  readonly peso: number;
  readonly descoberto: boolean;
  readonly valorFormatado: string | null;
  /** 0 a 1. */
  readonly confianca: number | null;
  /** Hoje sempre `IA`; uma pessoa que corrige o campo vira `PESSOA`. */
  readonly origem: string | null;
  readonly destino: string | null;
  readonly atualizadoEm: string | null;
}

export interface QualificacaoDoSdr {
  readonly conversaId: string;
  readonly situacao: SituacaoSdr;
  readonly rotuloDaSituacao: string;
  readonly nota: number | null;
  readonly temperatura: TemperaturaSdr | null;
  readonly notaMinima: number;
  readonly faixas: { readonly quente: number; readonly morno: number };
  readonly resumo: string | null;
  readonly motivo: string | null;
  readonly negocioId: string | null;
  readonly criterios: readonly CriterioDaQualificacao[];
  readonly faltamObrigatorios: readonly string[];
  readonly atualizadoEm: string;
}

export interface DecisaoDoSdr {
  readonly id: string;
  readonly conversaId: string | null;
  readonly tipo: TipoDecisaoSdr;
  readonly acao: AcaoSdr | null;
  readonly titulo: string;
  readonly motivo: string | null;
  readonly resumo: string | null;
  readonly nota: number | null;
  readonly temperatura: TemperaturaSdr | null;
  readonly modo: ModoSdr | null;
  readonly usuario: { readonly id: string; readonly nome: string } | null;
  readonly criadoEm: string;
}

export interface SugestaoDoSdr {
  readonly id: string;
  readonly texto: string;
  readonly acao: AcaoSdr;
  readonly motivo: string | null;
  readonly resumo: string | null;
  readonly criadoEm: string;
}

/** `GET /sdr/conversas/:id` (e o que "assumir", "devolver", "aprovar" devolvem). */
export interface EstadoDoSdr {
  readonly conversaId: string;
  /** Nulo = a IA nunca atendeu esta conversa. */
  readonly situacao: SituacaoSdr | null;
  readonly rotuloDaSituacao: string | null;
  /** A IA está atendendo (selo "IA atendendo"). */
  readonly ativa: boolean;
  readonly modo: ModoSdr | null;
  readonly humano: { readonly id: string; readonly nome: string } | null;
  readonly qualificacao: QualificacaoDoSdr | null;
  readonly sugestao: SugestaoDoSdr | null;
  readonly decisoes: readonly DecisaoDoSdr[];
  readonly acoes: {
    readonly assumir: boolean;
    readonly devolver: boolean;
    readonly aprovarSugestao: boolean;
    readonly descartarSugestao: boolean;
  };
}

/** Cartão de qualificação do contato ou do negócio. */
export interface RespostaQualificacao {
  readonly qualificacao: QualificacaoDoSdr | null;
}
