import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideCopy, LucidePlus, LucideX } from '@lucide/angular';

import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { CampoData } from '../../../ui/campo-data/campo-data';
import { Seletor, type OpcaoSeletor } from '../../../ui/seletor/seletor';
import type {
  DiaDaSemana,
  HorarioDeAtendimento,
  IntervaloDeAtendimento,
} from '../canais/canais.modelos';
import {
  DIAS_DA_SEMANA,
  FUSOS_HORARIOS,
  INTERVALOS_POR_DIA,
  minutosDoHorario,
  NOME_DO_DIA,
  problemasDoDia,
} from './apresentacao';

/** O campo de hora do navegador vai até 23:59; "até a meia-noite" é gravado como 24:00. */
const MEIA_NOITE = '24:00';
const ULTIMO_MINUTO = '23:59';

interface DiaVisual {
  readonly dia: DiaDaSemana;
  readonly nome: string;
  readonly intervalos: readonly IntervaloDeAtendimento[];
  readonly problema: string | null;
}

function paraCampo(hora: string): string {
  return hora === MEIA_NOITE ? ULTIMO_MINUTO : hora;
}

function somarHora(hora: string, minutos: number): string {
  const base = minutosDoHorario(hora, true) ?? 9 * 60;
  const total = Math.min(23 * 60 + 59, base + minutos);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Horário de atendimento da semana (R12): para cada dia, aberto ou fechado e até 6 intervalos
 * (das 08:00 às 12:00 e das 13:00 às 18:00, por exemplo), o fuso e o atalho "Copiar para os dias
 * úteis". Confere as mesmas regras da API (fim depois do início, sem sobreposição). Até a
 * meia-noite = 23:59 no campo (gravado como 24:00).
 */
@Component({
  selector: 'app-editor-horario',
  imports: [CaixaSelecao, CampoData, Seletor, LucideCopy, LucidePlus, LucideX],
  template: `
    <app-seletor
      rotulo="Fuso horário"
      [opcoes]="opcoesFuso()"
      [desabilitado]="desabilitado()"
      [valor]="horario().fusoHorario"
      (valorChange)="mudarFuso($event)"
    />
    <ul class="semana" aria-label="Dias da semana">
      @for (dia of dias(); track dia.dia) {
        <li class="dia" [class.dia--fechado]="dia.intervalos.length === 0">
          <app-caixa-selecao
            class="dia__aberto"
            [rotulo]="dia.nome"
            [desabilitado]="desabilitado()"
            [valor]="dia.intervalos.length > 0"
            (valorChange)="alternarDia(dia.dia, $event)"
          />
          <div class="dia__intervalos">
            @for (intervalo of dia.intervalos; track $index) {
              <div class="intervalo">
                <app-campo-data
                  tipo="hora"
                  rotuloOculto
                  [rotulo]="dia.nome + ': início do ' + ($index + 1) + 'º horário'"
                  [desabilitado]="desabilitado()"
                  [valor]="intervalo.inicio"
                  (valorChange)="mudar(dia.dia, $index, 'inicio', $event)"
                />
                <span class="intervalo__ate" aria-hidden="true">às</span>
                <app-campo-data
                  tipo="hora"
                  rotuloOculto
                  [rotulo]="dia.nome + ': fim do ' + ($index + 1) + 'º horário'"
                  [desabilitado]="desabilitado()"
                  [valor]="paraCampo(intervalo.fim)"
                  (valorChange)="mudar(dia.dia, $index, 'fim', $event)"
                />
                @if (!desabilitado()) {
                  <button
                    type="button"
                    class="intervalo__remover"
                    [attr.aria-label]="'Tirar o ' + ($index + 1) + 'º horário de ' + dia.nome"
                    (click)="remover(dia.dia, $index)"
                  >
                    <svg lucideX [size]="16" />
                  </button>
                }
              </div>
            } @empty {
              <span class="dia__fechado">Fechado</span>
            }
            @if (dia.problema) {
              <p class="dia__problema" role="alert">{{ dia.problema }}</p>
            }
            @if (!desabilitado() && dia.intervalos.length > 0) {
              <div class="dia__acoes">
                @if (dia.intervalos.length < maximo) {
                  <button type="button" class="dia__botao" (click)="adicionar(dia.dia)">
                    <svg lucidePlus [size]="14" />
                    Outro horário
                  </button>
                }
                @if (dia.dia === '1') {
                  <button type="button" class="dia__botao" (click)="copiarParaDiasUteis()">
                    <svg lucideCopy [size]="14" />
                    Copiar para terça a sexta
                  </button>
                }
              </div>
            }
          </div>
        </li>
      }
    </ul>
    <p class="semana__nota">Para atender até a meia-noite, use 23:59.</p>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: var(--esp-4);
      container-type: inline-size;
    }

    .semana {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    // Um dia por linha: o dia (aberto ou fechado) à esquerda, os horários à direita.
    .dia {
      display: grid;
      grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
      align-items: start;
      gap: var(--esp-2) var(--esp-4);
      padding: var(--esp-1) var(--esp-3);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);

      @container (max-width: 30rem) {
        grid-template-columns: minmax(0, 1fr);
        padding-bottom: var(--esp-3);
      }
    }

    .dia--fechado {
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--cor-borda);
    }

    .dia__intervalos {
      display: grid;
      align-content: center;
      gap: var(--esp-2);
      min-height: var(--altura-md);
      padding-block: var(--esp-1);
    }

    .dia__fechado {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda-lg);
    }

    .intervalo {
      display: grid;
      grid-template-columns: minmax(0, 8.5rem) auto minmax(0, 8.5rem) auto;
      justify-content: start;
      align-items: center;
      gap: var(--esp-2);
    }

    .intervalo__ate {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo-sm);
    }

    .intervalo__remover,
    .dia__botao {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--esp-1);
      border: 0;
      background: transparent;
      color: var(--cor-texto-suave);
      font: var(--fonte-rotulo);
      font-size: 13px;
      cursor: pointer;

      &:hover {
        background: var(--cor-superficie-3);
        color: var(--cor-texto);
      }

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: 2px;
      }
    }

    .intervalo__remover {
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      @include m.area-toque(4px, 4px);
    }

    .dia__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-1) var(--esp-2);
      margin-left: calc(-1 * var(--esp-3));
    }

    .dia__botao {
      min-height: 32px;
      padding: 0 var(--esp-3);
      border-radius: var(--raio-pilula);
      @include m.area-toque(6px, 0);
    }

    .dia__problema {
      color: var(--cor-erro);
      font: var(--fonte-legenda-lg);
      font-weight: 500;
    }

    .semana__nota {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorHorario {
  readonly horario = model.required<HorarioDeAtendimento>();
  readonly desabilitado = input(false);

  protected readonly maximo = INTERVALOS_POR_DIA;
  protected readonly paraCampo = paraCampo;

  protected readonly opcoesFuso = computed<readonly OpcaoSeletor<string>[]>(() => {
    const atual = this.horario().fusoHorario;
    const opcoes = FUSOS_HORARIOS.map((fuso) => ({ valor: fuso.valor, rotulo: fuso.rotulo }));
    if (!opcoes.some((opcao) => opcao.valor === atual)) {
      opcoes.push({ valor: atual, rotulo: atual });
    }
    return opcoes;
  });

  protected readonly dias = computed<readonly DiaVisual[]>(() =>
    DIAS_DA_SEMANA.map((dia) => {
      const intervalos = this.horario().dias[dia] ?? [];
      return { dia, nome: NOME_DO_DIA[dia], intervalos, problema: problemasDoDia(intervalos) };
    }),
  );

  /** Algum dia com problema (a tela não deixa salvar). */
  readonly invalido = computed(() => this.dias().some((dia) => dia.problema !== null));

  private definirDia(dia: DiaDaSemana, intervalos: readonly IntervaloDeAtendimento[]): void {
    const atual = this.horario();
    const dias: Partial<Record<DiaDaSemana, readonly IntervaloDeAtendimento[]>> = { ...atual.dias };
    if (intervalos.length) {
      dias[dia] = intervalos;
    } else {
      delete dias[dia];
    }
    this.horario.set({ ...atual, dias });
  }

  protected mudarFuso(fuso: string | null): void {
    if (fuso) {
      this.horario.set({ ...this.horario(), fusoHorario: fuso });
    }
  }

  protected alternarDia(dia: DiaDaSemana, aberto: boolean): void {
    if (!aberto) {
      this.definirDia(dia, []);
      return;
    }
    // Abre com o horário do dia aberto mais próximo antes dele (ou 08:00–18:00).
    const indice = DIAS_DA_SEMANA.indexOf(dia);
    const anterior = DIAS_DA_SEMANA.slice(0, indice)
      .reverse()
      .map((outro) => this.horario().dias[outro] ?? [])
      .find((intervalos) => intervalos.length > 0);
    this.definirDia(dia, anterior ?? [{ inicio: '08:00', fim: '18:00' }]);
  }

  protected adicionar(dia: DiaDaSemana): void {
    const intervalos = this.horario().dias[dia] ?? [];
    const ultimo = intervalos[intervalos.length - 1];
    const inicio = ultimo ? somarHora(ultimo.fim, 60) : '08:00';
    const fim = somarHora(inicio, 4 * 60);
    this.definirDia(dia, [...intervalos, { inicio, fim }]);
  }

  protected remover(dia: DiaDaSemana, indice: number): void {
    const intervalos = this.horario().dias[dia] ?? [];
    this.definirDia(
      dia,
      intervalos.filter((_, i) => i !== indice),
    );
  }

  protected mudar(
    dia: DiaDaSemana,
    indice: number,
    campo: 'inicio' | 'fim',
    valor: string | null,
  ): void {
    const intervalos = [...(this.horario().dias[dia] ?? [])];
    const atual = intervalos[indice];
    if (!atual) {
      return;
    }
    const hora = campo === 'fim' && valor === ULTIMO_MINUTO ? MEIA_NOITE : (valor ?? '');
    intervalos[indice] = { ...atual, [campo]: hora };
    this.definirDia(dia, intervalos);
  }

  protected copiarParaDiasUteis(): void {
    const segunda = this.horario().dias['1'] ?? [];
    const dias: Partial<Record<DiaDaSemana, readonly IntervaloDeAtendimento[]>> = {
      ...this.horario().dias,
    };
    for (const dia of ['2', '3', '4', '5'] as const) {
      dias[dia] = segunda.map((intervalo) => ({ ...intervalo }));
    }
    this.horario.set({ ...this.horario(), dias });
  }
}
