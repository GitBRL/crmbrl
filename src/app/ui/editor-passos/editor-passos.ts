import {
  ChangeDetectionStrategy,
  Component,
  computed,
  booleanAttribute,
  input,
  model,
} from '@angular/core';

import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import { gerarId } from '../tipos';
import { ListaPassos } from './lista-passos';
import { contarPassos, type DefinicaoPasso, novoPasso, type Passo, validarPassos } from './passos';

/**
 * Editor de passos em lista (DESIGN-SYSTEM.md §4.7), o mesmo para o chatbot e para as
 * automações: "Quando… (gatilho) / Se… (condição, com ramos) / Então… (ação) / Aguardar…
 * (espera)". Cada passo é um cartão que abre para mostrar os campos; arraste pela alça ou use
 * as setas para reordenar; "Se" tem um bloco de passos por ramo. O editor não conhece nenhum
 * passo: a tela entrega as `definicoes` (tipo, fase, campos) e lê `gatilho` e `passos` (tipo +
 * valores) para montar o JSON da API; `validarPassos` aponta o que falta preencher.
 *
 * ```html
 * <app-editor-passos [definicoes]="definicoes" [(gatilho)]="gatilho" [(passos)]="passos" />
 * ```
 */
@Component({
  selector: 'app-editor-passos',
  imports: [ListaPassos, Seletor],
  template: `
    <div class="editor">
      @if (gatilhos().length) {
        <section class="editor__bloco" aria-label="Gatilho">
          @if (gatilho(); as atual) {
            <app-lista-passos
              nome="Gatilho"
              fixo
              [somenteLeitura]="somenteLeitura()"
              [definicoes]="definicoes()"
              [passos]="[atual]"
              (passosChange)="mudarGatilho($event)"
            />
          } @else {
            <div class="editor__gatilho-vazio">
              <app-seletor
                rotulo="Quando isso acontecer…"
                placeholder="Escolha o que inicia"
                [opcoes]="gatilhos()"
                [desabilitado]="somenteLeitura()"
                [valor]="null"
                (valorChange)="escolherGatilho($event)"
              />
            </div>
          }
        </section>
      }

      <section class="editor__bloco" aria-label="Passos">
        <app-lista-passos
          nome="Passos"
          [somenteLeitura]="somenteLeitura()"
          [definicoes]="definicoes()"
          [niveisRestantes]="nivelMaximo()"
          [(passos)]="passos"
        />
      </section>

      @if (problemas() > 0) {
        <p class="editor__problemas" role="status">
          {{
            problemas() === 1
              ? '1 campo obrigatório está vazio.'
              : problemas() + ' campos obrigatórios estão vazios.'
          }}
          Abra os passos marcados com “Falta preencher”.
        </p>
      } @else if (total() > 0) {
        <p class="editor__total">{{ total() === 1 ? '1 passo' : total() + ' passos' }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .editor {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }

    .editor__bloco {
      min-width: 0;
    }

    .editor__gatilho-vazio {
      padding: var(--esp-4);
      border: 1px dashed var(--cor-borda-forte);
      border-radius: var(--raio-lg);
    }

    .editor__problemas,
    .editor__total {
      margin: 0;
      font: var(--fonte-corpo-sm);
    }

    .editor__problemas {
      color: var(--cor-erro);
    }

    .editor__total {
      color: var(--cor-texto-suave);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPassos {
  /** Os passos que existem (tipo, fase, campos). Os de fase `quando` viram opções do gatilho. */
  readonly definicoes = input.required<readonly DefinicaoPasso[]>();
  /** O gatilho (passo de fase `quando`); `null` até a pessoa escolher. */
  readonly gatilho = model<Passo | null>(null);
  /** A sequência de passos, sem o gatilho. */
  readonly passos = model<readonly Passo[]>([]);
  readonly somenteLeitura = input(false, { transform: booleanAttribute });
  /** Quantos níveis de "Se" podem ficar um dentro do outro. */
  readonly nivelMaximo = input(2);

  protected readonly gatilhos = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.definicoes()
      .filter((definicao) => definicao.fase === 'quando')
      .map((definicao) => ({ valor: definicao.tipo, rotulo: definicao.rotulo })),
  );
  protected readonly total = computed(() => contarPassos(this.passos()) + (this.gatilho() ? 1 : 0));
  protected readonly problemas = computed(
    () =>
      validarPassos(
        [...(this.gatilho() ? [this.gatilho()!] : []), ...this.passos()],
        this.definicoes(),
      ).length,
  );

  protected escolherGatilho(tipo: string | null): void {
    const definicao = this.definicoes().find((d) => d.tipo === tipo && d.fase === 'quando');
    if (definicao) {
      this.gatilho.set(novoPasso(definicao, gerarId('gatilho')));
    }
  }

  protected mudarGatilho(lista: readonly Passo[]): void {
    this.gatilho.set(lista[0] ?? null);
  }
}
