import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { LucideSearch, LucideX } from '@lucide/angular';

import { gerarId } from '../tipos';

/**
 * Campo de busca (DESIGN-SYSTEM.md §4): pílula 44px com ícone `search`, dentro de um
 * `<form role="search">`. `[(valor)]` acompanha o texto; `(buscar)` sai no Enter.
 * O rótulo existe para leitores de tela (visualmente oculto) e também dá nome ao marco de
 * busca ("Buscar no CRM"): com mais de um `search` na página, cada um tem o seu.
 */
@Component({
  selector: 'app-campo-busca',
  imports: [LucideSearch, LucideX],
  template: `
    <form
      class="campo-busca"
      role="search"
      [attr.aria-label]="rotulo()"
      (submit)="aoEnviar($event)"
    >
      <label class="visualmente-oculto" [for]="id">{{ rotulo() }}</label>
      <svg lucideSearch class="campo-busca__lupa" [size]="18" />
      <input
        #campo
        class="campo-busca__campo"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        [id]="id"
        [value]="valor()"
        [placeholder]="placeholder()"
        (input)="aoDigitar($event)"
        (keydown.escape)="limpar()"
      />
      @if (valor()) {
        <button
          type="button"
          class="campo-busca__limpar"
          aria-label="Limpar busca"
          (click)="limpar()"
        >
          <svg lucideX [size]="16" />
        </button>
      }
    </form>
  `,
  styleUrl: './campo-busca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-busca-host' },
})
export class CampoBusca {
  readonly valor = model('');
  readonly rotulo = input('Buscar');
  readonly placeholder = input('Buscar…');
  /** Enter no campo. */
  readonly buscar = output<string>();

  protected readonly id = gerarId('busca');
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  focar(): void {
    this.campo().nativeElement.focus();
  }

  protected aoDigitar(evento: Event): void {
    this.valor.set((evento.target as HTMLInputElement).value);
  }

  protected aoEnviar(evento: Event): void {
    evento.preventDefault();
    this.buscar.emit(this.valor().trim());
  }

  protected limpar(): void {
    this.valor.set('');
    this.focar();
  }
}
