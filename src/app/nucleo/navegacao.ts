import {
  LucideCalendarCheck,
  LucideChartPie,
  LucideContact,
  LucideHandshake,
  LucideHeartHandshake,
  LucideLayoutDashboard,
  LucideMegaphone,
  LucideMessageCircle,
  LucideMessagesSquare,
  LucidePalette,
  LucideSend,
  LucideSettings,
  LucideShieldCheck,
  LucideWallet,
  LucideWebhook,
  LucideWorkflow,
  type LucideIcon,
} from '@lucide/angular';

import { LIDERES, PAPEIS, type Papel } from './papeis';

/**
 * Módulos do CRM (contrato §6.3) — fonte única para o menu, as rotas (app.routes.ts) e a
 * página "em breve". Para incluir um módulo, acrescente-o aqui; a rota sai sozinha.
 */

export type IdGrupo = 'funis' | 'relacionamento' | 'gestao' | 'sistema';

export interface GrupoNavegacao {
  readonly id: IdGrupo;
  readonly rotulo: string;
}

export type StatusModulo = 'pronto' | 'em-breve';

export interface Modulo {
  /** Identificador estável (também vai no `data.modulo` da rota). */
  readonly id: string;
  readonly rotulo: string;
  /** Caminho absoluto, ex.: `/funis/marketing`. */
  readonly rota: string;
  /** Componente de ícone do Lucide; renderize com `<svg [lucideIcon]="modulo.icone">`. */
  readonly icone: LucideIcon;
  /** `null` = no topo da navegação, fora de grupo. */
  readonly grupo: IdGrupo | null;
  /** Papéis que enxergam e acessam o módulo. */
  readonly papeis: readonly Papel[];
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

export const MODULOS: readonly Modulo[] = [
  {
    id: 'inicio',
    rotulo: 'Visão geral',
    rota: '/inicio',
    icone: LucideLayoutDashboard,
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
    icone: LucideMessagesSquare,
    grupo: null,
    papeis: TODOS.filter((papel) => papel !== 'MARKETING'),
    status: 'em-breve',
    fase: 'Fase 2',
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
    icone: LucideMegaphone,
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_MARKETING', 'MARKETING'],
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideHandshake,
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_COMERCIAL', 'COMERCIAL'],
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideHeartHandshake,
    grupo: 'funis',
    papeis: [...DIRECAO, 'LIDER_CS', 'CS'],
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideContact,
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideCalendarCheck,
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideMessageCircle,
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'em-breve',
    fase: 'Fase 2',
    descricao: 'Converse com o time em tempo real, dentro do CRM.',
    funcionalidades: ['Canais por área', 'Mensagens diretas', 'Menções a contatos e negócios'],
  },
  {
    id: 'disparos',
    rotulo: 'Disparos',
    rota: '/disparos',
    icone: LucideSend,
    grupo: 'relacionamento',
    papeis: TODOS,
    status: 'em-breve',
    fase: 'Fase 2',
    descricao: 'Envie campanhas de WhatsApp para listas de contatos, sem ferramenta externa.',
    nota: 'Módulo novo, construído do zero no CRM; o sistema de disparos atual da BRL serve só de base.',
    funcionalidades: [
      'Listas e segmentos a partir dos contatos do CRM',
      'Modelos de mensagem com variáveis',
      'Agendamento e intervalo entre envios',
      'Vários números conectados',
      'Relatório de entrega, leitura e resposta',
      'Respostas caem no Atendimento',
    ],
  },
  {
    id: 'bi',
    rotulo: 'BI e relatórios',
    rota: '/bi',
    icone: LucideChartPie,
    grupo: 'gestao',
    papeis: [...DIRECAO, ...LIDERES],
    status: 'em-breve',
    fase: 'Fase 3',
    descricao: 'Métricas de Marketing, Comercial, CS e Atendimento num só painel.',
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
    icone: LucideWorkflow,
    grupo: 'gestao',
    papeis: [...DIRECAO, ...LIDERES],
    status: 'em-breve',
    fase: 'Fase 2',
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
    icone: LucideWallet,
    grupo: 'gestao',
    papeis: DIRECAO,
    status: 'em-breve',
    fase: 'Fase 4',
    descricao: 'Receitas, contratos e recorrência ligados aos clientes.',
    funcionalidades: [
      'Contratos e cobranças',
      'Receita recorrente (MRR)',
      'Inadimplência',
      'Visão por cliente',
    ],
  },
  {
    id: 'integracoes',
    rotulo: 'Integrações',
    rota: '/integracoes',
    icone: LucideWebhook,
    grupo: 'sistema',
    papeis: ['ADMIN'],
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucideSettings,
    grupo: 'sistema',
    papeis: ['ADMIN'],
    status: 'em-breve',
    fase: 'Fase 1',
    descricao: 'Usuários, papéis e equipes.',
    funcionalidades: [
      'Convites e acessos',
      'Papéis e lideranças',
      'Desligamento com encaminhamento de atividades',
      'Preferências',
    ],
  },
  {
    id: 'administracao',
    rotulo: 'Administração',
    rota: '/administracao',
    icone: LucideShieldCheck,
    grupo: 'sistema',
    papeis: ['ADMIN'],
    status: 'em-breve',
    fase: 'Fase 1',
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
    icone: LucidePalette,
    grupo: 'sistema',
    papeis: TODOS,
    status: 'pronto',
    fase: null,
    descricao: 'Cores, tipografia e componentes do BRL CRM, nos dois temas.',
    funcionalidades: [],
  },
];

export function moduloPorId(id: string | null | undefined): Modulo | undefined {
  return id ? MODULOS.find((modulo) => modulo.id === id) : undefined;
}

/** Módulo dono de uma URL (`/funis/cs?x=1#y` → Customer Success). */
export function moduloPorRota(url: string | null | undefined): Modulo | undefined {
  if (!url) {
    return undefined;
  }
  const caminho = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return MODULOS.filter(
    (modulo) => caminho === modulo.rota || caminho.startsWith(`${modulo.rota}/`),
  ).sort((a, b) => b.rota.length - a.rota.length)[0];
}

export function grupoPorId(id: IdGrupo | null): GrupoNavegacao | null {
  return GRUPOS.find((grupo) => grupo.id === id) ?? null;
}

export interface SecaoNavegacao {
  /** `null` para os módulos do topo, fora de grupo. */
  readonly grupo: GrupoNavegacao | null;
  readonly modulos: readonly Modulo[];
}

/**
 * Agrupa módulos para o menu, mantendo a ordem de `MODULOS`: primeiro os sem grupo, depois
 * cada grupo de `GRUPOS`. Grupos vazios (ex.: sem acesso) não aparecem.
 */
export function agruparModulos(modulos: readonly Modulo[] = MODULOS): readonly SecaoNavegacao[] {
  const secoes: SecaoNavegacao[] = [];
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
