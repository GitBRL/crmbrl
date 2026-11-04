/** Contrato de `GET /bi/:painel` (crmbrl-api, src/bi). */

export const PAINEIS = [
  'marketing',
  'comercial',
  'cs',
  'atendimento',
  'sdr',
  'financeiro',
] as const;
export type IdPainel = (typeof PAINEIS)[number];

export const ROTULO_PAINEL: Readonly<Record<IdPainel, string>> = {
  marketing: 'Marketing',
  comercial: 'Comercial',
  cs: 'Sucesso do cliente',
  atendimento: 'Atendimento',
  sdr: 'SDR com IA',
  financeiro: 'Financeiro',
};

export function ehPainel(valor: unknown): valor is IdPainel {
  return typeof valor === 'string' && (PAINEIS as readonly string[]).includes(valor);
}

export type UnidadeCartao = 'numero' | 'moeda' | 'percentual' | 'segundos' | 'dias' | 'nota';

export interface Cartao {
  readonly chave: string;
  readonly rotulo: string;
  readonly valor: number | null;
  /** `null` nos indicadores "de agora" e quando a comparação está desligada. */
  readonly anterior: number | null;
  /** Variação percentual sobre o período anterior. */
  readonly variacao: number | null;
  readonly unidade: UnidadeCartao;
  readonly melhorQuando: 'maior' | 'menor' | null;
  readonly dica: string;
}

export type TipoColuna =
  'texto' | 'numero' | 'moeda' | 'percentual' | 'segundos' | 'dias' | 'nota' | 'data' | 'id';

export interface ColunaBi {
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo: TipoColuna;
  readonly visivel: boolean;
}

export type LinhaBi = Readonly<Record<string, string | number | null>>;

export interface TabelaBi {
  readonly chave: string;
  readonly titulo: string;
  readonly dica: string;
  readonly colunas: readonly ColunaBi[];
  readonly linhas: readonly LinhaBi[];
}

export interface FiltrosEfetivos {
  readonly area: string | null;
  readonly equipeId: string | null;
  readonly pessoaId: string | null;
  readonly funilId: string | null;
  readonly canalId: string | null;
  readonly filaId: string | null;
  readonly comparar: boolean;
}

export interface RespostaPainel {
  readonly painel: IdPainel;
  readonly periodo: { readonly de: string; readonly ate: string };
  readonly anterior: { readonly de: string; readonly ate: string } | null;
  readonly geradoEm: string;
  readonly filtros: FiltrosEfetivos;
  readonly cartoes: readonly Cartao[];
  readonly tabelas: Readonly<Record<string, TabelaBi>>;
  readonly meta: Readonly<Record<string, unknown>>;
}

/** O que a pessoa escolhe nos filtros do topo (o que vai na consulta). */
export interface FiltrosBi {
  /** AAAA-MM-DD (dia inicial, inclusivo) ou `null` = últimos 30 dias. */
  readonly de: string | null;
  /** AAAA-MM-DD (dia final, inclusivo na tela; a API recebe o dia seguinte) ou `null`. */
  readonly ate: string | null;
  readonly comparar: boolean;
  readonly area: string | null;
  readonly equipeId: string | null;
  readonly pessoaId: string | null;
  readonly funilId: string | null;
  readonly canalId: string | null;
  readonly filaId: string | null;
}

export const FILTROS_PADRAO: FiltrosBi = {
  de: null,
  ate: null,
  comparar: true,
  area: null,
  equipeId: null,
  pessoaId: null,
  funilId: null,
  canalId: null,
  filaId: null,
};

export interface ArquivoExportado {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly tamanho: number;
  readonly url: string;
}

export type FormatoExportacao = 'xlsx' | 'csv';
