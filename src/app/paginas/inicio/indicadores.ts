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

import { type Area } from '../../nucleo/sessao/perfil';
import { CHAVES_BASE } from '../../nucleo/setores/setores';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Dica } from '../../ui/dica/dica';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Indicador, type UnidadeVariacao } from '../../ui/indicador/indicador';
import { gerarId } from '../../ui/tipos';
import type { DadosPeriodo } from './dados-exemplo';
import type { EstadoJornada } from './jornada';
import { valorDoCartao } from '../bi/bi.formatos';
import type { MedidasBi } from './metricas-bi';
import type { IndicadoresReais } from './metricas-jornada';

interface Kpi {
  readonly id: string;
  readonly icone: LucideIcon;
  /** `null` enquanto carrega (o cartão mostra o esqueleto). */
  readonly valor: number | string | null;
  readonly prefixo: string | null;
  readonly unidade: string | null;
  /** O nome do indicador ("Leads em 30 dias"), para o rótulo da dica. */
  readonly nome: string;
  /** O nome como legenda, com o número e a unidade presos ("30 dias"). */
  readonly legenda: string;
  readonly variacao: number | null;
  /** % (padrão), pontos percentuais na taxa e pontos da nota no health score. */
  readonly unidadeVariacao: UnidadeVariacao;
  readonly dica: string;
}

/** "Leads em 30 dias" → "Negócios novos em 30 dias" para quem vê só o Comercial. */
const ROTULO_NOVOS: Readonly<Record<Area, string>> = {
  MARKETING: 'Leads',
  COMERCIAL: 'Negócios novos',
  CS: 'Clientes novos',
};

const ICONE_AREA: Readonly<Record<Area, LucideIcon>> = {
  MARKETING: LucideMegaphone,
  COMERCIAL: LucideHandshake,
  CS: LucideHeartHandshake,
};

const DICA_NOVOS: Readonly<Record<Area, string>> = {
  MARKETING:
    'Negócios novos no funil de Marketing: leads que chegaram por webhook, formulário, WhatsApp, indicação ou cadastrados à mão.',
  COMERCIAL:
    'Negócios novos no funil Comercial no período: os que vieram do Marketing (qualificados) e os criados à mão.',
  CS: 'Clientes que entraram no funil de Customer Success no período, vindos dos negócios ganhos no Comercial.',
};

/**
 * "Leads em 30 dias" → o número e a palavra que vem depois dele presos por um espaço
 * inseparável: "30 dias" nunca se parte na legenda (a regra do `.sem-quebra`,
 * DESIGN-SYSTEM.md §2.10, para um texto que chega como valor).
 */
export function semQuebraNumeroUnidade(texto: string): string {
  return texto.replace(/(\d) (?=\p{L})/gu, '$1 ');
}

/**
 * Linha de indicadores do período. Negócios novos (leads do Marketing, ou os do setor de quem
 * vê uma só) e a taxa de ganho do Comercial (para quem vê a jornada inteira) são reais, das
 * métricas dos funis (R5.10); a receita recorrente (MRR) e os
 * clientes em risco alto vêm do BI (`GET /bi/financeiro` e `/bi/cs`), para quem vê esses painéis.
 * Cada cartão tem o ícone do módulo de onde o número vem, a dica
 * que explica a sigla e com o que a seta compara e, embaixo, o número, a variação (menta sobe,
 * coral cai) e a legenda. Quatro numa linha quando cabem; dois por linha; no celular, um por
 * linha, com o ícone à esquerda e a dica à direita.
 */
@Component({
  selector: 'app-inicio-indicadores',
  imports: [Dica, Esqueleto, Indicador, LucideDynamicIcon],
  template: `
    <h2 class="visualmente-oculto" [id]="idTitulo">
      Indicadores · {{ dados().periodo.descricao }}
    </h2>
    <p class="kpis__base">Variações {{ dados().periodo.comparacao }}</p>
    <ul class="kpis" role="list" [style.--kpis]="kpis().length">
      @for (kpi of kpis(); track kpi.id) {
        <li class="kpi">
          <span class="kpi__icone" aria-hidden="true">
            <svg [lucideIcon]="kpi.icone" [size]="20" />
          </span>
          @if (kpi.valor === null) {
            <div class="kpi__carregando" aria-busy="true">
              <span class="visualmente-oculto" role="status">Carregando {{ kpi.nome }}…</span>
              <app-esqueleto forma="bloco" altura="2.5rem" largura="60%" />
              <app-esqueleto largura="75%" />
            </div>
          } @else {
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
          }
          <span class="kpi__lado">
            <app-dica class="kpi__dica" [rotulo]="'Sobre: ' + kpi.nome" [texto]="kpi.dica" />
          </span>
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
  private readonly sessao = inject(SessaoService);

  /** Os textos do período ("últimos 30 dias", "o período anterior"…). */
  readonly dados = input.required<DadosPeriodo>();
  /** Os painéis do BI usados aqui (MRR e risco de churn); `null` enquanto carregam. */
  readonly bi = input<MedidasBi | null>(null);
  /** Leads e taxa de ganho reais; `null` enquanto carregam ou se falharam. */
  readonly reais = input<IndicadoresReais | null>(null);
  readonly estado = input<EstadoJornada>('carregando');

  protected readonly idTitulo = gerarId('indicadores-titulo');

  protected readonly kpis = computed<readonly Kpi[]>(() => {
    const { periodo } = this.dados();
    const reais = this.reais();
    const estado = this.estado();
    const areas = this.sessao.permissoes()?.areasVisiveis ?? [];
    const numero = (valor: number) => formatNumber(valor, this.locale, '1.0-0');
    const comparaPeriodo = `A seta compara com ${periodo.anterior}.`;
    /** Enquanto carrega: `null` (esqueleto); com erro: "—". */
    const pendente = estado === 'carregando' ? null : '—';
    const lista: Omit<Kpi, 'legenda'>[] = [];

    // Negócios novos: os leads do Marketing para quem vê a jornada inteira; os da própria
    // área para quem vê uma só (a primeira área visível, na ordem da jornada).
    const areaNovos = CHAVES_BASE.find((area) => areas.includes(area));
    if (areaNovos) {
      const novos = reais?.novos;
      const nome = periodo.rotuloLeads.replace('Leads', ROTULO_NOVOS[areaNovos]);
      lista.push({
        id: 'novos',
        icone: ICONE_AREA[areaNovos],
        valor: novos ? novos.valor : pendente,
        prefixo: null,
        unidade: null,
        nome,
        variacao: novos?.variacao ?? null,
        unidadeVariacao: '%',
        dica: `${DICA_NOVOS[areaNovos]} ${comparaPeriodo}`,
      });
    }
    // Taxa de ganho do Comercial: com uma área só, a jornada já a mostra.
    if (areas.includes('COMERCIAL') && areas.length > 1) {
      const taxa = reais?.taxaGanho;
      lista.push({
        id: 'taxa-ganho',
        icone: LucideHandshake,
        valor: taxa ? (taxa.valor ?? '—') : pendente,
        prefixo: null,
        unidade: taxa?.valor === null || !taxa ? null : '%',
        nome: 'Taxa de ganho',
        variacao: taxa?.variacao ?? null,
        unidadeVariacao: 'p.p.',
        dica: taxa
          ? `Parte dos negócios criados no Comercial no período que já foi ganha: ${numero(taxa.ganhos)} de ${numero(taxa.criados)}. ${comparaPeriodo} p.p. são pontos percentuais.`
          : `Parte dos negócios criados no Comercial no período que já foi ganha. ${comparaPeriodo}`,
      });
    }
    // De agora (sem comparação): MRR do Financeiro e clientes em risco alto do CS.
    const bi = this.bi();
    const mrr = bi?.financeiro?.cartoes.find((cartao) => cartao.chave === 'mrrAtual');
    const mrrFormatado = mrr ? valorDoCartao(mrr) : null;
    if (mrr && mrrFormatado) {
      lista.push({
        id: 'mrr',
        icone: LucideWallet,
        valor: mrrFormatado.valor,
        prefixo: mrrFormatado.prefixo,
        unidade: mrrFormatado.unidade,
        nome: 'Receita recorrente (MRR)',
        variacao: null,
        unidadeVariacao: '%',
        dica: `${mrr.dica} Valor de hoje, sem comparação.`,
      });
    }
    const risco = bi?.cs?.cartoes.find((cartao) => cartao.chave === 'riscoAlto');
    if (risco && risco.valor !== null) {
      lista.push({
        id: 'risco-churn',
        icone: LucideHeartHandshake,
        valor: risco.valor,
        prefixo: null,
        unidade: null,
        nome: 'Clientes em risco alto',
        variacao: null,
        unidadeVariacao: '%',
        dica: `${risco.dica} Valor de hoje, sem comparação.`,
      });
    }
    return lista.map((kpi) => ({ ...kpi, legenda: semQuebraNumeroUnidade(kpi.nome) }));
  });
}
