import type { ValidationErrors } from '@angular/forms';

/**
 * Mensagens dos erros de validação, por chave do erro (`required`, `email`…). O valor é o
 * texto ou uma função que recebe o objeto do erro (ex.: `{ requiredLength: 8 }`).
 */
export type MensagensErro = Readonly<
  Record<string, string | ((erro: Readonly<Record<string, unknown>>) => string)>
>;

const numero = new Intl.NumberFormat('pt-BR');

/** Mensagens padrão, em português e sem jargão (DESIGN-SYSTEM.md §7). */
export const MENSAGENS_ERRO_PADRAO: MensagensErro = {
  required: 'Preencha este campo.',
  email: 'Digite um e-mail válido, como nome@empresa.com.br.',
  minlength: (erro) => `Use pelo menos ${erro['requiredLength']} caracteres.`,
  maxlength: (erro) => `Use no máximo ${erro['requiredLength']} caracteres.`,
  min: (erro) => `O menor valor aceito é ${numero.format(Number(erro['min']))}.`,
  max: (erro) => `O maior valor aceito é ${numero.format(Number(erro['max']))}.`,
  pattern: 'Confira o formato deste campo.',
};

const MENSAGEM_GENERICA = 'Confira este campo.';

/**
 * Texto do primeiro erro do controle. Ordem de preferência: a mensagem passada pela tela
 * (`mensagens`), o próprio valor do erro quando ele é um texto (`setErrors({ api: 'Este
 * e-mail já está em uso.' })`) e a mensagem padrão. Sem nenhuma, "Confira este campo.".
 */
export function mensagemDoErro(
  erros: ValidationErrors | null | undefined,
  mensagens: MensagensErro = {},
): string | null {
  if (!erros) {
    return null;
  }
  const [chave] = Object.keys(erros);
  if (chave === undefined) {
    return null;
  }
  const valor: unknown = erros[chave];
  const modelo =
    mensagens[chave] ?? (typeof valor === 'string' ? valor : MENSAGENS_ERRO_PADRAO[chave]);
  if (modelo === undefined) {
    return MENSAGEM_GENERICA;
  }
  if (typeof modelo === 'string') {
    return modelo;
  }
  const detalhe = valor !== null && typeof valor === 'object' ? valor : {};
  return modelo(detalhe as Readonly<Record<string, unknown>>);
}
