import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideHourglass, LucideWorkflow } from '@lucide/angular';

import type { ErroApi } from '../../nucleo/api/erro-api';
import { abreviarNumero } from '../../nucleo/formatos';
import type { Area } from '../../nucleo/sessao/perfil';
import { BarraFunil } from '../../ui/barra-funil/barra-funil';
import { Botao } from '../../ui/botao/botao';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Selo } from '../../ui/selo/selo';
import type { Periodo } from './dados-exemplo';
import { SERIES_JORNADA, type AreaDaJornada, type JornadaReal } from './metricas-jornada';

export type EstadoJornada = 'carregando' | 'pronto' | 'erro';

/**
 * Aba "Jornada do cliente" do palco, com as métricas reais da API (R5.10): conversão, ciclo
 * e receita ganha (ou negócios parados, para quem não vê o Comercial) e, abaixo, o funil de
 * cada área visível — dos negócios criados no período, quantos chegaram a cada etapa, quantos
 * seguiram e quantos pararam, a queda e o tempo médio na etapa. Com as três áreas, cada uma
 * mostra só a entrada e o ganho, e "Ver todas as etapas" abre o resto; com uma área só, todas
 * as etapas já aparecem. Entre as áreas, "passagem automática" com a dica da regra (R5.7).
 */
@Component({
  selector: 'app-inicio-jornada',
  imports: [
    BarraFunil,
    Botao,
    Dica,
    EstadoVazio,
    Esqueleto,
    Indicador,
    Legenda,
    LucideWorkflow,
    RouterLink,
    Selo,
  ],
  templateUrl: './jornada.html',
  styleUrl: './jornada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioJornada {
  private readonly locale = inject(LOCALE_ID);

  readonly jornada = input<JornadaReal | null>(null);
  readonly estado = input<EstadoJornada>('carregando');
  readonly erro = input<ErroApi | null>(null);
  readonly periodo = input.required<Periodo>();
  /** "Tentar de novo" depois de um erro. */
  readonly recarregar = output<void>();

  protected readonly series = SERIES_JORNADA;
  protected readonly iconeParados = LucideHourglass;
  /** Áreas com todas as etapas abertas (com uma área só, ela já vem aberta). */
  private readonly abertas = signal<ReadonlySet<Area>>(new Set());

  /** "nos últimos 30 dias", "no último trimestre". */
  protected readonly noPeriodo = computed(() => {
    const periodo = this.periodo();
    return `${periodo.id === 'trimestre' ? 'no' : 'nos'} ${periodo.descricao}`;
  });
  protected readonly umaArea = computed(() => (this.jornada()?.areas.length ?? 0) <= 1);

  /** "R$ 28,8 mil" → número e sufixo separados (o sufixo vai menor, como unidade). */
  protected readonly terceiro = computed(() => {
    const terceiro = this.jornada()?.terceiro;
    if (!terceiro) {
      return null;
    }
    if (terceiro.tipo === 'receita') {
      const { numero, sufixo } = abreviarNumero(terceiro.valor ?? 0, this.locale);
      return { ...terceiro, numero, prefixo: 'R$', unidade: sufixo || null };
    }
    return { ...terceiro, numero: terceiro.valor ?? 0, prefixo: null, unidade: null };
  });

  protected estaAberta(area: AreaDaJornada): boolean {
    return this.umaArea() || this.abertas().has(area.area);
  }

  protected etapasDe(area: AreaDaJornada) {
    return this.estaAberta(area) ? area.etapas : area.extremos;
  }

  protected alternar(area: AreaDaJornada): void {
    this.abertas.update((abertas) => {
      const novas = new Set(abertas);
      if (novas.has(area.area)) {
        novas.delete(area.area);
      } else {
        novas.add(area.area);
      }
      return novas;
    });
  }

  protected rotuloParados(total: number): string {
    return total === 1 ? '1 parado' : `${total} parados`;
  }
}
