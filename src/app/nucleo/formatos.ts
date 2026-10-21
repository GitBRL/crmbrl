import { formatNumber } from '@angular/common';

/**
 * Formatação em pt-BR (DESIGN-SYSTEM.md §6 e §7). As funções recebem o `locale` (use
 * `inject(LOCALE_ID)`, que é "pt-BR" no app) para seguir o registro de locale do Angular.
 */

export interface NumeroAbreviado {
  /** Parte numérica já formatada ("48,2"). */
  readonly numero: string;
  /** "", "mil", "mi" ou "bi". */
  readonly sufixo: '' | 'mil' | 'mi' | 'bi';
}

const ESCALAS = [
  { limite: 1e9, sufixo: 'bi' },
  { limite: 1e6, sufixo: 'mi' },
  { limite: 1e3, sufixo: 'mil' },
] as const;

/** 48200 → { numero: "48,2", sufixo: "mil" }; 950 → { numero: "950", sufixo: "" }. */
export function abreviarNumero(valor: number, locale: string, casas = 1): NumeroAbreviado {
  const absoluto = Math.abs(valor);
  for (const escala of ESCALAS) {
    if (absoluto >= escala.limite) {
      return {
        numero: formatNumber(valor / escala.limite, locale, `1.0-${casas}`),
        sufixo: escala.sufixo,
      };
    }
  }
  return { numero: formatNumber(valor, locale, '1.0-0'), sufixo: '' };
}

/** 48200 → "R$ 48,2 mil"; 1250000 → "R$ 1,3 mi"; 980 → "R$ 980". */
export function formatarMoedaAbreviada(valor: number, locale: string, casas = 1): string {
  const { numero, sufixo } = abreviarNumero(valor, locale, casas);
  return sufixo ? `R$ ${numero} ${sufixo}` : `R$ ${numero}`;
}

/**
 * Tempo relativo curto: "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" e, a partir de
 * uma semana, a data (dd/mm/aaaa).
 */
export function formatarTempoRelativo(data: Date, agora: Date = new Date()): string {
  const segundos = Math.round((agora.getTime() - data.getTime()) / 1000);
  if (segundos < 45) {
    return 'agora';
  }
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return `há ${horas} h`;
  }
  const dias = Math.round(horas / 24);
  if (dias === 1) {
    return 'ontem';
  }
  if (dias < 7) {
    return `há ${dias} dias`;
  }
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}
