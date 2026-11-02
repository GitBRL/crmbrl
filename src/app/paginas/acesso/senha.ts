import { type DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Validators, type AbstractControl, type ValidatorFn } from '@angular/forms';

import { type MensagensErro } from '../../ui/campo/mensagens-erro';
import { SENHA_MAXIMO, SENHA_MINIMO } from '../../nucleo/sessao/perfil';

/**
 * Regras da senha nova (R2.1: de 8 a 128 caracteres), compartilhadas pelas telas de trocar,
 * redefinir e definir senha. A API continua conferindo; aqui a pessoa vê a regra enquanto
 * digita e não perde uma ida ao servidor por um erro bobo.
 */

/** Validadores do campo "Nova senha". */
export const VALIDADORES_NOVA_SENHA: readonly ValidatorFn[] = [
  Validators.required,
  Validators.minLength(SENHA_MINIMO),
  Validators.maxLength(SENHA_MAXIMO),
];

/**
 * "Confirmar nova senha" igual à nova (`{ diferentes: true }`). Lê o campo irmão `nova` do
 * mesmo grupo; quem usa revalida a confirmação quando a nova muda (`revalidarJunto`).
 */
export const confirmaNovaSenha: ValidatorFn = (controle: AbstractControl) => {
  const nova = controle.parent?.get('nova')?.value as string | undefined;
  const confirmacao = controle.value as string;
  if (!confirmacao) {
    return { required: true };
  }
  return nova === confirmacao ? null : { diferentes: true };
};

/**
 * A nova senha não pode repetir a atual (`{ igualAtual: true }`; a API recusa com 400). A
 * atual vem de uma função porque pode ser o campo "Senha atual" ou a senha temporária que a
 * pessoa acabou de usar para entrar.
 */
export function diferenteDaAtual(atual: () => string | null): ValidatorFn {
  return (controle: AbstractControl) => {
    const senhaAtual = atual();
    return senhaAtual && controle.value === senhaAtual ? { igualAtual: true } : null;
  };
}

/**
 * Quando `origem` muda, `alvo` é validado de novo (a confirmação depende da nova; a nova, da
 * atual). A inscrição acaba com a tela (`destroyRef`).
 */
export function revalidarJunto(
  origem: AbstractControl,
  alvo: AbstractControl,
  destroyRef: DestroyRef,
): void {
  origem.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
    if (alvo.value || alvo.touched) {
      alvo.updateValueAndValidity();
    }
  });
}

/** Mensagens dos campos de senha nova, sem jargão (DESIGN-SYSTEM.md §7). */
export const MENSAGENS_NOVA_SENHA: MensagensErro = {
  required: 'Digite a nova senha.',
  minlength: `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`,
  maxlength: `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`,
  igualAtual: 'A nova senha precisa ser diferente da atual.',
};

export const MENSAGENS_CONFIRMACAO: MensagensErro = {
  required: 'Digite a nova senha de novo para confirmar.',
  diferentes: 'As duas senhas não são iguais. Digite a mesma senha nos dois campos.',
};

/** Um item da lista de requisitos mostrada embaixo dos campos. */
export interface RegraSenha {
  readonly id: 'tamanho' | 'diferente' | 'iguais';
  readonly texto: string;
  readonly atendida: boolean;
}

/**
 * Requisitos da senha nova, para a lista que acompanha a digitação. Com `atual` (troca de
 * senha), entra "Diferente da senha atual" — só atendida quando há senha atual para comparar.
 */
export function regrasDaSenha(
  nova: string,
  confirmacao: string,
  atual?: string | null,
): readonly RegraSenha[] {
  const regras: RegraSenha[] = [
    {
      id: 'tamanho',
      texto: `Pelo menos ${SENHA_MINIMO} caracteres`,
      atendida: nova.length >= SENHA_MINIMO && nova.length <= SENHA_MAXIMO,
    },
  ];
  if (atual !== undefined) {
    regras.push({
      id: 'diferente',
      texto: 'Diferente da senha atual',
      atendida: !!nova && !!atual && nova !== atual,
    });
  }
  regras.push({
    id: 'iguais',
    texto: 'As duas senhas são iguais',
    atendida: !!confirmacao && nova === confirmacao,
  });
  return regras;
}
