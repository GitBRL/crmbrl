import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { LucideCheck } from '@lucide/angular';

import { CampoBase } from '../campo/campo-base';
import { Dica } from '../dica/dica';

/**
 * Alternador (DESIGN-SYSTEM.md §4.2): liga/desliga com efeito imediato ("Participa do
 * rodízio", "Passagem ativa"). É um `<input type="checkbox" role="switch">`: o leitor de tela
 * diz "ligado/desligado". O rótulo e a descrição (`dica`) ficam à esquerda e o trilho à
 * direita, numa linha de 44px. Ligado, o trilho fica **invertido** e a bolinha vai para a
 * direita com um visto (não depende de cor).
 *
 * `<app-alternador rotulo="Participa do rodízio" formControlName="noRodizio" />`
 */
@Component({
  selector: 'app-alternador',
  imports: [Dica, LucideCheck],
  template: `
    <div class="alternador">
      <span class="alternador__topo" [class.visualmente-oculto]="rotuloOculto()">
        <label class="alternador__rotulo" [for]="id">{{ rotulo() }}</label>
        @if (ajuda(); as texto) {
          <app-dica [rotulo]="'Sobre ' + rotulo()" [texto]="texto" />
        }
      </span>
      <label class="alternador__trilho" [for]="id">
        <input
          #campo
          type="checkbox"
          role="switch"
          class="alternador__input"
          [id]="id"
          [attr.name]="nome()"
          [checked]="valor()"
          [disabled]="estaDesabilitado()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (change)="aoMudar($event)"
          (blur)="tocar()"
        />
        <span class="alternador__bolinha" aria-hidden="true">
          <svg lucideCheck class="alternador__visto" [size]="12" [strokeWidth]="3" />
        </span>
      </label>
      @if (dica(); as texto) {
        <p class="alternador__dica" [id]="idDica">{{ texto }}</p>
      }
      @if (mensagemErro(); as mensagem) {
        <p class="alternador__erro" [id]="idErro">{{ mensagem }}</p>
      }
    </div>
  `,
  styleUrl: './alternador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'alternador-host',
    '[class.alternador-host--desabilitado]': 'estaDesabilitado()',
  },
})
export class Alternador extends CampoBase<boolean> {
  readonly valor = model(false);
  readonly nome = input<string | null>(null);

  protected override normalizar(valor: unknown): boolean {
    return valor === true;
  }

  protected aoMudar(evento: Event): void {
    this.definirValor((evento.target as HTMLInputElement).checked);
    // Efeito imediato: conta como tocado na hora (o erro, se houver, aparece já).
    this.tocar();
  }
}
