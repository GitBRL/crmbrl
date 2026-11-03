import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * As duas abas do Atendimento (Onda E, E4): **Conversas** (`/atendimento`) e **Ligações**
 * (`/atendimento/ligacoes`, o histórico com busca nas transcrições). São links de verdade, para
 * funcionarem com o teclado e com o botão de voltar do navegador.
 */
@Component({
  selector: 'app-abas-atendimento',
  imports: [RouterLink],
  template: `
    <nav class="abas" aria-label="Seções do Atendimento">
      <a
        class="abas__item"
        routerLink="/atendimento"
        [attr.aria-current]="ativa() === 'conversas' ? 'page' : null"
        >Conversas</a
      >
      <a
        class="abas__item"
        routerLink="/atendimento/ligacoes"
        [attr.aria-current]="ativa() === 'ligacoes' ? 'page' : null"
        >Ligações</a
      >
    </nav>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .abas {
      display: inline-flex;
      gap: var(--esp-1);
      padding: var(--esp-1);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
      box-shadow: inset 0 0 0 1px var(--cor-borda);
    }
    .abas__item {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 var(--esp-4);
      border-radius: var(--raio-md);
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      text-decoration: none;
      transition:
        background-color var(--duracao) var(--curva),
        color var(--duracao) var(--curva);

      &:hover {
        background: var(--cor-vidro);
        color: var(--cor-texto);
      }
      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: 1px;
      }
      &[aria-current='page'] {
        background: var(--cor-inverso);
        color: var(--cor-sobre-inverso);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbasAtendimento {
  readonly ativa = input.required<'conversas' | 'ligacoes'>();
}
