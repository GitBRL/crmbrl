import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideCheck,
  LucideDynamicIcon,
  LucideInfo,
  LucideLockKeyhole,
  LucideX,
  type LucideIconInput,
} from '@lucide/angular';

/**
 * `erro` (falhou: credenciais, servidor), `bloqueio` (conta desativada, muitas tentativas),
 * `atencao` (explicação importante, como a troca obrigatória), `info` e `sucesso`.
 */
export type TipoAvisoAcesso = 'erro' | 'bloqueio' | 'atencao' | 'info' | 'sucesso';

const ICONES: Readonly<Record<TipoAvisoAcesso, LucideIconInput>> = {
  erro: LucideX,
  bloqueio: LucideLockKeyhole,
  atencao: LucideInfo,
  info: LucideInfo,
  sucesso: LucideCheck,
};

/**
 * Aviso dentro do cartão de acesso, no lugar onde o problema acontece (acima do botão), com
 * o mesmo círculo de tipo dos avisos flutuantes. Erro e bloqueio são anunciados na hora
 * (`role="alert"`); os outros, de forma educada (`role="status"`).
 *
 * `<app-aviso-acesso tipo="bloqueio" titulo="Acesso bloqueado por 15 minutos">…</app-aviso-acesso>`
 */
@Component({
  selector: 'app-aviso-acesso',
  imports: [LucideDynamicIcon],
  template: `
    <span class="aviso-acesso__icone" aria-hidden="true">
      <svg [lucideIcon]="icone()" [size]="16" [strokeWidth]="2" />
    </span>
    <div class="aviso-acesso__textos">
      @if (titulo(); as texto) {
        <p class="aviso-acesso__titulo">{{ texto }}</p>
      }
      <div class="aviso-acesso__mensagem"><ng-content /></div>
      @if (codigo(); as id) {
        <p class="aviso-acesso__codigo">
          Código para o suporte: <span class="numeros">{{ id }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      --_cor: var(--dado-1);
      --_sobre: var(--pb-preto);

      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: var(--esp-3);
      padding: var(--esp-3) var(--esp-4) var(--esp-3) var(--esp-3);
      border: 1px solid color-mix(in srgb, var(--_cor) 45%, transparent);
      border-radius: var(--raio-lg);
      background: color-mix(in srgb, var(--_cor) 10%, var(--cor-superficie));
      color: var(--cor-texto);
    }

    :host(.aviso-acesso--erro),
    :host(.aviso-acesso--bloqueio) {
      --_cor: var(--cor-erro);
      --_sobre: var(--cor-sobre-erro);
    }

    :host(.aviso-acesso--atencao) {
      --_cor: var(--dado-3);
    }

    :host(.aviso-acesso--sucesso) {
      --_cor: var(--dado-2);
    }

    /* No claro, lima e menta claros demais para a borda: contorno de dado (§2.2). */
    :host(.aviso-acesso--atencao),
    :host(.aviso-acesso--sucesso),
    :host(.aviso-acesso--info) {
      border-color: color-mix(in srgb, var(--_cor) 45%, var(--cor-borda-forte));
    }

    .aviso-acesso__icone {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--_cor);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
      color: var(--_sobre);
    }

    .aviso-acesso__textos {
      display: grid;
      gap: var(--esp-1);
      padding-top: 3px;
    }

    .aviso-acesso__titulo {
      margin: 0;
      font: var(--fonte-rotulo);
      line-height: 1.4;
    }

    .aviso-acesso__mensagem {
      font: var(--fonte-corpo-sm);
    }

    .aviso-acesso__mensagem :is(p, ul) {
      margin: 0;
    }

    .aviso-acesso__mensagem > * + * {
      margin-top: var(--esp-1);
    }

    .aviso-acesso__codigo {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'aviso-acesso',
    '[class]': "'aviso-acesso--' + tipo()",
    '[attr.role]': 'papel()',
  },
})
export class AvisoAcesso {
  readonly tipo = input<TipoAvisoAcesso>('erro');
  readonly titulo = input<string | null>(null);
  /** Id da requisição (erros do servidor), para a TI achar nos logs. */
  readonly codigo = input<string | null>(null);

  protected readonly icone = computed(() => ICONES[this.tipo()]);
  protected readonly papel = computed(() =>
    this.tipo() === 'erro' || this.tipo() === 'bloqueio' ? 'alert' : 'status',
  );
}
