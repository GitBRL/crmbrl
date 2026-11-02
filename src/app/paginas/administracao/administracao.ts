import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { SECOES_ADMINISTRACAO } from './secoes';

/**
 * Administração (`/administracao`, Admin e C-level) — TELAS-FASE1 §8: o título, a frase de
 * propósito, as abas que o papel acessa (auditoria, logs técnicos, dúvidas à IA, saúde do
 * sistema) e a aba
 * aberta no `<router-outlet>`.
 */
@Component({
  selector: 'app-administracao',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="moldura__cabecalho">
      <div class="moldura__titulos">
        <h1 class="texto-display">Administração</h1>
        <p class="moldura__frase">{{ frase() }}</p>
      </div>
      <nav class="moldura__secoes rolagem-horizontal" aria-label="Seções da administração">
        @for (secao of secoes(); track secao.caminho) {
          <a
            class="moldura__secao"
            routerLinkActive="moldura__secao--ativa"
            ariaCurrentWhenActive="page"
            [routerLink]="secao.caminho"
            >{{ secao.rotulo }}</a
          >
        }
      </nav>
    </header>
    <router-outlet />
  `,
  styleUrl: '../integracoes/moldura.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Administracao {
  private readonly sessao = inject(SessaoService);

  protected readonly secoes = computed(() =>
    SECOES_ADMINISTRACAO.filter((secao) => this.sessao.permite(secao.permite)),
  );
  protected readonly frase = computed(() =>
    this.secoes().some((secao) => secao.caminho === 'saude')
      ? 'Quem fez o quê no CRM e a saúde do sistema, para conferir e investigar.'
      : 'Quem fez o quê no CRM, para conferir e investigar.',
  );
}
