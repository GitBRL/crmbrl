import type { VarianteSelo } from '../../ui/selo/selo';

/** Tipos e rótulos do módulo Financeiro (contratos, parcelas, régua e indicadores; R22–R24). */

export type StatusContrato = 'ATIVO' | 'SUSPENSO' | 'CANCELADO' | 'ENCERRADO';
export type Periodicidade = 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICO';
export type StatusParcela = 'ABERTO' | 'ATRASADO' | 'PAGO' | 'CANCELADO' | 'RENEGOCIADO';
export type FormaPagamento = 'PIX' | 'BOLETO' | 'CARTAO' | 'TRANSFERENCIA' | 'DINHEIRO' | 'OUTRO';
export type FaixaAtraso = '0-30' | '31-60' | '61-90' | '90+';
export type CanalRegua = 'WHATSAPP' | 'EMAIL' | 'LIGACAO';
export type SituacaoEnvio =
  | 'RETIDO'
  | 'AGENDADO'
  | 'ENVIADO'
  | 'FALHOU'
  | 'CANCELADO'
  | 'PULADO'
  | 'AGUARDANDO_LIGACAO'
  | 'LIGACAO_REGISTRADA';
export type ResultadoLigacao = 'PROMESSA' | 'SEM_ACORDO' | 'NAO_ATENDEU' | 'JA_PAGOU';

export const STATUS_CONTRATO: readonly StatusContrato[] = [
  'ATIVO',
  'SUSPENSO',
  'CANCELADO',
  'ENCERRADO',
];
export const STATUS_PARCELA: readonly StatusParcela[] = [
  'ABERTO',
  'ATRASADO',
  'PAGO',
  'CANCELADO',
  'RENEGOCIADO',
];

export const ROTULO_STATUS_CONTRATO: Readonly<Record<StatusContrato, string>> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  CANCELADO: 'Cancelado',
  ENCERRADO: 'Encerrado',
};
export const VARIANTE_STATUS_CONTRATO: Readonly<Record<StatusContrato, VarianteSelo>> = {
  ATIVO: 'menta',
  SUSPENSO: 'lima',
  CANCELADO: 'coral',
  ENCERRADO: 'neutro',
};
export const ROTULO_STATUS_PARCELA: Readonly<Record<StatusParcela, string>> = {
  ABERTO: 'Em aberto',
  ATRASADO: 'Atrasada',
  PAGO: 'Paga',
  CANCELADO: 'Cancelada',
  RENEGOCIADO: 'Renegociada',
};
export const VARIANTE_STATUS_PARCELA: Readonly<Record<StatusParcela, VarianteSelo>> = {
  ABERTO: 'ciano',
  ATRASADO: 'coral',
  PAGO: 'menta',
  CANCELADO: 'neutro',
  RENEGOCIADO: 'lima',
};
export const ROTULO_PERIODICIDADE: Readonly<Record<Periodicidade, string>> = {
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  UNICO: 'Pagamento único',
};
export const PERIODICIDADES = Object.keys(ROTULO_PERIODICIDADE) as readonly Periodicidade[];
export const ROTULO_FORMA: Readonly<Record<FormaPagamento, string>> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
  OUTRO: 'Outra forma',
};
export const FORMAS = Object.keys(ROTULO_FORMA) as readonly FormaPagamento[];
export const FAIXAS: readonly FaixaAtraso[] = ['0-30', '31-60', '61-90', '90+'];
export const ROTULO_FAIXA: Readonly<Record<FaixaAtraso, string>> = {
  '0-30': 'Até 30 dias',
  '31-60': '31 a 60 dias',
  '61-90': '61 a 90 dias',
  '90+': 'Mais de 90 dias',
};
export const ROTULO_CANAL_REGUA: Readonly<Record<CanalRegua, string>> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  LIGACAO: 'Ligação',
};
export const ROTULO_SITUACAO_ENVIO: Readonly<Record<SituacaoEnvio, string>> = {
  RETIDO: 'Retido',
  AGENDADO: 'Agendado',
  ENVIADO: 'Enviado',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
  PULADO: 'Pulado',
  AGUARDANDO_LIGACAO: 'Ligação pendente',
  LIGACAO_REGISTRADA: 'Ligação registrada',
};
export const VARIANTE_SITUACAO_ENVIO: Readonly<Record<SituacaoEnvio, VarianteSelo>> = {
  RETIDO: 'lima',
  AGENDADO: 'ciano',
  ENVIADO: 'menta',
  FALHOU: 'coral',
  CANCELADO: 'neutro',
  PULADO: 'neutro',
  AGUARDANDO_LIGACAO: 'lima',
  LIGACAO_REGISTRADA: 'menta',
};
export const ROTULO_RESULTADO_LIGACAO: Readonly<Record<ResultadoLigacao, string>> = {
  PROMESSA: 'Prometeu pagar',
  SEM_ACORDO: 'Sem acordo',
  NAO_ATENDEU: 'Não atendeu',
  JA_PAGOU: 'Já pagou',
};
export const ROTULO_TIPO_ENVIO: Readonly<Record<string, string>> = {
  ETAPA: 'Etapa da régua',
  PROMESSA_CONFIRMADA: 'Promessa confirmada',
  PROMESSA_NAO_CUMPRIDA: 'Promessa não cumprida',
};

export interface Ref {
  readonly id: string;
  readonly nome: string;
}

export interface Contrato {
  readonly id: string;
  readonly numero: number;
  readonly codigo: string;
  readonly empresa: Ref | null;
  readonly contato: Ref | null;
  readonly negocio: { readonly id: string; readonly titulo: string } | null;
  readonly produto: string;
  readonly descricao: string | null;
  readonly valor: string;
  readonly periodicidade: Periodicidade;
  readonly mrr: string;
  readonly inicioEm: string;
  readonly fimEm: string | null;
  readonly renovacaoEm: string | null;
  readonly renovacaoAutomatica: boolean;
  readonly diaVencimento: number | null;
  readonly status: StatusContrato;
  readonly responsavelCs: Ref | null;
  readonly canceladoEm: string | null;
  readonly motivoCancelamento: string | null;
  readonly encerradoEm: string | null;
  readonly podeEditar: boolean;
}

export interface ResumoParcelas {
  readonly total: number;
  readonly abertas: number;
  readonly atrasadas: number;
  readonly pagas: number;
  readonly valorEmAberto: string;
  readonly valorAtrasado: string;
  readonly valorPago: string;
}

export interface ContratoDetalhe extends Contrato {
  readonly resumoParcelas: ResumoParcelas;
}

export interface ConsultaContratos {
  readonly pagina: number;
  readonly porPagina: number;
  readonly status: readonly StatusContrato[];
  readonly busca: string;
}

export interface DadosContrato {
  empresaId?: string | null;
  contatoId?: string | null;
  negocioId?: string | null;
  produto: string;
  descricao?: string | null;
  valor: string;
  periodicidade?: Periodicidade;
  inicioEm: string;
  fimEm?: string | null;
  renovacaoEm?: string | null;
  renovacaoAutomatica?: boolean;
  diaVencimento?: number | null;
  responsavelCsId?: string | null;
  gerarParcelas?: boolean;
  quantidadeParcelas?: number | null;
}

export interface SugestaoContrato {
  readonly negocioGanho: boolean;
  readonly jaTemContrato: boolean;
  readonly sugestao: {
    readonly negocioId: string;
    readonly empresaId: string | null;
    readonly contatoId: string | null;
    readonly produto: string;
    readonly valor: string;
    readonly periodicidade: Periodicidade;
    readonly inicioEm: string;
    readonly responsavelCsId: string | null;
  } | null;
}

export interface Parcela {
  readonly id: string;
  readonly numero: string;
  readonly sequencia: number | null;
  readonly contrato: {
    readonly id: string;
    readonly codigo: string;
    readonly produto: string;
  } | null;
  readonly contato: {
    readonly id: string;
    readonly nome: string;
    readonly email: string | null;
    readonly telefone: string | null;
  } | null;
  readonly empresa: Ref | null;
  readonly origem: string | null;
  readonly descricao: string | null;
  readonly vencimento: string;
  readonly vencimentoOriginal: string | null;
  readonly valor: string;
  readonly valorPago: string | null;
  readonly status: StatusParcela;
  readonly statusGravado: StatusParcela;
  readonly diasEmAtraso: number;
  readonly faixaDeAtraso: FaixaAtraso | null;
  readonly linkBoleto: string | null;
  readonly linkPagamento: string | null;
  readonly pix: string | null;
  readonly pagoEm: string | null;
  readonly formaPagamento: FormaPagamento | null;
  readonly baixaOrigem: string | null;
  readonly renegociadaParaId: string | null;
  readonly promessaAte: string | null;
  readonly podeEditar: boolean;
}

export interface FiltrosParcelas {
  readonly status: readonly StatusParcela[];
  readonly faixa: FaixaAtraso | null;
  readonly contratoId: string | null;
  readonly vencimentoDe: string | null;
  readonly vencimentoAte: string | null;
  readonly comPromessa: boolean;
  readonly busca: string;
}

export interface ConsultaParcelas extends FiltrosParcelas {
  readonly pagina: number;
  readonly porPagina: number;
}

export interface TotaisParcelas {
  readonly quantidade: number;
  readonly porStatus: Readonly<
    Partial<Record<StatusParcela, { quantidade: number; valor: string }>>
  >;
}

export interface EnvioDaLinhaDoTempo {
  readonly ciclo: number;
  readonly marco: number;
  readonly etapa: string | null;
  readonly tipo: string;
  readonly canal: CanalRegua;
  readonly situacao: SituacaoEnvio;
  readonly dia: string;
  readonly destino: string | null;
  readonly agendadoPara: string | null;
  readonly enviadoEm: string | null;
  readonly motivo: string | null;
  readonly erro: string | null;
  readonly resultado: ResultadoLigacao | null;
  readonly observacao: string | null;
  readonly promessaAte: string | null;
  readonly atividadeId: string | null;
  readonly mensagemId: string | null;
}

export interface HistoricoParcela {
  readonly id: string;
  readonly acao: string;
  readonly resumo: string;
  readonly ator: string | null;
  readonly tipoAtor: string | null;
  readonly em: string;
}

export interface LinhaDoTempoParcela {
  readonly parcela: Parcela;
  readonly envios: readonly EnvioDaLinhaDoTempo[];
  readonly historico: readonly HistoricoParcela[];
}

export interface DadosBaixa {
  pagoEm?: string;
  valorPago?: string;
  formaPagamento?: FormaPagamento;
}

export interface DadosParcela {
  numero?: string;
  contratoId?: string | null;
  contatoId?: string | null;
  empresaId?: string | null;
  descricao?: string | null;
  vencimento: string;
  valor: string;
  linkBoleto?: string | null;
  linkPagamento?: string | null;
  pix?: string | null;
}

// ----- Régua ---------------------------------------------------------------------------------

export interface ConfiguracaoRegua {
  readonly ativa: boolean;
  readonly horario: string;
  readonly toleranciaDias: number;
  readonly canalWhatsappId: string | null;
  readonly intervaloWhatsappSegundos: number;
  readonly horarioLimiteLigacoes: string;
  readonly pausada: boolean;
  readonly textoPromessaConfirmada: string | null;
  readonly textoPromessaNaoCumprida: string | null;
  readonly variaveis: readonly string[];
  readonly podeEditar: boolean;
}

export interface EtapaRegua {
  readonly id: string;
  readonly nome: string;
  readonly marco: number;
  readonly rotuloDoMarco: string;
  readonly ativa: boolean;
  readonly whatsapp: boolean;
  readonly email: boolean;
  readonly ligacao: boolean;
  readonly modeloWhatsappId: string | null;
  readonly textoWhatsapp: string | null;
  readonly modeloEmailId: string | null;
  readonly assuntoEmail: string | null;
  readonly textoEmail: string | null;
  readonly roteiroLigacao: string | null;
}

export type DadosEtapa = Omit<EtapaRegua, 'id' | 'rotuloDoMarco'>;

export interface ResumoRegua {
  readonly whatsapp: Readonly<Record<string, number>>;
  readonly email: Readonly<Record<string, number>>;
  readonly ligacoes: Readonly<Record<string, number>>;
  readonly ligacoesPendentes: number;
  readonly proximoEnvioWhatsapp: string | null;
  readonly pausada: boolean;
  readonly ativa: boolean;
  readonly horario: string;
  readonly ultimaExecucao: {
    readonly id: string;
    readonly tipo: string;
    readonly status: string;
    readonly iniciadaEm: string;
  } | null;
  readonly podeGerenciar: boolean;
}

export interface EnvioRegua {
  readonly id: string;
  readonly dia: string;
  readonly parcela: {
    readonly id: string;
    readonly numero: string;
    readonly status: StatusParcela;
    readonly contato: Ref | null;
    readonly empresa: Ref | null;
  };
  readonly etapa: string | null;
  readonly marco: number;
  readonly tipo: string;
  readonly canal: CanalRegua;
  readonly situacao: SituacaoEnvio;
  readonly destino: string | null;
  readonly agendadoPara: string | null;
  readonly enviadoEm: string | null;
  readonly motivo: string | null;
  readonly erro: string | null;
  readonly statusDaMensagem: string | null;
}

export interface LigacaoPendente {
  readonly id: string;
  readonly etapa: string | null;
  readonly marco: number;
  readonly situacao: SituacaoEnvio;
  readonly prazoEm: string | null;
  readonly atividadeId: string | null;
  readonly roteiro: string | null;
  readonly telefone: string | null;
  readonly contato: Ref | null;
  readonly empresa: Ref | null;
  readonly parcela: {
    readonly id: string;
    readonly numero: string;
    readonly valor?: string;
    readonly vencimento?: string;
    readonly diasEmAtraso?: number;
  };
}

export interface ExecucaoRegua {
  readonly id: string;
  readonly tipo: string;
  readonly status: string;
  readonly resumo: Readonly<Record<string, number>> | null;
  readonly iniciadaEm?: string | null;
  readonly concluidaEm?: string | null;
  readonly criadoEm?: string | null;
}

// ----- Indicadores ---------------------------------------------------------------------------

export interface MesMrr {
  readonly mes: string;
  readonly novo: string;
  readonly expansao: string;
  readonly contracao: string;
  readonly churn: string;
  readonly variacao: string;
  readonly mrr: string;
}

export interface IndicadoresMrr {
  readonly meses: readonly MesMrr[];
  readonly atual: { readonly mrr: string; readonly contratos: number };
}

export interface FaixaInadimplencia {
  readonly faixa: FaixaAtraso;
  readonly quantidade: number;
  readonly valor: string;
  readonly clientes: number;
}

export interface IndicadoresInadimplencia {
  readonly referencia: string;
  readonly faixas: readonly FaixaInadimplencia[];
  readonly total: {
    readonly quantidade: number;
    readonly valor: string;
    readonly clientes: number;
  };
  readonly taxa: number | string | null;
}

export interface MesPrevistoRealizado {
  readonly mes: string;
  readonly previsto: string;
  readonly realizado: string;
  readonly emAberto: string;
  readonly recebidoNoMes: string;
  readonly taxaDeRealizacao: number | string | null;
}

export interface IndicadoresPrevistoRealizado {
  readonly meses: readonly MesPrevistoRealizado[];
  readonly total: unknown;
}

export interface FatorRisco {
  readonly tipo: 'ATRASO' | 'SATISFACAO' | 'SEM_INTERACAO';
  readonly pontos: number;
  readonly detalhe: string;
}

export interface RiscoChurn {
  readonly contatoId: string;
  readonly pontuacao: number;
  readonly nivel: 'BAIXO' | 'MEDIO' | 'ALTO';
  readonly fatores: readonly FatorRisco[];
}

export const ROTULO_NIVEL_RISCO: Readonly<Record<RiscoChurn['nivel'], string>> = {
  BAIXO: 'Risco baixo',
  MEDIO: 'Risco médio',
  ALTO: 'Risco alto',
};
export const VARIANTE_NIVEL_RISCO: Readonly<Record<RiscoChurn['nivel'], VarianteSelo>> = {
  BAIXO: 'menta',
  MEDIO: 'lima',
  ALTO: 'coral',
};

/** "2026-03" → "mar/26". */
export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split('-');
  const nomes = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return `${nomes[Number(numero) - 1] ?? numero}/${(ano ?? '').slice(2)}`;
}

/** "D-7", "D0", "D+3" a partir do marco em dias. */
export function rotuloDoMarco(marco: number): string {
  return marco === 0 ? 'D0' : marco > 0 ? `D+${marco}` : `D${marco}`;
}

/** Hoje como AAAA-MM-DD no horário local. */
export function hojeIso(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export interface ResumoIndicadores {
  readonly mes: string;
  readonly mrr: { readonly mrr: string; readonly contratos: number };
  readonly mrrDoMes: MesMrr;
  readonly inadimplencia: {
    readonly quantidade: number;
    readonly valor: string;
    readonly clientes: number;
  };
  readonly taxaDeInadimplencia: number | string | null;
  readonly previstoRealizado: MesPrevistoRealizado;
}

export interface ClienteEmRisco extends RiscoChurn {
  readonly contato: Ref;
}
