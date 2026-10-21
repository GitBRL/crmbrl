import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideHouse } from '@lucide/angular';
import { filter, map } from 'rxjs';

import { Botao } from '../../ui/botao/botao';
import { Cartao } from '../../ui/cartao/cartao';

/**
 * Página 404: as cápsulas sobrepostas da paleta (ciano, menta e lima) formam o "404", e um
 * botão leva à visão geral. O endereço procurado aparece no texto e acompanha a navegação:
 * o componente é reaproveitado de um endereço inexistente para outro.
 */
@Component({
  selector: 'app-nao-encontrada',
  imports: [RouterLink, Botao, Cartao],
  template: `
    <app-cartao variante="palco" class="nao-encontrada">
      <div class="capsulas" aria-hidden="true">
        <span class="capsula capsula--1">4</span>
        <span class="capsula capsula--2">0</span>
        <span class="capsula capsula--3">4</span>
      </div>
      <h1 class="texto-display">
        Página não encontrada&nbsp;<span class="tom-fraco">· </span
        ><span class="tom-fraco sem-quebra">404</span>
      </h1>
      <p class="nao-encontrada__texto">
        O endereço <code class="nao-encontrada__caminho">{{ caminho() }}</code> não existe ou mudou
        de lugar. Use o menu para chegar ao módulo que procura ou volte para a visão geral.
      </p>
      <a appBotao variante="invertido" routerLink="/inicio" [icone]="iconeInicio"
        >Ir para a visão geral</a
      >
    </app-cartao>
  `,
  styles: `
    @use 'mixins' as m;

    // A largura das outras páginas: o cartão ocupa o conteúdo, como os palcos; o texto
    // continua limitado a 52ch.
    :host {
      display: block;
      max-width: var(--largura-pagina, 1600px);
    }

    .nao-encontrada {
      display: grid;
      justify-items: start;
      gap: var(--esp-5);
      padding-block: var(--esp-12);
    }

    // Cápsulas como as da paleta oficial: a do meio (menta) por cima das vizinhas.
    .capsulas {
      --_altura: 88px;

      display: flex;
      margin-bottom: var(--esp-4);
    }

    .capsula {
      display: flex;
      align-items: center;
      width: calc(var(--_altura) * 1.9);
      height: var(--_altura);
      padding-inline: calc(var(--_altura) * 0.42);
      border-radius: var(--raio-pilula);
      color: var(--pb-preto);
      font: var(--fonte-numero);
      font-variant-numeric: tabular-nums;
    }

    .capsula--1 {
      background: var(--dado-1);
    }

    .capsula--2 {
      position: relative;
      justify-content: center;
      margin-inline: calc(var(--_altura) * -0.5);
      background: var(--dado-2-gradiente);
    }

    .capsula--3 {
      justify-content: flex-end;
      background: var(--dado-3);
    }

    .nao-encontrada__texto {
      max-width: 52ch;
      color: var(--cor-texto-suave);
      font: var(--fonte-lead, 400 1.0625rem/1.5 var(--familia));
    }

    .nao-encontrada__caminho {
      padding: 2px 8px;
      border-radius: var(--raio-pilula);
      background: var(--cor-vidro-forte);
      color: var(--cor-texto);
      font-size: 0.875em;
      overflow-wrap: anywhere;
    }

    @include m.abaixo(m.$sm) {
      .nao-encontrada {
        padding-block: var(--esp-8);
      }

      .capsulas {
        --_altura: 60px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaoEncontrada {
  private readonly router = inject(Router);
  protected readonly iconeInicio = LucideHouse;
  /** O endereço que levou até aqui (atualizado a cada navegação). */
  protected readonly caminho = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
}
