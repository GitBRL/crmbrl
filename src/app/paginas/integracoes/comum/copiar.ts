// A cópia para a área de transferência é do núcleo (a mesma da visão geral e dos contatos).
export { copiarTexto } from '../../../nucleo/copiar';

/** JSON legível (2 espaços); texto vai como veio e vazio vira "—". */
export function formatarJson(valor: unknown): string {
  if (valor === undefined || valor === null) {
    return '—';
  }
  if (typeof valor === 'string') {
    return valor;
  }
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

/** IP para leitura: o IPv4 que chega mapeado em IPv6 (`::ffff:172.21.0.1`) vira só o IPv4. */
export function formatarIp(ip: string | null | undefined): string {
  if (!ip) {
    return '—';
  }
  const mapeado = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/i.exec(ip);
  return mapeado ? mapeado[1] : ip;
}

/** Trecho de um texto da API: os entre crases (`name`) viram código. */
export interface ParteDoTexto {
  readonly texto: string;
  readonly codigo: boolean;
}

/** "Campos `name` e `email`." → [texto, código, texto, código, texto]. */
export function partesComCodigo(texto: string): readonly ParteDoTexto[] {
  return texto
    .split('`')
    .map((parte, indice) => ({ texto: parte, codigo: indice % 2 === 1 }))
    .filter((parte) => parte.texto !== '');
}
