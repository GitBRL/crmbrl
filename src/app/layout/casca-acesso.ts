import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AvisosService } from '../nucleo/avisos.service';
import { Avisos } from '../ui/avisos/avisos';
import { Confirmacao } from './confirmacao';
import { provideIcones } from './icones';

/**
 * Moldura das telas de acesso (`/entrar`, `/trocar-senha`, `/esqueci-senha`,
 * `/redefinir-senha`, `/definir-senha`), fora da casca: só o `<main>` (as telas não criam
 * outro), os avisos e o modal de confirmação. A cada troca de tela o foco vai para o `<main>`, para o
 * leitor de tela anunciar a página nova.
 */
@Component({
  selector: 'app-casca-acesso',
  imports: [RouterOutlet, Avisos, Confirmacao],
  providers: [provideIcones()],
  template: `
    <main #conteudo id="conteudo" class="casca-acesso" tabindex="-1">
      <router-outlet />
    </main>
    <app-confirmacao />
    <app-avisos
      [avisos]="avisos.lista()"
      (dispensar)="avisos.dispensar($event)"
      (agir)="avisos.agir($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }

    .casca-acesso {
      min-height: 100dvh;
      outline: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CascaAcesso {
  protected readonly avisos = inject(AvisosService);
  private readonly conteudo = viewChild.required<ElementRef<HTMLElement>>('conteudo');

  constructor() {
    let anterior: string | null = null;
    inject(Router)
      .events.pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => {
        const caminho = evento.urlAfterRedirects.split(/[?#]/)[0];
        if (anterior !== null && caminho !== anterior) {
          this.conteudo().nativeElement.focus({ preventScroll: true });
        }
        anterior = caminho;
      });
  }
}
