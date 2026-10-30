import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { CampoData } from '../campo-data/campo-data';
import { CampoTexto } from '../campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../grupo-opcoes/grupo-opcoes';
import { SeletorDiasSemana } from '../seletor-janela-envio/seletor-dias-semana';
import { type OpcaoSeletor, Seletor } from '../seletor/seletor';
import {
  type Agenda,
  agendaPadrao,
  DICA_MODO,
  descreverAgenda,
  erroDaAgenda,
  type FrequenciaAgenda,
  type ModoAgenda,
  ROTULO_FREQUENCIA,
  ROTULO_MODO,
  type SentidoAgenda,
} from './agenda';

/**
 * Seletor de agenda (DESIGN-SYSTEM.md §4.7): quando a campanha sai ou a automação roda.
 * Escolha do modo em pílulas (`modos` limita quais aparecem: campanhas usam "Agora" e "Numa
 * data e hora"; automações, "Repetir" e "Perto de uma data") e, abaixo, só os campos do modo.
 * `camposData` lista os campos de data do modo "Perto de uma data" (vencimento, aniversário…).
 * Uma frase resume o resultado; se a agenda não serve, ela vira o erro (`role="alert"`).
 *
 * `<app-seletor-agenda [modos]="['agora', 'data']" [(valor)]="agenda" />`
 */
@Component({
  selector: 'app-seletor-agenda',
  imports: [GrupoOpcoes, CampoData, CampoTexto, Seletor, SeletorDiasSemana],
  template: `
    <div class="agenda">
      <app-grupo-opcoes
        rotulo="Quando"
        disposicao="pilulas"
        [opcoes]="opcoesModo()"
        [valor]="valor().modo"
        (valorChange)="trocarModo($event)"
      />
      <p class="agenda__dica">{{ dicaDoModo() }}</p>

      @switch (valor().modo) {
        @case ('data') {
          <app-campo-data
            class="agenda__campo"
            tipo="data-hora"
            rotulo="Dia e hora"
            [valor]="valor().dataHora"
            (valorChange)="mudar({ dataHora: $event })"
          />
        }
        @case ('recorrente') {
          <div class="agenda__linha">
            <app-seletor
              class="agenda__campo"
              rotulo="Com que frequência"
              [opcoes]="frequencias"
              [valor]="valor().frequencia"
              (valorChange)="mudar({ frequencia: $event ?? 'semanal' })"
            />
            <app-campo-data
              class="agenda__campo"
              tipo="hora"
              rotulo="Hora"
              [valor]="valor().hora"
              (valorChange)="mudar({ hora: $event ?? '' })"
            />
          </div>
          @if (valor().frequencia === 'semanal') {
            <app-seletor-dias-semana
              [valor]="valor().diasSemana"
              (valorChange)="mudar({ diasSemana: $event })"
            />
          }
          @if (valor().frequencia === 'mensal') {
            <app-campo-texto
              class="agenda__campo"
              tipo="number"
              rotulo="Dia do mês"
              dica="De 1 a 28, para valer em todos os meses."
              [minimo]="1"
              [maximo]="28"
              [valor]="valor().diaMes"
              (valorChange)="mudar({ diaMes: numero($event) })"
            />
          }
        }
        @case ('relativa') {
          <div class="agenda__linha">
            <app-campo-texto
              class="agenda__campo"
              tipo="number"
              rotulo="Quantos dias"
              [minimo]="0"
              [maximo]="365"
              [valor]="valor().quantidade"
              (valorChange)="mudar({ quantidade: numero($event) })"
            />
            <app-seletor
              class="agenda__campo"
              rotulo="Antes ou depois"
              [opcoes]="sentidos"
              [valor]="valor().sentido"
              (valorChange)="mudar({ sentido: $event ?? 'antes' })"
            />
          </div>
          <div class="agenda__linha">
            <app-seletor
              class="agenda__campo"
              rotulo="De qual data"
              placeholder="Escolha a data"
              [opcoes]="camposData()"
              [valor]="valor().campo"
              (valorChange)="mudar({ campo: $event })"
            />
            <app-campo-data
              class="agenda__campo"
              tipo="hora"
              rotulo="Hora"
              [valor]="valor().hora"
              (valorChange)="mudar({ hora: $event ?? '' })"
            />
          </div>
        }
      }

      @if (erro(); as mensagem) {
        <p class="agenda__resumo agenda__resumo--erro" role="alert">{{ mensagem }}</p>
      } @else if (resumo() !== dicaDoModo()) {
        <p class="agenda__resumo" aria-live="polite">{{ resumo() }}</p>
      }
    </div>
  `,
  styleUrl: './seletor-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorAgenda {
  readonly valor = model<Agenda>(agendaPadrao());
  /** Modos oferecidos, na ordem em que aparecem. */
  readonly modos = input<readonly ModoAgenda[]>(['agora', 'data']);
  /** Campos de data do modo "Perto de uma data". */
  readonly camposData = input<readonly OpcaoSeletor<string>[]>([]);

  protected readonly frequencias: readonly OpcaoSeletor<FrequenciaAgenda>[] = (
    Object.keys(ROTULO_FREQUENCIA) as FrequenciaAgenda[]
  ).map((valor) => ({ valor, rotulo: ROTULO_FREQUENCIA[valor] }));
  protected readonly sentidos: readonly OpcaoSeletor<SentidoAgenda>[] = [
    { valor: 'antes', rotulo: 'Antes' },
    { valor: 'depois', rotulo: 'Depois' },
  ];

  protected readonly opcoesModo = computed<readonly OpcaoGrupo<ModoAgenda>[]>(() =>
    this.modos().map((modo) => ({ valor: modo, rotulo: ROTULO_MODO[modo] })),
  );
  protected readonly dicaDoModo = computed(() => DICA_MODO[this.valor().modo]);
  protected readonly erro = computed(() => erroDaAgenda(this.valor()));
  protected readonly resumo = computed(() => descreverAgenda(this.valor(), this.camposData()));

  protected trocarModo(modo: ModoAgenda | null): void {
    if (modo && modo !== this.valor().modo) {
      // Mantém o que já foi digitado nos outros campos; só troca o modo.
      this.valor.set({ ...this.valor(), modo });
    }
  }

  protected mudar(parte: Partial<Agenda>): void {
    this.valor.set({ ...this.valor(), ...parte });
  }

  protected numero(valor: string | number | null): number {
    const n = typeof valor === 'number' ? valor : Number(valor);
    return Number.isFinite(n) ? n : 0;
  }
}
