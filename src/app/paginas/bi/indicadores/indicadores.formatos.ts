import { abreviarNumero } from '../../../nucleo/formatos';
import { slugDaArea } from '../../../nucleo/setores/setores';
import { formatarCelula, formatarDuracao, valorDoCartao, type ValorDoCartao } from '../bi.formatos';
import type { TabelaBi, TipoColuna, UnidadeCartao } from '../bi.tipos';
import type {
  Agrupamento,
  CliqueDoWidget,
  Compartilhamento,
  FiltrosDoIndicador,
  IndicadorDoCatalogo,
  ResultadoDoWidget,
  UnidadeIndicador,
  Visualizacao,
  Widget,
} from './indicadores.tipos';

const UNIDADE_DO_CARTAO: Readonly<Record<UnidadeIndicador, UnidadeCartao>> = {
  NUMERO: 'numero',
  PERCENTUAL: 'percentual',
  MOEDA: 'moeda',
  DURACAO: 'segundos',
};

const TIPO_DA_COLUNA: Readonly<Record<UnidadeIndicador, TipoColuna>> = {
  NUMERO: 'numero',
  PERCENTUAL: 'percentual',
  MOEDA: 'moeda',
  DURACAO: 'segundos',
};

/** O número grande de um widget (com prefixo e unidade pequenos), ou `null` sem valor. */
export function valorDoWidget(
  unidade: UnidadeIndicador,
  valor: number | null | undefined,
): ValorDoCartao | null {
  return valorDoCartao({ valor: valor ?? null, unidade: UNIDADE_DO_CARTAO[unidade] });
}

/** O valor escrito por extenso ("R$ 8.000", "75%", "1 h 14 min"), para tabelas e metas. */
export function textoDoValor(unidade: UnidadeIndicador, valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  if (unidade === 'DURACAO') {
    return formatarDuracao(valor);
  }
  if (unidade === 'MOEDA') {
    const { numero, sufixo } = abreviarNumero(valor, 'pt-BR');
    return `R$ ${numero}${sufixo ? ` ${sufixo}` : ''}`;
  }
  return formatarCelula(valor, TIPO_DA_COLUNA[unidade]);
}

/** O widget como `TabelaBi`: serve ao gráfico (`montarGrafico`) e à alternativa em números. */
export function tabelaDoWidget(resultado: ResultadoDoWidget): TabelaBi {
  const tipo = TIPO_DA_COLUNA[resultado.unidade];
  const colunaValor = { chave: 'valor', rotulo: resultado.nome, tipo, visivel: true } as const;
  if (resultado.visualizacao === 'SERIE') {
    return {
      chave: resultado.id,
      titulo: resultado.titulo,
      dica: resultado.nome,
      colunas: [{ chave: 'rotulo', rotulo: 'Período', tipo: 'texto', visivel: true }, colunaValor],
      linhas: (resultado.pontos ?? []).map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
    };
  }
  const comFunil = resultado.visualizacao === 'FUNIL';
  return {
    chave: resultado.id,
    titulo: resultado.titulo,
    dica: resultado.nome,
    colunas: [
      { chave: 'id', rotulo: 'Id', tipo: 'id', visivel: false },
      {
        chave: 'rotulo',
        rotulo:
          resultado.visualizacao === 'RANKING'
            ? 'Pessoa'
            : resultado.visualizacao === 'BARRAS'
              ? 'Categoria'
              : 'Etapa',
        tipo: 'texto',
        visivel: true,
      },
      comFunil ? { ...colunaValor, rotulo: 'Negócios', tipo: 'numero' } : colunaValor,
      ...(comFunil
        ? [
            {
              chave: 'conversao',
              rotulo: 'Sobre a anterior',
              tipo: 'percentual',
              visivel: true,
            } as const,
            {
              chave: 'conversaoTotal',
              rotulo: 'Sobre a primeira',
              tipo: 'percentual',
              visivel: true,
            } as const,
          ]
        : []),
    ],
    linhas: (resultado.linhas ?? []).map((l) => ({
      id: l.id,
      rotulo: l.rotulo,
      valor: l.valor,
      conversao: l.conversao ?? null,
      conversaoTotal: l.conversaoTotal ?? null,
    })),
  };
}

/** Rota e consulta que abrem a lista que sustenta o número (R20.8). `null` quando não há lista. */
export interface DestinoDaLista {
  readonly comandos: readonly string[];
  readonly consulta: Readonly<Record<string, string>>;
}

export function destinoDoClique(
  clique: CliqueDoWidget | null | undefined,
  extra: { readonly responsavelId?: string | null; readonly area?: string | null } = {},
): DestinoDaLista | null {
  if (!clique) {
    return null;
  }
  const filtros: Record<string, unknown> = { ...clique.filtros };
  if (extra.responsavelId) {
    filtros['responsavelId'] = extra.responsavelId;
  }
  if (clique.lista === 'ATIVIDADES') {
    const resultado = (filtros['resultadoReuniao'] as readonly string[] | undefined)?.[0];
    const consulta: Record<string, string> = { escopo: 'TODAS' };
    if (filtros['tipo']) {
      consulta['tipo'] = (filtros['tipo'] as readonly string[]).join(',');
    }
    if (resultado) {
      consulta['resultado'] = resultado;
    }
    if (filtros['atrasadas']) {
      consulta['aba'] = 'pendentes';
    }
    return { comandos: ['/atividades'], consulta };
  }
  const consulta: Record<string, string> = {};
  if (filtros['funilId']) {
    consulta['funil'] = String(filtros['funilId']);
  }
  return { comandos: ['/funis', slugDaArea(extra.area ?? 'COMERCIAL')], consulta };
}

/** Linha de etapa → quadro do funil só naquela etapa. */
export function destinoDaEtapa(
  area: string,
  funilId: string,
  etapaId: string | null,
  base: boolean,
): DestinoDaLista | null {
  if (!etapaId) {
    return null;
  }
  return {
    comandos: ['/funis', slugDaArea(area)],
    consulta: { etapaId, ...(base ? {} : { funil: funilId }) },
  };
}

export const ROTULO_AGRUPAMENTO: Readonly<Record<Agrupamento, string>> = {
  DIA: 'por dia',
  SEMANA: 'por semana',
  MES: 'por mês',
};

/** Largura da grade: `largura` 1 a 3 colunas. */
export function colunasDoWidget(largura: number): number {
  return Math.min(3, Math.max(1, largura));
}

/** Parâmetros padrão (o que o catálogo declara) para uma visualização de um indicador. */
export function parametrosPadrao(
  indicador: IndicadorDoCatalogo,
  visualizacao: Visualizacao,
): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const p of indicador.parametros) {
    if (p.vale && !p.vale.includes(visualizacao)) {
      continue;
    }
    if (p.padrao && p.tipo !== 'ESTATISTICA' && p.tipo !== 'DIRECAO') {
      resultado[p.chave] = p.padrao;
    }
  }
  return resultado;
}

/** Texto curto do filtro ativo, para os chips ("2 funis", "Setor: Comercial"). */
export function filtrosAtivos(filtros: FiltrosDoIndicador | undefined): number {
  if (!filtros) {
    return 0;
  }
  return (
    [
      filtros.funilIds?.length,
      filtros.etapaIds?.length,
      filtros.setor,
      filtros.equipeId,
      filtros.pessoaIds?.length,
      filtros.origens?.length,
      filtros.utmSource?.length,
      filtros.utmCampaign?.length,
      filtros.etiquetas?.length,
    ] as const
  ).filter(Boolean).length;
}

/** Move um widget e renumera a ordem (arrastar ou botões). */
export function reordenarWidgets(
  widgets: readonly Widget[],
  de: number,
  para: number,
): readonly Widget[] {
  if (de === para || de < 0 || para < 0 || de >= widgets.length || para >= widgets.length) {
    return widgets;
  }
  const copia = [...widgets];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia.map((w, ordem) => ({ ...w, ordem }));
}

export const SEM_COMPARTILHAMENTO: Compartilhamento = { setores: [], pessoas: [], papeis: [] };
