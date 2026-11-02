import type { VarianteSelo } from '../../ui/selo/selo';
import type { Area } from '../../nucleo/sessao/perfil';
import { semCodigoDeRegra } from '../../nucleo/formatos';

/**
 * Tipos dos webhooks (crmbrl-api, `/webhooks/entradas` e `/webhooks/saidas`; contrato no
 * OpenAPI) e os rótulos em português que as telas de Integrações mostram (TELAS-FASE1 §7,
 * REGRAS-DE-NEGOCIO §8 e §9).
 */

// ---------------------------------------------------------------------------------------------
// Entrada (R8)
// ---------------------------------------------------------------------------------------------

export type EstrategiaDistribuicao = 'RODIZIO' | 'RESPONSAVEL_FIXO' | 'LIDER_DA_AREA';
export type ModeloMapeamento = 'GENERICO' | 'DISPAROS_BRL' | 'PERSONALIZADO';
export type StatusRecebimento = 'RECEBIDO' | 'PROCESSADO' | 'IGNORADO' | 'ERRO';
export type TipoEtapa = 'ABERTA' | 'GANHO' | 'PERDIDO';

export interface RegraDeCampo {
  /** Caminho no corpo recebido: `lead.email`, `itens[0].nome`, `planilha_*`. */
  readonly caminho: string;
  /** `nome`, `email`, `utm.source`, `camposPersonalizados.<chave>`… */
  readonly destino: string;
}

export interface CondicaoParaIgnorar {
  readonly caminho: string;
  readonly valor: string | number | boolean;
}

export interface Mapeamento {
  readonly campos: readonly RegraDeCampo[];
  readonly ignorarQuando: readonly CondicaoParaIgnorar[];
}

export interface ModeloPronto {
  readonly modelo: Exclude<ModeloMapeamento, 'PERSONALIZADO'>;
  readonly nome: string;
  readonly descricao: string;
  readonly mapeamento: Mapeamento;
  readonly exemplo: Record<string, unknown>;
}

export interface DestinoDeMapeamento {
  readonly destino: string;
  readonly descricao: string;
}

export interface ModelosDeMapeamento {
  readonly modelos: readonly ModeloPronto[];
  readonly destinos: readonly DestinoDeMapeamento[];
}

export interface PessoaDoWebhook {
  readonly id: string;
  readonly nome: string;
}

export interface WebhookEntrada {
  readonly id: string;
  readonly nome: string;
  readonly tokenPrefixo: string;
  /** O endereço com o token cortado: o completo só aparece ao criar e ao regenerar (R8.2). */
  readonly enderecoMascarado: string;
  readonly funil: { readonly id: string; readonly nome: string; readonly area: Area };
  readonly etapa: { readonly id: string; readonly nome: string; readonly tipo: TipoEtapa };
  readonly estrategia: EstrategiaDistribuicao;
  readonly responsavelFixo: PessoaDoWebhook | null;
  readonly modeloMapeamento: ModeloMapeamento;
  readonly mapeamento: Mapeamento;
  readonly etiquetasFixas: readonly string[];
  readonly exigeAssinatura: boolean;
  readonly segredoMascarado: string | null;
  readonly ativo: boolean;
  readonly ultimoRecebimentoEm: string | null;
  readonly recebimentos24h: { readonly total: number; readonly erros: number };
  readonly criadoPor: PessoaDoWebhook | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** Corpo de `POST /webhooks/entradas` (e, sem os campos de segredo, do `PATCH`). */
export interface DadosWebhookEntrada {
  readonly nome: string;
  readonly funilId: string;
  readonly etapaId: string;
  readonly estrategia: EstrategiaDistribuicao;
  readonly responsavelFixoId?: string | null;
  readonly modeloMapeamento: ModeloMapeamento;
  readonly mapeamento?: Mapeamento;
  readonly etiquetasFixas: readonly string[];
  readonly ativo?: boolean;
  readonly segredo?: string;
  readonly gerarSegredo?: boolean;
}

export interface WebhookEntradaCriado {
  readonly webhook: WebhookEntrada;
  /** O endereço completo, com o token: só nesta resposta. */
  readonly url: string;
  /** O segredo gerado (com `gerarSegredo`): só nesta resposta. */
  readonly segredo?: string;
}

export interface ResultadoDaPrevia {
  readonly valido: boolean;
  readonly ignorado: string | null;
  readonly problemas: readonly string[];
  readonly avisos: readonly string[];
  readonly contato: {
    readonly nome: string | null;
    readonly email: string | null;
    readonly telefone: string | null;
    readonly empresa: string | null;
    readonly cargo: string | null;
    readonly etiquetas: readonly string[];
    readonly camposPersonalizados: Readonly<Record<string, unknown>>;
  };
  readonly negocio: {
    readonly titulo: string | null;
    readonly valor: string | null;
    readonly valorRecorrente: string | null;
  };
  readonly utm: Readonly<Record<string, string>> | null;
  readonly encontrados: readonly RegraDeCampo[];
}

export interface Recebimento {
  readonly id: string;
  readonly webhookId: string;
  readonly recebidoEm: string;
  readonly ip: string | null;
  readonly tipoConteudo: string | null;
  readonly status: StatusRecebimento;
  readonly mensagem: string | null;
  readonly tentativas: number;
  readonly processadoEm: string | null;
  readonly contato: { readonly id: string; readonly nome: string } | null;
  readonly negocio: { readonly id: string; readonly titulo: string } | null;
  readonly recusadoNaRecepcao: boolean;
  readonly podeReprocessar: boolean;
}

export interface RecebimentoDetalhe extends Recebimento {
  readonly cabecalhos: Readonly<Record<string, unknown>>;
  readonly corpo: unknown;
}

// ---------------------------------------------------------------------------------------------
// Saída (R9)
// ---------------------------------------------------------------------------------------------

export type EventoDeWebhook =
  | 'contato.criado'
  | 'contato.atualizado'
  | 'negocio.criado'
  | 'negocio.movido'
  | 'negocio.ganho'
  | 'negocio.perdido'
  | 'atividade.criada'
  | 'atividade.concluida'
  | 'usuario.desligado'
  | 'webhook.teste';

export type StatusEntrega = 'PENDENTE' | 'ENTREGUE' | 'FALHOU';

export interface EventoDisponivel {
  readonly evento: EventoDeWebhook;
  readonly descricao: string;
}

export interface WebhookSaida {
  readonly id: string;
  readonly nome: string;
  readonly url: string;
  readonly eventos: readonly EventoDeWebhook[];
  readonly cabecalhos: readonly { readonly nome: string; readonly valorMascarado: string }[];
  readonly segredoMascarado: string;
  readonly ativo: boolean;
  readonly falhasConsecutivas: number;
  readonly desativadoAutomaticamenteEm: string | null;
  readonly entregas: { readonly pendentes: number; readonly falhas: number };
  readonly criadoPor: PessoaDoWebhook | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface DadosWebhookSaida {
  readonly nome?: string;
  readonly url?: string;
  readonly eventos?: readonly EventoDeWebhook[];
  /** No `PATCH`, `null` num cabeçalho o remove; os não enviados ficam. */
  readonly cabecalhos?: Readonly<Record<string, string | null>>;
  readonly ativo?: boolean;
}

export interface WebhookSaidaComSegredo {
  readonly webhook: WebhookSaida;
  /** O segredo das assinaturas: só nesta resposta. */
  readonly segredo: string;
}

export interface TentativaDeEntrega {
  readonly numero: number;
  readonly sucesso: boolean;
  readonly statusHttp: number | null;
  readonly duracaoMs: number | null;
  readonly trechoResposta: string | null;
  readonly erro: string | null;
  readonly criadoEm: string;
}

export interface Entrega {
  readonly id: string;
  readonly webhookId: string;
  readonly eventoId: string;
  readonly evento: string;
  readonly status: StatusEntrega;
  readonly tentativas: number;
  readonly ultimaTentativaEm: string | null;
  readonly proximaTentativaEm: string | null;
  readonly statusHttp: number | null;
  readonly duracaoMs: number | null;
  readonly trechoResposta: string | null;
  readonly erro: string | null;
  readonly entregueEm: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface EntregaDetalhe extends Entrega {
  readonly payload: unknown;
  readonly historicoTentativas: readonly TentativaDeEntrega[];
}

// ---------------------------------------------------------------------------------------------
// Apoio (funis e usuários para o destino do webhook de entrada)
// ---------------------------------------------------------------------------------------------

export interface EtapaDoFunil {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoEtapa;
  readonly ordem: number;
}

export interface FunilDoDestino {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
  readonly ativo: boolean;
  readonly etapas: readonly EtapaDoFunil[];
}

export interface UsuarioDoDestino {
  readonly id: string;
  readonly nome: string;
  readonly papel: string;
  readonly rotuloPapel: string;
  readonly area: Area | null;
  readonly ativo: boolean;
}

// ---------------------------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------------------------

export const ROTULO_ESTRATEGIA: Readonly<Record<EstrategiaDistribuicao, string>> = {
  RODIZIO: 'Rodízio da área',
  RESPONSAVEL_FIXO: 'Responsável fixo',
  LIDER_DA_AREA: 'Líder da área',
};

export const DICA_ESTRATEGIA: Readonly<Record<EstrategiaDistribuicao, string>> = {
  RODIZIO:
    'Cada lead novo vai para a próxima pessoa da vez no rodízio da área do funil (Configurações → Distribuição de leads).',
  RESPONSAVEL_FIXO: 'Todo lead que chegar por aqui fica com a mesma pessoa.',
  LIDER_DA_AREA: 'Os leads ficam com o líder da área do funil, que distribui depois.',
};

export const ROTULO_MODELO: Readonly<Record<ModeloMapeamento, string>> = {
  GENERICO: 'Genérico',
  DISPAROS_BRL: 'Disparos BRL',
  PERSONALIZADO: 'Personalizado',
};

export const ROTULO_STATUS_RECEBIMENTO: Readonly<Record<StatusRecebimento, string>> = {
  RECEBIDO: 'Na fila',
  PROCESSADO: 'Processado',
  IGNORADO: 'Ignorado',
  ERRO: 'Erro',
};

export const SELO_STATUS_RECEBIMENTO: Readonly<Record<StatusRecebimento, VarianteSelo>> = {
  RECEBIDO: 'ciano',
  PROCESSADO: 'menta',
  IGNORADO: 'neutro',
  ERRO: 'coral',
};

export const ROTULO_STATUS_ENTREGA: Readonly<Record<StatusEntrega, string>> = {
  PENDENTE: 'Pendente',
  ENTREGUE: 'Entregue',
  FALHOU: 'Falhou',
};

export const SELO_STATUS_ENTREGA: Readonly<Record<StatusEntrega, VarianteSelo>> = {
  PENDENTE: 'lima',
  ENTREGUE: 'menta',
  FALHOU: 'coral',
};

/** Rótulos curtos dos eventos (a descrição completa vem de `GET /webhooks/saidas/eventos`). */
export const ROTULO_EVENTO: Readonly<Record<EventoDeWebhook, string>> = {
  'contato.criado': 'Contato criado',
  'contato.atualizado': 'Contato atualizado',
  'negocio.criado': 'Negócio criado',
  'negocio.movido': 'Negócio movido',
  'negocio.ganho': 'Negócio ganho',
  'negocio.perdido': 'Negócio perdido',
  'atividade.criada': 'Atividade criada',
  'atividade.concluida': 'Atividade concluída',
  'usuario.desligado': 'Usuário desligado',
  'webhook.teste': 'Evento de teste',
};

/**
 * Descrição de um evento para o formulário: a da API, ou — quando ela só repete o nome
 * ("Negócio ganho.") — uma que diz o que chega em `dados`.
 */
const DESCRICAO_COMPLEMENTAR: Readonly<Partial<Record<EventoDeWebhook, string>>> = {
  'negocio.ganho': 'Negócio marcado como ganho, com o valor e o valor recorrente.',
  'atividade.criada':
    'Atividade nova (tarefa, ligação, reunião, e-mail ou nota), com responsável e prazo.',
  'atividade.concluida': 'Atividade marcada como concluída, com quem concluiu e quando.',
};

export function descricaoDoEvento(evento: string, descricaoDaApi: string): string {
  const descricao = semCodigoDeRegra(descricaoDaApi);
  const normalizar = (texto: string) => texto.trim().replace(/\.$/, '').toLocaleLowerCase('pt-BR');
  const repete = normalizar(descricao) === normalizar(rotuloDoEvento(evento));
  return (repete && DESCRICAO_COMPLEMENTAR[evento as EventoDeWebhook]) || descricao;
}

/** Eventos que um destino assina (todos menos o de teste, que vai a quem é testado). */
export const TOTAL_EVENTOS_ASSINAVEIS = Object.keys(ROTULO_EVENTO).length - 1;

/** Rótulo de um evento qualquer (os de fora da lista aparecem como vieram). */
export function rotuloDoEvento(evento: string): string {
  return ROTULO_EVENTO[evento as EventoDeWebhook] ?? evento;
}

/** Destinos de mapeamento com nome em português (para o seletor do mapeamento personalizado). */
export const ROTULO_DESTINO: Readonly<Record<string, string>> = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  empresa: 'Empresa',
  cargo: 'Cargo',
  titulo: 'Título do negócio',
  valor: 'Valor do negócio',
  valorRecorrente: 'Valor recorrente',
  etiquetas: 'Etiquetas',
  'utm.source': 'UTM source',
  'utm.medium': 'UTM medium',
  'utm.campaign': 'UTM campaign',
  'utm.term': 'UTM term',
  'utm.content': 'UTM content',
};

/** "camposPersonalizados.faturamento" → "Campo personalizado “faturamento”". */
export function rotuloDoDestino(destino: string): string {
  const conhecido = ROTULO_DESTINO[destino];
  if (conhecido) {
    return conhecido;
  }
  const prefixo = 'camposPersonalizados.';
  if (destino.startsWith(prefixo)) {
    return `Campo personalizado “${destino.slice(prefixo.length)}”`;
  }
  return destino;
}

/** Prefixo dos destinos que viram campo personalizado. */
export const PREFIXO_CAMPO_PERSONALIZADO = 'camposPersonalizados.';

/**
 * O fim do endereço mascarado de um webhook de entrada, que é o que diferencia um do outro:
 * "http://…/api/v1/webhooks/entrada/yxBjWicA…" → "…/entrada/yxBjWicA…". O endereço inteiro
 * (mascarado) fica no `title`.
 */
export function fimDoEndereco(endereco: string): string {
  const partes = endereco.split('/').filter(Boolean);
  return partes.length > 2 ? `…/${partes.slice(-2).join('/')}` : endereco;
}
