import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatarInteiro } from '../apresentacao';
import type { EnviosNoDia } from '../canais.modelos';

interface Coluna {
  readonly dia: string;
  /** "seg 20". */
  readonly rotulo: string;
  /** "segunda, 20/10: 42 de 214 envios, 1 falha". */
  readonly descricao: string;
  readonly altura: number;
  readonly alturaLimite: number;
  readonly enviados: number;
  readonly limite: number;
  readonly falhas: number;
  readonly hoje: boolean;
}

const DIA_CURTO = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

/**
 * Envios por dia de um número (série única, ciano): uma barra fina por dia, ancorada na base,
 * e um traço com o limite daquele dia (que cresce durante o aquecimento). Passar o mouse mostra
 * o dia; a mesma informação fica numa tabela para leitores de tela.
 */
@Component({
  selector: 'app-grafico-envios',
  template: `
    <div class="grafico" role="img" [attr.aria-label]="resumo()">
      @for (coluna of colunas(); track coluna.dia) {
        <div class="grafico__coluna" [class.grafico__coluna--hoje]="coluna.hoje" aria-hidden="true">
          <div class="grafico__area">
            <span class="grafico__limite" [style.bottom.%]="coluna.alturaLimite"></span>
            <span
              class="grafico__barra"
              [class.grafico__barra--vazia]="coluna.enviados === 0"
              [style.height.%]="coluna.altura"
            ></span>
            <span class="grafico__balao">
              <strong>{{ coluna.enviados }}</strong> de {{ coluna.limite }}
              @if (coluna.falhas > 0) {
                <span>· {{ coluna.falhas }} {{ coluna.falhas === 1 ? 'falha' : 'falhas' }}</span>
              }
            </span>
          </div>
          <span class="grafico__dia">{{ coluna.rotulo }}</span>
        </div>
      }
    </div>
    <p class="grafico__legenda">
      <span class="grafico__marca grafico__marca--barra" aria-hidden="true"></span> Envios
      <span class="grafico__marca grafico__marca--limite" aria-hidden="true"></span> Limite do dia
    </p>
    <table class="visualmente-oculto">
      <caption>
        Envios por dia
      </caption>
      <thead>
        <tr>
          <th scope="col">Dia</th>
          <th scope="col">Enviados</th>
          <th scope="col">Limite</th>
          <th scope="col">Falhas</th>
        </tr>
      </thead>
      <tbody>
        @for (coluna of colunas(); track coluna.dia) {
          <tr>
            <th scope="row">{{ coluna.descricao }}</th>
            <td>{{ coluna.enviados }}</td>
            <td>{{ coluna.limite }}</td>
            <td>{{ coluna.falhas }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-3);
    }

    .grafico {
      display: grid;
      grid-auto-columns: minmax(0, 1fr);
      grid-auto-flow: column;
      gap: 2px;
      height: 148px;
    }

    .grafico__coluna {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: var(--esp-2);
      min-width: 0;
    }

    .grafico__area {
      position: relative;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      border-bottom: 1px solid var(--cor-borda-forte);
    }

    // Barra fina, pontas de 4px arredondadas em cima, ancorada na base.
    .grafico__barra {
      width: min(14px, 70%);
      min-height: 2px;
      border-radius: 4px 4px 0 0;
      background: var(--dado-1);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
    }

    .grafico__barra--vazia {
      background: var(--cor-borda-forte);
      box-shadow: none;
    }

    .grafico__limite {
      position: absolute;
      left: 15%;
      right: 15%;
      height: 2px;
      border-radius: 1px;
      background: var(--cor-texto-fraco);
    }

    .grafico__balao {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      z-index: 1;
      padding: var(--esp-1) var(--esp-2);
      border-radius: var(--raio-sm);
      background: var(--cor-flutuante);
      box-shadow: var(--sombra-flutuante);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transform: translateX(-50%);
      transition: opacity var(--duracao-opacidade);

      strong {
        color: var(--cor-texto);
        font-weight: 600;
      }
    }

    .grafico__coluna:first-child .grafico__balao {
      left: 0;
      transform: none;
    }

    .grafico__coluna:last-child .grafico__balao {
      right: 0;
      left: auto;
      transform: none;
    }

    .grafico__coluna:hover .grafico__balao {
      opacity: 1;
    }

    .grafico__coluna:hover .grafico__area {
      background: var(--cor-vidro);
    }

    .grafico__dia {
      overflow: hidden;
      color: var(--cor-texto-fraco);
      font: var(--fonte-micro);
      font-weight: 400;
      text-align: center;
      text-overflow: clip;
      white-space: nowrap;
    }

    .grafico__coluna--hoje .grafico__dia {
      color: var(--cor-texto);
      font-weight: 600;
    }

    .grafico__legenda {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda);
    }

    .grafico__marca {
      display: inline-block;
      flex: none;
    }

    .grafico__marca--barra {
      width: 8px;
      height: 12px;
      border-radius: 3px 3px 0 0;
      background: var(--dado-1);
      box-shadow: inset 0 0 0 1px var(--cor-contorno-dado);
    }

    .grafico__marca--limite {
      width: 14px;
      height: 2px;
      margin-left: var(--esp-3);
      background: var(--cor-texto-fraco);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoEnvios {
  /** Do dia mais antigo para o mais novo (a API manda assim). */
  readonly envios = input.required<readonly EnviosNoDia[]>();
  /** `AAAA-MM-DD` de hoje (São Paulo), para destacar a coluna. */
  readonly hoje = input<string | null>(null);

  protected readonly colunas = computed<readonly Coluna[]>(() => {
    const envios = [...this.envios()].sort((a, b) => a.dia.localeCompare(b.dia));
    const teto = Math.max(1, ...envios.map((dia) => Math.max(dia.enviados, dia.limite)));
    return envios.map((dia) => {
      const data = new Date(`${dia.dia}T12:00:00Z`);
      const curto = DIA_CURTO.format(data).replace('.', '');
      return {
        dia: dia.dia,
        rotulo: `${curto.slice(0, 3)} ${dia.dia.slice(8, 10)}`,
        descricao: DIA_LONGO.format(data),
        altura: (dia.enviados / teto) * 100,
        alturaLimite: (dia.limite / teto) * 100,
        enviados: dia.enviados,
        limite: dia.limite,
        falhas: dia.falhas,
        hoje: dia.dia === this.hoje(),
      };
    });
  });

  protected readonly resumo = computed(() => {
    const colunas = this.colunas();
    const total = colunas.reduce((soma, coluna) => soma + coluna.enviados, 0);
    const falhas = colunas.reduce((soma, coluna) => soma + coluna.falhas, 0);
    const pico = colunas.reduce((maior, coluna) => Math.max(maior, coluna.enviados), 0);
    return `Envios nos últimos ${colunas.length} dias: ${formatarInteiro(total)} no total, no máximo ${formatarInteiro(pico)} num dia, ${formatarInteiro(falhas)} ${falhas === 1 ? 'falha' : 'falhas'}. Tabela com cada dia a seguir.`;
  });
}
