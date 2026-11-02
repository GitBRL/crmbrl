import { formatarData } from '../../../nucleo/formatos';

/** A API devolve o fim como o instante exclusivo (meia-noite do dia seguinte): mostra o último dia. */
export function textoDoPeriodo(periodo: { readonly de: string; readonly ate: string }): string {
  const ultimo = new Date(Date.parse(periodo.ate) - 1);
  return `${formatarData(periodo.de)} a ${formatarData(ultimo)}`;
}
