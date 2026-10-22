import { formatNumber } from '@angular/common';

/**
 * Formatação em pt-BR (DESIGN-SYSTEM.md §6 e §7). Valores e datas chegam da API como texto:
 * dinheiro em decimal (`"1500.00"`) e datas em ISO 8601 UTC; aqui viram o que a pessoa lê,
 * no fuso do navegador. As funções de número aceitam o `locale` (use `inject(LOCALE_ID)`,
 * que é "pt-BR" no app); as outras já são pt-BR.
 */

const LOCALE = 'pt-BR';

type Valor = string | number | null | undefined;
type Data = Date | string | number | null | undefined;

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
 * Número de um valor da API: `"1500.00"` → 1500, `"-3.5"` → -3,5. Texto vazio, `null` ou
 * inválido → `null`.
 */
export function paraNumero(valor: Valor): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }
  const texto = valor.trim();
  if (!texto) {
    return null;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export interface OpcoesMoeda {
  /** Mostrar os centavos (padrão: sim). Sem eles, arredonda: "R$ 1.501". */
  readonly centavos?: boolean;
  /** Texto quando não há valor (padrão: "—"). */
  readonly vazio?: string;
}

/**
 * Dinheiro em reais: `"1500.00"` → "R$ 1.500,00"; `null` → "—". Entre o "R$" e o número fica
 * um espaço inseparável (o valor nunca quebra de linha).
 */
export function formatarMoeda(valor: Valor, opcoes: OpcoesMoeda = {}): string {
  const numero = paraNumero(valor);
  if (numero === null) {
    return opcoes.vazio ?? '—';
  }
  const casas = opcoes.centavos === false ? 0 : 2;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(numero);
}

/** Valor decimal para mandar à API (`1500` → `"1500.00"`); `null` continua `null`. */
export function paraDecimal(valor: Valor): string | null {
  const numero = paraNumero(valor);
  return numero === null ? null : numero.toFixed(2);
}

/** Número inteiro ou decimal em pt-BR: 1600 → "1.600"; 0.5 → "0,5". */
export function formatarNumero(valor: Valor, casasMaximas = 2): string {
  const numero = paraNumero(valor);
  return numero === null
    ? '—'
    : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: casasMaximas }).format(numero);
}

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `Date` de um valor da API (ISO 8601) ou `null` se vazio/inválido. Datas sem hora
 * ("2026-10-21", como a previsão de fechamento) valem como o dia local — `new Date()` as
 * leria como meia-noite UTC, que no Brasil ainda é o dia anterior.
 */
export function paraData(valor: Data): Date | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const soData = typeof valor === 'string' ? SO_DATA.exec(valor) : null;
  const data = soData
    ? new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
    : valor instanceof Date
      ? valor
      : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

export type EstiloData = 'curta' | 'longa' | 'dia-mes' | 'mes-ano';

const FORMATOS_DATA: Readonly<Record<EstiloData, Intl.DateTimeFormatOptions>> = {
  curta: { day: '2-digit', month: '2-digit', year: 'numeric' },
  longa: { day: 'numeric', month: 'long', year: 'numeric' },
  'dia-mes': { day: 'numeric', month: 'short' },
  'mes-ano': { month: 'long', year: 'numeric' },
};

/**
 * Data no fuso do navegador: `curta` "21/10/2026" (padrão) · `longa` "21 de outubro de 2026"
 * · `dia-mes` "21 de out." · `mes-ano` "outubro de 2026". Sem valor → "—".
 */
export function formatarData(valor: Data, estilo: EstiloData = 'curta'): string {
  const data = paraData(valor);
  return data ? new Intl.DateTimeFormat(LOCALE, FORMATOS_DATA[estilo]).format(data) : '—';
}

/** "18:05" no fuso do navegador. */
export function formatarHora(valor: Data): string {
  const data = paraData(valor);
  return data
    ? new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(data)
    : '—';
}

/** "21/10/2026 às 18:05" no fuso do navegador. */
export function formatarDataHora(valor: Data): string {
  const data = paraData(valor);
  return data ? `${formatarData(data)} às ${formatarHora(data)}` : '—';
}

/**
 * Tempo relativo curto: "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" e, a partir de
 * uma semana, a data (dd/mm/aaaa). No futuro: "em 5 min", "em 2 h", "amanhã", "em 3 dias".
 * Aceita `Date` ou ISO 8601; sem valor → "—".
 */
export function formatarTempoRelativo(valor: Data, agora: Date = new Date()): string {
  const data = paraData(valor);
  if (!data) {
    return '—';
  }
  const diferenca = Math.round((agora.getTime() - data.getTime()) / 1000);
  const futuro = diferenca < 0;
  const segundos = Math.abs(diferenca);
  if (segundos < 45) {
    return 'agora';
  }
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) {
    return futuro ? `em ${minutos} min` : `há ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return futuro ? `em ${horas} h` : `há ${horas} h`;
  }
  const dias = Math.round(horas / 24);
  if (dias === 1) {
    return futuro ? 'amanhã' : 'ontem';
  }
  if (dias < 7) {
    return futuro ? `em ${dias} dias` : `há ${dias} dias`;
  }
  return formatarData(data);
}

/** Espera legível: 30 → "30 segundos"; 60 → "1 minuto"; 900 → "15 minutos"; 7200 → "2 horas". */
export function formatarEspera(segundos: number): string {
  const total = Math.max(1, Math.ceil(segundos));
  if (total < 60) {
    return total === 1 ? '1 segundo' : `${total} segundos`;
  }
  const minutos = Math.ceil(total / 60);
  if (minutos < 60) {
    return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  }
  const horas = Math.ceil(minutos / 60);
  return horas === 1 ? '1 hora' : `${horas} horas`;
}

/** Fuso do navegador ("America/Sao_Paulo"), para os filtros da API que o pedem. */
export function fusoDoNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

const dois = (numero: number) => String(numero).padStart(2, '0');

/** ISO da API → valor de `<input type="date">` ("2026-10-21"), no fuso do navegador. */
export function paraCampoData(valor: Data): string {
  const data = paraData(valor);
  return data ? `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}` : '';
}

/** ISO da API → valor de `<input type="datetime-local">` ("2026-10-21T18:05"). */
export function paraCampoDataHora(valor: Data): string {
  const data = paraData(valor);
  return data ? `${paraCampoData(data)}T${dois(data.getHours())}:${dois(data.getMinutes())}` : '';
}

/**
 * Valor de `<input type="datetime-local">` (hora local) → ISO 8601 UTC para a API; vazio →
 * `null`.
 */
export function deCampoDataHora(valor: string | null | undefined): string | null {
  if (!valor) {
    return null;
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/**
 * Valor de `<input type="date">` → o mesmo "AAAA-MM-DD" (campos só de data, como a previsão
 * de fechamento); vazio ou inválido → `null`.
 */
export function deCampoData(valor: string | null | undefined): string | null {
  return valor && SO_DATA.test(valor) ? valor : null;
}

/**
 * Tira dos textos da API os códigos internos das regras ("(R7.4)", "(regra R5.8)",
 * "(R7.3, R7.4)"): para quem usa o CRM eles não dizem nada (TELAS-FASE1: sem siglas sem
 * explicação). Os códigos continuam na documentação e nos logs.
 */
export function semCodigoDeRegra(texto: string): string {
  return texto
    .replace(/\s*\((?:regras?\s+)?R\d+(?:\.\d+)?(?:\s*(?:,|e|\/)\s*R\d+(?:\.\d+)?)*\)/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/**
 * Tempo na etapa de um negócio: "12 d", "1 d" e, abaixo de 24 h (a API conta dias inteiros),
 * "hoje" — ou "ontem", se entrou na etapa num dia anterior do calendário (`desde`, ISO). O
 * mesmo texto no quadro, no detalhe do negócio e na aba Negócios do contato.
 */
export function rotuloDias(dias: number, desde?: string | null, agora: Date = new Date()): string {
  if (dias > 0) {
    return `${dias} d`;
  }
  const entrada = desde ? new Date(desde) : null;
  const valida = !!entrada && !Number.isNaN(entrada.getTime());
  return valida && entrada.toDateString() !== agora.toDateString() ? 'ontem' : 'hoje';
}

/** "Na etapa há 12 d", "Na etapa desde ontem", "Na etapa desde hoje". */
export function tempoNaEtapa(
  dias: number,
  desde?: string | null,
  agora: Date = new Date(),
): string {
  const rotulo = rotuloDias(dias, desde, agora);
  return dias > 0 ? `Na etapa há ${rotulo}` : `Na etapa desde ${rotulo}`;
}
