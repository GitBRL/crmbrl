import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import { regrasDaSenha } from './senha';

/**
 * Requisitos da senha nova, visíveis e conferidos enquanto a pessoa digita (TELAS §1.2): cada
 * item ganha um visto quando é atendido — o estado também está no texto (não depende de cor).
 * Para o leitor de tela, um resumo educado ("2 de 3 requisitos atendidos") muda só quando a
 * contagem muda, sem anunciar cada tecla.
 *
 * `<app-regras-senha [nova]="nova()" [confirmacao]="confirmacao()" />`
 * Na troca de senha, passe `[atual]` para incluir "Diferente da senha atual".
 */
@Component({
  selector: 'app-regras-senha',
  imports: [LucideCheck],
  template: `
    <p class="regras__titulo" id="regras-senha-titulo">A nova senha precisa ter:</p>
    <ul class="regras__lista" aria-labelledby="regras-senha-titulo">
      @for (regra of regras(); track regra.id) {
        <li class="regra" [class.regra--ok]="regra.atendida">
          <span class="regra__marca" aria-hidden="true">
            @if (regra.atendida) {
              <svg lucideCheck [size]="12" [strokeWidth]="3" />
            }
          </span>
          <span
            >{{ regra.texto
            }}<span class="visualmente-oculto">{{
              regra.atendida ? ': atendido' : ': falta'
            }}</span></span
          >
        </li>
      }
    </ul>
    <p class="regras__dica">
      Dica: uma frase que só você conhece é fácil de lembrar e difícil de adivinhar.
    </p>
    <p class="visualmente-oculto" aria-live="polite">{{ resumo() }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-2);
      padding: var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .regras__titulo {
      margin: 0;
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .regras__dica {
      margin: var(--esp-1) 0 0;
      padding-top: var(--esp-3);
      border-top: 1px solid var(--cor-borda);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .regras__lista {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .regra {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
      transition: color var(--duracao) var(--curva);
    }

    .regra--ok {
      color: var(--cor-texto);
    }

    /* Pendente: círculo vazado (borda com 3:1). Atendido: círculo invertido com o visto. */
    .regra__marca {
      display: grid;
      flex: none;
      place-items: center;
      width: 18px;
      height: 18px;
      border: 1.5px solid var(--cor-texto-fraco);
      border-radius: 50%;
      transition:
        background-color var(--duracao) var(--curva),
        border-color var(--duracao) var(--curva);
    }

    .regra--ok .regra__marca {
      border-color: var(--cor-inverso);
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
    }

    @media (forced-colors: active) {
      .regra--ok .regra__marca {
        border-color: CanvasText;
        background: CanvasText;
        color: Canvas;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'regras' },
})
export class RegrasSenha {
  readonly nova = input('');
  readonly confirmacao = input('');
  /**
   * Senha atual, na troca de senha (`null` enquanto não digitada). Sem este input (definir e
   * redefinir senha), a regra "Diferente da senha atual" não aparece.
   */
  readonly atual = input<string | null | undefined>(undefined);

  protected readonly regras = computed(() =>
    regrasDaSenha(this.nova(), this.confirmacao(), this.atual()),
  );

  protected readonly resumo = computed(() => {
    const regras = this.regras();
    const atendidas = regras.filter((regra) => regra.atendida).length;
    if (!this.nova() && !this.confirmacao()) {
      return '';
    }
    return atendidas === regras.length
      ? 'A senha atende a todos os requisitos.'
      : `${atendidas} de ${regras.length} requisitos atendidos.`;
  });
}
