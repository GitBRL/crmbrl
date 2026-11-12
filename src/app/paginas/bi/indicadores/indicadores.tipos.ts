/** Contrato de `/indicadores/*` (crmbrl-api, src/indicadores, R33). */

import type { Papel } from '../../../nucleo/papeis';

export type GrupoIndicador = 'LEADS' | 'REUNIOES' | 'VENDAS' | 'LIGACOES' | 'ATIVIDADES';
export type UnidadeIndicador = 'NUMERO' | 'PERCENTUAL' | 'MOEDA' | 'DURACAO';
export type Visualizacao = 'NUMERO' | 'SERIE' | 'RANKING' | 'POR_ETAPA' | 'BARRAS' | 'FUNIL';
export type Agrupamento = 'DIA' | 'SEMANA' | 'MES';

export const ROTULO_VISUALIZACAO: Readonly<Record<Visualizacao, string>> = {
  NUMERO: 'Número',
  SERIE: 'Série no tempo',
  RANKING: 'Ranking por pessoa',
  POR_ETAPA: 'Por etapa',
  BARRAS: 'Barras',
  FUNIL: 'Funil',
};

export interface OpcaoDeParametro {
  readonly valor: string;
  readonly rotulo: string;
}

export interface ParametroDoIndicador {
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo:
    'ETAPA' | 'FUNIL' | 'TIPO_ATIVIDADE' | 'ESTATISTICA' | 'DIRECAO' | 'AGRUPAMENTO' | 'POR';
  readonly obrigatorioEm: readonly Visualizacao[] | null;
  readonly vale: readonly Visualizacao[] | null;
  readonly opcoes?: readonly OpcaoDeParametro[];
  readonly padrao?: string;
  readonly dica: string;
}

export interface IndicadorDoCatalogo {
  readonly chave: string;
  readonly nome: string;
  readonly descricao: string;
  readonly grupo: GrupoIndicador;
  readonly unidade: UnidadeIndicador;
  readonly melhorQuando: 'maior' | 'menor' | null;
  readonly agora: boolean;
  readonly parametros: readonly ParametroDoIndicador[];
  readonly visualizacoes: readonly Visualizacao[];
  readonly barras: readonly string[];
}

export interface ModeloDePainel {
  readonly chave: string;
  readonly nome: string;
  readonly descricao: string;
  readonly quantidadeDeWidgets: number;
}

export interface Catalogo {
  readonly grupos: readonly { readonly chave: GrupoIndicador; readonly rotulo: string }[];
  readonly indicadores: readonly IndicadorDoCatalogo[];
  readonly modelos: readonly ModeloDePainel[];
}

export type TipoDePeriodo =
  | 'HOJE'
  | 'ULTIMOS_7_DIAS'
  | 'ULTIMOS_30_DIAS'
  | 'MES_ATUAL'
  | 'MES_ANTERIOR'
  | 'TRIMESTRE'
  | 'ANO'
  | 'PERSONALIZADO';

export const ROTULO_PERIODO: Readonly<Record<TipoDePeriodo, string>> = {
  HOJE: 'Hoje',
  ULTIMOS_7_DIAS: 'Últimos 7 dias',
  ULTIMOS_30_DIAS: 'Últimos 30 dias',
  MES_ATUAL: 'Mês atual',
  MES_ANTERIOR: 'Mês anterior',
  TRIMESTRE: 'Trimestre atual',
  ANO: 'Ano atual',
  PERSONALIZADO: 'Outro período',
};

export interface FiltrosDoIndicador {
  readonly periodo?: { readonly tipo: TipoDePeriodo; readonly de?: string; readonly ate?: string };
  readonly comparar?: boolean;
  readonly funilIds?: readonly string[];
  readonly etapaIds?: readonly string[];
  readonly setor?: string;
  readonly equipeId?: string;
  readonly pessoaIds?: readonly string[];
  readonly origens?: readonly string[];
  readonly utmSource?: readonly string[];
  readonly utmCampaign?: readonly string[];
  readonly etiquetas?: readonly string[];
}

export interface MetaDoWidget {
  readonly geral?: number | null;
  readonly porPessoa?: number | null;
}

export interface Widget {
  readonly id: string;
  readonly indicador: string;
  readonly parametros: Readonly<Record<string, string>>;
  readonly visualizacao: Visualizacao;
  readonly titulo?: string;
  readonly filtros?: FiltrosDoIndicador;
  readonly meta?: MetaDoWidget;
  readonly largura: 1 | 2 | 3;
  readonly ordem: number;
}

export interface Compartilhamento {
  readonly setores: readonly string[];
  readonly pessoas: readonly string[];
  readonly papeis: readonly Papel[];
}

export interface PainelDeIndicadores {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly dono: { readonly id: string; readonly nome: string };
  readonly minha: boolean;
  readonly podeEditar: boolean;
  readonly modelo: string | null;
  readonly filtrosPadrao: FiltrosDoIndicador;
  readonly widgets: readonly Widget[];
  readonly quantidadeDeWidgets: number;
  readonly compartilhamento: Compartilhamento | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface ProgressoDeMeta {
  readonly alvo: number;
  readonly progresso: number | null;
  readonly atingida: boolean;
}

export interface LinhaDoWidget {
  readonly id: string | null;
  readonly rotulo: string;
  readonly valor: number | null;
  readonly conversao?: number | null;
  readonly conversaoTotal?: number | null;
  readonly tipo?: string | null;
  readonly meta?: ProgressoDeMeta | null;
}

export interface PontoDaSerie {
  readonly chave: string;
  readonly rotulo: string;
  readonly valor: number | null;
}

export interface CliqueDoWidget {
  readonly lista: 'NEGOCIOS' | 'ATIVIDADES';
  readonly filtros: Readonly<Record<string, unknown>>;
}

export interface ResultadoDoWidget {
  readonly id: string;
  readonly indicador: string;
  readonly nome: string;
  readonly visualizacao: Visualizacao;
  readonly titulo: string;
  readonly unidade: UnidadeIndicador;
  readonly melhorQuando: 'maior' | 'menor' | null;
  readonly largura: 1 | 2 | 3;
  readonly ordem: number;
  readonly periodo: { readonly de: string; readonly ate: string } | null;
  readonly anterior: { readonly de: string; readonly ate: string } | null;
  readonly ok: boolean;
  readonly erro?: { readonly mensagem: string; readonly status: number };
  readonly valor?: number | null;
  readonly valorAnterior?: number | null;
  readonly variacao?: number | null;
  readonly meta?: ProgressoDeMeta | null;
  readonly agrupamento?: Agrupamento;
  readonly por?: string;
  readonly funil?: { readonly id: string; readonly nome: string; readonly area: string } | null;
  readonly pontos?: readonly PontoDaSerie[];
  readonly linhas?: readonly LinhaDoWidget[];
  readonly clique?: CliqueDoWidget | null;
}

export interface RespostaDeCalculo {
  readonly painelId: string | null;
  readonly geradoEm: string;
  readonly periodo: { readonly de: string; readonly ate: string } | null;
  readonly anterior: { readonly de: string; readonly ate: string } | null;
  readonly filtros: Readonly<Record<string, unknown>> | null;
  readonly widgets: readonly ResultadoDoWidget[];
}

export interface EntradaDePainel {
  readonly nome?: string;
  readonly descricao?: string | null;
  readonly modelo?: string;
  readonly filtrosPadrao?: FiltrosDoIndicador;
  readonly widgets?: readonly Widget[];
  readonly compartilhamento?: Partial<Compartilhamento>;
}

export interface PedidoDeCalculo {
  readonly painelId?: string;
  readonly widgets?: readonly Widget[];
  readonly filtros?: FiltrosDoIndicador;
}
