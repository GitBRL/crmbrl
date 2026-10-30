import { descreverDias, horaCurta, type DiaSemana } from '../seletor-janela-envio/janela-envio';

/**
 * Agenda: quando uma campanha sai ou quando uma automação roda. Quatro modos:
 * `agora`, `data` (uma data e hora), `recorrente` (todo dia, toda semana, todo mês) e
 * `relativa` (N dias antes/depois de um campo de data do contato ou do negócio).
 * Um objeto só, com todos os campos sempre presentes; cada modo lê os seus. Funções puras.
 */

export type ModoAgenda = 'agora' | 'data' | 'recorrente' | 'relativa';
export type FrequenciaAgenda = 'diaria' | 'semanal' | 'mensal';
export type SentidoAgenda = 'antes' | 'depois';

export interface Agenda {
  readonly modo: ModoAgenda;
  /** Modo `data`: "AAAA-MM-DDTHH:mm" (horário de Brasília). */
  readonly dataHora: string | null;
  /** Modo `recorrente`. */
  readonly frequencia: FrequenciaAgenda;
  /** Frequência semanal: dias escolhidos. */
  readonly diasSemana: readonly DiaSemana[];
  /** Frequência mensal: dia do mês (1 a 28; evita meses curtos). */
  readonly diaMes: number;
  /** Modos `recorrente` e `relativa`: "HH:mm". */
  readonly hora: string;
  /** Modo `relativa`: quantos dias, antes ou depois, de qual campo. */
  readonly quantidade: number;
  readonly sentido: SentidoAgenda;
  readonly campo: string | null;
}

export const ROTULO_MODO: Readonly<Record<ModoAgenda, string>> = {
  agora: 'Agora',
  data: 'Numa data e hora',
  recorrente: 'Repetir',
  relativa: 'Perto de uma data',
};

export const DICA_MODO: Readonly<Record<ModoAgenda, string>> = {
  agora: 'Começa assim que você confirmar.',
  data: 'Começa no dia e na hora que você escolher.',
  recorrente: 'Roda todo dia, toda semana ou todo mês.',
  relativa: 'Por exemplo, 3 dias antes do vencimento.',
};

export const ROTULO_FREQUENCIA: Readonly<Record<FrequenciaAgenda, string>> = {
  diaria: 'Todo dia',
  semanal: 'Toda semana',
  mensal: 'Todo mês',
};

export function agendaPadrao(modo: ModoAgenda = 'agora'): Agenda {
  return {
    modo,
    dataHora: null,
    frequencia: 'semanal',
    diasSemana: [1],
    diaMes: 1,
    hora: '09:00',
    quantidade: 3,
    sentido: 'antes',
    campo: null,
  };
}

/** Motivo de a agenda não servir, ou `null` quando está certa. */
export function erroDaAgenda(agenda: Agenda, agora: Date = new Date()): string | null {
  switch (agenda.modo) {
    case 'agora':
      return null;
    case 'data': {
      if (!agenda.dataHora) {
        return 'Escolha o dia e a hora.';
      }
      // "AAAA-MM-DDTHH:mm" sem fuso é lido no horário do navegador; o limite é só uma guarda.
      return new Date(agenda.dataHora).getTime() <= agora.getTime()
        ? 'Escolha um momento no futuro.'
        : null;
    }
    case 'recorrente': {
      if (!/^\d{2}:\d{2}$/.test(agenda.hora)) {
        return 'Informe a hora.';
      }
      if (agenda.frequencia === 'semanal' && agenda.diasSemana.length === 0) {
        return 'Escolha ao menos um dia da semana.';
      }
      if (agenda.frequencia === 'mensal' && (agenda.diaMes < 1 || agenda.diaMes > 28)) {
        return 'Escolha um dia do mês de 1 a 28.';
      }
      return null;
    }
    case 'relativa': {
      if (!agenda.campo) {
        return 'Escolha a data de referência.';
      }
      if (
        !Number.isInteger(agenda.quantidade) ||
        agenda.quantidade < 0 ||
        agenda.quantidade > 365
      ) {
        return 'Informe de 0 a 365 dias.';
      }
      return /^\d{2}:\d{2}$/.test(agenda.hora) ? null : 'Informe a hora.';
    }
  }
}

function dataLonga(dataHora: string): string {
  const [data, hora] = dataHora.split('T');
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano} às ${horaCurta(hora ?? '00:00')}`;
}

/** Frase da agenda: "Toda semana, às segundas, às 9h." */
export function descreverAgenda(
  agenda: Agenda,
  camposData: readonly { valor: string; rotulo: string }[] = [],
): string {
  const erro = erroDaAgenda(agenda, new Date(0));
  if (erro) {
    return erro;
  }
  switch (agenda.modo) {
    case 'agora':
      return 'Começa assim que você confirmar.';
    case 'data':
      return `Começa em ${dataLonga(agenda.dataHora ?? '')} (horário de Brasília).`;
    case 'recorrente': {
      const hora = `às ${horaCurta(agenda.hora)}`;
      if (agenda.frequencia === 'diaria') {
        return `Todo dia, ${hora}.`;
      }
      if (agenda.frequencia === 'semanal') {
        return `Toda semana, ${descreverDias(agenda.diasSemana)}, ${hora}.`;
      }
      return `Todo mês, no dia ${agenda.diaMes}, ${hora}.`;
    }
    case 'relativa': {
      const campo = camposData.find((c) => c.valor === agenda.campo)?.rotulo ?? agenda.campo;
      const dias =
        agenda.quantidade === 0
          ? 'No dia'
          : `${agenda.quantidade} ${agenda.quantidade === 1 ? 'dia' : 'dias'} ${agenda.sentido === 'antes' ? 'antes' : 'depois'}`;
      return `${dias} de “${campo}”, às ${horaCurta(agenda.hora)}.`;
    }
  }
}
