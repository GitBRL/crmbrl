import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from '../../nucleo/api/api';
import { paraNumero } from '../../nucleo/formatos';
import {
  AREAS,
  ROTULO_AREA,
  SLUG_AREA,
  type Area,
  type SlugArea,
} from '../../nucleo/sessao/perfil';
import type { SerieFunil } from '../../ui/barra-funil/barra-funil';

/**
 * Métricas reais da jornada (R5.10) para a aba "Jornada do cliente" da Visão geral: os
 * funis-base que a pessoa vê (`GET /funis`), as métricas de cada um no período e no período
 * anterior (`GET /funis/:id/metricas`) e a receita dos negócios ganhos no Comercial
 * (`GET /negocios`, somando os ganhos dentro do período). A API já recorta pelo que a pessoa
 * vê (R5.9): um membro do Comercial vê só o funil Comercial e os negócios dele.
 */

type TipoEtapa = 'ABERTA' | 'GANHO' | 'PERDIDO';

interface EtapaResumida {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoEtapa;
  readonly ordem: number;
}

export interface FunilDaJornada {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
  readonly base: boolean;
  readonly ativo: boolean;
}

/** `GET /funis/:id/metricas` (crmbrl-api, funis/dto/metricas.dto.ts). */
export interface MetricasDoFunil {
  readonly funil: { readonly id: string; readonly nome: string; readonly area: Area };
  readonly periodo: { readonly de: string; readonly ate: string };
  readonly etapas: readonly {
    readonly etapa: EtapaResumida & { readonly prazoDias?: number | null };
    readonly negociosAtuais: number;
    readonly valorAtual: string;
    readonly parados?: number | null;
    readonly entradasNoPeriodo: number;
    readonly saidasNoPeriodo: number;
    readonly tempoMedioSegundos?: number | null;
    readonly tempoMedioDias?: number | null;
  }[];
  readonly conversoes: readonly {
    readonly deEtapa: EtapaResumida;
    readonly paraEtapa: EtapaResumida;
    readonly alcancaramOrigem: number;
    readonly alcancaramDestino: number;
    readonly taxa?: number | null;
  }[];
  readonly coorte: {
    readonly criados: number;
    readonly abertos: number;
    readonly ganhos: number;
    readonly perdidos: number;
    readonly taxaDeGanho?: number | null;
  };
  readonly cicloMedio: {
    readonly negociosGanhos: number;
    readonly segundos?: number | null;
    readonly dias?: number | null;
  };
  readonly parados: number;
}

interface NegocioGanho {
  readonly valor: string | null;
  readonly ganhoEm: string | null;
  readonly atualizadoEm: string;
}

/** O que a jornada recebe de cada área visível. */
export interface MedidasDaArea {
  readonly funil: FunilDaJornada;
  readonly atual: MetricasDoFunil;
  /** O período anterior, do mesmo tamanho (para as variações dos indicadores). */
  readonly anterior: MetricasDoFunil | null;
}

export interface ReceitaGanha {
  readonly valor: number;
  readonly negocios: number;
}

export interface MedidasDaJornada {
  readonly areas: readonly MedidasDaArea[];
  /** `null` quando a pessoa não vê o Comercial. */
  readonly receita: ReceitaGanha | null;
}

/** Até quantas páginas de ganhos somar na receita (100 por página). */
const PAGINAS_DE_GANHOS = 5;

@Injectable({ providedIn: 'root' })
export class MetricasJornadaApi {
  private readonly http = inject(HttpClient);

  /**
   * Tudo de uma vez para o período `[de, ate)`: os funis-base visíveis, as métricas de cada
   * um no período e no anterior, e a receita ganha no Comercial.
   */
  async carregar(de: Date, ate: Date): Promise<MedidasDaJornada> {
    const funis = await firstValueFrom(this.http.get<readonly FunilDaJornada[]>(urlApi('funis')));
    const base = AREAS.map((area) =>
      funis.find((funil) => funil.area === area && funil.base && funil.ativo),
    ).filter((funil): funil is FunilDaJornada => !!funil);
    const duracao = ate.getTime() - de.getTime();
    const deAnterior = new Date(de.getTime() - duracao);
    const comercial = base.find((funil) => funil.area === 'COMERCIAL');
    const [areas, receita] = await Promise.all([
      Promise.all(
        base.map(async (funil) => {
          const [atual, anterior] = await Promise.all([
            this.metricas(funil.id, de, ate),
            this.metricas(funil.id, deAnterior, de).catch(() => null),
          ]);
          return { funil, atual, anterior };
        }),
      ),
      comercial ? this.receitaGanha(comercial.id, de, ate) : Promise.resolve(null),
    ]);
    return { areas, receita };
  }

  private metricas(funilId: string, de: Date, ate: Date) {
    return firstValueFrom(
      this.http.get<MetricasDoFunil>(urlApi('funis', funilId, 'metricas'), {
        params: parametros({ de, ate }),
      }),
    );
  }

  /**
   * Soma o valor dos negócios ganhos no período. A lista não filtra pela data do ganho:
   * vem dos atualizados mais recentes para os mais antigos (todo ganho no período foi
   * atualizado no período), parando quando a página já é anterior ao início.
   */
  private async receitaGanha(funilId: string, de: Date, ate: Date): Promise<ReceitaGanha> {
    let valor = 0;
    let negocios = 0;
    for (let pagina = 1; pagina <= PAGINAS_DE_GANHOS; pagina++) {
      const resposta = await firstValueFrom(
        this.http.get<Pagina<NegocioGanho>>(urlApi('negocios'), {
          params: parametros({
            funilId,
            status: 'GANHO',
            ordenarPor: 'atualizadoEm',
            direcao: 'desc',
            pagina,
            porPagina: 100,
          }),
        }),
      );
      for (const negocio of resposta.itens) {
        const ganhoEm = negocio.ganhoEm ? new Date(negocio.ganhoEm).getTime() : NaN;
        if (ganhoEm >= de.getTime() && ganhoEm < ate.getTime()) {
          valor += paraNumero(negocio.valor) ?? 0;
          negocios++;
        }
      }
      const ultimo = resposta.itens[resposta.itens.length - 1];
      if (
        !ultimo ||
        resposta.pagina * resposta.porPagina >= resposta.total ||
        new Date(ultimo.atualizadoEm).getTime() < de.getTime()
      ) {
        break;
      }
    }
    return { valor, negocios };
  }
}

// ---------------------------------------------------------------------------------------
// A jornada para a tela
// ---------------------------------------------------------------------------------------

export interface EtapaDaJornada {
  readonly id: string;
  readonly etapa: string;
  /** Negócios criados no período que chegaram a esta etapa (ou passaram dela). */
  readonly total: number;
  /** Dos que chegaram: os que seguiram até a barra seguinte e os que pararam ali. */
  readonly series: readonly SerieFunil[];
  /** Queda em % em relação à etapa anterior mostrada; `null` na primeira. */
  readonly queda: number | null;
  /** Tempo médio na etapa, em dias inteiros; `null` sem saídas no período (ou no ganho). */
  readonly tempoMedioDias: number | null;
}

export interface AreaDaJornada {
  readonly area: Area;
  readonly rotulo: string;
  readonly slug: SlugArea;
  readonly funilId: string;
  /** Todas as etapas da conversão: as abertas em ordem e, por último, a de ganho. */
  readonly etapas: readonly EtapaDaJornada[];
  /** Só a entrada e o ganho (a área recolhida), com a queda entre os dois. */
  readonly extremos: readonly EtapaDaJornada[];
  readonly parados: number;
  readonly criados: number;
  readonly ganhos: number;
  /** Nome da etapa de ganho ("Qualificado (MQL)", "Ganho", "Renovado"). */
  readonly etapaGanho: string;
  /** Como o negócio chega a esta área sozinho (a área anterior também visível). */
  readonly passagem: string | null;
}

export interface IndicadorDaJornada<Valor = number> {
  /** O número (no ciclo, também um texto pronto: "< 1" min); `null` sem valor. */
  readonly valor: Valor | null;
  /** "%", "d", "h", "min"… (`null` sem valor). */
  readonly unidade: string | null;
  readonly legenda: string;
  readonly dica: string;
}

export interface JornadaReal {
  readonly areas: readonly AreaDaJornada[];
  /** O maior total de entrada: a largura de referência das barras. */
  readonly referencia: number;
  readonly conversao: IndicadorDaJornada;
  readonly ciclo: IndicadorDaJornada<number | string>;
  /** Receita ganha (vendo o Comercial) ou negócios parados agora. */
  readonly terceiro: IndicadorDaJornada & { readonly tipo: 'receita' | 'parados' };
  /** Há negócios criados ou ganhos no período (senão, a tela mostra o estado vazio). */
  readonly temDados: boolean;
}

export interface IndicadoresReais {
  /**
   * Negócios novos no período, na primeira área visível: leads (Marketing) para quem vê a
   * jornada inteira; os da própria área para quem vê uma só. `null` sem funis visíveis.
   */
  readonly novos: {
    readonly area: Area;
    readonly valor: number;
    readonly variacao: number | null;
  } | null;
  /**
   * Taxa de ganho do Comercial em %, só para quem vê mais de uma área (com uma só, a jornada
   * já a mostra no lugar da conversão total).
   */
  readonly taxaGanho: {
    readonly valor: number | null;
    readonly variacao: number | null;
    readonly ganhos: number;
    readonly criados: number;
  } | null;
}

const PASSAGENS: Readonly<Partial<Record<Area, { readonly de: Area; readonly texto: string }>>> = {
  COMERCIAL: {
    de: 'MARKETING',
    texto:
      'Quando o Marketing marca o lead como qualificado (MQL), o CRM cria sozinho o negócio no funil Comercial e o distribui por rodízio. Por isso o Comercial também conta negócios criados à mão.',
  },
  CS: {
    de: 'COMERCIAL',
    texto:
      'Todo negócio ganho no Comercial entra sozinho no funil de Customer Success, na etapa Boas-vindas, levando o valor e o valor recorrente.',
  },
};

const LEGENDA_CONVERSAO: Readonly<Record<Area, string>> = {
  MARKETING: 'Taxa de qualificação',
  COMERCIAL: 'Taxa de ganho',
  CS: 'Taxa de renovação',
};

const LEGENDA_CICLO: Readonly<Record<Area, string>> = {
  MARKETING: 'Ciclo até a qualificação',
  COMERCIAL: 'Ciclo médio de venda',
  CS: 'Ciclo até a renovação',
};

const numero = (valor: number) => new Intl.NumberFormat('pt-BR').format(valor);

const SEGUNDOS_POR_DIA = 86_400;
const SEGUNDOS_POR_HORA = 3_600;

/**
 * Uma duração com a unidade que a faz legível: dias com uma casa a partir de um dia; abaixo
 * disso, horas e, abaixo de uma hora, minutos (um ciclo de 40 minutos não vira "0 d"). Menos
 * de meio minuto vira "< 1 min", não "0 min" (o negócio ganho na hora em que foi criado).
 */
export function duracaoCurta(segundos: number): {
  readonly valor: number | string;
  readonly unidade: 'd' | 'h' | 'min';
} {
  if (segundos >= SEGUNDOS_POR_DIA) {
    return { valor: Math.round((segundos / SEGUNDOS_POR_DIA) * 10) / 10, unidade: 'd' };
  }
  if (segundos >= SEGUNDOS_POR_HORA) {
    return { valor: Math.round(segundos / SEGUNDOS_POR_HORA), unidade: 'h' };
  }
  const minutos = Math.round(segundos / 60);
  return { valor: minutos < 1 ? '< 1' : minutos, unidade: 'min' };
}

/** `parte` em % de `todo`, com uma casa (`null` quando `todo` é 0). */
export function percentual(parte: number, todo: number): number | null {
  return todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null;
}

/** Rótulos das séries das barras: quem seguiu para a barra seguinte e quem parou. */
export const SERIES_JORNADA = ['Seguiram adiante', 'Pararam na etapa'] as const;

interface PassoDaJornada {
  readonly id: string;
  readonly etapa: string;
  readonly total: number;
  readonly tempoMedioDias: number | null;
}

/**
 * Cada barra mostra, dos que chegaram a ela, quantos seguiram até a barra seguinte (ciano) e
 * quantos pararam ali (menta); a última barra (o ganho) é toda de quem chegou.
 */
function comSeries(passos: readonly PassoDaJornada[]): readonly EtapaDaJornada[] {
  return passos.map((passo, indice) => {
    const seguinte = passos[indice + 1];
    const anterior = passos[indice - 1];
    const series: readonly SerieFunil[] = seguinte
      ? [
          { rotulo: SERIES_JORNADA[0], valor: seguinte.total },
          { rotulo: SERIES_JORNADA[1], valor: Math.max(0, passo.total - seguinte.total) },
        ]
      : [{ rotulo: 'Chegaram', valor: passo.total }];
    return {
      ...passo,
      series,
      queda: anterior ? queda(anterior.total, passo.total) : null,
    };
  });
}

function montarArea(medidas: MedidasDaArea, anterior: Area | null): AreaDaJornada {
  const { funil, atual } = medidas;
  const tempo = new Map(
    atual.etapas.map((linha) => [
      linha.etapa.id,
      linha.tempoMedioDias === null || linha.tempoMedioDias === undefined
        ? null
        : Math.round(linha.tempoMedioDias),
    ]),
  );
  const sequencia = atual.conversoes.length
    ? [
        { etapa: atual.conversoes[0].deEtapa, total: atual.conversoes[0].alcancaramOrigem },
        ...atual.conversoes.map((conversao) => ({
          etapa: conversao.paraEtapa,
          total: conversao.alcancaramDestino,
        })),
      ]
    : atual.etapas
        .filter((linha) => linha.etapa.tipo !== 'PERDIDO')
        .slice(0, 1)
        .map((linha) => ({ etapa: linha.etapa, total: atual.coorte.criados }));
  const passos = sequencia.map<PassoDaJornada>((item) => ({
    id: item.etapa.id,
    etapa: item.etapa.nome,
    total: item.total,
    tempoMedioDias: item.etapa.tipo === 'GANHO' ? null : (tempo.get(item.etapa.id) ?? null),
  }));
  const extremos = passos.length > 2 ? [passos[0], passos[passos.length - 1]] : passos;
  const passagem = PASSAGENS[funil.area];
  return {
    area: funil.area,
    rotulo: ROTULO_AREA[funil.area],
    slug: SLUG_AREA[funil.area],
    funilId: funil.id,
    etapas: comSeries(passos),
    extremos: comSeries(extremos),
    parados: atual.parados,
    criados: atual.coorte.criados,
    ganhos: atual.coorte.ganhos,
    etapaGanho: atual.etapas.find((linha) => linha.etapa.tipo === 'GANHO')?.etapa.nome ?? 'ganho',
    passagem: passagem && passagem.de === anterior ? passagem.texto : null,
  };
}

function queda(antes: number, depois: number): number | null {
  return antes > 0 ? Math.round(((antes - depois) / antes) * 1000) / 10 : null;
}

/** As métricas da API → o que a aba "Jornada do cliente" desenha. */
export function montarJornada(medidas: MedidasDaJornada): JornadaReal {
  const areas = medidas.areas.map((area, indice) =>
    montarArea(area, indice > 0 ? medidas.areas[indice - 1].funil.area : null),
  );
  const primeira = areas[0];
  const final = areas.find((area) => area.area === 'COMERCIAL') ?? areas[areas.length - 1];
  const umaSo = areas.length === 1;

  const taxa = (valor: number | null) => ({ valor, unidade: valor === null ? null : '%' });
  const conversao: IndicadorDaJornada =
    !primeira || !final
      ? {
          ...taxa(null),
          legenda: 'Conversão total do funil',
          dica: 'Sem funis visíveis.',
        }
      : umaSo
        ? {
            ...taxa(percentual(final.ganhos, final.criados)),
            legenda: LEGENDA_CONVERSAO[final.area],
            dica: `Negócios criados no período que chegaram a “${final.etapaGanho}”: ${numero(final.ganhos)} de ${numero(final.criados)}.`,
          }
        : {
            ...taxa(percentual(final.ganhos, primeira.criados)),
            legenda: 'Conversão total do funil',
            dica: `Negócios ganhos no ${final.rotulo} em relação aos leads que entraram no ${primeira.rotulo} no período: ${numero(final.ganhos)} de ${numero(primeira.criados)}.`,
          };

  const medidasDoCiclo = medidas.areas.find((area) => area.funil.area === final?.area);
  const ciclo = medidasDoCiclo?.atual.cicloMedio;
  const segundosDoCiclo =
    ciclo?.segundos ??
    (ciclo?.dias === null || ciclo?.dias === undefined ? null : ciclo.dias * SEGUNDOS_POR_DIA);
  const duracao =
    ciclo && ciclo.negociosGanhos > 0 && segundosDoCiclo !== null
      ? duracaoCurta(segundosDoCiclo)
      : null;
  const cicloIndicador: IndicadorDaJornada<number | string> = {
    valor: duracao?.valor ?? null,
    unidade: duracao?.unidade ?? null,
    legenda: final ? LEGENDA_CICLO[final.area] : 'Ciclo médio',
    dica:
      ciclo && ciclo.negociosGanhos > 0
        ? `Tempo médio entre a criação do negócio e “${final?.etapaGanho}”, dos ${numero(ciclo.negociosGanhos)} que chegaram lá no período.`
        : `Nenhum negócio chegou a “${final?.etapaGanho ?? 'ganho'}” no período.`,
  };

  const terceiro: JornadaReal['terceiro'] = medidas.receita
    ? {
        tipo: 'receita',
        valor: medidas.receita.valor,
        unidade: null,
        legenda: 'Receita ganha',
        dica:
          medidas.receita.negocios > 0
            ? `Soma do valor dos ${numero(medidas.receita.negocios)} negócios ganhos no Comercial no período.`
            : 'Nenhum negócio ganho no Comercial no período.',
      }
    : {
        tipo: 'parados',
        valor: areas.reduce((soma, area) => soma + area.parados, 0),
        unidade: null,
        legenda: 'Negócios parados agora',
        dica: 'Negócios abertos há mais tempo que o prazo-alvo da etapa em que estão.',
      };

  return {
    areas,
    referencia: Math.max(0, ...areas.map((area) => area.etapas[0]?.total ?? 0)),
    conversao,
    ciclo: cicloIndicador,
    terceiro,
    temDados: medidas.areas.some(
      (area) => area.atual.coorte.criados > 0 || area.atual.cicloMedio.negociosGanhos > 0,
    ),
  };
}

/** Negócios novos e taxa de ganho reais, com a variação em relação ao período anterior. */
export function montarIndicadores(medidas: MedidasDaJornada): IndicadoresReais {
  const primeira = medidas.areas[0];
  const comercial = medidas.areas.find((area) => area.funil.area === 'COMERCIAL');
  const taxa = (metricas: MetricasDoFunil | null | undefined) =>
    metricas ? percentual(metricas.coorte.ganhos, metricas.coorte.criados) : null;
  const taxaAtual = taxa(comercial?.atual);
  const taxaAnterior = taxa(comercial?.anterior);
  return {
    novos: primeira
      ? {
          area: primeira.funil.area,
          valor: primeira.atual.coorte.criados,
          variacao: primeira.anterior
            ? percentual(
                primeira.atual.coorte.criados - primeira.anterior.coorte.criados,
                primeira.anterior.coorte.criados,
              )
            : null,
        }
      : null,
    taxaGanho:
      comercial && medidas.areas.length > 1
        ? {
            valor: taxaAtual,
            variacao:
              taxaAtual !== null && taxaAnterior !== null
                ? Math.round((taxaAtual - taxaAnterior) * 10) / 10
                : null,
            ganhos: comercial.atual.coorte.ganhos,
            criados: comercial.atual.coorte.criados,
          }
        : null,
  };
}

/** Quem aparece na pilha de avatares do cabeçalho (os usuários ativos que a pessoa vê). */
export interface PessoaDoCrm {
  readonly nome: string;
  readonly foto: string | null;
}

/** Usuários ativos visíveis (C-level e Admin: todos; líder: a equipe). */
@Injectable({ providedIn: 'root' })
export class PessoasDoCrmApi {
  private readonly http = inject(HttpClient);

  async listar(): Promise<readonly PessoaDoCrm[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<{ readonly nome: string; readonly avatarUrl: string | null }>>(
        urlApi('usuarios'),
        { params: parametros({ ativo: true, porPagina: 50 }) },
      ),
    );
    return pagina.itens.map((usuario) => ({ nome: usuario.nome, foto: usuario.avatarUrl }));
  }
}
