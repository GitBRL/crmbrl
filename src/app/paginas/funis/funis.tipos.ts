import type { Area } from '../../nucleo/sessao/perfil';
import type { Papel } from '../../nucleo/papeis';

/**
 * Tipos da API de funis e negócios (crmbrl-api, `src/funis/dto/*`; OpenAPI em
 * TRABALHO/openapi.json). Valores em reais chegam como texto decimal ("1500.00") e datas em
 * ISO 8601 UTC; a previsão de fechamento é só a data ("2026-11-30").
 */

export type TipoEtapa = 'ABERTA' | 'GANHO' | 'PERDIDO';
export type StatusNegocio = 'ABERTO' | 'GANHO' | 'PERDIDO';
export type VisaoQuadro = 'MEUS' | 'EQUIPE' | 'TODOS';
export type TipoAtor = 'USUARIO' | 'SISTEMA' | 'WEBHOOK' | 'AUTOMACAO' | 'IA';
export type OrigemContato =
  'MANUAL' | 'WEBHOOK' | 'WHATSAPP' | 'SITE' | 'INDICACAO' | 'IMPORTACAO' | 'PASSAGEM' | 'OUTRO';

export interface Etapa {
  readonly id: string;
  readonly funilId: string;
  readonly nome: string;
  /** Identifica as etapas da configuração inicial (`qualificado_mql`), mesmo renomeadas. */
  readonly chave?: string | null;
  /** A partir de 1. */
  readonly ordem: number;
  readonly tipo: TipoEtapa;
  /** Prazo-alvo: acima dele o negócio aberto está "parado" (R5.10). */
  readonly prazoDias?: number | null;
  /** 0 a 100. */
  readonly probabilidade?: number | null;
}

export interface Funil {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
  /** Funil-base da área (R5.1): não pode ser excluído. */
  readonly base: boolean;
  readonly ordem: number;
  /** Falso = arquivado. */
  readonly ativo: boolean;
  readonly descricao?: string | null;
  /** Em ordem. */
  readonly etapas: readonly Etapa[];
}

export interface ResumoFunil {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
}

export interface ResumoUsuario {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl?: string | null;
}

export interface ResumoContato {
  readonly id: string;
  readonly nome: string;
  readonly email?: string | null;
  readonly telefone?: string | null;
  readonly etiquetas: readonly string[];
}

export interface ResumoEmpresa {
  readonly id: string;
  readonly nome: string;
}

export interface EtapaDoNegocio {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoEtapa;
  readonly ordem: number;
  readonly prazoDias?: number | null;
  readonly probabilidade?: number | null;
}

export interface Utm {
  readonly source?: string;
  readonly medium?: string;
  readonly campaign?: string;
  readonly term?: string;
  readonly content?: string;
}

export interface Negocio {
  readonly id: string;
  readonly titulo: string;
  readonly status: StatusNegocio;
  readonly valor: string;
  readonly valorRecorrente?: string | null;
  readonly previsaoFechamento?: string | null;
  readonly motivoPerda?: string | null;
  readonly ganhoEm?: string | null;
  readonly perdidoEm?: string | null;
  readonly etapaDesde: string;
  readonly diasNaEtapa: number;
  /** Aberto há mais tempo na etapa que o prazo-alvo (R5.10). */
  readonly parado: boolean;
  readonly posicao: number;
  readonly origem: OrigemContato;
  readonly origemDetalhe?: string | null;
  readonly utm?: Utm | null;
  readonly reconversoes: number;
  readonly ultimaReconversaoEm?: string | null;
  readonly camposPersonalizados: Readonly<Record<string, unknown>>;
  /** Negócio que originou este por uma passagem (R5.7). */
  readonly negocioOrigemId?: string | null;
  readonly funil: ResumoFunil;
  readonly etapa: EtapaDoNegocio;
  readonly contato: ResumoContato;
  readonly empresa?: ResumoEmpresa | null;
  /** Nulo = sem responsável (o membro da área pode assumir). */
  readonly responsavel?: ResumoUsuario | null;
  readonly criadoPorId?: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface ColunaQuadro {
  readonly etapa: Etapa;
  /** Negócios na etapa (com os filtros), não só os trazidos. */
  readonly total: number;
  readonly valorTotal: string;
  readonly parados: number;
  /** Em ordem de posição. */
  readonly negocios: readonly Negocio[];
  readonly temMais: boolean;
}

export interface Quadro {
  readonly funil: ResumoFunil;
  readonly ativo: boolean;
  readonly colunas: readonly ColunaQuadro[];
  readonly total: number;
  readonly valorTotal: string;
}

export interface FiltrosQuadro {
  readonly visao: VisaoQuadro;
  readonly busca: string;
  readonly etiqueta: string | null;
}

export interface PassagemExecutada {
  readonly passagemId: string;
  /** "Comercial → Customer Success". */
  readonly nome: string;
  readonly negocioOrigemId: string;
  /** O negócio criado no destino (ou o aberto que recebeu a reconversão, R5.6). */
  readonly negocioDestinoId: string;
  readonly funilDestinoId: string;
  readonly criado: boolean;
  readonly reconversao: boolean;
  readonly responsavel?: ResumoUsuario | null;
}

export interface ResultadoMovimentacao {
  readonly negocio: Negocio;
  readonly passagens: readonly PassagemExecutada[];
}

export interface PedidoMover {
  readonly etapaId: string;
  readonly motivoPerda?: string;
  /** Cartão logo acima, na etapa de destino. */
  readonly depoisDeId?: string;
  /** Cartão logo abaixo, na etapa de destino. */
  readonly antesDeId?: string;
}

export interface NovoNegocio {
  readonly contatoId: string;
  readonly funilId: string;
  readonly titulo?: string;
  readonly empresaId?: string | null;
  readonly etapaId?: string;
  readonly responsavelId?: string | null;
  readonly valor?: string;
}

export interface AlteracaoNegocio {
  readonly titulo?: string;
  readonly empresaId?: string | null;
  readonly responsavelId?: string | null;
  readonly valor?: string;
  readonly valorRecorrente?: string | null;
  readonly previsaoFechamento?: string | null;
  readonly motivoPerda?: string;
}

export interface EventoLinhaDoTempo {
  readonly id: string;
  /** `entidade.verbo`, ex.: `negocio.movido`. */
  readonly acao: string;
  readonly entidade: string;
  readonly entidadeId: string | null;
  readonly resumo: string;
  readonly dados?: Readonly<Record<string, unknown>> | null;
  readonly tipoAtor: TipoAtor;
  readonly usuarioId: string | null;
  readonly atorDescricao: string | null;
  readonly criadoEm: string;
}

export type TipoAtividade = 'TAREFA' | 'LIGACAO' | 'REUNIAO' | 'EMAIL' | 'WHATSAPP' | 'NOTA';
export type StatusAtividade = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';

export interface AtividadeLinhaDoTempo {
  readonly id: string;
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly status: StatusAtividade;
  readonly atrasada: boolean;
  readonly venceEm: string | null;
  readonly inicioEm: string | null;
  readonly fimEm: string | null;
  readonly concluidaEm: string | null;
  readonly responsavel: { readonly id: string; readonly nome: string };
}

export interface RegistroLinhaDoTempo {
  readonly tipo: 'evento' | 'atividade';
  readonly ocorridoEm: string;
  readonly evento: EventoLinhaDoTempo | null;
  readonly atividade: AtividadeLinhaDoTempo | null;
}

export interface Atividade {
  readonly id: string;
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly status: StatusAtividade;
  readonly prioridade: 'BAIXA' | 'MEDIA' | 'ALTA';
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly fimEm?: string | null;
  /** Pendente com o prazo no passado (R6.3). */
  readonly atrasada: boolean;
  readonly responsavel: ResumoUsuario;
  readonly concluidaEm?: string | null;
  readonly negocio?: {
    readonly id: string;
    readonly titulo: string;
    readonly funilId: string;
  } | null;
  readonly criadoEm: string;
}

export interface NovaAtividade {
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly negocioId: string;
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly fimEm?: string | null;
}

export interface UsuarioVinculado {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
  readonly ativo: boolean;
}

export interface Contato {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  readonly telefone: string | null;
  readonly cargo: string | null;
  readonly empresa: ResumoEmpresa | null;
  readonly responsavel: UsuarioVinculado | null;
  readonly etiquetas: readonly string[];
}

export interface NovoContato {
  readonly nome: string;
  readonly email?: string | null;
  readonly telefone?: string | null;
  readonly empresaId?: string | null;
  readonly empresaNome?: string | null;
}

export interface ResultadoCriacaoContato {
  /** Falso: já existia um contato com o mesmo e-mail ou telefone, que foi reconvertido (R4.2). */
  readonly criado: boolean;
  readonly contato: Contato;
}

export interface Empresa {
  readonly id: string;
  readonly nome: string;
  readonly cnpjFormatado: string | null;
  readonly cidade: string | null;
  readonly uf: string | null;
}

export interface Usuario {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
  readonly rotuloPapel: string;
  readonly area?: Area | null;
  readonly ativo: boolean;
  readonly nivel: 'ADMINISTRADOR' | 'DIRETORIA' | 'LIDER' | 'MEMBRO';
  readonly avatarUrl?: string | null;
}

export interface EtiquetaEmUso {
  readonly etiqueta: string;
  readonly quantidade: number;
}

export interface NovaEtapa {
  readonly nome: string;
  readonly prazoDias?: number | null;
  readonly probabilidade?: number | null;
}

export interface AlteracaoEtapa {
  readonly nome?: string;
  readonly prazoDias?: number | null;
  readonly probabilidade?: number | null;
}

// Regras automáticas (para as dicas do quadro; só Admin e C-level leem as passagens, e a
// liderança, o rodízio da área) ------------------------------------------------------------

export type EstrategiaDistribuicao = 'RODIZIO' | 'RESPONSAVEL_FIXO' | 'LIDER_DA_AREA';

/** `GET /passagens`: só o que as dicas usam. */
export interface PassagemDoFunil {
  readonly id: string;
  readonly nome: string;
  readonly funilOrigem: ResumoFunil;
  readonly etapaGatilho: { readonly id: string; readonly nome: string };
  readonly funilDestino: ResumoFunil;
  readonly etapaDestino: { readonly id: string; readonly nome: string };
  readonly estrategia: EstrategiaDistribuicao;
  readonly responsavelFixo: { readonly id: string; readonly nome: string } | null;
  readonly ativa: boolean;
}

/** `GET /regras-distribuicao`: só o que as dicas usam. */
export interface RegraDoRodizio {
  readonly area: Area;
  readonly incluirLideres: boolean;
  readonly participantes: readonly { readonly id: string; readonly nome: string }[];
}
