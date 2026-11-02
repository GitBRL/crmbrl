import { LIDERES, PAPEIS, type Papel } from './papeis';
import type { Permissoes } from './sessao/perfil';

/**
 * Módulos do CRM (contrato §6.3) **sem os ícones** — fonte única para a guarda de acesso das
 * rotas (`nucleo/sessao/guardas.ts`), o `SessaoService` e as rotas "em breve". Fica fora do
 * carregamento inicial o pacote de ícones: quem desenha (menu, página "em breve") usa
 * `nucleo/navegacao.ts`, que acrescenta o ícone de cada módulo.
 */

export type IdGrupo = 'funis' | 'relacionamento' | 'gestao' | 'sistema';

export interface GrupoNavegacao {
  readonly id: IdGrupo;
  readonly rotulo: string;
}

export type StatusModulo = 'pronto' | 'em-breve';

export interface ModuloBase {
  /** Identificador estável (também vai no `data.modulo` da rota). */
  readonly id: string;
  readonly rotulo: string;
  /** Caminho absoluto, ex.: `/funis/marketing`. */
  readonly rota: string;
  /** `null` = no topo da navegação, fora de grupo. */
  readonly grupo: IdGrupo | null;
  /** Papéis que enxergam e acessam o módulo. */
  readonly papeis: readonly Papel[];
  /**
   * Conferência extra com as permissões reais do `auth/eu` (além do papel). Ex.: o funil de
   * Marketing exige `areasVisiveis` com MARKETING.
   */
  readonly acesso?: (permissoes: Permissoes) => boolean;
  /**
   * Outros caminhos que pertencem ao módulo (o detalhe da empresa, `/empresas/:id`, é de
   * Contatos e empresas): o menu marca o módulo e a guarda confere o acesso a ele.
   */
  readonly rotasRelacionadas?: readonly string[];
  readonly status: StatusModulo;
  /** Fase do roadmap ("Fase 1"…); `null` nos módulos prontos. */
  readonly fase: string | null;
  /** Uma frase dizendo para que o módulo serve. */
  readonly descricao: string;
  /** Funcionalidades planejadas (módulos "em breve"). */
  readonly funcionalidades: readonly string[];
  /** Observação curta exibida junto da descrição, quando houver. */
  readonly nota?: string;
  /** `true` quando a tela existe mas mostra dados de exemplo. */
  readonly exemplo?: boolean;
}

export const GRUPOS: readonly GrupoNavegacao[] = [
  { id: 'funis', rotulo: 'Funis' },
  { id: 'relacionamento', rotulo: 'Relacionamento' },
  { id: 'gestao', rotulo: 'Gestão' },
  { id: 'sistema', rotulo: 'Sistema' },
];

const TODOS: readonly Papel[] = PAPEIS;
const DIRECAO: readonly Papel[] = ['ADMIN', 'C_LEVEL'];

export const MODULOS_BASE: readonly ModuloBase[] = [
  {
    id: 'inicio',
    rotulo: 'Visão geral',
    rota: '/inicio',
    grupo: null,
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    exemplo: true,
    descricao: 'Da captação do lead ao sucesso do cliente, em um só lugar.',
    funcionalidades: [],
  },
  {
    id: 'atendimento',
    rotulo: 'Atendimento',
    rota: '/atendimento',
    grupo: null,
    // R12: a área de Marketing (inclusive o líder) não usa o Atendimento — a API recusa.
    papeis: TODOS.filter((papel) => papel !== 'MARKETING' && papel !== 'LIDER_MARKETING'),
    status: 'pronto',
    fase: null,
    descricao: 'Converse com clientes de todos os canais sem sair do CRM.',
    funcionalidades: [
      'WhatsApp integrado por conexão própria (sem serviços de terceiros)',
      'Instagram, e-mail e chat do site',
      'Chatbot com fluxos configuráveis',
      'Distribuição e transferência de conversas',
      'Respostas rápidas',
      'Métricas de atendimento (tempo de resposta, SLA, satisfação)',
    ],
  },
  {
    id: 'funil-marketing',
    rotulo: 'Marketing',
    rota: '/funis/marketing',
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_MARKETING', 'MARKETING'],
    acesso: (permissoes) => permissoes.areasVisiveis.includes('MARKETING'),
    status: 'pronto',
    fase: null,
    descricao: 'Capte e qualifique leads antes de passá-los ao Comercial.',
    funcionalidades: [
      'Leads por webhook, formulários e WhatsApp',
      'Funil kanban com etapas configuráveis',
      'Origem e campanhas (UTM)',
      'Qualificação (MQL)',
      'Passagem automática para o Comercial',
    ],
  },
  {
    id: 'funil-comercial',
    rotulo: 'Comercial',
    rota: '/funis/comercial',
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_COMERCIAL', 'COMERCIAL'],
    acesso: (permissoes) => permissoes.areasVisiveis.includes('COMERCIAL'),
    status: 'pronto',
    fase: null,
    descricao: 'Acompanhe cada oportunidade até o fechamento.',
    funcionalidades: [
      'Funil kanban de negócios',
      'Distribuição automática de leads',
      'Tarefas e follow-ups',
      'Propostas e valores',
      'Negócio ganho vai automaticamente para o CS',
    ],
  },
  {
    id: 'funil-cs',
    rotulo: 'Customer Success',
    rota: '/funis/cs',
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_CS', 'CS'],
    acesso: (permissoes) => permissoes.areasVisiveis.includes('CS'),
    status: 'pronto',
    fase: null,
    descricao: 'Garanta que cada cliente tenha sucesso depois da venda.',
    funcionalidades: [
      'Pipeline de onboarding',
      'Health score',
      'Acompanhamento de renovação e churn',
      'Pesquisas de satisfação (NPS/CSAT)',
    ],
  },
  {
    id: 'contatos',
    rotulo: 'Contatos e empresas',
    rota: '/contatos',
    grupo: 'relacionamento',
    papeis: TODOS,
    acesso: (permissoes) => permissoes.verContatos,
    rotasRelacionadas: ['/empresas'],
    status: 'pronto',
    fase: null,
    descricao: 'Todas as pessoas e empresas, com o histórico completo.',
    funcionalidades: [
      'Cadastro de pessoas e empresas',
      'Linha do tempo de interações',
      'Campos personalizados e etiquetas',
      'Importação e deduplicação',
    ],
  },
  {
    id: 'atividades',
    rotulo: 'Atividades',
    rota: '/atividades',
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao: 'Tarefas, ligações e reuniões de toda a equipe.',
    funcionalidades: [
      'Agenda e lista de tarefas',
      'Lembretes',
      'Encaminhamento automático ao líder quando alguém é desligado',
      'Histórico auditável',
    ],
  },
  {
    id: 'chat',
    rotulo: 'Chat da equipe',
    rota: '/chat',
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao: 'Converse com o time em tempo real, dentro do CRM.',
    funcionalidades: ['Canais por área', 'Mensagens diretas', 'Menções a contatos e negócios'],
  },
  {
    id: 'disparos',
    rotulo: 'Disparos',
    rota: '/disparos',
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao:
      'Envie campanhas de WhatsApp e e-mail para segmentos de contatos, sem ferramenta externa.',
    funcionalidades: [
      'Segmentos a partir dos contatos do CRM',
      'Modelos de mensagem com variáveis e variações',
      'Janela de envio e intervalo entre envios',
      'Vários números conectados',
      'Relatório de entrega, leitura e resposta',
      'Respostas caem no Atendimento',
    ],
  },
  {
    id: 'chatbot',
    rotulo: 'Chatbot',
    rota: '/chatbot',
    grupo: 'relacionamento',
    // Fluxos de atendimento automático: a configuração é de quem lidera (como as automações).
    papeis: [...DIRECAO, ...LIDERES],
    status: 'pronto',
    fase: null,
    descricao:
      'Fluxos que recebem o cliente, fazem as primeiras perguntas e passam para uma pessoa.',
    funcionalidades: [
      'Fluxos em passos, com perguntas e respostas',
      'Gatilhos por palavra, horário ou nova conversa',
      'Transferência para o atendimento com resumo',
      'Simulador para testar antes de publicar',
    ],
  },
  {
    id: 'bi',
    rotulo: 'BI e relatórios',
    rota: '/bi',
    grupo: 'gestao',
    // Todos os papéis: cada um vê as abas da própria área (a API recorta, R20).
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao: 'Métricas de Marketing, Comercial, CS, Atendimento e Financeiro num só painel.',
    funcionalidades: [
      'Painéis por área',
      'Filtros por período, equipe e pessoa',
      'Exportação',
      'Análise por IA com sugestões de ação (Admin)',
    ],
  },
  {
    id: 'automacoes',
    rotulo: 'Automações',
    rota: '/automacoes',
    grupo: 'gestao',
    papeis: [...DIRECAO, ...LIDERES],
    status: 'pronto',
    fase: null,
    descricao: 'Regras que trabalham por você.',
    funcionalidades: [
      'Gatilhos (lead criado, etapa alterada, mensagem recebida, negócio ganho)',
      'Ações (mensagem no WhatsApp, tarefa, mover etapa, webhook)',
      'Cadências com intervalos',
      'Histórico de execuções',
    ],
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    rota: '/financeiro',
    grupo: 'gestao',
    // CS e líder de CS cuidam da carteira; Comercial só consulta os contratos que ganhou.
    papeis: [...DIRECAO, 'LIDER_CS', 'CS', 'LIDER_COMERCIAL', 'COMERCIAL'],
    status: 'pronto',
    fase: null,
    descricao: 'Contratos, parcelas a receber e a régua de cobrança ligados aos clientes.',
    funcionalidades: [
      'Contratos com parcelas e renovação',
      'Parcelas a receber, baixa e importação de planilha',
      'Régua de cobrança por WhatsApp, e-mail e ligação',
      'Receita recorrente (MRR) e inadimplência',
    ],
  },
  {
    id: 'integracoes',
    rotulo: 'Integrações',
    rota: '/integracoes',
    grupo: 'sistema',
    papeis: ['ADMIN'],
    acesso: (permissoes) => permissoes.gerenciarWebhooks,
    status: 'pronto',
    fase: null,
    descricao: 'Conecte o CRM a outros sistemas.',
    funcionalidades: [
      'Webhooks de entrada (captação de leads) e de saída (eventos)',
      'WhatsApp (gateway próprio)',
      'TicketHub e outros sistemas de chamados',
      'Registro de cada chamada',
    ],
  },
  {
    id: 'configuracoes',
    rotulo: 'Configurações',
    rota: '/configuracoes',
    grupo: 'sistema',
    // Todos têm ao menos "Meu perfil"; cada seção confere a sua permissão.
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao:
      'Usuários, equipes, distribuição de leads, passagens, canais, atendimento, disparos, assistente e o seu perfil.',
    funcionalidades: [
      'Convites e acessos',
      'Papéis e lideranças',
      'Desligamento com encaminhamento de atividades',
      'Distribuição de leads (rodízio)',
      'Passagens entre funis',
      'Canais de atendimento (WhatsApp, Instagram, Messenger, e-mail e chat do site)',
      'Filas, horários e respostas rápidas',
      'Limites dos disparos',
      'Assistente de ajuda',
      'Meu perfil, troca de senha e notificações no celular',
    ],
  },
  {
    id: 'administracao',
    rotulo: 'Administração',
    rota: '/administracao',
    grupo: 'sistema',
    // Auditoria: Admin e C-level; logs técnicos: só Admin (cada aba confere a sua).
    papeis: DIRECAO,
    acesso: (permissoes) => permissoes.verAuditoria || permissoes.verLogsTecnicos,
    status: 'pronto',
    fase: null,
    descricao: 'Auditoria e saúde do sistema.',
    funcionalidades: [
      'Registro de todas as atividades de todos os usuários',
      'Logs técnicos e monitoramento',
      'Dúvidas feitas à IA (para evoluir o sistema)',
      'Chamados abertos automaticamente',
    ],
  },
  {
    id: 'design-system',
    rotulo: 'Design system',
    rota: '/design-system',
    grupo: 'sistema',
    // Catálogo técnico (cores, componentes): só no menu do Admin; para os outros papéis é um
    // item sem uso no dia a dia.
    papeis: ['ADMIN'],
    status: 'pronto',
    fase: null,
    descricao: 'Cores, tipografia e componentes do BRL CRM, nos dois temas.',
    funcionalidades: [],
  },
];

/** Módulo pelo id ("funil-cs"). */
export function moduloBasePorId(id: string | null | undefined): ModuloBase | undefined {
  return acharPorId(MODULOS_BASE, id);
}

/** Módulo dono de uma URL (`/funis/cs?x=1#y` → Customer Success). */
export function moduloBasePorRota(url: string | null | undefined): ModuloBase | undefined {
  return acharPorRota(MODULOS_BASE, url);
}

export function acharPorId<T extends ModuloBase>(
  modulos: readonly T[],
  id: string | null | undefined,
): T | undefined {
  return id ? modulos.find((modulo) => modulo.id === id) : undefined;
}

/** O módulo da lista cuja rota (ou rota relacionada) mais específica contém a URL. */
export function acharPorRota<T extends ModuloBase>(
  modulos: readonly T[],
  url: string | null | undefined,
): T | undefined {
  if (!url) {
    return undefined;
  }
  const caminho = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const cabe = (rota: string) => caminho === rota || caminho.startsWith(`${rota}/`);
  let melhor: T | undefined;
  let tamanho = -1;
  for (const modulo of modulos) {
    for (const rota of [modulo.rota, ...(modulo.rotasRelacionadas ?? [])]) {
      if (cabe(rota) && rota.length > tamanho) {
        melhor = modulo;
        tamanho = rota.length;
      }
    }
  }
  return melhor;
}

export function grupoPorId(id: IdGrupo | null): GrupoNavegacao | null {
  return GRUPOS.find((grupo) => grupo.id === id) ?? null;
}

export interface SecaoNavegacao<T extends ModuloBase = ModuloBase> {
  /** `null` para os módulos do topo, fora de grupo. */
  readonly grupo: GrupoNavegacao | null;
  readonly modulos: readonly T[];
}

/**
 * Agrupa módulos para o menu, mantendo a ordem da lista: primeiro os sem grupo, depois cada
 * grupo de `GRUPOS`. Grupos vazios (ex.: sem acesso) não aparecem.
 */
export function agruparModulos<T extends ModuloBase>(
  modulos: readonly T[],
): readonly SecaoNavegacao<T>[] {
  const secoes: SecaoNavegacao<T>[] = [];
  const soltos = modulos.filter((modulo) => modulo.grupo === null);
  if (soltos.length) {
    secoes.push({ grupo: null, modulos: soltos });
  }
  for (const grupo of GRUPOS) {
    const doGrupo = modulos.filter((modulo) => modulo.grupo === grupo.id);
    if (doGrupo.length) {
      secoes.push({ grupo, modulos: doGrupo });
    }
  }
  return secoes;
}
