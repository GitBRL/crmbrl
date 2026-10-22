import { SENHA_MINIMO } from '../../nucleo/sessao/perfil';

/**
 * Telefone gravado pela API (E.164 só com dígitos, "5511987654321") → "+55 (11) 98765-4321".
 * Outros formatos voltam como vieram; sem telefone → ''.
 */
export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) {
    return '';
  }
  const digitos = e164.replace(/\D/g, '');
  const brasil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  if (brasil) {
    return `+55 (${brasil[1]}) ${brasil[2]}-${brasil[3]}`;
  }
  return e164;
}

const LETRAS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const ALGARISMOS = '23456789';
const SIMBOLOS = '@#$%&*+-=?';

/**
 * Senha temporária forte e fácil de ditar: 14 caracteres (letras sem as ambíguas l/I/O/0/1,
 * algarismos e símbolos), com pelo menos um de cada grupo. Usa `crypto.getRandomValues`.
 */
export function gerarSenha(tamanho = 14): string {
  const total = Math.max(tamanho, SENHA_MINIMO);
  const sortear = (alfabeto: string, quantidade: number): string[] => {
    const valores = new Uint32Array(quantidade);
    crypto.getRandomValues(valores);
    return Array.from(valores, (valor) => alfabeto[valor % alfabeto.length]);
  };
  const caracteres = [
    ...sortear(LETRAS, total - 4),
    ...sortear(ALGARISMOS, 2),
    ...sortear(SIMBOLOS, 2),
  ];
  // Embaralha (Fisher–Yates) para os algarismos e símbolos não ficarem sempre no fim.
  const ordem = new Uint32Array(caracteres.length);
  crypto.getRandomValues(ordem);
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = ordem[i] % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/** "1 pessoa" / "3 pessoas". */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
