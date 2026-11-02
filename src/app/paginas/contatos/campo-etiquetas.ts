import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';

import { CampoBase } from '../../ui/campo/campo-base';
import { MolduraCampo } from '../../ui/campo/moldura-campo';

/** Etiqueta como a API grava (R4.7): aparada, com espaços simples. */
export function limparEtiqueta(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** Acrescenta etiquetas sem repetir (sem diferenciar maiúsculas). */
export function juntarEtiquetas(atuais: readonly string[], novas: readonly string[]): string[] {
  const resultado = [...atuais];
  for (const nova of novas.map(limparEtiqueta).filter(Boolean)) {
    if (!resultado.some((etiqueta) => etiqueta.toLowerCase() === nova.toLowerCase())) {
      resultado.push(nova);
    }
  }
  return resultado;
}

/**
 * Etiquetas livres (R4.7): cada etiqueta vira um selo com botão de remover; digite e tecle
 * Enter (ou vírgula) para acrescentar, Backspace no campo vazio tira a última. As etiquetas
 * em uso aparecem como sugestões (`<datalist>` nativo). Funciona com `formControlName`.
 */
@Component({
  selector: 'app-campo-etiquetas',
  imports: [MolduraCampo, LucideX],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idDica]="idDica"
      [idErro]="idErro"
      [dica]="
        dica() ??
        'Tecle Enter ou vírgula para acrescentar. As etiquetas em uso aparecem enquanto você digita.'
      "
      [erro]="mensagemErro()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
      [rotuloOculto]="rotuloOculto()"
    >
      <div
        class="etiquetas"
        [class.etiquetas--invalido]="!!mensagemErro()"
        [class.etiquetas--desabilitado]="estaDesabilitado()"
      >
        <ul class="etiquetas__lista" [attr.aria-label]="'Etiquetas escolhidas: ' + valor().length">
          @for (etiqueta of valor(); track etiqueta) {
            <li class="etiquetas__item">
              <span>{{ etiqueta }}</span>
              <button
                type="button"
                class="etiquetas__remover"
                [attr.aria-label]="'Remover a etiqueta ' + etiqueta"
                [disabled]="estaDesabilitado()"
                (click)="remover(etiqueta)"
              >
                <svg lucideX [size]="14" />
              </button>
            </li>
          }
        </ul>
        <input
          #campo
          class="etiquetas__campo"
          type="text"
          autocomplete="off"
          enterkeyhint="done"
          [id]="id"
          [attr.list]="idSugestoes"
          [attr.placeholder]="valor().length ? null : (placeholder() ?? 'Ex.: VIP, Evento 2026')"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          [disabled]="estaDesabilitado()"
          [value]="texto()"
          (input)="aoDigitar($event)"
          (keydown)="aoTeclar($event)"
          (blur)="aoSair()"
        />
        <datalist [id]="idSugestoes">
          @for (sugestao of sugestoesLivres(); track sugestao) {
            <option [value]="sugestao"></option>
          }
        </datalist>
      </div>
    </app-moldura-campo>
  `,
  styleUrl: './campo-etiquetas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-etiquetas' },
})
export class CampoEtiquetas extends CampoBase<readonly string[]> {
  readonly valor = model<readonly string[]>([]);
  readonly placeholder = input<string | null>(null);
  /** Etiquetas em uso, para sugerir. */
  readonly sugestoes = input<readonly string[]>([]);

  protected readonly idSugestoes = `${this.id}-sugestoes`;
  protected readonly texto = signal('');

  protected readonly sugestoesLivres = computed(() => {
    const escolhidas = new Set(this.valor().map((etiqueta) => etiqueta.toLowerCase()));
    return this.sugestoes().filter((sugestao) => !escolhidas.has(sugestao.toLowerCase()));
  });

  protected override normalizar(valor: unknown): readonly string[] {
    return Array.isArray(valor) ? juntarEtiquetas([], valor.map(String)) : [];
  }

  protected aoDigitar(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    // Vírgula (digitada ou colada) separa etiquetas.
    if (valor.includes(',')) {
      const partes = valor.split(',');
      const resto = partes.pop() ?? '';
      this.acrescentar(partes);
      this.texto.set(resto);
      (evento.target as HTMLInputElement).value = resto;
      return;
    }
    this.texto.set(valor);
    // Escolha numa sugestão do datalist: acrescenta na hora.
    const tipo = (evento as InputEvent).inputType;
    if (
      (tipo === undefined || tipo === 'insertReplacementText') &&
      this.sugestoes().some((sugestao) => sugestao === valor)
    ) {
      this.confirmarTexto();
    }
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') {
      if (this.texto().trim()) {
        evento.preventDefault();
        this.confirmarTexto();
      }
      return;
    }
    if (evento.key === 'Backspace' && !this.texto() && this.valor().length) {
      this.remover(this.valor()[this.valor().length - 1]);
    }
  }

  protected aoSair(): void {
    this.confirmarTexto();
    this.tocar();
  }

  protected remover(etiqueta: string): void {
    this.definirValor(this.valor().filter((item) => item !== etiqueta));
  }

  private confirmarTexto(): void {
    if (this.texto().trim()) {
      this.acrescentar([this.texto()]);
    }
    this.texto.set('');
    const campo = this.campo()?.nativeElement as HTMLInputElement | undefined;
    if (campo) {
      campo.value = '';
    }
  }

  private acrescentar(novas: readonly string[]): void {
    const juntas = juntarEtiquetas(this.valor(), novas);
    if (juntas.length !== this.valor().length) {
      this.definirValor(juntas);
    }
  }
}
