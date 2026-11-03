import type { TemplateDoCanal } from '../configuracoes/canais/canais.modelos';
import type { Area } from '../../nucleo/sessao/perfil';
import type { StatusMensagem } from '../../nucleo/tempo-real/eventos';
import type { DirecaoMensagem, TipoMensagem } from '../../ui/mensagens/mensagens';

/**
 * Formatos da API do Atendimento (`crmbrl-api/src/atendimento/dto/*`, rotas
 * `/api/v1/atendimento/...`). Os nomes e os enums são os da API; a tela converte para o
 * modelo dos componentes de conversa em `apresentacao.ts`.
 */

export type TipoCanal =
  'WHATSAPP' | 'WHATSAPP_OFICIAL' | 'WEBCHAT' | 'EMAIL' | 'INSTAGRAM' | 'MESSENGER';
export type StatusConversa = 'ABERTA' | 'PENDENTE' | 'RESOLVIDA';
export type PrioridadeConversa = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';
export type EscopoConversas = 'MINHAS' | 'SEM_RESPONSAVEL' | 'TODAS';
export type AreaDoAtendimento = Extract<Area, 'COMERCIAL' | 'CS'>;

export const TIPOS_CANAL: readonly TipoCanal[] = [
  'WHATSAPP',
  'WHATSAPP_OFICIAL',
  'WEBCHAT',
  'EMAIL',
  'INSTAGRAM',
  'MESSENGER',
];

/** Pessoa da equipe numa resposta (`PessoaDto`). */
export interface Pessoa {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl?: string | null;
}

export interface ResumoCanal {
  readonly id: string;
  readonly tipo: TipoCanal;
  readonly nome: string;
  readonly ativo: boolean;
}

export interface ResumoFila {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
}

export interface ContatoDaConversa {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  /** E.164 só com dígitos. */
  readonly telefone: string | null;
}

export interface UltimaMensagem {
  readonly id: string;
  readonly direcao: DirecaoMensagem;
  readonly tipo: TipoMensagem;
  /** Começo do texto ou o nome do anexo; nulo se a mensagem foi excluída. */
  readonly previa: string | null;
  readonly autorNome: string | null;
  readonly ocorridaEm: string;
}

export interface SlaDaConversa {
  readonly primeiraRespostaAte: string | null;
  readonly resolucaoAte: string | null;
  readonly primeiraRespostaEstourada: boolean;
  readonly resolucaoEstourada: boolean;
}

/** `ConversaResumoDto`: a linha da lista (e o que o tempo real manda). */
export interface ConversaResumo {
  readonly id: string;
  readonly canal: ResumoCanal;
  readonly contato: ContatoDaConversa;
  readonly fila: ResumoFila | null;
  /** Nulo = sem responsável. */
  readonly responsavel: Pessoa | null;
  readonly status: StatusConversa;
  readonly prioridade: PrioridadeConversa;
  readonly assunto: string | null;
  readonly etiquetas: readonly string[];
  readonly naoLidas: number;
  readonly ultimaMensagem: UltimaMensagem | null;
  readonly ultimaMensagemEm: string | null;
  readonly ultimaEntradaEm: string | null;
  /** Desde quando o contato espera resposta (nulo = ninguém esperando). */
  readonly aguardandoDesde: string | null;
  readonly atribuidaEm: string | null;
  readonly sla: SlaDaConversa;
  /** Instagram, Messenger e WhatsApp oficial: até quando cabe resposta comum (janela de 24 h). */
  readonly janelaAte: string | null;
  readonly negocioId: string | null;
  readonly criadoEm: string;
  readonly resolvidaEm: string | null;
}

export interface Satisfacao {
  readonly solicitadaEm: string | null;
  readonly nota: number | null;
  readonly comentario: string | null;
  readonly respondidaEm: string | null;
  readonly aguardando: boolean;
}

export interface NegocioDaConversa {
  readonly id: string;
  readonly titulo: string;
  readonly status: 'ABERTO' | 'GANHO' | 'PERDIDO';
  readonly funil: { readonly id: string; readonly nome: string; readonly area: Area };
}

export interface AcoesDaConversa {
  readonly assumir: boolean;
  readonly transferir: boolean;
  readonly resolver: boolean;
  readonly reabrir: boolean;
  readonly responder: boolean;
  readonly criarNegocio: boolean;
  /** Conversa em aberto num canal que usa templates (WhatsApp oficial). */
  readonly enviarTemplate?: boolean;
}

/** `ConversaDetalheDto`. */
export interface ConversaDetalhe extends ConversaResumo {
  readonly primeiraRespostaEm: string | null;
  readonly resolvidaPor: Pessoa | null;
  readonly reaberturas: number;
  readonly satisfacao: Satisfacao;
  readonly negocio: NegocioDaConversa | null;
  readonly podeResponder: {
    readonly pode: boolean;
    readonly motivo: string | null;
    /** Janela fechada: só vale um template aprovado. */
    readonly apenasTemplate?: boolean;
  };
  readonly acoes: AcoesDaConversa;
}

export interface ContadoresDeConversas {
  readonly minhas: number;
  readonly semResponsavel: number;
  readonly todas: number;
  readonly naoLidas: number;
}

export interface PaginaConversas {
  readonly itens: readonly ConversaResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
  readonly contadores: ContadoresDeConversas;
}

export interface FiltrosConversas {
  readonly escopo: EscopoConversas;
  readonly status?: readonly StatusConversa[];
  readonly tipoCanal?: readonly TipoCanal[];
  readonly filaId?: string;
  readonly canalId?: string;
  readonly etiqueta?: readonly string[];
  readonly naoLidas?: boolean;
  readonly slaEstourado?: boolean;
  readonly contatoId?: string;
  readonly busca?: string;
  readonly pagina?: number;
  readonly porPagina?: number;
}

/** `ArquivoDto`. */
export interface Arquivo {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly tamanho: number;
  readonly largura: number | null;
  readonly altura: number | null;
  readonly duracaoSegundos: number | null;
  readonly criadoEm: string;
  /** `/api/v1/arquivos/<id>`. */
  readonly url: string;
}

export interface MensagemCitada {
  readonly id: string;
  readonly direcao: DirecaoMensagem;
  readonly tipo: TipoMensagem;
  readonly texto: string | null;
  readonly autorNome: string | null;
}

/** `MensagemDaConversaDto`. */
export interface MensagemDaConversa {
  readonly id: string;
  readonly conversaId: string;
  readonly direcao: DirecaoMensagem;
  readonly tipo: TipoMensagem;
  readonly texto: string | null;
  readonly arquivo: Arquivo | null;
  readonly autor: Pessoa | null;
  readonly autorTipo: 'USUARIO' | 'SISTEMA' | 'AUTOMACAO' | 'IA' | 'WEBHOOK' | null;
  readonly automatica: boolean;
  readonly status: StatusMensagem | null;
  readonly erro: string | null;
  readonly tentativas: number;
  readonly respostaA: MensagemCitada | null;
  readonly metadados: Readonly<Record<string, unknown>> | null;
  readonly ocorridaEm: string;
  readonly enviadaEm: string | null;
  readonly entregueEm: string | null;
  readonly lidaEm: string | null;
  readonly editadaEm: string | null;
  readonly excluida: boolean;
}

export interface PaginaMensagens {
  readonly itens: readonly MensagemDaConversa[];
  readonly proximoCursor: string | null;
}

/** `AtendenteDto`: quem pode receber uma transferência. */
export interface Atendente extends Pessoa {
  readonly papel: string;
  readonly rotuloPapel: string;
  readonly area: Area | null;
  readonly emAberto: number;
  readonly conectado: boolean;
}

/** `FilaDto` (só o que a tela usa). */
export interface Fila {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
  readonly descricao: string | null;
  readonly slaPrimeiraRespostaMinutos: number | null;
  readonly slaResolucaoMinutos: number | null;
  readonly estrategia: 'RODIZIO' | 'MENOR_CARGA' | 'MANUAL';
  readonly ativa: boolean;
}

/** `CanalDoAtendimentoDto` (só o que a tela usa). */
export interface CanalDoAtendimento {
  readonly id: string;
  readonly tipo: TipoCanal;
  readonly nome: string;
  readonly ativo: boolean;
  readonly disponivel: boolean;
  readonly filaPadrao: ResumoFila | null;
  readonly situacaoHorario: {
    readonly aberto: boolean;
    readonly proximaAbertura: string | null;
    readonly proximoFechamento: string | null;
  };
  readonly pesquisaSatisfacao: boolean;
}

/** `RespostaRapidaDto` (só o que a tela usa). */
export interface RespostaRapida {
  readonly id: string;
  readonly atalho: string;
  readonly titulo: string;
  readonly texto: string;
  readonly area: Area | null;
  readonly ativa: boolean;
}

export type MotivoAtribuicao =
  'DISTRIBUICAO' | 'ASSUMIDA' | 'TRANSFERENCIA' | 'DESLIGAMENTO' | 'REABERTURA' | 'MANUAL';

/** `AtribuicaoDto`: uma linha do histórico de quem cuidou da conversa. */
export interface Atribuicao {
  readonly id: string;
  readonly motivo: MotivoAtribuicao | string;
  readonly de: Pessoa | null;
  readonly para: Pessoa | null;
  readonly deFila: ResumoFila | null;
  readonly paraFila: ResumoFila | null;
  readonly nota: string | null;
  readonly por: Pessoa | null;
  readonly tipoAtor: string;
  readonly criadoEm: string;
}

/** O que muda num `PATCH /atendimento/conversas/:id`. */
export interface AlteracaoConversa {
  readonly status?: 'ABERTA' | 'PENDENTE';
  readonly prioridade?: PrioridadeConversa;
  readonly assunto?: string | null;
  readonly etiquetas?: readonly string[];
  readonly negocioId?: string | null;
}

export interface Transferencia {
  readonly usuarioId?: string;
  readonly filaId?: string;
  readonly nota?: string;
}

export interface NovoNegocioDaConversa {
  readonly titulo?: string;
  readonly valor?: string;
}

// Painel do contato -------------------------------------------------------------------------

/** `GET /contatos/:id` (só o que o painel mostra). */
export interface ContatoDoPainel {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  readonly telefone: string | null;
  readonly cargo: string | null;
  readonly empresa: { readonly id: string; readonly nome: string } | null;
  readonly responsavel: { readonly id: string; readonly nome: string } | null;
  readonly etiquetas: readonly string[];
  readonly optOutMarketing: boolean;
  readonly primeiraOrigem?: unknown;
  readonly criadoEm: string;
}

export interface NegocioDoContato {
  readonly id: string;
  readonly titulo: string;
  readonly status: 'ABERTO' | 'GANHO' | 'PERDIDO';
  readonly valor: string;
  readonly funil: { readonly id: string; readonly nome: string; readonly area: Area };
  readonly etapa: { readonly id: string; readonly nome: string; readonly tipo: string };
  readonly responsavel?: { readonly id: string; readonly nome: string } | null;
}

export interface AtividadeDoContato {
  readonly id: string;
  readonly tipo: string;
  readonly titulo: string;
  readonly status: string;
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly atrasada: boolean;
  readonly responsavel: { readonly id: string; readonly nome: string };
}

// Templates (WhatsApp oficial) ---------------------------------------------------------------

/** `GET /atendimento/conversas/:id/templates`. */
export interface TemplatesDaConversa {
  /** `false` nos canais sem templates (`itens` vazio). */
  readonly suportado: boolean;
  readonly janelaAberta: boolean;
  readonly janelaAte: string | null;
  /** Motivo, quando a janela está fechada. */
  readonly aviso: string | null;
  readonly sincronizadoEm: string | null;
  readonly itens: readonly TemplateDoCanal[];
}

/** Variáveis de um envio, na ordem em que aparecem no template. */
export interface VariaveisDoTemplate {
  readonly cabecalho?: readonly string[];
  readonly corpo?: readonly string[];
  readonly botoes?: readonly (string | null)[];
}

export interface EnvioDeTemplate {
  readonly templateId: string;
  readonly variaveis?: VariaveisDoTemplate;
}
