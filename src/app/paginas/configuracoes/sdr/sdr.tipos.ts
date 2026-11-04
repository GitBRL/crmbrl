/**
 * Tipos da configuração do SDR com IA (API `/sdr`, regra R31). Só a configuração e o simulador:
 * as conversas e a qualificação ficam em `nucleo/sdr`.
 */

export type ModoSdr = 'DESLIGADO' | 'AUTOMATICO' | 'SUGESTAO';
export type TipoCriterio = 'TEXTO' | 'OPCAO' | 'NUMERO' | 'DATA' | 'SIM_NAO';
export type AlvoCriterio = 'NENHUM' | 'CONTATO' | 'NEGOCIO';
export type TemperaturaSdr = 'QUENTE' | 'MORNO' | 'FRIO';
export type AcaoSdr = 'continuar' | 'qualificado' | 'desqualificado' | 'passar_humano';

export const ROTULO_MODO: Readonly<Record<ModoSdr, string>> = {
  DESLIGADO: 'Desligado',
  AUTOMATICO: 'Automático',
  SUGESTAO: 'Sugestão',
};

export const EXPLICACAO_MODO: Readonly<Record<ModoSdr, string>> = {
  DESLIGADO: 'A IA não participa: a conversa segue o atendimento normal.',
  AUTOMATICO: 'A IA responde sozinha o lead novo, até qualificar ou passar para uma pessoa.',
  SUGESTAO: 'A IA só propõe a resposta; o atendente aprova, edita ou descarta antes de enviar.',
};

export const ROTULO_TIPO_CRITERIO: Readonly<Record<TipoCriterio, string>> = {
  TEXTO: 'Texto livre',
  OPCAO: 'Opção da lista',
  NUMERO: 'Número',
  DATA: 'Data',
  SIM_NAO: 'Sim ou não',
};

export const ROTULO_ALVO: Readonly<Record<AlvoCriterio, string>> = {
  NENHUM: 'Só na qualificação',
  CONTATO: 'Campo do contato',
  NEGOCIO: 'Campo do negócio',
};

export const ROTULO_TEMPERATURA: Readonly<Record<TemperaturaSdr, string>> = {
  QUENTE: 'Quente',
  MORNO: 'Morno',
  FRIO: 'Frio',
};

export const ROTULO_ACAO: Readonly<Record<AcaoSdr, string>> = {
  continuar: 'Continuar a conversa',
  qualificado: 'Qualificado',
  desqualificado: 'Desqualificado',
  passar_humano: 'Passar para uma pessoa',
};

export interface CanalSdr {
  readonly canalId: string;
  readonly nome: string;
  readonly tipo: string;
  readonly ativo: boolean;
  readonly modo: ModoSdr;
}

export interface RegrasPassagem {
  readonly pedidoHumano: boolean;
  readonly assuntoSensivel: boolean;
  readonly baixaConfianca: boolean;
  readonly confiancaMinima: number;
  readonly semAvanco: boolean;
  readonly reclamacao: boolean;
}

export interface ConfiguracaoSdr {
  readonly nomeAssistente: string;
  readonly tom: string;
  readonly apresentacao: string;
  readonly mensagemPassagem: string;
  readonly modelo: string;
  readonly esforco: string;
  readonly esperaAgrupamentoSegundos: number;
  readonly maxMensagensPorConversa: number;
  readonly maxMensagensSemAvanco: number;
  readonly maxTokensPorConversa: number;
  readonly orcamentoMensalTokens: number | null;
  readonly notaMinimaQualificado: number;
  readonly faixaQuente: number;
  readonly faixaMorno: number;
  readonly regrasPassagem: RegrasPassagem;
  readonly baseVersao: number;
  readonly atualizadoEm: string;
}

/** O que `PUT /sdr/configuracao` aceita (parcial). */
export type AtualizacaoConfiguracaoSdr = Partial<
  Omit<ConfiguracaoSdr, 'baseVersao' | 'atualizadoEm' | 'regrasPassagem'>
> & { regrasPassagem?: Partial<RegrasPassagem> };

export interface ModeloDisponivel {
  readonly id: string;
  readonly rotulo: string;
}

export interface GeralSdr {
  readonly iaConfigurada: boolean;
  readonly modelosDisponiveis: readonly ModeloDisponivel[];
  readonly configuracao: ConfiguracaoSdr;
}

export interface ArtigoSdr {
  readonly id: string;
  readonly titulo: string;
  readonly conteudo: string;
  readonly ativo: boolean;
  readonly ordem: number;
  readonly versao: number;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface CorpoArtigo {
  titulo?: string;
  conteudo?: string;
  ativo?: boolean;
  ordem?: number;
}

export interface VersaoArtigo {
  readonly numero: number;
  readonly titulo: string;
  readonly conteudo: string;
  readonly ativo: boolean;
  readonly excluido: boolean;
  readonly autorId: string | null;
  readonly criadoEm: string;
}

export interface CriterioSdr {
  readonly id: string;
  readonly chave: string;
  readonly rotulo: string;
  readonly instrucao: string;
  readonly tipo: TipoCriterio;
  readonly opcoes: readonly string[];
  readonly alvo: AlvoCriterio;
  readonly campo: string | null;
  readonly peso: number;
  readonly obrigatorio: boolean;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface CorpoCriterio {
  chave?: string;
  rotulo?: string;
  instrucao?: string;
  tipo?: TipoCriterio;
  opcoes?: readonly string[];
  alvo?: AlvoCriterio;
  campo?: string | null;
  peso?: number;
  obrigatorio?: boolean;
  ativo?: boolean;
}

export interface CampoDisponivel {
  readonly campo: string;
  readonly rotulo: string;
  readonly fixo: boolean;
}

export interface CamposDisponiveis {
  readonly contato: readonly CampoDisponivel[];
  readonly negocio: readonly CampoDisponivel[];
}

export interface UsoSdr {
  readonly mes: string;
  readonly tokens: { readonly total: number };
  readonly simulador: { readonly tokens: number };
  readonly turnos: number;
  readonly conversasAtendidas: number;
  readonly orcamento: number | null;
  readonly percentual: number | null;
  readonly esgotado: boolean;
}

export interface MensagemSimulador {
  readonly papel: 'lead' | 'ia';
  readonly texto: string;
}

export interface ValorSimulador {
  readonly chave: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly confianca: number;
}

export interface CriterioDescoberto extends ValorSimulador {
  readonly aceito: boolean;
  readonly motivoDaRecusa: string | null;
}

export interface TurnoSimulador {
  readonly aviso: string;
  readonly resposta: string;
  readonly criterios: readonly CriterioDescoberto[];
  readonly valores: readonly ValorSimulador[];
  readonly nota: number;
  readonly temperatura: TemperaturaSdr;
  readonly faltamObrigatorios: readonly string[];
  readonly acao: AcaoSdr;
  readonly motivo: string | null;
  readonly motivoDaTroca: string | null;
  readonly resumo: string | null;
  readonly tokens: { readonly total: number };
}

/** Automação ativa que manda mensagem a todo lead novo (aviso da aba Canais). */
export interface AutomacaoQueAvisa {
  readonly id: string;
  readonly nome: string;
}
