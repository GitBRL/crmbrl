import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideLockKeyhole } from '@lucide/angular';

import { moduloPorRota } from '../nucleo/navegacao';
import { listarPapeis } from '../nucleo/papeis';
import { SessaoService } from '../nucleo/sessao/sessao.service';
import { Botao } from '../ui/botao/botao';
import { Cartao } from '../ui/cartao/cartao';

/**
 * Página "sem acesso" (`/sem-acesso?pagina=<rota negada>`), para onde as guardas mandam
 * quando o papel ou as permissões não liberam a página. Diz o que foi negado, quem acessa
 * e o que fazer.
 */
@Component({
  selector: 'app-sem-acesso',
  imports: [RouterLink, Botao, Cartao, LucideLockKeyhole],
  template: `
    <app-cartao variante="palco" class="sem-acesso">
      <span class="sem-acesso__icone" aria-hidden="true">
        <svg lucideLockKeyhole [size]="34" [strokeWidth]="1.5" />
      </span>
      <h1 class="texto-display sem-acesso__titulo">
        @if (modulo(); as modulo) {
          {{ modulo.rotulo }}&nbsp;<span class="tom-fraco">· </span
          ><span class="tom-fraco sem-quebra">sem acesso</span>
        } @else {
          Sem acesso
        }
      </h1>
      <p class="sem-acesso__texto">
        @if (sessao.rotuloPapel(); as papel) {
          O seu papel, <strong>{{ papel }}</strong
          >, não acessa esta página.
        } @else {
          Você não tem acesso a esta página.
        }
        @if (quemAcessa(); as quem) {
          Quem acessa: {{ quem }}.
        }
      </p>
      <p class="sem-acesso__texto">
        Se você precisa dela no seu trabalho, peça a um Admin do CRM para revisar o seu papel.
      </p>
      <div class="sem-acesso__acoes">
        <a appBotao variante="invertido" routerLink="/inicio" [icone]="voltar">
          Ir para a visão geral
        </a>
      </div>
    </app-cartao>
  `,
  styles: `
    :host {
      display: block;
    }

    .sem-acesso {
      display: block;
      max-width: 52rem;
    }

    .sem-acesso__icone {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      margin-bottom: var(--esp-6);
      border-radius: 50%;
      background: var(--cor-vidro-forte);
      color: var(--cor-texto);
    }

    .sem-acesso__titulo {
      margin-bottom: var(--esp-4);
    }

    .sem-acesso__texto {
      max-width: 40rem;
      margin-bottom: var(--esp-3);
      color: var(--cor-texto-suave);
      font: var(--fonte-lead);

      strong {
        color: var(--cor-texto);
        font-weight: 500;
      }
    }

    .sem-acesso__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      margin-top: var(--esp-6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemAcesso {
  /** A rota negada (query `pagina`). */
  readonly pagina = input<string | null>(null);

  protected readonly sessao = inject(SessaoService);
  protected readonly voltar = LucideArrowLeft;
  protected readonly modulo = computed(() => moduloPorRota(this.pagina()));
  /** Só quando o módulo inteiro é negado (dentro de um módulo, quem decide é a seção). */
  protected readonly quemAcessa = computed(() => {
    const modulo = this.modulo();
    if (!modulo || this.sessao.pode(modulo)) {
      return null;
    }
    return listarPapeis(modulo.papeis);
  });
}
