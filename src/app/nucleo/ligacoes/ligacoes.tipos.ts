/**
 * Tipos das ligações (Onda E, E2): o que `crmbrl-api/src/ligacoes` devolve e emite. "Mudou aqui,
 * mudou lá" (ligacao-dto.ts e ligacoes.dto.ts da API).
 */

export type DirecaoLigacao = 'RECEBIDA' | 'FEITA';

export type EstadoLigacao =
  | 'CHAMANDO'
  | 'TOCANDO'
  | 'EM_ANDAMENTO'
  | 'ENCERRADA'
  | 'PERDIDA'
  | 'RECUSADA'
  | 'SEM_RESPOSTA'
  | 'FALHOU';

/** Estados em que a ligação ainda pode mudar. */
export const ESTADOS_ATIVOS: readonly EstadoLigacao[] = ['CHAMANDO', 'TOCANDO', 'EM_ANDAMENTO'];

export function estaAtiva(estado: EstadoLigacao): boolean {
  return ESTADOS_ATIVOS.includes(estado);
}

export interface ContatoDaLigacao {
  readonly id: string;
  readonly nome: string;
  readonly telefone: string | null;
  readonly empresa: string | null;
}

export interface Ligacao {
  readonly id: string;
  readonly direcao: DirecaoLigacao;
  readonly estado: EstadoLigacao;
  readonly motivo: string | null;
  readonly motivoTexto: string | null;
  readonly canal: { readonly id: string; readonly nome: string };
  readonly contato: ContatoDaLigacao;
  readonly conversaId: string | null;
  readonly atendente: { readonly id: string; readonly nome: string } | null;
  readonly atividadeId: string | null;
  readonly anotacao: string | null;
  readonly iniciadaEm: string;
  readonly tocouEm: string | null;
  readonly atendidaEm: string | null;
  readonly encerradaEm: string | null;
  readonly duracaoSegundos: number | null;
  readonly expiraEm: string | null;
  /** Só a quem foi chamado, enquanto a ligação recebida toca. */
  readonly ofertaSdp: string | null;
  /** Só ao atendente de uma ligação feita, enquanto chama ou toca. */
  readonly respostaSdp: string | null;
  readonly gravar: boolean;
  readonly erroCodigo: string | null;
  readonly erroMensagem: string | null;
}

export interface LigacoesAtivas {
  readonly emAndamento: Ligacao | null;
  readonly tocando: readonly Ligacao[];
}

export interface CanalDeLigacao {
  readonly id: string;
  readonly nome: string;
  readonly botaoVisivel: boolean;
}

export interface ConfiguracaoWebrtc {
  readonly stunUrls: readonly string[];
}

export interface PaginaLigacoes {
  readonly itens: readonly Ligacao[];
  readonly proximoCursor: string | null;
}

export type SituacaoPermissao =
  'NENHUMA' | 'PEDIDA' | 'CONCEDIDA' | 'NEGADA' | 'REVOGADA' | 'EXPIRADA';

export interface PedidoDePermissao {
  readonly pode: boolean;
  readonly motivo: 'limite_24h' | 'limite_7d' | null;
  readonly liberaEm: string | null;
  readonly usoNas24h: number;
  readonly maximo24h: number;
  readonly usoNos7d: number;
  readonly maximo7d: number;
}

/** `GET /ligacoes/permissoes` e o evento `ligacao.permissao`. */
export interface PermissaoDeLigacao {
  readonly contatoId: string;
  readonly canalId: string;
  readonly situacao: SituacaoPermissao;
  readonly tipo: 'TEMPORARIA' | 'PERMANENTE' | null;
  readonly validaAte: string | null;
  readonly podeLigar: boolean;
  readonly pedido: PedidoDePermissao;
  readonly ultimoPedidoEm: string | null;
  readonly respondidaEm: string | null;
  readonly semRespostaSeguidas: number;
  readonly janelaAberta: boolean;
  readonly temTemplateDePermissao: boolean;
  readonly consultadaEm: string | null;
  readonly limiteDeLigacoes: unknown;
}

export interface DadosPedidoPermissao {
  readonly contatoId: string;
  readonly canalId?: string;
  readonly texto?: string;
  readonly templateId?: string;
  readonly variaveis?: readonly string[];
}

export interface DadosNovaLigacao {
  readonly contatoId: string;
  readonly canalId?: string;
  readonly sdp: string;
  readonly atividadeId?: string;
}

export interface FiltrosLigacoes {
  readonly contatoId?: string;
  readonly conversaId?: string;
  readonly direcao?: DirecaoLigacao;
  readonly limite?: number;
  readonly cursor?: string;
}

export interface HorarioDeLigacoes {
  readonly fusoHorario: string;
  readonly dias: unknown;
}

/** `GET|PATCH /whatsapp-oficial/canais/:id/ligacoes` (só Admin). */
export interface ConfiguracaoLigacoes {
  readonly canalId: string;
  readonly ativa: boolean;
  readonly botaoVisivel: boolean;
  readonly horario: HorarioDeLigacoes | null;
  readonly horarioEfetivo: HorarioDeLigacoes | null;
  readonly filaId: string | null;
  readonly filaEfetivaId: string | null;
  readonly gravar: boolean;
  readonly tempoDeToqueSegundos: number;
  readonly mensagemPerdidaAtiva: boolean;
  readonly mensagemPerdida: string | null;
  readonly sincronizadaEm: string | null;
  readonly ultimoErroMeta: string | null;
  readonly campoDoWebhook: 'calls';
}

export type DadosConfiguracaoLigacoes = Partial<
  Pick<
    ConfiguracaoLigacoes,
    | 'ativa'
    | 'botaoVisivel'
    | 'filaId'
    | 'gravar'
    | 'tempoDeToqueSegundos'
    | 'mensagemPerdidaAtiva'
    | 'mensagemPerdida'
  > & { readonly horario: HorarioDeLigacoes | null }
>;

// ----- Tempo real (namespace /tempo-real, sala usuario:<id>) ------------------------------------

export interface EventoLigacaoTocando {
  readonly ligacaoId: string;
  readonly contato: ContatoDaLigacao;
  readonly canal: { readonly id: string; readonly nome: string };
  readonly ofertaSdp: string;
  readonly expiraEm: string;
  readonly conversaId: string | null;
}

export type MotivoDeixouDeTocar =
  'atendida_por_outro' | 'tempo_esgotado' | 'cliente_desligou' | 'falha' | 'encerrada';

export interface EventoLigacaoDeixouDeTocar {
  readonly ligacaoId: string;
  readonly motivo: MotivoDeixouDeTocar | string;
  readonly atendidaPor?: { readonly id: string; readonly nome: string } | null;
}

export interface EventoLigacaoRespostaSdp {
  readonly ligacaoId: string;
  readonly sdp: string;
}

export interface EventoLigacaoEstado {
  readonly ligacaoId: string;
  readonly estado: EstadoLigacao;
  readonly motivo?: string | null;
  readonly atendidaEm?: string | null;
}

export interface EventoLigacaoEncerrada {
  readonly ligacaoId: string;
  readonly estado: EstadoLigacao;
  readonly duracaoSegundos: number | null;
  readonly motivo: string | null;
  readonly motivoTexto?: string | null;
}

export type EventoLigacaoPermissao = PermissaoDeLigacao;
