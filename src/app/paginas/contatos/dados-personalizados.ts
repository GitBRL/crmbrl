/**
 * Campos personalizados (R4.7): um objeto JSON livre. Na tela, cada chave vira uma linha
 * "nome: valor" (texto); valores que não são texto (número, lista, objeto vindo de um webhook)
 * aparecem como JSON.
 */

export interface CampoPersonalizado {
  readonly chave: string;
  readonly valor: string;
}

/** O valor de um campo como texto (vazio para nulo). */
export function textoDoCampo(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  if (typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  return JSON.stringify(valor);
}

/** `faturamento_mensal` → "Faturamento mensal"; `planilha_cidade` → "Planilha cidade". */
export function rotuloDoCampo(chave: string): string {
  const texto = chave
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : chave;
}

export function listarCampos(
  campos: Readonly<Record<string, unknown>>,
): readonly CampoPersonalizado[] {
  return Object.entries(campos)
    .map(([chave, valor]) => ({ chave, valor: textoDoCampo(valor) }))
    .sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'));
}
