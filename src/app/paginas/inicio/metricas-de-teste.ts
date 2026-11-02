import type { Area } from '../../nucleo/sessao/perfil';
import type { MedidasDaArea, MetricasDoFunil } from './metricas-jornada';

/**
 * **Só para testes (specs).** Métricas de funil falsas, no formato de
 * `GET /funis/:id/metricas`, para a jornada da Visão geral. Nenhum código do app importa isto.
 */

type Tipo = 'ABERTA' | 'GANHO' | 'PERDIDO';

/** Métricas de um funil a partir das etapas (nome, tipo, tempo médio) e dos alcances. */
export function metricas(
  area: Area,
  etapas: readonly (readonly [string, Tipo, number | null])[],
  alcances: readonly number[],
  ajustes: {
    readonly criados?: number;
    readonly ganhos?: number;
    readonly ganhosNoPeriodo?: number;
    readonly cicloDias?: number | null;
    /** Padrão: os dias do ciclo em segundos. */
    readonly cicloSegundos?: number | null;
    readonly parados?: number;
  } = {},
): MetricasDoFunil {
  const comId = etapas.map(([nome, tipo, tempo], indice) => ({
    etapa: { id: `${area}-${indice}`, nome, tipo, ordem: indice + 1 },
    tempo,
  }));
  const sequencia = comId.filter((item) => item.etapa.tipo !== 'PERDIDO');
  const criados = ajustes.criados ?? alcances[0] ?? 0;
  const ganhos = ajustes.ganhos ?? alcances[alcances.length - 1] ?? 0;
  return {
    funil: { id: `funil-${area}`, nome: area, area },
    periodo: { de: '2026-09-22T03:00:00.000Z', ate: '2026-10-21T22:00:00.000Z' },
    etapas: comId.map(({ etapa, tempo }) => ({
      etapa,
      negociosAtuais: 0,
      valorAtual: '0.00',
      entradasNoPeriodo: 0,
      saidasNoPeriodo: 0,
      tempoMedioDias: tempo,
    })),
    conversoes: sequencia.slice(1).map((item, indice) => ({
      deEtapa: sequencia[indice].etapa,
      paraEtapa: item.etapa,
      alcancaramOrigem: alcances[indice],
      alcancaramDestino: alcances[indice + 1],
    })),
    coorte: { criados, abertos: 0, ganhos, perdidos: 0 },
    cicloMedio: {
      negociosGanhos: ajustes.ganhosNoPeriodo ?? ganhos,
      segundos:
        ajustes.cicloSegundos ??
        (ajustes.cicloDias === undefined || ajustes.cicloDias === null
          ? null
          : ajustes.cicloDias * 86_400),
      dias: ajustes.cicloDias ?? null,
    },
    parados: ajustes.parados ?? 0,
  };
}

export const MARKETING = metricas(
  'MARKETING',
  [
    ['Novo lead', 'ABERTA', 2],
    ['Em contato', 'ABERTA', 3.4],
    ['Nutrição', 'ABERTA', null],
    ['Qualificado (MQL)', 'GANHO', null],
    ['Descartado', 'PERDIDO', null],
  ],
  [20, 10, 6, 4],
  { cicloDias: 6.5, parados: 3 },
);
export const COMERCIAL = metricas(
  'COMERCIAL',
  [
    ['Novo', 'ABERTA', 1],
    ['Qualificação', 'ABERTA', 4],
    ['Ganho', 'GANHO', null],
    ['Perdido', 'PERDIDO', null],
  ],
  [12, 8, 3],
  { cicloDias: 12 },
);
export const CS = metricas(
  'CS',
  [
    ['Boas-vindas', 'ABERTA', 2],
    ['Onboarding', 'ABERTA', 10],
    ['Renovado', 'GANHO', null],
    ['Cancelado (churn)', 'PERDIDO', null],
  ],
  [5, 4, 1],
  { cicloDias: 30, parados: 1 },
);

export function area(
  atual: MetricasDoFunil,
  anterior: MetricasDoFunil | null = null,
): MedidasDaArea {
  return {
    funil: {
      id: atual.funil.id,
      nome: atual.funil.nome,
      area: atual.funil.area,
      base: true,
      ativo: true,
    },
    atual,
    anterior,
  };
}
