/** Rótulos dos tipos de canal em que o SDR atua. */
export const ROTULO_TIPO_CANAL_SDR: Readonly<Record<string, string>> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_OFICIAL: 'WhatsApp oficial',
  WEBCHAT: 'Chat do site',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Messenger',
};

/** Formata nota 0 a 100 etc. */
export function textoOuNulo(valor: string | number | null): string {
  return String(valor ?? '').trim();
}

/** Número inteiro de um campo de texto; `null` quando em branco, `NaN` quando inválido. */
export function inteiroDoCampo(valor: string | number | null): number | null {
  const texto = textoOuNulo(valor);
  if (texto === '') {
    return null;
  }
  const n = Number(texto);
  return Number.isInteger(n) ? n : Number.NaN;
}

/** Chave estável a partir do rótulo ("Forma de pagamento" → "forma_de_pagamento"). */
export function chaveDoRotulo(rotulo: string): string {
  const chave = rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(chave) ? chave : chave ? `c_${chave}` : '';
}
