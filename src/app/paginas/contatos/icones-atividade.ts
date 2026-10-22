import type { LucideIconInput } from '@lucide/angular';
import {
  LucideBuilding,
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideCircleDashed,
  LucideContact,
  LucideHandshake,
  LucideListTodo,
  LucideMail,
  LucideMessageCircle,
  LucidePhone,
  LucideStickyNote,
  LucideUserMinus,
  LucideWorkflow,
} from '@lucide/angular';

import type { TipoAtividade } from './contatos.tipos';

/** Ícone de cada tipo de atividade (R6.1). */
export const ICONE_TIPO_ATIVIDADE: Readonly<Record<TipoAtividade, LucideIconInput>> = {
  TAREFA: LucideListTodo,
  LIGACAO: LucidePhone,
  REUNIAO: LucideCalendarDays,
  EMAIL: LucideMail,
  WHATSAPP: LucideMessageCircle,
  NOTA: LucideStickyNote,
};

/** Ícone de um evento da auditoria pela entidade da ação (`contato.reconvertido` → contato). */
export function iconeDoEvento(acao: string): LucideIconInput {
  if (acao === 'contato.anonimizado' || /\.encaminhad[oa]$/.test(acao)) {
    return LucideUserMinus;
  }
  const entidade = acao.split('.')[0];
  switch (entidade) {
    case 'contato':
      return LucideContact;
    case 'empresa':
      return LucideBuilding;
    case 'negocio':
      return LucideHandshake;
    case 'atividade':
      return LucideCalendarCheck;
    case 'passagem':
      return LucideWorkflow;
    default:
      return LucideCircleDashed;
  }
}
