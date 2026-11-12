import {
  LucideMail,
  LucideMessageCircle,
  LucidePhone,
  LucideSquareCheckBig,
  LucideStickyNote,
  LucideUsers,
  type LucideIcon,
} from '@lucide/angular';

import { formatarData, formatarHora, paraData } from '../../nucleo/formatos';
import type {
  Atividade,
  GrupoAtividade,
  PrioridadeAtividade,
  ResultadoReuniao,
  TipoAtividade,
} from './atividades.api';

/**
 * Como as atividades aparecem: rótulo e ícone de cada tipo, nomes dos grupos da agenda e o
 * "quando" curto da lista ("Hoje às 18:00", "Venceu ontem às 16:10"). Tudo no fuso do
 * navegador, como os grupos que a API calcula.
 */

export interface InfoTipo {
  readonly rotulo: string;
  readonly icone: LucideIcon;
}

export const TIPOS: Readonly<Record<TipoAtividade, InfoTipo>> = {
  TAREFA: { rotulo: 'Tarefa', icone: LucideSquareCheckBig },
  LIGACAO: { rotulo: 'Ligação', icone: LucidePhone },
  REUNIAO: { rotulo: 'Reunião', icone: LucideUsers },
  EMAIL: { rotulo: 'E-mail', icone: LucideMail },
  WHATSAPP: { rotulo: 'WhatsApp', icone: LucideMessageCircle },
  NOTA: { rotulo: 'Nota', icone: LucideStickyNote },
};

/** Os tipos da agenda (a nota nasce concluída e só aparece na linha do tempo, R6.2). */
export const TIPOS_DA_AGENDA: readonly TipoAtividade[] = [
  'TAREFA',
  'LIGACAO',
  'REUNIAO',
  'EMAIL',
  'WHATSAPP',
];

/** Os grupos da aba "Pendentes", na ordem da agenda. */
export const GRUPOS_PENDENTES: readonly GrupoAtividade[] = [
  'ATRASADAS',
  'HOJE',
  'PROXIMOS_7_DIAS',
  'MAIS_TARDE',
  'SEM_DATA',
];

export const ROTULO_GRUPO: Readonly<Record<GrupoAtividade, string>> = {
  ATRASADAS: 'Atrasadas',
  HOJE: 'Hoje',
  PROXIMOS_7_DIAS: 'Próximos 7 dias',
  MAIS_TARDE: 'Mais tarde',
  SEM_DATA: 'Sem data',
  CONCLUIDAS: 'Concluídas',
};

export const ROTULO_PRIORIDADE: Readonly<Record<PrioridadeAtividade, string>> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

/** R6.6 — rótulo e cor do selo do resultado da reunião. */
export const RESULTADOS: Readonly<
  Record<
    ResultadoReuniao,
    { readonly rotulo: string; readonly variante: 'menta' | 'coral' | 'ciano' }
  >
> = {
  COMPARECEU: { rotulo: 'Compareceu', variante: 'menta' },
  NAO_COMPARECEU: { rotulo: 'Não compareceu', variante: 'coral' },
  REMARCADA: { rotulo: 'Remarcada', variante: 'ciano' },
};

const DIA_MS = 86_400_000;
const LOCALE = 'pt-BR';

function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/** Diferença em dias de calendário (no fuso do navegador): amanhã = 1, ontem = −1. */
export function diasDeDiferenca(data: Date, agora: Date): number {
  return Math.round((inicioDoDia(data) - inicioDoDia(agora)) / DIA_MS);
}

/**
 * O dia em poucas letras, em minúsculas: "hoje", "amanhã", "ontem", o dia da semana nos
 * próximos seis dias ("segunda") e, fora disso, "26/10" (com o ano quando não é o atual).
 */
export function rotuloDoDia(data: Date, agora: Date): string {
  const dias = diasDeDiferenca(data, agora);
  if (dias === 0) {
    return 'hoje';
  }
  if (dias === 1) {
    return 'amanhã';
  }
  if (dias === -1) {
    return 'ontem';
  }
  if (dias > 1 && dias < 7) {
    return new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(data).replace('-feira', '');
  }
  const opcoes: Intl.DateTimeFormatOptions =
    data.getFullYear() === agora.getFullYear()
      ? { day: '2-digit', month: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat(LOCALE, opcoes).format(data);
}

export function comMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase(LOCALE) + texto.slice(1);
}

/**
 * O "quando" da lista: "Hoje às 18:00", "Venceu ontem às 16:10" (atrasada), "Amanhã,
 * 10:00–11:00" (reunião), "Sem data", "Concluída hoje às 15:20", "Cancelada ontem".
 */
export function quandoDaAtividade(atividade: Atividade, agora: Date = new Date()): string {
  if (atividade.status === 'CONCLUIDA') {
    const concluida = paraData(atividade.concluidaEm);
    return concluida
      ? `Concluída ${rotuloDoDia(concluida, agora)} às ${formatarHora(concluida)}`
      : 'Concluída';
  }
  if (atividade.status === 'CANCELADA') {
    const cancelada = paraData(atividade.canceladaEm);
    return cancelada ? `Cancelada ${rotuloDoDia(cancelada, agora)}` : 'Cancelada';
  }
  const inicio = paraData(atividade.inicioEm);
  const fim = paraData(atividade.fimEm);
  if (atividade.tipo === 'REUNIAO' && inicio) {
    const intervalo = fim ? `${formatarHora(inicio)}–${formatarHora(fim)}` : formatarHora(inicio);
    return `${comMaiuscula(rotuloDoDia(inicio, agora))}, ${intervalo}`;
  }
  const vence = paraData(atividade.venceEm);
  if (!vence) {
    return 'Sem data';
  }
  const dia = rotuloDoDia(vence, agora);
  const hora = formatarHora(vence);
  return atividade.atrasada ? `Venceu ${dia} às ${hora}` : `${comMaiuscula(dia)} às ${hora}`;
}

/**
 * O "quando" por extenso, para o painel: "quinta-feira, 22 de outubro de 2026 às 10:00" ou,
 * na reunião, "… das 10:00 às 11:00". Sem data → `null`.
 */
export function quandoPorExtenso(atividade: Atividade): string | null {
  const inicio = paraData(atividade.inicioEm);
  const fim = paraData(atividade.fimEm);
  const base = atividade.tipo === 'REUNIAO' && inicio ? inicio : paraData(atividade.venceEm);
  if (!base) {
    return null;
  }
  const dia = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(base);
  if (atividade.tipo === 'REUNIAO' && inicio && fim) {
    return `${dia}, das ${formatarHora(inicio)} às ${formatarHora(fim)}`;
  }
  return `${dia} às ${formatarHora(base)}`;
}

/** "21/10/2026 às 18:05" ou "—". */
export function dataHora(iso: string | null): string {
  const data = paraData(iso);
  return data ? `${formatarData(data)} às ${formatarHora(data)}` : '—';
}

/** Link do negócio de uma atividade: o núcleo leva `/funis/<funilId>?negocio=` à área certa. */
export function linkDoNegocio(negocio: { readonly id: string; readonly funilId: string }) {
  return { rota: ['/funis', negocio.funilId], query: { negocio: negocio.id } };
}
