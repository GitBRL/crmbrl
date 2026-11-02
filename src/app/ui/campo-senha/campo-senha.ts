import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

import { CampoBase } from '../campo/campo-base';
import { MolduraCampo } from '../campo/moldura-campo';

/**
 * Campo de senha (DESIGN-SYSTEM.md §4.2): o campo de texto com um botão de mostrar/ocultar
 * (`aria-pressed`, o nome diz a ação) e um aviso de Caps Lock ligado enquanto o campo está
 * focado. `autocomplete` padrão `current-password`; na troca de senha use `new-password`.
 *
 * `<app-campo-senha rotulo="Senha" formControlName="senha" />`
 */
@Component({
  selector: 'app-campo-senha',
  imports: [MolduraCampo, LucideEye, LucideEyeOff],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idDica]="idDica"
      [idErro]="idErro"
      [dica]="dica()"
      [erro]="mensagemErro()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
      [rotuloOculto]="rotuloOculto()"
    >
      <div
        class="controle"
        [class.controle--invalido]="!!mensagemErro()"
        [class.controle--desabilitado]="estaDesabilitado()"
      >
        <input
          #campo
          class="controle__campo"
          autocapitalize="off"
          spellcheck="false"
          [id]="id"
          [type]="visivel() ? 'text' : 'password'"
          [attr.name]="nome()"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-required]="requerido() || null"
          [disabled]="estaDesabilitado()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (input)="aoDigitar($event)"
          (keydown)="verificarCapsLock($event)"
          (keyup)="verificarCapsLock($event)"
          (blur)="aoSair()"
        />
        <button
          type="button"
          class="controle__mostrar"
          aria-label="Mostrar senha"
          [attr.aria-controls]="id"
          [attr.aria-pressed]="visivel()"
          [disabled]="estaDesabilitado()"
          (click)="visivel.set(!visivel())"
        >
          @if (visivel()) {
            <svg lucideEyeOff [size]="18" />
          } @else {
            <svg lucideEye [size]="18" />
          }
        </button>
      </div>
    </app-moldura-campo>
    <p class="caps" [id]="id + '-caps'" aria-live="polite">
      @if (capsLock()) {
        Caps Lock ligado: as letras saem maiúsculas.
      }
    </p>
  `,
  styleUrl: './campo-senha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-senha' },
})
export class CampoSenha extends CampoBase<string> {
  readonly valor = model('');
  readonly nome = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  /** `current-password` (entrar) ou `new-password` (criar/trocar). */
  readonly autocomplete = input<'current-password' | 'new-password' | 'off'>('current-password');

  /** A senha está à mostra (o botão alterna). */
  readonly visivel = signal(false);
  protected readonly capsLock = signal(false);

  constructor() {
    super();
    this.sincronizarTexto((valor) => valor);
  }

  protected override normalizar(valor: unknown): string {
    return valor === null || valor === undefined ? '' : String(valor);
  }

  protected override idsDescricaoExtra(): readonly string[] {
    return this.capsLock() ? [`${this.id}-caps`] : [];
  }

  protected aoDigitar(evento: Event): void {
    this.lerDoCampo((evento.target as HTMLInputElement).value);
  }

  protected verificarCapsLock(evento: KeyboardEvent): void {
    if (typeof evento.getModifierState === 'function') {
      this.capsLock.set(evento.getModifierState('CapsLock'));
    }
  }

  protected aoSair(): void {
    this.capsLock.set(false);
    this.tocar();
  }
}
