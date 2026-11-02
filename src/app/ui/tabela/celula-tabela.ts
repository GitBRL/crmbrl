import { Directive, inject, input, TemplateRef } from '@angular/core';

/** Contexto do modelo de célula: `let-linha` (ou `let-x="linha"`), `let-i="indice"`. */
export interface ContextoCelula<T> {
  readonly $implicit: T;
  readonly linha: T;
  readonly indice: number;
}

/**
 * Modelo de uma célula da `app-tabela`, pelo id da coluna. Sem modelo, a célula mostra
 * `linha[coluna.id]` como texto. `[appCelulaDe]` só serve para tipar o `let-` com o tipo da
 * linha (o valor não é usado):
 *
 * ```html
 * <ng-template appCelula="nome" [appCelulaDe]="contatos()" let-contato>
 *   <app-avatar [nome]="contato.nome" tamanho="sm" decorativo /> {{ contato.nome }}
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[appCelula]' })
export class CelulaTabela<T = unknown> {
  readonly coluna = input.required<string>({ alias: 'appCelula' });
  readonly de = input<readonly T[] | null | undefined>(undefined, { alias: 'appCelulaDe' });
  readonly modelo = inject<TemplateRef<ContextoCelula<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _diretiva: CelulaTabela<T>,
    contexto: unknown,
  ): contexto is ContextoCelula<T> {
    return true;
  }
}
