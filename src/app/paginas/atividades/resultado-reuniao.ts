import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';
import type { ConclusaoDeAtividade, ResultadoReuniao } from './atividades.api';

const OPCOES: readonly OpcaoGrupo<ResultadoReuniao>[] = [
  { valor: 'COMPARECEU', rotulo: 'Compareceu', dica: 'A reunião aconteceu.' },
  { valor: 'NAO_COMPARECEU', rotulo: 'Não compareceu', dica: 'O contato faltou.' },
  {
    valor: 'REMARCADA',
    rotulo: 'Remarcada',
    dica: 'Marca outra data: o CRM cria uma nova reunião pendente.',
  },
];

/**
 * Modal do resultado da reunião (R6.6): aparece em todo lugar onde se conclui uma reunião (lista
 * de Atividades, painel, aba do negócio, detalhe do contato, início). Compareceu, Não compareceu
 * ou Remarcada — esta pede a nova data e hora. Cancelar (botão, Esc ou véu) não conclui nada.
 * Também corrige o resultado de uma reunião já concluída (`resultadoAtual`).
 */
@Component({
  selector: 'app-resultado-reuniao',
  imports: [Botao, CampoData, GrupoOpcoes, Modal],
  template: `
    <app-modal [(aberto)]="aberto" [titulo]="titulo()" largura="sm" (fechado)="aoFechar()">
      <form class="resultado" [id]="idFormulario" (submit)="$event.preventDefault(); confirmar()">
        <p class="resultado__frase">
          Como foi <strong>{{ reuniao() }}</strong
          >?
        </p>
        <app-grupo-opcoes
          rotulo="Resultado da reunião"
          [opcoes]="opcoes"
          [erro]="erroResultado()"
          [(valor)]="resultado"
        />
        @if (resultado() === 'REMARCADA') {
          <app-campo-data
            rotulo="Nova data e hora"
            tipo="data-hora"
            obrigatorio
            [erro]="erroData()"
            [(valor)]="novaData"
          />
        }
      </form>
      <div modal-rodape class="resultado__acoes">
        <button appBotao type="button" variante="contorno" (click)="aberto.set(false)">
          Cancelar
        </button>
        <button appBotao type="submit" [attr.form]="idFormulario" variante="invertido">
          {{ rotuloConfirmar() }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .resultado {
      display: grid;
      gap: var(--esp-5);
    }

    .resultado__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .resultado__frase strong {
      color: var(--cor-texto);
      font-weight: 500;
    }

    .resultado__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-3);
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoReuniaoModal {
  readonly aberto = model(false);
  /** Título da reunião. */
  readonly reuniao = input('');
  readonly titulo = input('Resultado da reunião');
  readonly rotuloConfirmar = input('Concluir reunião');
  /** Correção: o resultado que a reunião já tem (vem marcado). */
  readonly resultadoAtual = input<ResultadoReuniao | null>(null);

  /** O corpo de `concluir` (ou da correção): resultado e, na remarcação, a nova data em ISO. */
  readonly confirmado = output<ConclusaoDeAtividade>();
  /** Fechou sem confirmar. */
  readonly cancelado = output<void>();

  protected readonly opcoes = OPCOES;
  /** Id único por instância: o botão do rodapé fica fora do form (`form=`). */
  protected readonly idFormulario = gerarId('form-resultado-reuniao');
  protected readonly resultado = signal<ResultadoReuniao | null>(null);
  protected readonly novaData = signal<string | null>(null);
  protected readonly erroResultado = signal<string | null>(null);
  protected readonly erroData = signal<string | null>(null);
  private confirmou = false;

  constructor() {
    effect(() => {
      if (this.aberto()) {
        this.resultado.set(this.resultadoAtual());
        this.novaData.set(null);
        this.erroResultado.set(null);
        this.erroData.set(null);
        this.confirmou = false;
      }
    });
  }

  protected confirmar(): void {
    const resultado = this.resultado();
    if (!resultado) {
      this.erroResultado.set('Escolha como foi a reunião para continuar.');
      return;
    }
    this.erroResultado.set(null);
    if (resultado !== 'REMARCADA') {
      this.finalizar({ resultadoReuniao: resultado });
      return;
    }
    const iso = localParaIso(this.novaData(), 'data-hora');
    if (!iso) {
      this.erroData.set('Informe a nova data e hora.');
      return;
    }
    if (new Date(iso).getTime() <= Date.now()) {
      this.erroData.set('A nova data precisa estar no futuro.');
      return;
    }
    this.finalizar({ resultadoReuniao: resultado, novaData: iso });
  }

  protected aoFechar(): void {
    if (!this.confirmou) {
      this.cancelado.emit();
    }
  }

  private finalizar(conclusao: ConclusaoDeAtividade): void {
    this.confirmou = true;
    this.confirmado.emit(conclusao);
    this.aberto.set(false);
  }
}
