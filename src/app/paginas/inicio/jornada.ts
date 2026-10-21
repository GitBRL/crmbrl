import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { LucideWorkflow } from '@lucide/angular';

import { abreviarNumero } from '../../nucleo/formatos';
import { BarraFunil } from '../../ui/barra-funil/barra-funil';
import { Dica } from '../../ui/dica/dica';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { AREAS_FUNIL, ORIGENS, type DadosJornada, type Periodo } from './dados-exemplo';

/**
 * Aba "Jornada do cliente" do palco: conversão, ciclo e receita abrem o painel (o nome da
 * aba já o titula; o título fica só para leitores de tela) e, abaixo, o funil do lead ao CS
 * em barras de cápsulas (uma série por origem do lead), agrupado por área, com a legenda das
 * origens logo acima. Entre as áreas, "passagem automática" e uma dica explicam como o
 * negócio muda de funil sozinho.
 */
@Component({
  selector: 'app-inicio-jornada',
  imports: [BarraFunil, Dica, Indicador, Legenda, LucideWorkflow],
  templateUrl: './jornada.html',
  styleUrl: './jornada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioJornada {
  private readonly locale = inject(LOCALE_ID);

  readonly dados = input.required<DadosJornada>();
  readonly periodo = input.required<Periodo>();

  protected readonly origens = ORIGENS;

  /** A largura de cada barra é proporcional aos leads (a primeira etapa). */
  protected readonly referencia = computed(() => this.dados().etapas[0]?.total ?? null);

  protected readonly grupos = computed(() =>
    AREAS_FUNIL.map((area) => ({
      ...area,
      etapas: this.dados().etapas.filter((etapa) => etapa.area === area.id),
    })).filter((grupo) => grupo.etapas.length > 0),
  );

  /** "186 mil" → número e sufixo separados (o sufixo vai menor, como unidade). */
  protected readonly receita = computed(() =>
    abreviarNumero(this.dados().receitaGanha, this.locale),
  );

  protected readonly dicaConversao = computed(() => {
    const { etapas } = this.dados();
    const ganhos = etapas.find((etapa) => etapa.id === 'ganhos')?.total ?? 0;
    const leads = etapas[0]?.total ?? 0;
    return `Parte dos leads do período que virou negócio ganho: ${this.numero(ganhos)} de ${this.numero(leads)}.`;
  });

  private numero(valor: number): string {
    return formatNumber(valor, this.locale, '1.0-0');
  }
}
