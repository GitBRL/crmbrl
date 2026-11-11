import type { FunilDoDestino } from '../integracoes/tipos';
import type {
  EventoAuditoria,
  EventoAuditoriaDetalhe,
  FiltrosDaAuditoria,
  LogTecnico,
  LogTecnicoDetalhe,
  PessoaDoFiltro,
} from './tipos';

/** Dados de exemplo das specs da Administração (formato do OpenAPI da API). */

export function eventoAuditoria(ajustes: Partial<EventoAuditoria> = {}): EventoAuditoria {
  return {
    id: '363',
    criadoEm: new Date(Date.now() - 5 * 60_000).toISOString(),
    tipoAtor: 'USUARIO',
    usuarioId: 'u-rafael',
    atorDescricao: 'Rafael Mendes',
    acao: 'negocio.movido',
    entidade: 'negocio',
    entidadeId: 'n1',
    resumo: 'Rafael Mendes moveu “Escola Horizonte” para Proposta',
    quantidadeAlteracoes: 2,
    requisicaoId: 'req-abc',
    ...ajustes,
  };
}

export function eventoDetalhe(
  ajustes: Partial<EventoAuditoriaDetalhe> = {},
): EventoAuditoriaDetalhe {
  return {
    ...eventoAuditoria(),
    alteracoes: [
      { campo: 'etapaId', antes: 'Qualificação', depois: 'Proposta' },
      { campo: 'valor', antes: null, depois: '1500.00' },
    ],
    dados: { alteracoes: {}, origem: 'kanban' },
    relacionados: [{ entidade: 'contato', id: 'c1' }],
    ip: '192.0.2.10',
    userAgent: 'Mozilla/5.0',
    usuario: {
      id: 'u-rafael',
      nome: 'Rafael Mendes',
      email: 'lider.comercial@demo.local',
      papel: 'LIDER',
      ativo: true,
    },
    ...ajustes,
  };
}

export const FILTROS: FiltrosDaAuditoria = {
  acoes: ['negocio.movido', 'usuario.login', 'webhook_saida.segredo_regenerado'],
  entidades: ['negocio', 'usuario', 'webhook_saida'],
  tiposAtor: ['USUARIO', 'SISTEMA', 'WEBHOOK', 'AUTOMACAO', 'IA'],
};

export const PESSOAS: readonly PessoaDoFiltro[] = [
  { id: 'u-rafael', nome: 'Rafael Mendes', rotuloPapel: 'Líder Comercial', ativo: true },
  { id: 'u-pedro', nome: 'Pedro Santos', rotuloPapel: 'Comercial', ativo: false },
];

export const ETAPA_PROPOSTA = '5b1d2c3e-4f50-4a61-9b72-8c93d4e5f601';
export const ETAPA_QUALIFICACAO = '5b1d2c3e-4f50-4a61-9b72-8c93d4e5f602';

export const FUNIS: readonly FunilDoDestino[] = [
  {
    id: '5b1d2c3e-4f50-4a61-9b72-8c93d4e5f600',
    nome: 'Comercial',
    area: 'COMERCIAL',
    ativo: true,
    etapas: [
      { id: ETAPA_QUALIFICACAO, nome: 'Qualificação', tipo: 'ABERTA', ordem: 1 },
      { id: ETAPA_PROPOSTA, nome: 'Proposta', tipo: 'ABERTA', ordem: 2 },
    ],
  },
];

export function logTecnico(ajustes: Partial<LogTecnico> = {}): LogTecnico {
  return {
    id: '12',
    criadoEm: new Date(Date.now() - 60 * 60_000).toISOString(),
    nivel: 'AVISO',
    contexto: 'Webhooks',
    mensagem: 'Webhook de entrada "Site" passou de 60 chamadas por minuto.',
    requisicaoId: 'req-xyz',
    usuarioId: null,
    metodo: null,
    rota: null,
    status: null,
    duracaoMs: null,
    ...ajustes,
  };
}

export function logDetalhe(ajustes: Partial<LogTecnicoDetalhe> = {}): LogTecnicoDetalhe {
  return { ...logTecnico(), dados: { webhookId: 'we1' }, ...ajustes };
}

export async function microtarefas(vezes = 8): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await Promise.resolve();
  }
}
