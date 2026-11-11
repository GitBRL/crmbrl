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
  LucideSquareKanban,
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
import { ehDiretoria, PAPEIS } from './papeis';
import {
  areaDoSlug,
  CHAVES_BASE,
  compararNaJornada,
  nomeDoSetor,
  setorCarregado,
  setoresAtivosCarregados,
  slugDaArea,
} from './setores/setores';

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

/**
 * Item do menu para o funil de um setor (`/funis/<chave em minúsculas>`, id `funil-<…>`). Os de
 * base mantêm descrição e ícone próprios; todos levam o nome atual do setor. Admin e C-level
 * acessam todos (mesmo um setor criado depois de entrarem); os demais, os de `areasVisiveis`.
 */
export function moduloDoFunil(chave: string): Modulo {
  const slug = slugDaArea(chave);
  const id = `funil-${slug}`;
  const deBase = moduloPorId(id);
  const nome = nomeDoSetor(chave);
  return {
    ...(deBase ?? {
      status: 'pronto' as const,
      fase: null,
      descricao: setorCarregado(chave)?.descricao || `Os funis e negócios do setor ${nome}.`,
      funcionalidades: [],
      icone: LucideSquareKanban,
    }),
    id,
    rotulo: nome,
    rota: `/funis/${slug}`,
    grupo: 'funis',
    papeis: PAPEIS,
    acesso: (permissoes, usuario) =>
      ehDiretoria(usuario) || permissoes.areasVisiveis.includes(chave),
    quemAcessa: `Admin, C-level e o setor ${nome}`,
  };
}

/**
 * Módulos do menu com um item de funil por setor ativo, na ordem da jornada (lê signals:
 * reativo em `computed`). Antes de a lista de setores chegar, os de base. `areasDaPessoa`
 * (o `areasVisiveis` da sessão) garante o funil do próprio setor mesmo antes disso.
 */
export function modulosDaNavegacao(areasDaPessoa: readonly string[] = []): readonly Modulo[] {
  const ativos = setoresAtivosCarregados();
  const chaves = new Set(ativos.length ? ativos.map((setor) => setor.chave) : CHAVES_BASE);
  for (const area of areasDaPessoa) {
    // Setor desativado depois que a pessoa entrou: a lista carregada manda.
    if (setorCarregado(area)?.ativo !== false) {
      chaves.add(area);
    }
  }
  const funis = [...chaves].sort(compararNaJornada).map(moduloDoFunil);
  return [
    ...MODULOS.filter((modulo) => modulo.grupo === null),
    ...funis,
    ...MODULOS.filter((modulo) => modulo.grupo !== null && modulo.grupo !== 'funis'),
  ];
}

/**
 * Módulo dono de uma URL contando os funis de todos os setores (`/funis/pos_venda/123` → o
 * funil do setor Pós-venda, mesmo antes de a lista de setores chegar).
 */
export function moduloDaNavegacaoPorRota(
  url: string | null | undefined,
  areasDaPessoa: readonly string[] = [],
): Modulo | undefined {
  const modulo = acharPorRota(modulosDaNavegacao(areasDaPessoa), url);
  if (modulo) {
    return modulo;
  }
  const area = areaDoSlug(/^\/funis\/([^/?#]+)/.exec(url ?? '')?.[1]);
  return area ? moduloDoFunil(area) : undefined;
}
