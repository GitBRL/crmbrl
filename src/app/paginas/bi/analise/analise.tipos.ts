import type { IdPainel } from '../bi.tipos';

/** Contrato de `/bi/analise` (crmbrl-api, src/bi/analise): estado, streaming SSE e histórico. */

export interface EstadoAnalise {
  readonly configurada: boolean;
  readonly comoConfigurar: string | null;
  readonly disponivel: boolean;
  readonly motivo: string | null;
  readonly modelo: string;
  readonly limiteDiario: number;
  readonly usadasHoje: number;
  readonly restantesHoje: number;
  readonly maxPerguntasPorAnalise: number;
}

export type Tendencia = 'positiva' | 'negativa' | 'neutra';
export type Nivel = 'alta' | 'media' | 'baixa';

export interface LinkAcao {
  readonly caminho: string;
  readonly parametros: Readonly<Record<string, string>>;
  readonly rotulo: string;
  /** O link foi corrigido pela API para algo que existe e que a pessoa pode ver. */
  readonly ajustado: boolean;
}

/** Os campos podem vir incompletos enquanto o JSON está em formação (evento `parcial`). */
export interface Destaque {
  readonly titulo?: string;
  readonly detalhe?: string;
  readonly tendencia?: Tendencia;
}
export interface Risco {
  readonly titulo?: string;
  readonly detalhe?: string;
  readonly gravidade?: Nivel;
}
export interface Acao {
  readonly titulo?: string;
  readonly detalhe?: string;
  readonly prioridade?: Nivel;
  /** Ausente no parcial; vem no resultado final. */
  readonly link?: LinkAcao | null;
}

/** O que a tela mostra: o resultado da análise ou a resposta de uma pergunta, inteiro ou parcial. */
export interface ConteudoAnalise {
  /** `resumo` na análise, `resposta` na pergunta. */
  readonly texto?: string;
  readonly destaques?: readonly Destaque[];
  readonly riscos?: readonly Risco[];
  readonly acoes?: readonly Acao[];
}

export interface Tokens {
  readonly entrada: number;
  readonly saida: number;
  readonly cacheLeitura: number;
  readonly cacheEscrita: number;
}

export type CodigoErroAnalise =
  | 'tempo_esgotado'
  | 'indisponivel'
  | 'chave_recusada'
  | 'recusada'
  | 'resposta_incompleta'
  | 'resposta_invalida'
  | 'cancelada'
  | 'erro';

export type EventoAnalise =
  | {
      readonly evento: 'inicio';
      readonly tipo: 'analise' | 'pergunta';
      readonly analiseId: string;
      readonly perguntaId: string | null;
    }
  | { readonly evento: 'fase'; readonly fase: 'pensando' | 'escrevendo' }
  | { readonly evento: 'parcial'; readonly conteudo: ConteudoAnalise }
  | { readonly evento: 'nova_tentativa'; readonly tentativa: number; readonly motivo: string }
  | {
      readonly evento: 'concluido';
      readonly tipo: 'analise' | 'pergunta';
      readonly analiseId: string;
      readonly perguntaId: string | null;
      readonly conteudo: ConteudoAnalise;
      readonly restantesHoje: number | null;
    }
  | {
      readonly evento: 'erro';
      readonly codigo: CodigoErroAnalise;
      readonly mensagem: string;
      readonly analiseId: string | null;
      readonly perguntaId: string | null;
    };

export type StatusAnalise = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'FALHOU';

export interface ItemHistorico {
  readonly id: string;
  readonly usuario: { readonly id: string; readonly nome: string };
  readonly painel: IdPainel;
  readonly periodo: { readonly de: string; readonly ate: string } | null;
  readonly filtros: Readonly<Record<string, unknown>> | null;
  readonly status: StatusAnalise;
  readonly erro: string | null;
  readonly resumo: string | null;
  readonly modelo: string;
  readonly tentativas: number;
  readonly totalPerguntas: number;
  readonly tokens: Tokens | null;
  readonly duracaoMs: number | null;
  readonly criadoEm: string;
  readonly concluidoEm: string | null;
}

export interface PerguntaSalva {
  readonly id: string;
  readonly pergunta: string;
  readonly resposta: ConteudoAnalise | null;
  readonly status: StatusAnalise;
  readonly erro: string | null;
  readonly tentativas: number;
  readonly tokens: Tokens | null;
  readonly duracaoMs: number | null;
  readonly criadoEm: string;
}

export interface DetalheAnalise extends ItemHistorico {
  readonly resultado: ConteudoAnalise | null;
  /** Os números agregados que foram enviados à IA. */
  readonly entrada: unknown;
  readonly perguntas: readonly PerguntaSalva[];
}

export interface FiltrosHistorico {
  readonly pagina: number;
  readonly porPagina: number;
  readonly usuarioId: string | null;
  readonly painel: IdPainel | null;
}

export const ROTULO_STATUS: Readonly<Record<StatusAnalise, string>> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  FALHOU: 'Falhou',
};

export const ROTULO_NIVEL: Readonly<Record<Nivel, string>> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const ROTULO_TENDENCIA: Readonly<Record<Tendencia, string>> = {
  positiva: 'Positiva',
  negativa: 'Negativa',
  neutra: 'Neutra',
};
