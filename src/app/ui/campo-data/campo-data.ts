import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { CampoBase } from '../campo/campo-base';
import { MolduraCampo } from '../campo/moldura-campo';

/** `data` → `aaaa-mm-dd` · `data-hora` → `aaaa-mm-ddTHH:mm` · `hora` → `HH:mm` (hora local). */
export type TipoCampoData = 'data' | 'data-hora' | 'hora';

const TIPO_NATIVO: Readonly<Record<TipoCampoData, string>> = {
  data: 'date',
  'data-hora': 'datetime-local',
  hora: 'time',
};

/**
 * Data e hora (DESIGN-SYSTEM.md §4.2): o `<input type="date|datetime-local|time">` nativo
 * na pílula (calendário e relógio do sistema, teclado e leitor de tela completos). O valor
 * é o texto local do próprio input (`2026-10-21`, `2026-10-21T10:00`, `10:00`) ou `null`;
 * para a API (ISO em UTC), converta com `localParaIso` e `isoParaLocal`.
 *
 * `<app-campo-data rotulo="Previsão de fechamento" formControlName="previsao" />`
 */
@Component({
  selector: 'app-campo-data',
  imports: [MolduraCampo],
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
        [class.controle--vazio]="!valor()"
      >
        <input
          #campo
          class="controle__campo"
          [id]="id"
          [type]="tipoNativo()"
          [attr.name]="nome()"
          [attr.min]="minimo()"
          [attr.max]="maximo()"
          [attr.step]="passo()"
          [attr.aria-required]="requerido() || null"
          [disabled]="estaDesabilitado()"
          [attr.aria-invalid]="mensagemErro() ? true : null"
          [attr.aria-describedby]="descricao()"
          (input)="aoMudar($event)"
          (change)="aoMudar($event)"
          (blur)="tocar()"
        />
      </div>
    </app-moldura-campo>
  `,
  styleUrl: './campo-data.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-data' },
})
export class CampoData extends CampoBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly tipo = input<TipoCampoData>('data');
  readonly nome = input<string | null>(null);
  /** Limites no mesmo formato do valor. */
  readonly minimo = input<string | null>(null);
  readonly maximo = input<string | null>(null);
  /** Passo em segundos para hora (`900` = de 15 em 15 minutos). */
  readonly passo = input<number | null>(null);

  protected readonly tipoNativo = computed(() => TIPO_NATIVO[this.tipo()]);

  constructor() {
    super();
    this.sincronizarTexto((valor) => valor ?? '');
  }

  protected override normalizar(valor: unknown): string | null {
    return typeof valor === 'string' && valor !== '' ? valor : null;
  }

  protected aoMudar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    // Data pela metade (um pedaço apagado): ainda sem valor, sem reescrever o que está lá.
    const valor = campo.value === '' || campo.validity?.badInput ? null : campo.value;
    if (valor !== this.valor()) {
      this.lerDoCampo(valor);
    }
  }
}

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

/**
 * Valor local do campo → ISO em UTC para a API. `data` vira a meia-noite local daquele dia;
 * `hora` não tem data e volta como está. Texto inválido → `null`.
 */
export function localParaIso(valor: string | null, tipo: TipoCampoData = 'data'): string | null {
  if (!valor) {
    return null;
  }
  if (tipo === 'hora') {
    return valor;
  }
  const data = new Date(tipo === 'data' ? `${valor}T00:00` : valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/** ISO (UTC) da API → valor local do campo, no fuso do navegador. */
export function isoParaLocal(iso: string | null, tipo: TipoCampoData = 'data'): string | null {
  if (!iso) {
    return null;
  }
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return null;
  }
  const dia = `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
  const hora = `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
  return tipo === 'data' ? dia : tipo === 'hora' ? hora : `${dia}T${hora}`;
}
