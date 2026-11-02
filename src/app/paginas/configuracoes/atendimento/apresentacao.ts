import { formatarTempoRelativo } from '../../../nucleo/formatos';
import { ROTULO_AREA } from '../../../nucleo/sessao/perfil';
import type {
  DiaDaSemana,
  HorarioDeAtendimento,
  IntervaloDeAtendimento,
} from '../canais/canais.modelos';
import type {
  AreaDoAtendimento,
  EstrategiaFila,
  MotivoNaFila,
  SituacaoDoHorario,
  Variavel,
} from './atendimento.modelos';

/**
 * Textos e contas da configuração do Atendimento: SLA em minutos ↔ "1 h 30 min", estratégias,
 * motivos na fila, resumo do horário e a prévia das respostas rápidas. Funções puras, testadas
 * em `apresentacao.spec.ts`.
 */

// SLA ------------------------------------------------------------------------------------------

export type UnidadeDeTempo = 'minutos' | 'horas' | 'dias';

const MINUTOS_POR: Readonly<Record<UnidadeDeTempo, number>> = {
  minutos: 1,
  horas: 60,
  dias: 24 * 60,
};

/** 15 → "15 min"; 90 → "1 h 30 min"; 1440 → "1 dia"; 2880 + 240 → "2 dias e 4 h". */
export function formatarMinutos(minutos: number | null): string {
  if (minutos === null) {
    return 'Sem prazo';
  }
  const dias = Math.floor(minutos / MINUTOS_POR.dias);
  const horas = Math.floor((minutos % MINUTOS_POR.dias) / 60);
  const resto = minutos % 60;
  if (dias > 0) {
    const textoDias = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    return horas > 0 ? `${textoDias} e ${horas} h` : textoDias;
  }
  if (horas > 0) {
    return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
  }
  return `${resto} min`;
}

/** Minutos → o maior número inteiro de horas ou dias que dá exato (para o campo da tela). */
export function partirMinutos(minutos: number): { valor: number; unidade: UnidadeDeTempo } {
  if (minutos % MINUTOS_POR.dias === 0) {
    return { valor: minutos / MINUTOS_POR.dias, unidade: 'dias' };
  }
  if (minutos % 60 === 0) {
    return { valor: minutos / 60, unidade: 'horas' };
  }
  return { valor: minutos, unidade: 'minutos' };
}

export function juntarMinutos(valor: number, unidade: UnidadeDeTempo): number {
  return Math.round(valor * MINUTOS_POR[unidade]);
}

export const ROTULO_UNIDADE: Readonly<Record<UnidadeDeTempo, string>> = {
  minutos: 'minutos',
  horas: 'horas',
  dias: 'dias',
};

export const DICA_SLA =
  'SLA é o prazo combinado com o cliente. A primeira resposta conta da chegada da conversa até a primeira mensagem da equipe; a resolução, até a conversa ser resolvida. Quando o prazo estoura, a conversa ganha um selo coral no Atendimento e o líder da área é avisado.';

// Estratégias ------------------------------------------------------------------------------------

export interface EstrategiaVisual {
  readonly rotulo: string;
  readonly descricao: string;
}

export const ESTRATEGIA: Readonly<Record<EstrategiaFila, EstrategiaVisual>> = {
  RODIZIO: {
    rotulo: 'Rodízio',
    descricao: 'Cada conversa nova vai para a próxima pessoa da vez, em ordem.',
  },
  MENOR_CARGA: {
    rotulo: 'Menor carga',
    descricao: 'Vai para quem tem menos conversas em aberto agora.',
  },
  MANUAL: {
    rotulo: 'Manual',
    descricao: 'Ninguém recebe sozinho: a conversa fica na fila até alguém assumir.',
  },
};

export const ESTRATEGIAS: readonly EstrategiaFila[] = ['RODIZIO', 'MENOR_CARGA', 'MANUAL'];

export function rotuloDaArea(area: AreaDoAtendimento): string {
  return ROTULO_AREA[area];
}

// Pessoas na fila ---------------------------------------------------------------------------------

/** O motivo, em uma frase, para a dica ao lado do nome. */
export const MOTIVO_NA_FILA: Readonly<Record<MotivoNaFila, string>> = {
  AREA: 'Recebe: é da área.',
  NA_LISTA: 'Recebe: está na lista da fila.',
  RETIRADO: 'Não recebe: foi tirada desta fila.',
  FORA_DA_LISTA: 'Não recebe: não está na lista da fila.',
  LIDER: 'O líder só recebe se estiver na lista da fila.',
  CONVITE_PENDENTE: 'Ainda não aceitou o convite: entra sozinha quando ativar o acesso.',
  PRIMEIRO_ACESSO_PENDENTE: 'Ainda não entrou no CRM: entra sozinha no primeiro acesso.',
};

/** "3 conversas em aberto" etc. */
export function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

// Horário ---------------------------------------------------------------------------------------

export const DIAS_DA_SEMANA: readonly DiaDaSemana[] = ['1', '2', '3', '4', '5', '6', '0'];

export const NOME_DO_DIA: Readonly<Record<DiaDaSemana, string>> = {
  '0': 'Domingo',
  '1': 'Segunda',
  '2': 'Terça',
  '3': 'Quarta',
  '4': 'Quinta',
  '5': 'Sexta',
  '6': 'Sábado',
};

const ABREVIADO: Readonly<Record<DiaDaSemana, string>> = {
  '0': 'Dom',
  '1': 'Seg',
  '2': 'Ter',
  '3': 'Qua',
  '4': 'Qui',
  '5': 'Sex',
  '6': 'Sáb',
};

/** Fusos do Brasil (o padrão do CRM é o de São Paulo). */
export const FUSOS_HORARIOS: readonly { valor: string; rotulo: string }[] = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília (São Paulo, Rio, Sul e Nordeste)' },
  { valor: 'America/Manaus', rotulo: 'Amazonas (Manaus) · 1 h a menos' },
  { valor: 'America/Cuiaba', rotulo: 'Mato Grosso (Cuiabá) · 1 h a menos' },
  { valor: 'America/Porto_Velho', rotulo: 'Rondônia (Porto Velho) · 1 h a menos' },
  { valor: 'America/Rio_Branco', rotulo: 'Acre (Rio Branco) · 2 h a menos' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha · 1 h a mais' },
];

export const FUSO_PADRAO = 'America/Sao_Paulo';
export const INTERVALOS_POR_DIA = 6;

function textoDosIntervalos(intervalos: readonly IntervaloDeAtendimento[]): string {
  return intervalos.map((i) => `${i.inicio}–${i.fim}`).join(', ');
}

/**
 * O horário numa linha, juntando dias seguidos com os mesmos intervalos:
 * "Seg a Sex, 08:00–12:00, 13:00–18:00 · Sáb, 09:00–13:00". `null` → "24 horas, todos os dias".
 */
export function resumoDoHorario(horario: HorarioDeAtendimento | null): string {
  if (!horario) {
    return '24 horas, todos os dias';
  }
  const grupos: { dias: DiaDaSemana[]; texto: string }[] = [];
  for (const dia of DIAS_DA_SEMANA) {
    const intervalos = horario.dias[dia] ?? [];
    if (intervalos.length === 0) {
      continue;
    }
    const texto = textoDosIntervalos(intervalos);
    const ultimo = grupos[grupos.length - 1];
    const anterior = ultimo?.dias[ultimo.dias.length - 1];
    const seguido =
      anterior !== undefined &&
      DIAS_DA_SEMANA.indexOf(dia) === DIAS_DA_SEMANA.indexOf(anterior) + 1;
    if (ultimo && seguido && ultimo.texto === texto) {
      ultimo.dias.push(dia);
    } else {
      grupos.push({ dias: [dia], texto });
    }
  }
  if (grupos.length === 0) {
    return 'Fechado todos os dias';
  }
  return grupos
    .map(({ dias, texto }) => {
      const nomes =
        dias.length === 1
          ? ABREVIADO[dias[0]]
          : dias.length === 2
            ? `${ABREVIADO[dias[0]]} e ${ABREVIADO[dias[1]]}`
            : `${ABREVIADO[dias[0]]} a ${ABREVIADO[dias[dias.length - 1]]}`;
      return `${nomes}, ${texto}`;
    })
    .join(' · ');
}

/** "Aberto agora · fecha às 18:00" / "Fechado · abre segunda às 08:00". */
export function situacaoDoHorario(
  situacao: SituacaoDoHorario,
  temHorario: boolean,
  agora: Date = new Date(),
): string {
  if (!temHorario) {
    return 'Sempre aberto';
  }
  if (situacao.aberto) {
    return situacao.proximoFechamento
      ? `Aberto agora · fecha ${quando(situacao.proximoFechamento, agora)}`
      : 'Aberto agora';
  }
  return situacao.proximaAbertura
    ? `Fechado agora · abre ${quando(situacao.proximaAbertura, agora)}`
    : 'Fechado agora';
}

/** "às 18:00" (hoje), "amanhã às 08:00", "segunda às 08:00" ou a data. */
function quando(iso: string, agora: Date): string {
  const data = new Date(iso);
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    data,
  );
  const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDoDia(data) - inicioDoDia(agora)) / 86_400_000);
  if (dias === 0) {
    return `às ${hora}`;
  }
  if (dias === 1) {
    return `amanhã às ${hora}`;
  }
  if (dias > 1 && dias < 7) {
    const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(data);
    return `${semana.replace('-feira', '')} às ${hora}`;
  }
  return formatarTempoRelativo(data, agora);
}

/** `HH:MM` → minutos (`24:00` só como fim); `null` se inválido. */
export function minutosDoHorario(hora: string, ehFim: boolean): number | null {
  if (ehFim && hora === '24:00') {
    return 24 * 60;
  }
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

/** Problemas de um dia (mesmas regras da API): fim depois do início e sem sobreposição. */
export function problemasDoDia(intervalos: readonly IntervaloDeAtendimento[]): string | null {
  const lidos: { de: number; ate: number }[] = [];
  for (const intervalo of intervalos) {
    const de = minutosDoHorario(intervalo.inicio, false);
    const ate = minutosDoHorario(intervalo.fim, true);
    if (de === null || ate === null) {
      return 'Preencha o início e o fim (HH:MM).';
    }
    if (ate <= de) {
      return `O fim (${intervalo.fim}) precisa ser depois do início (${intervalo.inicio}). Para passar da meia-noite, termine às 24:00 e continue no dia seguinte.`;
    }
    lidos.push({ de, ate });
  }
  lidos.sort((a, b) => a.de - b.de);
  for (let i = 1; i < lidos.length; i++) {
    if (lidos[i].de < lidos[i - 1].ate) {
      return 'Há intervalos que se sobrepõem.';
    }
  }
  return null;
}

/** Horário comercial de partida: segunda a sexta, 08:00–18:00. */
export function horarioComercial(fusoHorario = FUSO_PADRAO): HorarioDeAtendimento {
  const comercial = [{ inicio: '08:00', fim: '18:00' }];
  return {
    fusoHorario,
    dias: { '1': comercial, '2': comercial, '3': comercial, '4': comercial, '5': comercial },
  };
}

// Respostas rápidas ---------------------------------------------------------------------------------

/** Como a API grava o atalho: sem a barra inicial, em minúsculas (crmbrl-api, `variaveis.ts`). */
export function normalizarAtalho(atalho: string): string {
  return atalho.trim().replace(/^\/+/, '').toLocaleLowerCase('pt-BR');
}

export const FORMATO_DO_ATALHO = /^[^\s/]{1,40}$/;

const VARIAVEL = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Nomes das variáveis do texto (sem repetir, na ordem). */
export function variaveisDoTexto(texto: string): string[] {
  return [...new Set([...texto.matchAll(VARIAVEL)].map((item) => item[1]))];
}

/** As variáveis do texto que não existem. */
export function variaveisDesconhecidas(
  texto: string,
  conhecidas: readonly Pick<Variavel, 'nome'>[],
): string[] {
  const nomes = new Set(conhecidas.map((variavel) => variavel.nome));
  return variaveisDoTexto(texto).filter((nome) => !nomes.has(nome));
}

/** O texto com os exemplos no lugar das variáveis (a prévia da tela). */
export function aplicarExemplos(texto: string, variaveis: readonly Variavel[]): string {
  const exemplos = new Map(variaveis.map((variavel) => [variavel.nome, variavel.exemplo]));
  return texto.replace(VARIAVEL, (inteiro, nome: string) => exemplos.get(nome) ?? inteiro);
}
