/**
 * Janela de envio (dias da semana e faixa de horas): a regra "só enviar neste período" das
 * campanhas e das automações. Funções puras, sem Angular.
 */

/** Dias da semana como no `Date`: 0 = domingo … 6 = sábado. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface JanelaEnvio {
  /** Dias permitidos, em ordem crescente (0 = domingo). */
  readonly dias: readonly DiaSemana[];
  /** "HH:mm", horário local do fuso. */
  readonly inicio: string;
  /** "HH:mm"; tem de ser depois do início. */
  readonly fim: string;
  /** Fuso IANA; o CRM usa `America/Sao_Paulo`. */
  readonly fuso: string;
}

export const FUSO_PADRAO = 'America/Sao_Paulo';

export const DIAS_SEMANA: readonly { valor: DiaSemana; curto: string; longo: string }[] = [
  { valor: 0, curto: 'Dom', longo: 'domingo' },
  { valor: 1, curto: 'Seg', longo: 'segunda-feira' },
  { valor: 2, curto: 'Ter', longo: 'terça-feira' },
  { valor: 3, curto: 'Qua', longo: 'quarta-feira' },
  { valor: 4, curto: 'Qui', longo: 'quinta-feira' },
  { valor: 5, curto: 'Sex', longo: 'sexta-feira' },
  { valor: 6, curto: 'Sáb', longo: 'sábado' },
];

/** Segunda a sexta, das 8h às 18h. */
export const JANELA_COMERCIAL: JanelaEnvio = {
  dias: [1, 2, 3, 4, 5],
  inicio: '08:00',
  fim: '18:00',
  fuso: FUSO_PADRAO,
};

export const JANELA_SEMPRE: JanelaEnvio = {
  dias: [0, 1, 2, 3, 4, 5, 6],
  inicio: '00:00',
  fim: '23:59',
  fuso: FUSO_PADRAO,
};

/** Motivo de a janela não servir, ou `null` quando está certa. */
export function erroDaJanela(janela: JanelaEnvio): string | null {
  if (janela.dias.length === 0) {
    return 'Escolha ao menos um dia da semana.';
  }
  if (!/^\d{2}:\d{2}$/.test(janela.inicio) || !/^\d{2}:\d{2}$/.test(janela.fim)) {
    return 'Informe a hora de início e a de fim.';
  }
  if (janela.fim <= janela.inicio) {
    return 'A hora de fim precisa ser depois da hora de início.';
  }
  return null;
}

/** "08:00" → "8h"; "08:30" → "8h30". */
export function horaCurta(hora: string): string {
  const [h, m] = hora.split(':');
  const horas = String(Number(h));
  return m && m !== '00' ? `${horas}h${m}` : `${horas}h`;
}

const PLURAL: readonly string[] = [
  'domingos',
  'segundas',
  'terças',
  'quartas',
  'quintas',
  'sextas',
  'sábados',
];

/** "de segunda a sexta", "aos sábados e domingos", "todos os dias", "às segundas, quartas e sextas". */
export function descreverDias(dias: readonly DiaSemana[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  const nome = (d: DiaSemana) => DIAS_SEMANA[d].longo;
  if (ordenados.length === 7) {
    return 'todos os dias';
  }
  const seguidos = ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  if (ordenados.length >= 3 && seguidos) {
    const curto = (d: DiaSemana) => nome(d).replace('-feira', '');
    return `de ${curto(ordenados[0])} a ${curto(ordenados[ordenados.length - 1])}`;
  }
  const plural = ordenados.map((d) => PLURAL[d]);
  const soFimDeSemana = ordenados.every((d) => d === 0 || d === 6);
  const lista =
    plural.length > 1
      ? `${plural.slice(0, -1).join(', ')} e ${plural[plural.length - 1]}`
      : plural[0];
  return `${soFimDeSemana ? 'aos' : 'às'} ${lista}`;
}

/** Frase da janela: "Envia de segunda a sexta, das 8h às 18h (horário de Brasília)." */
export function descreverJanela(janela: JanelaEnvio): string {
  const erro = erroDaJanela(janela);
  if (erro) {
    return erro;
  }
  const fuso = janela.fuso === FUSO_PADRAO ? ' (horário de Brasília)' : ` (${janela.fuso})`;
  return `Envia ${descreverDias(janela.dias)}, das ${horaCurta(janela.inicio)} às ${horaCurta(janela.fim)}${fuso}.`;
}

/** Alterna um dia da semana, mantendo a lista em ordem. */
export function alternarDia(dias: readonly DiaSemana[], dia: DiaSemana): readonly DiaSemana[] {
  return dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort((a, b) => a - b);
}
