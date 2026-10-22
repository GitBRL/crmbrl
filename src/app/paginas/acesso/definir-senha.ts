import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SenhaPorLink } from './senha-por-link';

/**
 * Definir senha pelo convite (`/definir-senha?token=`, pública) — TELAS-FASE1 §1 e R2.8: a
 * pessoa convidada pelo Admin cria a senha e já entra. Toda a tela está em `SenhaPorLink`.
 */
@Component({
  selector: 'app-definir-senha',
  imports: [SenhaPorLink],
  template: `<app-senha-por-link modo="convite" [token]="token()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefinirSenha {
  /** Token do convite (query `token`). */
  readonly token = input<string | null>(null);
}
