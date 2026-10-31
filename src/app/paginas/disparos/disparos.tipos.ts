import type { VarianteSelo } from '../../ui/selo/selo';

/**
 * Contrato dos Disparos com a API (crmbrl-api, `/disparos/campanhas`; contrato da Onda B §2.3 e
 * regra R17). O resumo da lista não traz segmento, texto, ritmo nem janela: eles vêm no detalhe.
 */

export type CanalCampanha = 'WHATSAPP' | 'EMAIL';
export type TipoPublico = 'SEGMENTO' | 'IMPORTACAO';

export type StatusCampanha =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'AGENDADA'
  | 'EM_ANDAMENTO'
  | 'PAUSADA'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type StatusDestinatario =
  'PENDENTE' | 'ENVIANDO' | 'ENVIADO' | 'FALHOU' | 'INVALIDO' | 'EXCLUIDO';

export const STATUS_CAMPANHA: readonly StatusCampanha[] = [
  'RASCUNHO',
  'AGUARDANDO_APROVACAO',
  'AGENDADA',
  'EM_ANDAMENTO',
  'PAUSADA',
  'CONCLUIDA',
  'CANCELADA',
];

export const ROTULO_STATUS_CAMPANHA: Readonly<Record<StatusCampanha, string>> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADA: 'Pausada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const VARIANTE_STATUS_CAMPANHA: Readonly<Record<StatusCampanha, VarianteSelo>> = {
  RASCUNHO: 'neutro',
  AGUARDANDO_APROVACAO: 'lima',
  AGENDADA: 'ciano',
  EM_ANDAMENTO: 'menta',
  PAUSADA: 'lima',
  CONCLUIDA: 'contorno',
  CANCELADA: 'coral',
};

export const ROTULO_CANAL_CAMPANHA: Readonly<Record<CanalCampanha, string>> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
};

export const ROTULO_STATUS_DESTINATARIO: Readonly<Record<StatusDestinatario, string>> = {
  PENDENTE: 'Na fila',
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  FALHOU: 'Falhou',
  INVALIDO: 'Sem WhatsApp',
  EXCLUIDO: 'Fora da campanha',
};

export const VARIANTE_STATUS_DESTINATARIO: Readonly<Record<StatusDestinatario, VarianteSelo>> = {
  PENDENTE: 'neutro',
  ENVIANDO: 'ciano',
  ENVIADO: 'menta',
  FALHOU: 'coral',
  INVALIDO: 'lima',
  EXCLUIDO: 'neutro',
};

/** Campanhas que ainda estão vivas (a tela acompanha o progresso delas). */
export const STATUS_ATIVOS: readonly StatusCampanha[] = [
  'AGENDADA',
  'EM_ANDAMENTO',
  'PAUSADA',
  'AGUARDANDO_APROVACAO',
];

export interface ContadoresCampanha {
  readonly total: number;
  readonly pendentes: number;
  readonly enviando: number;
  readonly enviados: number;
  readonly entregues: number;
  readonly lidos: number;
  readonly respondidos: number;
  readonly falhas: number;
  readonly invalidos: number;
  readonly excluidos: number;
  readonly optOuts: number;
}

export const CONTADORES_ZERADOS: ContadoresCampanha = {
  total: 0,
  pendentes: 0,
  enviando: 0,
  enviados: 0,
  entregues: 0,
  lidos: 0,
  respondidos: 0,
  falhas: 0,
  invalidos: 0,
  excluidos: 0,
  optOuts: 0,
};

export interface CanalDaCampanha {
  readonly id: string;
  readonly nome: string;
  readonly tipo: CanalCampanha;
  readonly ordem: number;
  readonly telefone: string | null;
  readonly statusDoNumero: string | null;
  readonly numeroPausado: boolean;
}

export type MotivoDeEspera = 'janela_de_envio' | 'intervalo' | 'confirmacoes';

export interface EsperaDaCampanha {
  readonly motivo: MotivoDeEspera;
  readonly ate: string | null;
}

export interface AcoesDaCampanha {
  readonly editar: boolean;
  readonly editarConteudo: boolean;
  readonly iniciar: boolean;
  readonly aprovar: boolean;
  readonly reprovar: boolean;
  readonly pausar: boolean;
  readonly retomar: boolean;
  readonly cancelar: boolean;
  readonly reenviarFalhas: boolean;
  readonly excluir: boolean;
  readonly duplicar: boolean;
}

export interface ArquivoCampanha {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly url: string;
  readonly tamanho?: number;
}

export interface PessoaResumo {
  readonly id: string;
  readonly nome: string;
}

/** Item da lista (`GET /disparos/campanhas`). */
export interface ResumoCampanha {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly canal: CanalCampanha;
  readonly status: StatusCampanha;
  readonly tipoPublico: TipoPublico;
  readonly importacaoId: string | null;
  readonly modeloId: string | null;
  readonly arquivo: ArquivoCampanha | null;
  readonly agendadaPara: string | null;
  readonly iniciadaEm: string | null;
  readonly pausadaEm: string | null;
  readonly pausaMotivo: string | null;
  readonly concluidaEm: string | null;
  readonly canceladaEm: string | null;
  readonly proximoEnvioEm: string | null;
  readonly aguardando: EsperaDaCampanha | null;
  readonly canais: readonly CanalDaCampanha[];
  readonly contadores: ContadoresCampanha;
  /** 0 a 100. */
  readonly progresso: number;
  readonly campanhaOrigemId: string | null;
  readonly criadoPor: PessoaResumo | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly acoes: AcoesDaCampanha;
}

export interface RitmoCampanha {
  readonly intervaloMinimoSegundos: number;
  readonly intervaloMaximoSegundos: number;
  readonly loteTamanho: number | null;
  readonly lotePausaSegundos: number | null;
  readonly simularDigitando: boolean;
  readonly pausarAposFalhas: number;
}

/** Janela de envio no formato da API: `dias` 0 (domingo) a 6, cada um com faixas de horas. */
export interface JanelaEnvioApi {
  readonly fusoHorario: string;
  readonly dias: Readonly<Record<string, readonly { inicio: string; fim: string }[]>>;
}

export interface SegmentoApi {
  readonly combinacao?: 'todas' | 'qualquer';
  readonly condicoes: readonly CondicaoApi[];
}

export type CondicaoApi =
  { campo: string; operador: string; valor?: unknown } | { grupo: SegmentoApi };

export interface Campanha extends ResumoCampanha {
  readonly segmento: SegmentoApi | null;
  readonly assunto: string | null;
  readonly texto: string;
  readonly ritmo: RitmoCampanha;
  readonly janelaEnvio: JanelaEnvioApi | null;
  readonly aprovacao: {
    readonly solicitadaEm: string | null;
    readonly aprovadaEm: string | null;
    readonly aprovadaPor: PessoaResumo | null;
    readonly reprovacaoMotivo: string | null;
  };
}

/** Corpo de `POST`/`PATCH /disparos/campanhas` (no PATCH, tudo opcional). */
export interface DadosCampanha {
  nome?: string;
  descricao?: string | null;
  canal?: CanalCampanha;
  canalIds?: readonly string[];
  tipoPublico?: TipoPublico;
  segmento?: SegmentoApi | null;
  importacaoId?: string | null;
  modeloId?: string | null;
  assunto?: string | null;
  texto?: string;
  arquivoId?: string | null;
  intervaloMinimoSegundos?: number;
  intervaloMaximoSegundos?: number;
  loteTamanho?: number | null;
  lotePausaSegundos?: number | null;
  simularDigitando?: boolean;
  pausarAposFalhas?: number;
  janelaEnvio?: JanelaEnvioApi | null;
  area?: string;
}

export interface ConsultaCampanhas {
  readonly pagina: number;
  readonly porPagina: number;
  readonly status: readonly StatusCampanha[];
  readonly canal: CanalCampanha | null;
  readonly busca: string;
  readonly minhas: boolean;
}

export interface PreviaPublico {
  readonly total: number;
  readonly elegiveis: number;
  readonly semDestino: number;
  readonly optOutExcluidos: number;
  readonly amostra: readonly {
    readonly id: string;
    readonly nome: string;
    readonly email: string | null;
    readonly telefone: string | null;
    readonly etiquetas?: readonly string[];
  }[];
}

export interface EstimativaEnvio {
  readonly duracaoSegundos: number;
  readonly terminoPrevisto: string | null;
  readonly dias: number;
  readonly enviosPorHora: number;
  readonly limiteDiarioTotal: number;
}

export interface ProblemaRevisao {
  readonly gravidade: 'erro' | 'aviso';
  readonly campo: string;
  readonly mensagem: string;
}

export interface RevisaoCampanha {
  readonly campanhaId: string;
  readonly publico: PreviaPublico;
  readonly estimativa: EstimativaEnvio;
  readonly canais: readonly {
    readonly id: string;
    readonly nome: string;
    readonly telefone: string | null;
    readonly disponivel: boolean;
    readonly motivo: string | null;
    readonly limiteDoDia: number | null;
  }[];
  readonly previa: { readonly texto: string; readonly assunto: string | null };
  readonly problemas: readonly ProblemaRevisao[];
  readonly podeIniciar: boolean;
  readonly exigeAprovacao: boolean;
}

export interface Destinatario {
  readonly id: string;
  readonly contato: {
    readonly id: string;
    readonly nome: string;
    readonly email: string | null;
    readonly telefone: string | null;
  } | null;
  readonly destino: string | null;
  readonly status: StatusDestinatario;
  readonly motivo: string | null;
  readonly canal: { readonly id: string; readonly nome: string } | null;
  readonly conversaMensagemId: string | null;
  readonly enviadoEm: string | null;
  readonly entregueEm: string | null;
  readonly lidoEm: string | null;
  readonly respondeuEm: string | null;
  readonly optOutEm: string | null;
  readonly falhouEm: string | null;
}

export interface RelatorioCampanha {
  readonly campanhaId: string;
  readonly nome: string;
  readonly status: StatusCampanha;
  readonly contadores: ContadoresCampanha;
  readonly taxas: {
    readonly entrega: number;
    readonly leitura: number;
    readonly resposta: number;
    readonly falha: number;
    readonly optOut: number;
  };
  readonly porNumero: readonly {
    readonly canalId: string;
    readonly nome: string;
    readonly telefone: string | null;
    readonly enviados: number;
    readonly entregues: number;
    readonly lidos: number;
    readonly respondidos: number;
    readonly falhas: number;
  }[];
  readonly serie: readonly {
    readonly inicio: string;
    readonly enviados: number;
    readonly entregues: number;
    readonly lidos: number;
    readonly respondidos: number;
  }[];
  readonly motivosDeFalha: readonly { readonly motivo: string; readonly quantidade: number }[];
  readonly motivosDeExclusao: readonly { readonly motivo: string; readonly quantidade: number }[];
}

export interface ConfiguracaoDisparos {
  readonly aprovacaoDoLider: boolean;
  readonly palavrasDeSaida: readonly string[];
  readonly mensagemDeSaida: string;
}

export interface ModeloMensagem {
  readonly id: string;
  readonly nome: string;
  readonly canal: CanalCampanha | null;
  readonly assunto: string | null;
  readonly texto: string;
  readonly arquivo: ArquivoCampanha | null;
  readonly area: string | null;
  readonly variaveis: readonly string[];
  readonly podeEditar: boolean;
}

/** Canal de atendimento que pode servir à campanha (`GET /atendimento/canais`). */
export interface CanalDisponivel {
  readonly id: string;
  readonly tipo: string;
  readonly nome: string;
  readonly ativo: boolean;
  readonly disponivel: boolean;
}

export interface ImportacaoResumo {
  readonly id: string;
  readonly nome: string;
  readonly status: string;
  readonly criados: number;
  readonly atualizados: number;
  readonly totalLinhas: number;
  readonly concluidaEm: string | null;
}

/** Evento `campanha.progresso` do tempo real. */
export interface EventoCampanhaProgresso {
  readonly campanhaId: string;
  readonly status: StatusCampanha;
  readonly contadores: ContadoresCampanha;
  readonly proximoEnvioEm: string | null;
  readonly pausaMotivo: string | null;
  readonly em: string;
}

/** Percentual com uma casa ("33,3%"); `—` sem valor. */
export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
    return '—';
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Aplica um evento de progresso ao resumo/detalhe, sem tocar no resto. */
export function aplicarProgresso<T extends ResumoCampanha>(
  campanha: T,
  evento: EventoCampanhaProgresso,
): T {
  const { total, pendentes, enviando } = evento.contadores;
  const resolvidos = Math.max(0, total - pendentes - enviando);
  const progresso = total > 0 ? Math.min(100, Math.round((resolvidos / total) * 100)) : 0;
  return {
    ...campanha,
    status: evento.status,
    contadores: evento.contadores,
    proximoEnvioEm: evento.proximoEnvioEm,
    pausaMotivo: evento.pausaMotivo,
    progresso,
  };
}
