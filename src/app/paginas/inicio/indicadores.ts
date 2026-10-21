import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import {
  LucideDynamicIcon,
  LucideHandshake,
  LucideHeartHandshake,
  LucideMegaphone,
  LucideWallet,
  type LucideIcon,
} from '@lucide/angular';

import { abreviarNumero } from '../../nucleo/formatos';
import { Dica } from '../../ui/dica/dica';
import { Indicador, type UnidadeVariacao } from '../../ui/indicador/indicador';
import { gerarId } from '../../ui/tipos';
import type { DadosPeriodo } from './dados-exemplo';

interface Kpi {
  readonly id: string;
  readonly icone: LucideIcon;
  readonly valor: number | string;
  readonly prefixo: string | null;
  readonly unidade: string | null;
  /** O nome do indicador ("Leads em 30 dias"), para o rótulo da dica. */
  readonly nome: string;
  /** O nome como legenda, com o número e a unidade presos ("30 dias"). */
  readonly legenda: string;
  readonly variacao: number;
  /** % (padrão), pontos percentuais na taxa e pontos da nota no health score. */
  readonly unidadeVariacao: UnidadeVariacao;
  readonly dica: string;
}

/**
 * "Leads em 30 dias" → o número e a palavra que vem depois dele presos por um espaço
 * inseparável: "30 dias" nunca se parte na legenda (a regra do `.sem-quebra`,
 * DESIGN-SYSTEM.md §2.10, para um texto que chega como valor).
 */
export function semQuebraNumeroUnidade(texto: string): string {
  return texto.replace(/(\d) (?=\p{L})/gu, '$1\u00a0');
}

/**
 * Linha de indicadores do período: leads, taxa de ganho, MRR e health score. Cada cartão tem
 * no topo o ícone do módulo de onde o número vem (Marketing, Comercial, Financeiro e CS, os
 * mesmos da navegação) e a dica que explica a sigla e com o que a seta compara; embaixo, o
 * número, a variação (menta sobe, coral cai) e a legenda. Acima, uma linha diz a base das
 * variações. Quatro numa linha quando cabem; dois por linha; no celular, um por linha, com o
 * ícone à esquerda e a dica à direita. A dica fica no topo do cartão (e não ao lado da
 * legenda) para todas ficarem na mesma altura e a legenda ter a largura toda do cartão.
 */
@Component({
  selector: 'app-inicio-indicadores',
  imports: [Dica, Indicador, LucideDynamicIcon],
  template: `
    <h2 class="visualmente-oculto" [id]="idTitulo">
      Indicadores · {{ dados().periodo.descricao }}
    </h2>
    <p class="kpis__base">Variações {{ dados().periodo.comparacao }}</p>
    <ul class="kpis" role="list">
      @for (kpi of kpis(); track kpi.id) {
        <li class="kpi">
          <span class="kpi__icone" aria-hidden="true">
            <svg [lucideIcon]="kpi.icone" [size]="20" />
          </span>
          <app-indicador
            tamanho="sm"
            variacaoAbaixo
            [valor]="kpi.valor"
            [prefixo]="kpi.prefixo"
            [unidade]="kpi.unidade"
            [legenda]="kpi.legenda"
            [variacao]="kpi.variacao"
            [unidadeVariacao]="kpi.unidadeVariacao"
          />
          <app-dica class="kpi__dica" [rotulo]="'Sobre: ' + kpi.nome" [texto]="kpi.dica" />
        </li>
      }
    </ul>
  `,
  styleUrl: './indicadores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.aria-labelledby]': 'idTitulo',
  },
})
export class InicioIndicadores {
  private readonly locale = inject(LOCALE_ID);

  readonly dados = input.required<DadosPeriodo>();

  protected readonly idTitulo = gerarId('indicadores-titulo');

  protected readonly kpis = computed<readonly Kpi[]>(() => {
    const { indicadores, jornada, periodo } = this.dados();
    const total = (id: string) => jornada.etapas.find((etapa) => etapa.id === id)?.total ?? 0;
    const numero = (valor: number) => formatNumber(valor, this.locale, '1.0-0');
    const mrr = abreviarNumero(indicadores.mrr.valor, this.locale);
    const comparaPeriodo = `A seta compara com ${periodo.anterior}.`;
    const comparaHoje = 'Valor de hoje; a seta compara com o início do período.';
    const lista: readonly Omit<Kpi, 'legenda'>[] = [
      {
        id: 'leads',
        icone: LucideMegaphone,
        valor: indicadores.leads.valor,
        prefixo: null,
        unidade: null,
        nome: periodo.rotuloLeads,
        variacao: indicadores.leads.variacao,
        unidadeVariacao: '%',
        dica: `Contatos novos que chegaram por webhook, formulário, WhatsApp ou indicação. ${comparaPeriodo}`,
      },
      {
        id: 'taxa-ganho',
        icone: LucideHandshake,
        valor: indicadores.taxaGanho.valor,
        prefixo: null,
        unidade: '%',
        nome: 'Taxa de ganho',
        variacao: indicadores.taxaGanho.variacao,
        unidadeVariacao: 'p.p.',
        dica: `Parte das oportunidades do Comercial que virou negócio ganho: ${numero(total('ganhos'))} de ${numero(total('oportunidades'))}. ${comparaPeriodo} p.p. são pontos percentuais.`,
      },
      {
        id: 'mrr',
        icone: LucideWallet,
        valor: mrr.numero,
        prefixo: 'R$',
        unidade: mrr.sufixo || null,
        nome: 'Receita recorrente (MRR)',
        variacao: indicadores.mrr.variacao,
        unidadeVariacao: '%',
        dica: `MRR é a receita recorrente mensal: quanto os contratos ativos faturam por mês. Sobe com os negócios ganhos e cai com os cancelamentos. ${comparaHoje}`,
      },
      {
        id: 'health-score',
        icone: LucideHeartHandshake,
        valor: indicadores.healthScore.valor,
        prefixo: null,
        unidade: null,
        nome: 'Health score médio (CS)',
        variacao: indicadores.healthScore.variacao,
        unidadeVariacao: 'pts',
        dica: `Health score é uma nota de 0 a 100 para a saúde de cada cliente: uso do produto, pagamentos em dia, chamados e satisfação. Abaixo de 60, o CS entra em ação. ${comparaHoje}`,
      },
    ];
    return lista.map((kpi) => ({ ...kpi, legenda: semQuebraNumeroUnidade(kpi.nome) }));
  });
}
