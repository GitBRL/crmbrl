/**
 * Tipos e rótulos de Automações (API `/automacoes`, contrato da Onda B). A tela usa o formato da
 * API para o que já é simples; o que o editor de passos e o construtor de segmento mostram em
 * "modelo de tela" é convertido em `conversao.ts`.
 */

export type TipoGatilho = 'EVENTO' | 'DATA_RELATIVA' | 'RECORRENCIA';
export type EntidadeAutomacao = 'contato' | 'negocio' | 'atividade' | 'conversa';
export type CriterioParada = 'RESPONDEU' | 'GANHOU' | 'PERDEU' | 'SAIU_DO_SEGMENTO';
export type LimiteExecucao = 'UMA_VEZ' | 'UMA_VEZ_POR_PERIODO' | 'SEMPRE';
export type StatusExecucao = 'EM_ANDAMENTO' | 'AGUARDANDO' | 'CONCLUIDA' | 'FALHOU' | 'CANCELADA';

/** Formato JSON dos passos da API. */
export interface PassoApi {
  id: string;
  tipo: string;
  rotulo?: string;
  config?: Record<string, unknown>;
  ramos?: { id: string; rotulo?: string; passos: PassoApi[] }[];
}

export interface DefinicaoApi {
  passos: PassoApi[];
}

export interface CondicoesApi {
  segmento?: unknown;
  horario?: unknown;
}

export interface PendenciaOuErro {
  readonly mensagem: string;
}

export interface Automacao {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly ativa: boolean;
  readonly tipoGatilho: TipoGatilho;
  readonly evento: string | null;
  readonly gatilhoRotulo: string;
  readonly gatilhoConfig: Record<string, unknown> | null;
  readonly entidade: EntidadeAutomacao;
  readonly condicoes: CondicoesApi | null;
  readonly definicao: DefinicaoApi | null;
  readonly criteriosParada: readonly CriterioParada[];
  readonly limiteExecucao: LimiteExecucao;
  readonly limitePeriodoDias: number | null;
  readonly marketing: boolean;
  readonly modelo: string | null;
  readonly versao: number;
  readonly pendencias: readonly string[];
  readonly proximaExecucaoEm: string | null;
  readonly ultimaExecucaoEm: string | null;
  readonly criadoPor: { readonly id: string; readonly nome: string } | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly execucoes?: Partial<Record<StatusExecucao, number>>;
}

/** Corpo de criação e edição (todos os campos opcionais na edição). */
export interface CorpoAutomacao {
  nome?: string;
  descricao?: string | null;
  area?: string | null;
  tipoGatilho?: TipoGatilho;
  evento?: string | null;
  gatilhoConfig?: Record<string, unknown>;
  condicoes?: CondicoesApi;
  definicao?: DefinicaoApi;
  criteriosParada?: CriterioParada[];
  limiteExecucao?: LimiteExecucao;
  limitePeriodoDias?: number | null;
  marketing?: boolean;
}

export interface GatilhoDoCatalogo {
  readonly evento: string;
  readonly rotulo: string;
  readonly entidade: EntidadeAutomacao;
  readonly origem: 'evento' | 'agenda';
  readonly filtros: readonly string[];
}

export interface Catalogo {
  readonly gatilhos: readonly GatilhoDoCatalogo[];
  readonly camposDeData: readonly {
    readonly campo: string;
    readonly rotulo: string;
    readonly entidade: EntidadeAutomacao;
  }[];
}

export interface ModeloPronto {
  readonly chave: string;
  readonly nome: string;
  readonly descricao: string;
  readonly areas: readonly string[];
  readonly aConfigurar: readonly string[];
  readonly automacao?: {
    readonly tipoGatilho: TipoGatilho;
    readonly evento?: string;
    readonly gatilhoConfig: Record<string, unknown>;
    readonly definicao: DefinicaoApi;
  };
}

export interface ResultadoValidacao {
  readonly valido: boolean;
  readonly erros: readonly PendenciaOuErro[] | readonly string[];
  readonly pendencias: readonly string[];
  readonly entidade: EntidadeAutomacao | null;
}

export interface Execucao {
  readonly id: string;
  readonly automacaoId: string;
  readonly automacaoNome: string;
  readonly automacaoVersao: number;
  readonly status: StatusExecucao;
  readonly entidade: EntidadeAutomacao;
  readonly entidadeId: string;
  readonly contato: { readonly id: string; readonly nome: string } | null;
  readonly negocioId: string | null;
  readonly conversaId: string | null;
  readonly teste: boolean;
  readonly passoAtualId: string | null;
  readonly aguardandoAte: string | null;
  readonly motivoFim: string | null;
  readonly erro: string | null;
  readonly passosExecutados: number;
  readonly iniciadaEm: string;
  readonly concluidaEm: string | null;
}

export interface PassoExecutado {
  readonly ordem: number;
  readonly passoId: string;
  readonly tipo: string;
  readonly rotulo: string | null;
  readonly visita: number;
  readonly status: 'EXECUTANDO' | 'AGUARDANDO' | 'CONCLUIDO' | 'ERRO';
  readonly tentativas: number;
  readonly resultado: {
    readonly decisao?: {
      readonly acao?: string;
      readonly ramoId?: string;
      readonly motivo?: string;
    };
    readonly saida?: Record<string, unknown> | null;
  } | null;
  readonly erro: string | null;
  readonly iniciadoEm: string | null;
  readonly concluidoEm: string | null;
}

export interface ExecucaoDetalhe extends Execucao {
  readonly variaveis: unknown;
  readonly contexto: unknown;
  readonly definicao: DefinicaoApi | null;
  readonly passos: readonly PassoExecutado[];
}

export interface ResultadoTeste {
  readonly condicoesAtendidas: boolean;
  readonly motivoDasCondicoes: null | 'fora_do_segmento' | 'opt_out' | 'fora_da_area';
  readonly execucao: ExecucaoDetalhe | null;
}

export const ROTULO_STATUS_EXECUCAO: Readonly<Record<StatusExecucao, string>> = {
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO: 'Aguardando',
  CONCLUIDA: 'Concluída',
  FALHOU: 'Falhou',
  CANCELADA: 'Cancelada',
};

export const VARIANTE_STATUS_EXECUCAO: Readonly<
  Record<StatusExecucao, 'neutro' | 'ciano' | 'menta' | 'lima' | 'coral' | 'contorno'>
> = {
  EM_ANDAMENTO: 'ciano',
  AGUARDANDO: 'lima',
  CONCLUIDA: 'menta',
  FALHOU: 'coral',
  CANCELADA: 'neutro',
};

export const ROTULO_STATUS_PASSO: Readonly<Record<PassoExecutado['status'], string>> = {
  EXECUTANDO: 'Executando',
  AGUARDANDO: 'Aguardando',
  CONCLUIDO: 'Feito',
  ERRO: 'Com erro',
};

export const ROTULO_ENTIDADE: Readonly<Record<EntidadeAutomacao, string>> = {
  contato: 'Contato',
  negocio: 'Negócio',
  atividade: 'Atividade',
  conversa: 'Conversa',
};

export const ROTULO_TIPO_GATILHO: Readonly<Record<TipoGatilho, string>> = {
  EVENTO: 'Quando algo acontece',
  DATA_RELATIVA: 'Perto de uma data',
  RECORRENCIA: 'De tempos em tempos',
};

export const ROTULO_CRITERIO: Readonly<Record<CriterioParada, string>> = {
  RESPONDEU: 'O contato responder',
  GANHOU: 'O negócio for ganho',
  PERDEU: 'O negócio for perdido',
  SAIU_DO_SEGMENTO: 'O contato deixar de atender às condições',
};

export const ROTULO_MOTIVO_CONDICOES: Readonly<Record<string, string>> = {
  fora_do_segmento: 'A pessoa não atende às condições da automação.',
  opt_out: 'A pessoa pediu para não receber mensagens de marketing.',
  fora_da_area: 'O registro é de outra área.',
};

/** Rótulo do passo para quem lê o histórico. */
export const ROTULO_TIPO_PASSO: Readonly<Record<string, string>> = {
  'acao.whatsapp': 'Enviar WhatsApp',
  'acao.email': 'Enviar e-mail',
  'acao.atividade': 'Criar atividade',
  'acao.mover_etapa': 'Mover de etapa',
  'acao.atribuir': 'Atribuir responsável',
  'acao.etiquetar': 'Mudar etiquetas',
  'acao.criar_negocio': 'Criar negócio',
  'acao.notificar': 'Avisar alguém',
  'acao.webhook': 'Chamar webhook',
  'acao.chatbot': 'Iniciar chatbot',
  aguardar: 'Aguardar',
  condicao: 'Verificar condição',
  encerrar: 'Encerrar',
};
