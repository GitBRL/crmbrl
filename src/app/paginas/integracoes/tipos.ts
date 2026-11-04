import type { VarianteSelo } from '../../ui/selo/selo';
import type { Area } from '../../nucleo/sessao/perfil';
import { semCodigoDeRegra } from '../../nucleo/formatos';
import type { EventosDoAplicativo, RegraDoEvento } from './eventos.tipos';

/**
 * Tipos dos webhooks (crmbrl-api, `/webhooks/entradas` e `/webhooks/saidas`; contrato no
 * OpenAPI) e os rótulos em português que as telas de Integrações mostram (TELAS-FASE1 §7,
 * REGRAS-DE-NEGOCIO §8 e §9).
 */

// ---------------------------------------------------------------------------------------------
// Entrada (R8)
// ---------------------------------------------------------------------------------------------

export type EstrategiaDistribuicao = 'RODIZIO' | 'RESPONSAVEL_FIXO' | 'LIDER_DA_AREA';
export type ModeloMapeamento = 'GENERICO' | 'DISPAROS_BRL' | 'DO_APLICATIVO' | 'PERSONALIZADO';

export type AplicativoIntegracao =
  | 'ACTIVE_CAMPAIGN'
  | 'EDUZZ'
  | 'ELEMENTOR'
  | 'FACEBOOK_LEAD_ADS'
  | 'GREAT_PAGES'
  | 'HOTMART'
  | 'KIWIFY'
  | 'LEAD_LOVERS'
  | 'MANYCHAT'
  | 'RD_STATION'
  | 'TYPEFORM'
  | 'WEBHOOK';
export type AlvoIntegracao = 'CONTATO' | 'NEGOCIO';
export type ModoIntegracao = 'CRIAR' | 'ATUALIZAR' | 'CRIAR_OU_ATUALIZAR';
export type StatusInicial = 'ABERTO' | 'GANHO' | 'PERDIDO';
export type SituacaoIntegracao = 'ATIVA' | 'INATIVA' | 'PRECISA_ATENCAO';
export type SegredoDoAplicativo = 'NAO_USA' | 'OPCIONAL' | 'GERADO_PELO_CRM' | 'OBRIGATORIO';
export type TipoDeCampoRecebido = 'texto' | 'numero' | 'booleano' | 'lista' | 'objeto';
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

export interface CredencialDoAplicativo {
  readonly chave: string;
  readonly rotulo: string;
  readonly secreto: boolean;
  readonly obrigatorio: boolean;
  readonly descricao: string;
  readonly exemplo?: string;
}

export interface AplicativoDoCatalogo {
  readonly aplicativo: AplicativoIntegracao;
  readonly nome: string;
  readonly descricao: string;
  readonly disponivel: boolean;
  readonly entrega: 'WEBHOOK' | 'API';
  readonly tiposDeConteudo: readonly string[];
  readonly autenticidade: {
    readonly tipo: string;
    readonly descricao: string;
    readonly segredo: SegredoDoAplicativo;
    readonly rotuloDoSegredo: string | null;
    readonly cabecalho: string | null;
  };
  readonly credencial: readonly CredencialDoAplicativo[] | null;
  readonly buscaCampos: boolean;
  readonly escolheFormulario: boolean;
  readonly passoAPasso: { readonly titulo: string; readonly passos: readonly string[] };
  readonly modelo: {
    readonly nome: string;
    readonly descricao: string;
    readonly mapeamento: Mapeamento;
    readonly exemplo: Record<string, unknown>;
  } | null;
  readonly dicas: readonly string[];
  /** Tabela de eventos (plataformas de curso); `null` nos demais aplicativos. */
  readonly eventos?: EventosDoAplicativo | null;
}

export interface CatalogoDeAplicativos {
  readonly aplicativos: readonly AplicativoDoCatalogo[];
  readonly destinos: readonly DestinoDeMapeamento[];
}

export interface CampoDaCredencial {
  readonly chave: string;
  readonly rotulo: string;
  readonly secreto: boolean;
  /** Secreto: mascarado com os 4 últimos caracteres; senão o valor; `null` se vazio. */
  readonly valor: string | null;
}

export interface CampoDeIntegracao {
  readonly caminho: string;
  readonly rotulo: string;
  readonly tipo: string;
}

export interface CamposRecebidos {
  readonly campos: readonly {
    readonly caminho: string;
    readonly tipo: TipoDeCampoRecebido;
    readonly exemplo: string | null;
    readonly ocorrencias: number;
  }[];
  readonly recebimentosLidos: number;
  readonly ultimoRecebimentoEm: string | null;
}

export interface FormularioDoTypeform {
  readonly id: string;
  readonly titulo: string;
  readonly url: string;
  readonly atualizadoEm: string | null;
}

export interface ResultadoDaCredencial {
  readonly valida: boolean;
  readonly mensagem: string;
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
  readonly aplicativo: AplicativoIntegracao;
  readonly aplicativoNome: string;
  readonly alvo: AlvoIntegracao;
  readonly modo: ModoIntegracao;
  readonly statusInicial: StatusInicial;
  readonly motivoPerdaPadrao: string | null;
  readonly credencial: {
    readonly configurada: boolean;
    readonly campos: readonly CampoDaCredencial[];
  };
  readonly configuracao: {
    readonly formularioId?: string;
    readonly cabecalhoDeAutenticacao?: string;
    readonly webhookRegistrado?: {
      readonly formularioId: string;
      readonly tag: string;
      readonly ativo: boolean;
      readonly em: string;
    };
    readonly webhookErro?: string;
    // Facebook Lead Ads
    readonly conexaoId?: string;
    readonly paginaId?: string;
    readonly paginaNome?: string;
    readonly formularioNome?: string;
    readonly assinaturaErro?: string;
    // Plataformas de curso
    readonly eventos?: Readonly<Record<string, RegraDoEvento>> | null;
    readonly produtos?: readonly string[] | null;
  };
  readonly camposBuscados: readonly CampoDeIntegracao[] | null;
  readonly camposBuscadosEm: string | null;
  readonly situacao: SituacaoIntegracao;
  readonly precisaAtencao: boolean;
  readonly atencaoMotivo: string | null;
  readonly atencaoEm: string | null;
  /** `false`: integração antiga, sem o endereço completo guardado (só "Gerar novo endereço"). */
  readonly enderecoDisponivel: boolean;
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
  readonly aplicativo?: AplicativoIntegracao;
  readonly alvo?: AlvoIntegracao;
  readonly modo?: ModoIntegracao;
  readonly statusInicial?: StatusInicial;
  readonly motivoPerdaPadrao?: string | null;
  readonly credencial?: Readonly<Record<string, string>>;
  readonly configuracao?: {
    readonly formularioId?: string | null;
    readonly cabecalhoDeAutenticacao?: string | null;
    readonly conexaoId?: string;
    readonly paginaId?: string;
    readonly eventos?: Readonly<Record<string, RegraDoEvento>> | null;
    readonly produtos?: readonly string[] | null;
  };
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
  /** Etapa, dono, status e motivo de perda vindos do mapeamento (modo atualizar). */
  readonly atualizacoes?: {
    readonly etapa: string | null;
    readonly dono: string | null;
    readonly status: string | null;
    readonly motivoPerda: string | null;
  };
  readonly camposDoNegocio?: Readonly<Record<string, unknown>>;
  /** Quantos leads o corpo trazia (RD Station manda lista). */
  readonly itens?: number;
}

export interface ItemDoRecebimento {
  readonly indice: number;
  readonly rotulo: string | null;
  readonly status: 'PROCESSADO' | 'IGNORADO' | 'ERRO';
  readonly mensagem: string;
  readonly contatoId: string | null;
  readonly negocioId: string | null;
  readonly avisos: readonly string[];
  /** Código do evento da plataforma (plataformas de curso), como `PURCHASE_APPROVED`. */
  readonly evento?: string | null;
  readonly chave?: string | null;
}

export interface Recebimento {
  readonly id: string;
  readonly webhookId: string;
  readonly aplicativo?: AplicativoIntegracao;
  readonly aplicativoNome?: string;
  readonly integracao?: { readonly id: string; readonly nome: string };
  readonly recebidoEm: string;
  readonly ip: string | null;
  readonly tipoConteudo: string | null;
  readonly status: StatusRecebimento;
  readonly mensagem: string | null;
  readonly avisos?: readonly string[];
  readonly itens?: readonly ItemDoRecebimento[];
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
  | 'ligacao.encerrada'
  | 'sdr.lead_qualificado'
  | 'sdr.lead_desqualificado'
  | 'webhook.teste';

export type StatusEntrega = 'PENDENTE' | 'ENTREGUE' | 'FALHOU';

export interface EventoDisponivel {
  readonly evento: EventoDeWebhook;
  readonly descricao: string;
}

export type FormatoDeSaida = 'ENVELOPE_CRM' | 'CLINT';
export type MetodoDeSaida = 'POST' | 'GET';
export type TipoDeGatilho =
  'NEGOCIO_CRIADO' | 'ENTRA_NA_ETAPA' | 'MUDA_DE_ETAPA' | 'MUDA_DE_STATUS';

export interface GatilhoDeSaida {
  readonly tipo: TipoDeGatilho;
  readonly funilId?: string | null;
  readonly etapaId?: string | null;
  readonly status?: StatusInicial | null;
}

export interface CampoDeSaida {
  /** Caminho de origem no CRM: `contato.email`, `negocio.valor`… */
  readonly origem: string;
  /** Nome do campo no envio (editável pelo Admin). */
  readonly identificador: string;
}

export interface FormatoClint {
  readonly gatilhos: readonly {
    readonly tipo: TipoDeGatilho;
    readonly descricao: string;
    readonly exigeEtapa: boolean;
    readonly aceitaStatus: boolean;
  }[];
  readonly campos: readonly {
    readonly origem: string;
    readonly rotulo: string;
    readonly grupo: string;
    readonly identificadorPadrao: string;
  }[];
  readonly metodos: readonly MetodoDeSaida[];
}

export interface WebhookSaida {
  readonly id: string;
  readonly nome: string;
  readonly url: string;
  readonly eventos: readonly EventoDeWebhook[];
  readonly formato?: FormatoDeSaida;
  readonly metodo?: MetodoDeSaida;
  readonly gatilhos?: readonly GatilhoDeSaida[];
  readonly campos?: readonly CampoDeSaida[];
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
  readonly formato?: FormatoDeSaida;
  readonly metodo?: MetodoDeSaida;
  readonly gatilhos?: readonly GatilhoDeSaida[];
  readonly campos?: readonly CampoDeSaida[];
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
  DO_APLICATIVO: 'Modelo do aplicativo',
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
  'ligacao.encerrada': 'Ligação encerrada',
  'sdr.lead_qualificado': 'Lead qualificado pela IA',
  'sdr.lead_desqualificado': 'Lead desqualificado pela IA',
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
  'ligacao.encerrada':
    'Ligação do WhatsApp que terminou (atendida, perdida, recusada, sem resposta ou com falha), com duração, espera, contato e atendente. Nunca leva áudio nem transcrição.',
  'sdr.lead_qualificado':
    'O SDR com IA qualificou o lead e passou o negócio para o Comercial: contato, negócio, vendedor, canal, nota, temperatura, critérios e resumo.',
  'sdr.lead_desqualificado':
    'O SDR com IA desqualificou o lead: contato, canal, nota, temperatura, critérios, motivo e resumo. Nenhum vendedor é escolhido.',
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
  etapa: 'Etapa do negócio',
  dono: 'Dono do negócio',
  status: 'Status do negócio',
  motivoPerda: 'Motivo da perda',
};

/** "camposPersonalizados.faturamento" → "Campo personalizado “faturamento”". */
export function rotuloDoDestino(destino: string): string {
  const conhecido = ROTULO_DESTINO[destino];
  if (conhecido) {
    return conhecido;
  }
  const prefixoNegocio = 'negocio.camposPersonalizados.';
  if (destino.startsWith(prefixoNegocio)) {
    return `Campo personalizado do negócio “${destino.slice(prefixoNegocio.length)}”`;
  }
  const prefixo = 'camposPersonalizados.';
  if (destino.startsWith(prefixo)) {
    return `Campo personalizado “${destino.slice(prefixo.length)}”`;
  }
  return destino;
}

/** Prefixo dos destinos que viram campo personalizado do contato. */
export const PREFIXO_CAMPO_PERSONALIZADO = 'camposPersonalizados.';
/** Prefixo dos destinos que viram campo personalizado do negócio. */
export const PREFIXO_CAMPO_DO_NEGOCIO = 'negocio.camposPersonalizados.';

/**
 * O fim do endereço mascarado de um webhook de entrada, que é o que diferencia um do outro:
 * "http://…/api/v1/webhooks/entrada/yxBjWicA…" → "…/entrada/yxBjWicA…". O endereço inteiro
 * (mascarado) fica no `title`.
 */
export function fimDoEndereco(endereco: string): string {
  const partes = endereco.split('/').filter(Boolean);
  return partes.length > 2 ? `…/${partes.slice(-2).join('/')}` : endereco;
}

// ---------------------------------------------------------------------------------------------
// Aplicativos, modos e situação (Onda H)
// ---------------------------------------------------------------------------------------------

/** Arquivo do logotipo de cada aplicativo (`public/assets/integracoes/`, origem em docs/LOGOTIPOS-INTEGRACOES.md). */
const ARQUIVO_LOGOTIPO: Readonly<Record<AplicativoIntegracao, string>> = {
  ACTIVE_CAMPAIGN: 'activecampaign.svg',
  EDUZZ: 'eduzz.svg',
  ELEMENTOR: 'elementor.svg',
  FACEBOOK_LEAD_ADS: 'facebook.svg',
  GREAT_PAGES: 'greatpages.svg',
  HOTMART: 'hotmart.svg',
  KIWIFY: 'kiwify.svg',
  LEAD_LOVERS: 'leadlovers.png',
  MANYCHAT: 'manychat.png',
  RD_STATION: 'rdstation.svg',
  TYPEFORM: 'typeform.svg',
  WEBHOOK: 'webhook.svg',
};

export function logotipoDoAplicativo(aplicativo: AplicativoIntegracao): string {
  return `/assets/integracoes/${ARQUIVO_LOGOTIPO[aplicativo]}`;
}

export const ROTULO_ALVO: Readonly<Record<AlvoIntegracao, string>> = {
  NEGOCIO: 'Negócio',
  CONTATO: 'Contato',
};

export const ROTULO_MODO: Readonly<Record<ModoIntegracao, string>> = {
  CRIAR: 'Criar',
  ATUALIZAR: 'Atualizar',
  CRIAR_OU_ATUALIZAR: 'Criar ou atualizar',
};

export const DICA_MODO: Readonly<Record<ModoIntegracao, string>> = {
  CRIAR: 'Todo recebimento cria um negócio novo, mesmo que o contato já tenha um aberto.',
  CRIAR_OU_ATUALIZAR:
    'Se o contato já tem um negócio aberto neste funil, atualiza o mais recente (e registra a reconversão); senão, cria um.',
  ATUALIZAR:
    'Só atualiza o negócio aberto do contato. Sem negócio aberto, o recebimento fica como ignorado.',
};

export const ROTULO_STATUS_INICIAL: Readonly<Record<StatusInicial, string>> = {
  ABERTO: 'Aberto',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export const ROTULO_SITUACAO: Readonly<Record<SituacaoIntegracao, string>> = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
  PRECISA_ATENCAO: 'Precisa de atenção',
};

export const SELO_SITUACAO: Readonly<Record<SituacaoIntegracao, VarianteSelo>> = {
  ATIVA: 'menta',
  INATIVA: 'neutro',
  PRECISA_ATENCAO: 'coral',
};

/** "Criar negócio", "Atualizar contato", "Criar ou atualizar negócio". */
export function rotuloDaAcao(alvo: AlvoIntegracao, modo: ModoIntegracao): string {
  return `${ROTULO_MODO[modo]} ${ROTULO_ALVO[alvo].toLocaleLowerCase('pt-BR')}`;
}

export const ROTULO_GATILHO: Readonly<Record<TipoDeGatilho, string>> = {
  NEGOCIO_CRIADO: 'Negócio criado',
  ENTRA_NA_ETAPA: 'Negócio entra na etapa…',
  MUDA_DE_ETAPA: 'Negócio muda de etapa',
  MUDA_DE_STATUS: 'Negócio muda de status',
};

/** Resumo de um destino de saída para listas: eventos (envelope do CRM) ou gatilhos (Clint). */
export function resumoDoEnvio(
  w: Pick<WebhookSaida, 'formato' | 'metodo' | 'gatilhos' | 'eventos'>,
): string {
  if (w.formato === 'CLINT') {
    const total = w.gatilhos?.length ?? 0;
    return `Formato Clint · ${w.metodo ?? 'POST'} · ${total === 1 ? '1 gatilho' : `${total} gatilhos`}`;
  }
  if (w.eventos.length >= TOTAL_EVENTOS_ASSINAVEIS) {
    return 'Todos os eventos';
  }
  const rotulos = w.eventos.map((evento) => rotuloDoEvento(evento));
  return rotulos.length <= 2
    ? rotulos.join(' e ')
    : `${rotulos.slice(0, 2).join(', ')} e mais ${rotulos.length - 2}`;
}
