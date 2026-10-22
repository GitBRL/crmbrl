import type { VarianteSelo } from '../../ui/selo/selo';

/**
 * Tipos da auditoria e dos logs técnicos (crmbrl-api, `/auditoria` e
 * `/administracao/logs-tecnicos`; R3) e os rótulos em português que a tela mostra
 * (TELAS-FASE1 §8).
 */

export type TipoAtor = 'USUARIO' | 'SISTEMA' | 'WEBHOOK' | 'AUTOMACAO' | 'IA';
export type NivelLog = 'DEBUG' | 'INFO' | 'AVISO' | 'ERRO';

export interface EventoAuditoria {
  /** Id sequencial, em texto. */
  readonly id: string;
  readonly criadoEm: string;
  readonly tipoAtor: TipoAtor;
  readonly usuarioId: string | null;
  /** Nome do ator no momento do evento (usuário, webhook, job…). */
  readonly atorDescricao: string | null;
  /** `entidade.verbo`, ex.: `negocio.movido`. */
  readonly acao: string;
  readonly entidade: string;
  readonly entidadeId: string | null;
  readonly resumo: string;
  readonly quantidadeAlteracoes: number;
  readonly requisicaoId: string | null;
}

export interface Alteracao {
  readonly campo: string;
  readonly antes: unknown;
  readonly depois: unknown;
}

export interface EventoAuditoriaDetalhe extends EventoAuditoria {
  readonly alteracoes: readonly Alteracao[];
  readonly dados: Readonly<Record<string, unknown>> | null;
  readonly relacionados: readonly { readonly entidade: string; readonly id: string }[];
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly usuario: {
    readonly id: string;
    readonly nome: string;
    readonly email: string;
    readonly papel: string;
    readonly ativo: boolean;
  } | null;
}

export interface FiltrosDaAuditoria {
  readonly acoes: readonly string[];
  readonly entidades: readonly string[];
  readonly tiposAtor: readonly TipoAtor[];
}

export interface LogTecnico {
  readonly id: string;
  readonly criadoEm: string;
  readonly nivel: NivelLog;
  /** Origem: `HTTP`, `Fila:<nome>`, `Eventos`, `Email`, `Webhooks`… */
  readonly contexto: string;
  readonly mensagem: string;
  readonly requisicaoId: string | null;
  readonly usuarioId: string | null;
  readonly metodo: string | null;
  readonly rota: string | null;
  readonly status: number | null;
  readonly duracaoMs: number | null;
}

export interface LogTecnicoDetalhe extends LogTecnico {
  /** Sem segredos; em falhas, `erro: { nome, mensagem, codigo?, pilha }`. */
  readonly dados: Readonly<Record<string, unknown>> | null;
}

export interface PessoaDoFiltro {
  readonly id: string;
  readonly nome: string;
  readonly rotuloPapel: string;
  readonly ativo: boolean;
}

// ---------------------------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------------------------

export const ROTULO_TIPO_ATOR: Readonly<Record<TipoAtor, string>> = {
  USUARIO: 'Pessoa',
  SISTEMA: 'Sistema',
  WEBHOOK: 'Webhook',
  AUTOMACAO: 'Automação',
  IA: 'IA',
};

export const ROTULO_NIVEL: Readonly<Record<NivelLog, string>> = {
  ERRO: 'Erro',
  AVISO: 'Aviso',
  INFO: 'Informação',
  DEBUG: 'Depuração',
};

export const SELO_NIVEL: Readonly<Record<NivelLog, VarianteSelo>> = {
  ERRO: 'coral',
  AVISO: 'lima',
  INFO: 'ciano',
  DEBUG: 'neutro',
};

export const ROTULO_ENTIDADE: Readonly<Record<string, string>> = {
  atividade: 'Atividade',
  contato: 'Contato',
  empresa: 'Empresa',
  etapa: 'Etapa',
  funil: 'Funil',
  negocio: 'Negócio',
  passagem: 'Passagem',
  regra_distribuicao: 'Distribuição de leads',
  usuario: 'Usuário',
  sessao: 'Sessão',
  notificacao: 'Notificação',
  webhook_entrada: 'Webhook de entrada',
  webhook_recebimento: 'Recebimento de webhook',
  webhook_saida: 'Webhook de saída',
  webhook_entrega: 'Entrega de webhook',
};

/**
 * Ações que a API registra (`entidade.verbo`), como frase curta. A lista acompanha a API
 * (`GET /auditoria/filtros` e os `acao:` dos serviços): `tipos.spec.ts` confere. Uma ação nova
 * sem rótulo ainda aparece, pelo nome gerado em `rotuloDaAcao`.
 */
export const ROTULO_ACAO: Readonly<Record<string, string>> = {
  'atividade.cancelada': 'Atividade cancelada',
  'atividade.concluida': 'Atividade concluída',
  'atividade.criada': 'Atividade criada',
  'atividade.encaminhada': 'Atividade encaminhada',
  'atividade.reaberta': 'Atividade reaberta',
  'atividade.atualizada': 'Atividade alterada',
  'contato.anonimizado': 'Contato anonimizado (LGPD)',
  'contato.atualizado': 'Contato alterado',
  'contato.criado': 'Contato criado',
  'contato.encaminhado': 'Contato encaminhado',
  'contato.reconvertido': 'Contato voltou (reconversão)',
  'empresa.criada': 'Empresa criada',
  'empresa.atualizada': 'Empresa alterada',
  'empresa.encaminhada': 'Empresa encaminhada',
  'etapa.atualizada': 'Etapa alterada',
  'etapa.criada': 'Etapa criada',
  'etapa.excluida': 'Etapa removida',
  'funil.criado': 'Funil criado',
  'funil.atualizado': 'Funil alterado',
  'funil.arquivado': 'Funil arquivado',
  'funil.reativado': 'Funil reativado',
  'funil.etapas_reordenadas': 'Etapas reordenadas',
  'funil.excluido': 'Funil excluído',
  'negocio.assumido': 'Negócio assumido',
  'negocio.atualizado': 'Negócio alterado',
  'negocio.criado': 'Negócio criado',
  'negocio.encaminhado': 'Negócio encaminhado',
  'negocio.excluido': 'Negócio excluído',
  'negocio.ganho': 'Negócio ganho',
  'negocio.movido': 'Negócio movido',
  'negocio.perdido': 'Negócio perdido',
  'negocio.reaberto': 'Negócio reaberto',
  'negocio.reconvertido': 'Negócio reconvertido',
  'negocio.reposicionado': 'Negócio reposicionado na etapa',
  'passagem.criada': 'Passagem criada',
  'passagem.atualizada': 'Passagem alterada',
  'passagem.executada': 'Passagem automática',
  'passagem.excluida': 'Passagem excluída',
  'passagem.responsavel_fixo_alterado': 'Passagem: responsável fixo trocado',
  'regra_distribuicao.criada': 'Rodízio configurado',
  'regra_distribuicao.atualizada': 'Rodízio alterado',
  'regra_distribuicao.participante_definido': 'Entrou no rodízio',
  'regra_distribuicao.participante_removido': 'Saiu do rodízio',
  'usuario.convite_enviado': 'Convite enviado',
  'usuario.criado': 'Usuário criado',
  'usuario.atualizado': 'Usuário alterado',
  'usuario.desligado': 'Usuário desligado',
  'usuario.reativado': 'Usuário reativado',
  'usuario.login': 'Entrou no CRM',
  'usuario.login_falhou': 'Tentativa de entrar falhou',
  'usuario.bloqueado_forca_bruta': 'Entrada bloqueada (muitas tentativas)',
  'usuario.lider_alterado': 'Líder alterado',
  'usuario.redefinicao_solicitada': 'Pediu para redefinir a senha',
  'usuario.troca_de_senha_falhou': 'Troca de senha falhou',
  'usuario.logout': 'Saiu do CRM',
  'usuario.senha_alterada': 'Senha trocada',
  'usuario.senha_redefinida': 'Senha redefinida',
  'usuario.senha_temporaria_definida': 'Senha temporária definida',
  'webhook_entrada.criado': 'Webhook de entrada criado',
  'webhook_entrada.atualizado': 'Webhook de entrada alterado',
  'webhook_entrada.excluido': 'Webhook de entrada excluído',
  'webhook_entrada.responsavel_fixo_alterado': 'Webhook de entrada: responsável fixo trocado',
  'webhook_entrada.segredo_definido': 'Webhook de entrada: assinatura exigida',
  'webhook_entrada.segredo_removido': 'Webhook de entrada: assinatura removida',
  'webhook_entrada.token_regenerado': 'Webhook de entrada: endereço novo',
  'webhook_recebimento.dados_apagados': 'Dados de recebimentos apagados (LGPD)',
  'webhook_recebimento.reprocessado': 'Recebimento reprocessado',
  'webhook_entrega.dados_apagados': 'Dados de entregas apagados (LGPD)',
  'webhook_entrega.reenviada': 'Entrega reenviada',
  'webhook_saida.criado': 'Webhook de saída criado',
  'webhook_saida.atualizado': 'Webhook de saída alterado',
  'webhook_saida.excluido': 'Webhook de saída excluído',
  'webhook_saida.desativado_automaticamente': 'Webhook de saída desativado após falhas',
  'webhook_saida.teste_enviado': 'Teste de webhook enviado',
  'webhook_saida.segredo_regenerado': 'Webhook de saída: segredo novo',
};

export function rotuloDaEntidade(entidade: string): string {
  return ROTULO_ENTIDADE[entidade] ?? maiuscula(entidade.replaceAll('_', ' '));
}

/** "webhook_saida.segredo_regenerado" → "Webhook de saída: segredo regenerado". */
export function rotuloDaAcao(acao: string): string {
  const conhecida = ROTULO_ACAO[acao];
  if (conhecida) {
    return conhecida;
  }
  const [entidade, ...resto] = acao.split('.');
  const verbo = resto.join('.').replaceAll('_', ' ');
  return verbo ? `${rotuloDaEntidade(entidade)}: ${verbo}` : rotuloDaEntidade(entidade);
}

/** Nomes de campo do diff em português: "responsavelId" → "Responsável". */
const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  cargo: 'Cargo',
  titulo: 'Título',
  valor: 'Valor',
  valorRecorrente: 'Valor recorrente',
  etapaId: 'Etapa',
  etapa: 'Etapa',
  funilId: 'Funil',
  responsavelId: 'Responsável',
  responsavel: 'Responsável',
  empresaId: 'Empresa',
  contatoId: 'Contato',
  liderId: 'Líder',
  papel: 'Papel',
  ativo: 'Ativo',
  status: 'Situação',
  motivoPerda: 'Motivo da perda',
  previsaoFechamento: 'Previsão de fechamento',
  prioridade: 'Prioridade',
  venceEm: 'Vence em',
  descricao: 'Descrição',
  etiquetas: 'Etiquetas',
  camposPersonalizados: 'Campos personalizados',
  optOutMarketing: 'Não quer receber marketing',
  prazoDias: 'Prazo (dias)',
  probabilidade: 'Probabilidade',
  url: 'URL',
  eventos: 'Eventos',
  cabecalhos: 'Cabeçalhos',
  estrategia: 'Distribuição',
  incluirLideres: 'Líderes no rodízio',
  // Dados registrados nos eventos (desligamento, passagens, webhooks…).
  area: 'Área',
  contagens: 'Em números',
  destinatario: 'Quem recebeu',
  motivoDestinatario: 'Por que essa pessoa',
  liderados: 'Liderados',
  lideresIgnorados: 'Líderes ignorados',
  atividades: 'Atividades',
  negocios: 'Negócios',
  contatos: 'Contatos',
  empresas: 'Empresas',
  rodizios: 'Rodízios de que saiu',
  sessoesRevogadas: 'Sessões encerradas',
  linksDeSenhaInvalidados: 'Links de senha cancelados',
};

export function rotuloDoCampo(campo: string): string {
  const conhecido = ROTULO_CAMPO[campo];
  if (conhecido) {
    return conhecido;
  }
  const palavras = campo
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('.', ' › ')
    .toLowerCase();
  return maiuscula(palavras);
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
