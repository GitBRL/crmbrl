import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { LucideGlobe, LucidePlus, LucideX } from '@lucide/angular';

import { CampoBase } from '../../../../ui/campo/campo-base';
import { MolduraCampo } from '../../../../ui/campo/moldura-campo';
import { DOMINIOS_POR_CANAL } from '../canais.modelos';
import { normalizarDominio } from './widget';

/**
 * Os sites onde o chat pode aparecer (R14: CORS e origem do Socket.IO). Digite o endereço e
 * tecle Enter (ou "Adicionar"): ele vira a origem que o navegador manda
 * (`www.site.com.br/contato` → `https://www.site.com.br`), sem repetir; endereço que não serve
 * fica no campo com o motivo. Funciona com `formControlName`.
 */
@Component({
  selector: 'app-campo-dominios',
  imports: [MolduraCampo, LucideGlobe, LucidePlus, LucideX],
  template: `
    <app-moldura-campo
      [rotulo]="rotulo()"
      [paraId]="id"
      [idDica]="idDica"
      [idErro]="idErro"
      [dica]="dica()"
      [erro]="problema() ?? mensagemErro()"
      [ajuda]="ajuda()"
      [opcional]="opcional()"
      [rotuloOculto]="rotuloOculto()"
    >
      <div class="dominios">
        <div
          class="dominios__entrada"
          [class.dominios__entrada--invalida]="!!(problema() ?? mensagemErro())"
        >
          <input
            #campo
            class="dominios__campo"
            type="text"
            inputmode="url"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="done"
            [id]="id"
            [attr.placeholder]="placeholder()"
            [attr.aria-invalid]="problema() || mensagemErro() ? true : null"
            [attr.aria-describedby]="descricao()"
            [disabled]="estaDesabilitado() || cheio()"
            [value]="texto()"
            (input)="aoDigitar($event)"
            (keydown.enter)="adicionar($event)"
            (blur)="tocar()"
          />
          <button
            type="button"
            class="dominios__adicionar"
            [disabled]="estaDesabilitado() || !texto().trim()"
            (click)="adicionar()"
          >
            <svg lucidePlus [size]="16" />
            Adicionar
          </button>
        </div>
        @if (valor().length) {
          <ul class="dominios__lista" [attr.aria-label]="'Sites autorizados: ' + valor().length">
            @for (dominio of valor(); track dominio) {
              <li class="dominios__item">
                <svg lucideGlobe [size]="16" class="dominios__icone" />
                <span class="dominios__texto">{{ dominio }}</span>
                <button
                  type="button"
                  class="dominios__remover"
                  [attr.aria-label]="'Remover ' + dominio"
                  [disabled]="estaDesabilitado()"
                  (click)="remover(dominio)"
                >
                  <svg lucideX [size]="14" />
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="dominios__vazio">{{ textoVazio() }}</p>
        }
      </div>
    </app-moldura-campo>
  `,
  styles: `
    @use '../../../../ui/campo/campo' as c;

    :host {
      display: block;
      min-width: 0;
    }

    .dominios {
      display: grid;
      gap: var(--esp-3);
    }

    .dominios__entrada {
      @include c.controle;

      padding-inline-end: var(--esp-1);

      &.dominios__entrada--invalida {
        border-color: var(--cor-erro);
      }
    }

    .dominios__campo {
      flex: 1;
      min-width: 0;
      height: calc(var(--altura-md) - 2px);
      padding: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: inherit;
      font: var(--fonte-corpo);

      &::placeholder {
        color: var(--cor-texto-fraco);
      }
    }

    .dominios__adicionar {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--esp-1);
      height: 36px;
      padding: 0 var(--esp-3);
      border: 0;
      border-radius: var(--raio-pilula);
      background: var(--cor-inverso);
      color: var(--cor-sobre-inverso);
      font: var(--fonte-rotulo);
      cursor: pointer;

      &:disabled {
        opacity: 0.4;
        cursor: default;
      }

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: 2px;
      }
    }

    .dominios__lista {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .dominios__item {
      display: inline-flex;
      align-items: center;
      gap: var(--esp-2);
      min-width: 0;
      max-width: 100%;
      min-height: 36px;
      padding-inline: var(--esp-3) var(--esp-1);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-pilula);
      background: var(--cor-superficie-2);
      font: var(--fonte-corpo-sm);
    }

    .dominios__icone {
      flex: none;
      color: var(--cor-texto-suave);
    }

    .dominios__texto {
      min-width: 0;
      overflow-wrap: anywhere;
      font-family: var(--familia-mono);
      font-size: 13px;
    }

    .dominios__remover {
      position: relative;
      display: inline-grid;
      flex: none;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--cor-texto-suave);
      cursor: pointer;

      &::after {
        content: '';
        position: absolute;
        inset: -8px;
      }

      &:hover {
        background: var(--cor-superficie-3);
        color: var(--cor-texto);
      }

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: 1px;
      }
    }

    .dominios__vazio {
      padding-inline-start: var(--esp-4);
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'campo-dominios' },
})
export class CampoDominios extends CampoBase<readonly string[]> {
  readonly valor = model<readonly string[]>([]);
  readonly placeholder = input('www.seusite.com.br');
  readonly textoVazio = input('Nenhum site ainda: o chat só aparece nos sites desta lista.');

  protected readonly texto = signal('');
  /** O endereço digitado não serve (fica no campo, com o motivo). */
  protected readonly problema = signal<string | null>(null);
  protected readonly cheio = computed(() => this.valor().length >= DOMINIOS_POR_CANAL);

  protected override normalizar(valor: unknown): readonly string[] {
    return Array.isArray(valor) ? valor.map(String) : [];
  }

  protected aoDigitar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
    this.problema.set(null);
  }

  protected adicionar(evento?: Event): void {
    evento?.preventDefault();
    const digitado = this.texto().trim();
    if (!digitado) {
      return;
    }
    // Vários de uma vez, separados por vírgula, espaço ou linha.
    const partes = digitado.split(/[\s,;]+/).filter(Boolean);
    const novos = [...this.valor()];
    const recusados: string[] = [];
    for (const parte of partes) {
      const dominio = normalizarDominio(parte);
      if (!dominio) {
        recusados.push(parte);
        continue;
      }
      if (!novos.includes(dominio) && novos.length < DOMINIOS_POR_CANAL) {
        novos.push(dominio);
      }
    }
    if (novos.length !== this.valor().length) {
      this.definirValor(novos);
    }
    if (recusados.length) {
      this.texto.set(recusados.join(' '));
      this.problema.set(
        `“${recusados[0]}” não é um endereço de site. Use algo como www.seusite.com.br ou https://loja.seusite.com.br.`,
      );
    } else {
      this.texto.set('');
      this.problema.set(
        novos.length >= DOMINIOS_POR_CANAL && partes.length > 0
          ? `Cabem no máximo ${DOMINIOS_POR_CANAL} sites.`
          : null,
      );
    }
  }

  protected remover(dominio: string): void {
    this.definirValor(this.valor().filter((item) => item !== dominio));
    this.focar();
  }
}
