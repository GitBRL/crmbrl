/**
 * Período dos filtros da Administração: as datas dos campos (`AAAA-MM-DD`, dia local) viram o
 * intervalo que a API espera — `de` inclusive e `ate` **exclusivo**, ISO com fuso (R3.4).
 */

function diaLocal(valor: string | null | undefined): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? '');
  if (!partes) {
    return null;
  }
  const data = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Meia-noite do dia (fuso do navegador), em ISO UTC. */
export function inicioDoDia(valor: string | null | undefined): string | null {
  return diaLocal(valor)?.toISOString() ?? null;
}

/** Meia-noite do dia seguinte (o `ate` da API é exclusivo), em ISO UTC. */
export function fimDoDia(valor: string | null | undefined): string | null {
  const dia = diaLocal(valor);
  if (!dia) {
    return null;
  }
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1).toISOString();
}

/** Mensagem quando o fim vem antes do início (ou `null` se está tudo certo). */
export function problemaDoPeriodo(de: string | null, ate: string | null): string | null {
  const inicio = diaLocal(de);
  const fim = diaLocal(ate);
  return inicio && fim && fim < inicio
    ? 'A data final precisa ser igual ou depois da inicial.'
    : null;
}
