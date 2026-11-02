import type { TipoAtividade } from './atividades.api';

/**
 * A criação rápida entende o que a pessoa escreve: "Ligar para Maria amanhã às 10h" vira uma
 * ligação para amanhã às 10:00, com o título "Ligar para Maria". Só o começo da frase define
 * o tipo; a data e a hora podem estar em qualquer lugar. Nada aqui chama a API.
 */
export interface Interpretacao {
  /** Tipo reconhecido pelo começo da frase ("Ligar…", "Reunião…"); `null` se nenhum. */
  readonly tipo: TipoAtividade | null;
  /** O dia reconhecido (meia-noite local); `null` se nenhum. */
  readonly dia: Date | null;
  /** A hora reconhecida; `null` se nenhuma. */
  readonly hora: { readonly horas: number; readonly minutos: number } | null;
  /** O texto sem os trechos de data e hora ("Ligar para Maria"). */
  readonly titulo: string;
}

interface Trecho {
  readonly inicio: number;
  readonly fim: number;
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const TIPOS: readonly { readonly tipo: TipoAtividade; readonly padrao: RegExp }[] = [
  {
    tipo: 'LIGACAO',
    padrao:
      /^(?:(?:fazer|marcar|agendar|dar)\s+(?:uma?\s+)?)?(?:ligacao|ligar|telefonar|telefonema)\b/,
  },
  {
    tipo: 'REUNIAO',
    padrao:
      /^(?:(?:fazer|marcar|agendar|ter)\s+(?:uma?\s+)?)?(?:reuniao|reunir|call|videochamada|videoconferencia)\b/,
  },
  {
    tipo: 'EMAIL',
    padrao: /^(?:(?:enviar|mandar|responder|escrever)\s+(?:uma?\s+|o\s+)?)?e-?mail\b/,
  },
  {
    tipo: 'WHATSAPP',
    padrao:
      /^(?:(?:enviar|mandar|responder|chamar)\s+(?:uma?\s+|o\s+|no\s+)?)?(?:whatsapp|whats|zap|wpp)\b/,
  },
];

// Palavras que, antes da data, saem junto com ela ("até sexta", "na segunda").
const ANTES_DA_DATA = String.raw`(?:(?:para|ate|na|no|nesta|neste|nessa|nesse|em|no dia)\s+)?`;
// "segunda" também é ordinal: "segunda via", "segunda reunião" não são datas.
const NAO_ORDINAL = String.raw`(?!\s+(?:via|vez|parcela|opcao|etapa|fase|reuniao|proposta|chamada|ligacao|visita|rodada|versao))`;
// O que pode vir depois de um dia da semana sem preposição para ele ser data: o fim da frase,
// pontuação, uma hora ("às 9h", "14:30") ou um período ("de manhã", "à tarde").
const DEPOIS_DO_DIA_SOLTO =
  /^\s*(?:$|[,.;:!?)]|(?:as|a partir das|ate as|por volta das|das)\s+\d|\d|(?:de|pela|a|na)\s+(?:manha|tarde|noite)\b|cedo\b)/;

/** Texto em minúsculas e sem acentos, com o mesmo comprimento (os índices continuam valendo). */
export function normalizar(texto: string): string {
  return [...texto]
    .map((caractere) => {
      const simples = caractere.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      return simples.length === caractere.length ? simples : caractere.toLowerCase();
    })
    .join('');
}

function somarDias(base: Date, dias: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
}

function reconhecerDia(
  texto: string,
  agora: Date,
): { readonly dia: Date; readonly trecho: Trecho } | null {
  const hoje = somarDias(agora, 0);
  const relativos: readonly [RegExp, number][] = [
    [new RegExp(String.raw`\b${ANTES_DA_DATA}depois de amanha\b`), 2],
    [new RegExp(String.raw`\b${ANTES_DA_DATA}amanha\b`), 1],
    [new RegExp(String.raw`\b${ANTES_DA_DATA}hoje\b`), 0],
  ];
  for (const [padrao, dias] of relativos) {
    const achado = padrao.exec(texto);
    if (achado) {
      return { dia: somarDias(hoje, dias), trecho: trechoDe(achado) };
    }
  }

  // Dia da semana: o próximo (hoje não conta: "quarta" numa quarta é a da semana que vem).
  // Vale com preposição antes ("na sexta"), "-feira" ou "que vem" depois, sábado e domingo,
  // ou o dia sozinho no fim da frase ou seguido de hora ("Ligar segunda", "sexta às 9h") —
  // "segunda proposta" e "terça parte" continuam sem data.
  const semana = new RegExp(
    String.raw`\b(?:((?:para|ate|na|no|nesta|neste|nessa|nesse|de)\s+(?:(?:proxima|proximo)\s+)?|(?:proxima|proximo)\s+))?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira|\s+feira)?(\s+que vem)?\b${NAO_ORDINAL}`,
    'g',
  );
  for (const achadoSemana of texto.matchAll(semana)) {
    const [inteiro, preposicao, nome, feira, queVem] = achadoSemana;
    const depois = texto.slice((achadoSemana.index ?? 0) + inteiro.length);
    if (
      preposicao ||
      feira ||
      queVem ||
      ['sabado', 'domingo'].includes(nome) ||
      DEPOIS_DO_DIA_SOLTO.test(depois)
    ) {
      const alvo = DIAS_DA_SEMANA.indexOf(nome);
      const avanco = (alvo - hoje.getDay() + 7) % 7 || 7;
      return { dia: somarDias(hoje, avanco), trecho: trechoDe(achadoSemana) };
    }
  }

  // 25/10 ou 25/10/2026.
  const barra = new RegExp(
    String.raw`\b${ANTES_DA_DATA}(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b`,
  ).exec(texto);
  if (barra) {
    const ano = barra[3] ? Number(barra[3].length === 2 ? `20${barra[3]}` : barra[3]) : null;
    const dia = montarData(ano ?? hoje.getFullYear(), Number(barra[2]) - 1, Number(barra[1]));
    if (dia) {
      return { dia, trecho: trechoDe(barra) };
    }
  }

  // "dia 25": neste mês, ou no próximo se já passou.
  const diaDoMes = /\b(?:(?:para|ate|no)\s+)?dia\s+(\d{1,2})\b(?!\s*\/)/.exec(texto);
  if (diaDoMes) {
    const numero = Number(diaDoMes[1]);
    const mes = numero >= hoje.getDate() ? hoje.getMonth() : hoje.getMonth() + 1;
    const dia = montarData(hoje.getFullYear(), mes, numero);
    if (dia) {
      return { dia, trecho: trechoDe(diaDoMes) };
    }
  }
  return null;
}

/** A data só vale se existir de verdade (31/02 não). */
function montarData(ano: number, mes: number, dia: number): Date | null {
  const data = new Date(ano, mes, dia);
  return data.getDate() === dia && dia > 0 ? data : null;
}

function reconhecerHora(texto: string): {
  readonly hora: { readonly horas: number; readonly minutos: number };
  readonly trecho: Trecho;
} | null {
  const meioDia = /\b(?:ao\s+)?meio[- ]dia\b/.exec(texto);
  const padroes: readonly RegExp[] = [
    // "às 10h", "às 14", "às 9:30", "a partir das 15h", "por volta das 11"
    /\b(?:as|a partir das|ate as|por volta das|das)\s+(\d{1,2})(?:(?:h|:)(\d{2})?)?(?:\s*(?:h|hs|horas?))?\b/,
    // "10h30", "10:30" (sem preposição, só com os minutos)
    /\b(\d{1,2})(?:h|:)(\d{2})(?:\s*(?:h|hs))?\b/,
  ];
  for (const padrao of padroes) {
    const achado = padrao.exec(texto);
    if (achado) {
      const horas = Number(achado[1]);
      const minutos = Number(achado[2] ?? 0);
      if (horas < 24 && minutos < 60) {
        return { hora: { horas, minutos }, trecho: trechoDe(achado) };
      }
    }
  }
  if (meioDia) {
    return { hora: { horas: 12, minutos: 0 }, trecho: trechoDe(meioDia) };
  }
  return null;
}

function trechoDe(achado: RegExpExecArray): Trecho {
  return { inicio: achado.index, fim: achado.index + achado[0].length };
}

/** Tira os trechos e arruma o que sobra (espaços dobrados, vírgula ou "às" pendurados). */
function tirarTrechos(texto: string, trechos: readonly Trecho[]): string {
  let resultado = texto;
  for (const trecho of [...trechos].sort((a, b) => b.inicio - a.inicio)) {
    resultado = `${resultado.slice(0, trecho.inicio)} ${resultado.slice(trecho.fim)}`;
  }
  let anterior = '';
  while (anterior !== resultado) {
    anterior = resultado;
    resultado = resultado
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;!?])/g, '$1')
      .replace(/[\s,;–—-]+$/u, '')
      .replace(/\s+(?:e|para|às|as|no|na|em|de|até|ate)$/iu, '')
      .trim();
  }
  return resultado;
}

/** "Ligar para Maria amanhã às 10h" → ligação, amanhã, 10:00, "Ligar para Maria". */
export function interpretarTitulo(texto: string, agora: Date = new Date()): Interpretacao {
  const normal = normalizar(texto);
  const comeco = normal.trimStart();
  const tipo = TIPOS.find(({ padrao }) => padrao.test(comeco))?.tipo ?? null;
  const dia = reconhecerDia(normal, agora);
  const hora = reconhecerHora(normal);
  const trechos = [dia?.trecho, hora?.trecho].filter((trecho): trecho is Trecho => !!trecho);
  const titulo = trechos.length ? tirarTrechos(texto, trechos) : texto.trim();
  return {
    tipo,
    dia: dia?.dia ?? null,
    hora: hora?.hora ?? null,
    titulo: titulo.length >= 2 ? titulo : texto.trim(),
  };
}

/** Hora usada quando a frase diz o dia mas não a hora ("amanhã"): o fim do expediente. */
export const HORA_PADRAO = { horas: 18, minutos: 0 } as const;

const dois = (numero: number) => String(numero).padStart(2, '0');

/**
 * A data e a hora reconhecidas no formato do campo `datetime-local` ("2026-10-22T10:00"),
 * ou `null` se a frase não fala de quando. Só a hora → hoje (amanhã, se já passou); só o
 * dia → às 18:00 (ou 23:59, se hoje já passou das 18:00).
 */
export function quandoReconhecido(
  interpretacao: Pick<Interpretacao, 'dia' | 'hora'>,
  agora: Date = new Date(),
): string | null {
  const { dia, hora } = interpretacao;
  if (!dia && !hora) {
    return null;
  }
  let data: Date;
  if (dia && hora) {
    data = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora.horas, hora.minutos);
  } else if (hora) {
    data = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      hora.horas,
      hora.minutos,
    );
    if (data.getTime() <= agora.getTime()) {
      data = new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate() + 1,
        hora.horas,
        hora.minutos,
      );
    }
  } else {
    const base = dia as Date;
    data = new Date(base.getFullYear(), base.getMonth(), base.getDate(), HORA_PADRAO.horas, 0);
    if (data.getTime() <= agora.getTime()) {
      data = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59);
    }
  }
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}T${dois(data.getHours())}:${dois(data.getMinutes())}`;
}
