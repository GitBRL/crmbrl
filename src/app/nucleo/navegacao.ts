import {
  LucideCalendarCheck,
  LucideChartPie,
  LucideContact,
  LucideHandshake,
  LucideHeartHandshake,
  LucideLayoutDashboard,
  LucideMegaphone,
  LucideMessageCircle,
  LucideMessageSquareText,
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

import {
  acharPorId,
  acharPorRota,
  agruparModulos as agrupar,
  MODULOS_BASE,
  type ModuloBase,
  type SecaoNavegacao,
} from './modulos';

export {
  GRUPOS,
  grupoPorId,
  type GrupoNavegacao,
  type IdGrupo,
  type ModuloBase,
  type SecaoNavegacao,
  type StatusModulo,
} from './modulos';

/**
 * Módulos do CRM com o ícone de cada um, para quem desenha: menu lateral, busca, página
 * "em breve", catálogo. Os dados ficam em `nucleo/modulos.ts` (sem ícones), que é o que a
 * guarda, a sessão e as rotas usam — assim o pacote de ícones não entra no carregamento
 * inicial.
 */

export interface Modulo extends ModuloBase {
  /** Componente de ícone do Lucide; renderize com `<svg [lucideIcon]="modulo.icone">`. */
  readonly icone: LucideIcon;
}

const ICONES: Readonly<Record<string, LucideIcon>> = {
  inicio: LucideLayoutDashboard,
  atendimento: LucideMessagesSquare,
  'funil-marketing': LucideMegaphone,
  'funil-comercial': LucideHandshake,
  'funil-cs': LucideHeartHandshake,
  contatos: LucideContact,
  atividades: LucideCalendarCheck,
  chat: LucideMessageCircle,
  disparos: LucideSend,
  chatbot: LucideMessageSquareText,
  bi: LucideChartPie,
  automacoes: LucideWorkflow,
  financeiro: LucideWallet,
  integracoes: LucideWebhook,
  configuracoes: LucideSettings,
  administracao: LucideShieldCheck,
  'design-system': LucidePalette,
};

/** Ícone de um módulo pelo id (o painel, quando o id não existe). */
export function iconeDoModulo(id: string): LucideIcon {
  return ICONES[id] ?? LucideLayoutDashboard;
}

export const MODULOS: readonly Modulo[] = MODULOS_BASE.map((modulo) => ({
  ...modulo,
  icone: iconeDoModulo(modulo.id),
}));

export function moduloPorId(id: string | null | undefined): Modulo | undefined {
  return acharPorId(MODULOS, id);
}

/** Módulo dono de uma URL (`/funis/cs?x=1#y` → Customer Success). */
export function moduloPorRota(url: string | null | undefined): Modulo | undefined {
  return acharPorRota(MODULOS, url);
}

/** Agrupa para o menu, mantendo a ordem (sem argumento: todos os módulos). */
export function agruparModulos(): readonly SecaoNavegacao<Modulo>[];
export function agruparModulos<T extends ModuloBase>(
  modulos: readonly T[],
): readonly SecaoNavegacao<T>[];
export function agruparModulos(
  modulos: readonly ModuloBase[] = MODULOS,
): readonly SecaoNavegacao<ModuloBase>[] {
  return agrupar(modulos);
}
