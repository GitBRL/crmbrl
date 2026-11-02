import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SenhaPorLink } from './senha-por-link';

/**
 * Redefinir senha pelo link do e-mail (`/redefinir-senha?token=`, pública) — TELAS-FASE1 §1.3
 * e R2.8: depois do "Esqueci minha senha", a pessoa escolhe a senha nova e já entra. Toda a
 * tela está em `SenhaPorLink`.
 */
@Component({
  selector: 'app-redefinir-senha',
  imports: [SenhaPorLink],
  template: `<app-senha-por-link modo="redefinicao" [token]="token()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedefinirSenha {
  /** Token do link do e-mail (query `token`). */
  readonly token = input<string | null>(null);
}
