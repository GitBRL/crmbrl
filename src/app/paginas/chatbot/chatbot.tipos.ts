/**
 * Contrato do chatbot com a API (`/api/v1/chatbot/**`, crmbrl-api `ChatbotController`).
 * A definição dos fluxos segue o formato de `src/comum/passos` da API.
 */

export type GatilhoFluxo = 'NOVA_CONVERSA' | 'PALAVRA_CHAVE' | 'FORA_DO_HORARIO' | 'SEMPRE';
export type GrupoPasso = 'conversa' | 'logica' | 'acao' | 'fim';
export type RamosDoTipo = 'nenhum' | 'opcoes' | 'excecoes' | 'condicoes';

export interface TipoDePasso {
  readonly tipo: string;
  readonly rotulo: string;
  readonly grupo: GrupoPasso;
  readonly descricao: string;
  readonly ramos: RamosDoTipo;
  readonly esperaResposta: boolean;
  readonly exemplo: Readonly<Record<string, unknown>>;
}

export type ConfigPasso = Record<string, unknown>;

export interface RamoDefinicao {
  id: string;
  rotulo?: string;
  config?: ConfigPasso;
  passos: PassoDefinicao[];
}

export interface PassoDefinicao {
  id: string;
  tipo: string;
  rotulo?: string;
  config?: ConfigPasso;
  ramos?: RamoDefinicao[];
  proximo?: string;
}

export interface DefinicaoFluxo {
  passos: PassoDefinicao[];
}

export interface PessoaResumo {
  readonly id: string;
  readonly nome: string;
}

export interface VersaoPublicada {
  readonly id: string;
  readonly numero: number;
  readonly publicadaEm: string;
  readonly publicadaPor: PessoaResumo | null;
}

export interface ContadoresFluxo {
  readonly total: number;
  readonly emAndamento: number;
  readonly transferidas: number;
  readonly semResposta: number;
}

export interface FluxoResumo {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly canalIds: readonly string[];
  readonly gatilho: GatilhoFluxo;
  readonly palavrasChave: readonly string[];
  readonly prioridade: number;
  readonly ativo: boolean;
  readonly versaoPublicada: VersaoPublicada | null;
  readonly rascunhoNaoPublicado: boolean;
  readonly passos: number;
  readonly criadoPor: PessoaResumo | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly rascunhoAlteradoEm: string;
  readonly contadores: ContadoresFluxo;
  readonly podeEditar: boolean;
}

export interface FluxoDetalhe extends FluxoResumo {
  readonly rascunho: DefinicaoFluxo;
  readonly definicaoPublicada: DefinicaoFluxo | null;
}

export interface NovoFluxo {
  nome: string;
  descricao?: string;
  area?: string | null;
  canalIds?: string[];
  gatilho: GatilhoFluxo;
  palavrasChave?: string[];
  prioridade?: number;
}

export type AlteracaoFluxo = Partial<
  Pick<NovoFluxo, 'nome' | 'descricao' | 'canalIds' | 'gatilho' | 'palavrasChave' | 'prioridade'>
>;

export interface ProblemaDefinicao {
  readonly caminho: string;
  readonly mensagem: string;
  readonly passoId?: string;
}

export interface ResultadoValidacao {
  readonly valido: boolean;
  readonly problemas: readonly ProblemaDefinicao[];
}

export interface VersaoDoFluxo {
  readonly id: string;
  readonly numero: number;
  readonly publicadaEm: string;
  readonly publicadaPor: PessoaResumo | null;
  readonly passos: number;
  readonly emUso: number;
}

export interface VersaoCompleta {
  readonly id: string;
  readonly numero: number;
  readonly publicadaEm: string;
  readonly publicadaPor: PessoaResumo | null;
  readonly definicao: DefinicaoFluxo;
}

export type StatusExecucao = 'EM_ANDAMENTO' | 'AGUARDANDO' | 'CONCLUIDA' | 'FALHOU' | 'CANCELADA';

export interface ExecucaoResumo {
  readonly id: string;
  readonly status: StatusExecucao;
  readonly motivoFim: string | null;
  readonly erro: string | null;
  readonly iniciadaEm: string;
  readonly concluidaEm: string | null;
  readonly conversaId: string | null;
  readonly contato: PessoaResumo | null;
  readonly versao: number | null;
  readonly passosExecutados: number;
}

export interface PassoExecutado {
  readonly passoId: string;
  readonly tipo: string;
  readonly visita: number;
  readonly status: string;
  readonly tentativas: number;
  readonly erro: string | null;
  readonly saida: unknown;
  readonly iniciadoEm: string | null;
  readonly concluidoEm: string | null;
}

export interface ExecucaoDetalhe extends Omit<ExecucaoResumo, 'versao' | 'passosExecutados'> {
  readonly variaveis: Readonly<Record<string, unknown>>;
  readonly passos: readonly PassoExecutado[];
}

export interface EstadoSimulacao {
  readonly execucaoId: string;
  readonly status: StatusExecucao;
  readonly motivoFim: string | null;
  readonly erro: string | null;
  readonly aguardando: {
    readonly passoId: string;
    readonly tipo: 'opcoes' | 'texto';
    readonly opcoes?: readonly { readonly id: string; readonly rotulo: string }[];
    readonly temTempo: boolean;
  } | null;
  readonly transcricao: readonly {
    readonly de: 'bot' | 'contato' | 'sistema';
    readonly texto: string;
    readonly opcoes?: readonly string[];
    readonly passoId?: string;
  }[];
  readonly variaveis: Readonly<Record<string, unknown>>;
}

export interface InicioSimulacao {
  origem: 'rascunho' | 'publicada';
  canalTipo?: string;
  contato?: { nome?: string; email?: string; telefone?: string; etiquetas?: string[] };
  mensagem?: string;
  horarioAberto?: boolean;
}

export const ROTULO_GATILHO: Readonly<Record<GatilhoFluxo, string>> = {
  NOVA_CONVERSA: 'Nova conversa',
  PALAVRA_CHAVE: 'Palavra-chave',
  FORA_DO_HORARIO: 'Fora do horário',
  SEMPRE: 'Sempre, antes do atendente',
};

export const DICA_GATILHO: Readonly<Record<GatilhoFluxo, string>> = {
  NOVA_CONVERSA: 'Responde quando um cliente começa uma conversa nova.',
  PALAVRA_CHAVE: 'Responde quando a mensagem do cliente tem uma das palavras que você definir.',
  FORA_DO_HORARIO: 'Responde só quando o canal está fora do horário de atendimento.',
  SEMPRE: 'Atende toda conversa antes de passar para uma pessoa.',
};

export const ROTULO_STATUS_EXECUCAO: Readonly<Record<StatusExecucao, string>> = {
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO: 'Aguardando resposta',
  CONCLUIDA: 'Concluída',
  FALHOU: 'Falhou',
  CANCELADA: 'Cancelada',
};

export const ROTULO_MOTIVO_FIM: Readonly<Record<string, string>> = {
  transferida_para_humano: 'Passou para uma pessoa',
  concluida: 'Fluxo concluído',
  sem_resposta: 'Cliente não respondeu',
  respostas_invalidas: 'Respostas inválidas',
  atendente_assumiu: 'Atendente assumiu',
  conversa_resolvida: 'Conversa resolvida',
  conversa_transferida: 'Conversa transferida',
  fluxo_excluido: 'Fluxo excluído',
  simulacao_encerrada: 'Simulação encerrada',
};
