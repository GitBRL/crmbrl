import type { Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';

/** Contratos do assistente (`/api/v1/assistente`, regra R25). */

export type CategoriaAssistente =
  'duvida_de_uso' | 'funcionalidade_inexistente_no_escopo' | 'fora_do_escopo' | 'erro_do_sistema';

export const ROTULO_CATEGORIA: Readonly<Record<CategoriaAssistente, string>> = {
  duvida_de_uso: 'Dúvida de uso',
  funcionalidade_inexistente_no_escopo: 'Pedido de funcionalidade',
  fora_do_escopo: 'Fora do escopo',
  erro_do_sistema: 'Erro do sistema',
};

export type StatusPergunta = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'FALHOU';
export type Avaliacao = 'UTIL' | 'NAO_UTIL';
export type StatusChamado = 'PENDENTE' | 'ENVIADO' | 'FALHOU';
export type DestinoChamado = 'TICKETHUB' | 'WEBHOOK';

export interface EstadoAssistente {
  readonly disponivel: boolean;
  readonly motivo: string | null;
  readonly aviso: string;
  readonly modelo: string;
  readonly perguntasPorDia: number;
  readonly usadasHoje: number;
  readonly restantesHoje: number;
  readonly maxCaracteresPergunta: number;
  readonly maxPerguntasPorConversa: number;
  readonly chamadosDisponiveis: boolean;
  readonly categoriasComChamado: readonly CategoriaAssistente[];
}

export interface ChamadoDto {
  readonly id: string;
  readonly conversaId: string;
  readonly perguntaId: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tela: string | null;
  readonly categoria: CategoriaAssistente | null;
  readonly destino: DestinoChamado;
  readonly status: StatusChamado;
  readonly tentativas: number;
  readonly proximaTentativaEm: string | null;
  readonly ultimoErro: string | null;
  readonly numero: string | number | null;
  readonly link: string | null;
  readonly criadoEm: string;
  readonly enviadoEm: string | null;
}

export interface PerguntaDto {
  readonly id: string;
  readonly conversaId: string;
  readonly pergunta: string;
  readonly tela: string | null;
  readonly modulo: string | null;
  readonly status: StatusPergunta;
  readonly resposta: string | null;
  readonly resolvido: boolean | null;
  readonly categoria: CategoriaAssistente | null;
  readonly resumoDoPedido: string | null;
  readonly erro: string | null;
  readonly avaliacao: Avaliacao | null;
  readonly podeAbrirChamado: boolean;
  readonly chamado: ChamadoDto | null;
  readonly criadoEm: string;
}

export interface ResumoConversa {
  readonly id: string;
  readonly titulo: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly totalPerguntas: number;
}

export interface DetalheConversa extends ResumoConversa {
  readonly perguntas: readonly PerguntaDto[];
  readonly usuario?: UsuarioResumo;
}

export interface UsuarioResumo {
  readonly id: string;
  readonly nome: string;
  readonly papel?: Papel;
  readonly area?: Area | null;
}

/** Eventos do streaming de `POST /perguntas`. */
export type CodigoErroPergunta =
  | 'tempo_esgotado'
  | 'indisponivel'
  | 'chave_recusada'
  | 'recusada'
  | 'resposta_incompleta'
  | 'resposta_invalida'
  | 'cancelada'
  | 'erro';

export type EventoPergunta =
  | {
      readonly evento: 'inicio';
      readonly conversaId: string;
      readonly perguntaId: string;
      readonly conversaNova: boolean;
      readonly modelo: string | null;
    }
  | { readonly evento: 'fase'; readonly fase: 'pensando' | 'escrevendo' }
  | { readonly evento: 'parcial'; readonly resposta: string }
  | { readonly evento: 'nova_tentativa'; readonly tentativa: number; readonly motivo: string }
  | {
      readonly evento: 'concluido';
      readonly conversaId: string;
      readonly perguntaId: string;
      readonly resposta: string;
      readonly resolvido: boolean | null;
      readonly categoria: CategoriaAssistente | null;
      readonly resumoDoPedido: string | null;
      readonly podeAbrirChamado: boolean;
      readonly restantesHoje: number | null;
    }
  | {
      readonly evento: 'erro';
      readonly codigo: CodigoErroPergunta;
      readonly mensagem: string;
      readonly conversaId: string | null;
      readonly perguntaId: string | null;
    };

// Administração ---------------------------------------------------------------------------------

export type DestinoConfigurado = DestinoChamado | 'NENHUM';
export type PrioridadeChamado = 'baixa' | 'media' | 'alta' | 'critica';
export type OrigemValor = 'admin' | 'ambiente' | null;

export interface ConfiguracaoAssistente {
  readonly perguntasPorDia: number;
  readonly orcamentoMensalTokens: number | null;
  readonly destino: DestinoConfigurado;
  readonly ticketHub: {
    readonly url: string | null;
    readonly urlPublica: string | null;
    readonly email: string | null;
    readonly senhaDefinida: boolean;
    readonly prioridade: PrioridadeChamado;
    readonly sistemaId: number | string | null;
    readonly origem: {
      readonly url: OrigemValor;
      readonly email: OrigemValor;
      readonly senha: OrigemValor;
    };
  };
  readonly webhook: {
    readonly url: string | null;
    readonly cabecalhos: readonly { readonly nome: string; readonly valorMascarado: string }[];
    readonly segredoDefinido: boolean;
    readonly segredoMascarado: string | null;
    readonly modeloCorpo: string | null;
    readonly modeloCorpoPadrao: string;
  };
  readonly destinoPronto: boolean;
  readonly motivoDestino: string | null;
  readonly uso: {
    readonly tokensNoMes: number;
    readonly orcamentoMensalTokens: number | null;
    readonly perguntasHoje: number;
    readonly perguntasNoMes: number;
  };
  readonly baseDeConhecimento: {
    readonly artigos: readonly { readonly arquivo: string; readonly titulo: string }[];
    readonly avisos: readonly string[];
  };
}

export interface AtualizacaoConfiguracao {
  perguntasPorDia?: number;
  orcamentoMensalTokens?: number | null;
  destino?: DestinoConfigurado;
  ticketHub?: {
    url?: string | null;
    urlPublica?: string | null;
    email?: string | null;
    senha?: string | null;
    prioridade?: PrioridadeChamado;
    sistemaId?: number | null;
  };
  webhook?: {
    url?: string | null;
    cabecalhos?: Record<string, string | null> | null;
    segredo?: string | null;
    modeloCorpo?: string | null;
  };
}

export interface PerguntaDoHistorico extends PerguntaDto {
  readonly tokens: number | null;
  readonly usuario: {
    readonly id: string;
    readonly nome: string;
    readonly papel: Papel;
    readonly area: Area | null;
  };
}

export type AvaliacaoFiltro = 'UTIL' | 'NAO_UTIL' | 'SEM_AVALIACAO';

export interface FiltrosHistoricoDuvidas {
  pagina: number;
  porPagina: number;
  de: string | null;
  ate: string | null;
  categoria: CategoriaAssistente | null;
  area: string | null;
  usuarioId: string | null;
  modulo: string | null;
  resolvido: boolean | null;
  avaliacao: AvaliacaoFiltro | null;
  comChamado: boolean | null;
  busca: string;
}

export interface TemaSemResposta {
  readonly resumo: string;
  readonly modulo: string | null;
  readonly categoria: CategoriaAssistente | null;
  readonly total: number;
  readonly pessoas: number;
  readonly ultimaEm: string;
  readonly exemploPerguntaId: string;
}

export interface ChamadoAdmin extends ChamadoDto {
  readonly usuario: { readonly id: string; readonly nome: string };
}
