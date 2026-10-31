/** Tipos e regras puras do assistente de importação (`/contatos/importar`, R16). */

export type TipoImportacao = 'CONTATOS' | 'EMPRESAS' | 'PARCELAS';
export type StatusImportacao =
  'RASCUNHO' | 'NA_FILA' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHOU' | 'CANCELADA';
export type PoliticaDuplicados = 'ATUALIZAR_VAZIOS' | 'IGNORAR' | 'SOBRESCREVER';
export type EstrategiaResponsavel = 'RODIZIO' | 'RESPONSAVEL_FIXO';
export type AreaRodizio = 'MARKETING' | 'COMERCIAL' | 'CS';
export type ResultadoLinha = 'CRIADO' | 'ATUALIZADO' | 'IGNORADO' | 'ERRO';

export interface LeituraArquivo {
  readonly separador?: ',' | ';' | '\t' | '|';
  readonly codificacao?: 'utf-8' | 'latin1';
  readonly aba?: string;
  readonly linhaCabecalho?: number;
}

/** `{ coluna do arquivo: campo do CRM }`. Colunas não importadas ficam de fora. */
export type Mapeamento = Readonly<Record<string, string>>;

export interface Importacao {
  readonly id: string;
  readonly tipo: TipoImportacao;
  readonly status: StatusImportacao;
  readonly nome: string;
  readonly arquivoId: string;
  readonly formato: string;
  readonly leitura: LeituraArquivo;
  readonly colunas: readonly string[];
  readonly totalLinhas: number;
  readonly mapeamento: Mapeamento;
  readonly modeloId: string | null;
  readonly duplicados: PoliticaDuplicados;
  readonly etiquetas: readonly string[];
  readonly estrategiaResponsavel: EstrategiaResponsavel | null;
  readonly responsavelId: string | null;
  readonly areaRodizio: AreaRodizio | null;
  readonly origemDetalhe: string | null;
  readonly processadas: number;
  readonly criados: number;
  readonly atualizados: number;
  readonly ignorados: number;
  readonly erros: number;
  readonly progresso: number;
  readonly relatorioId: string | null;
  readonly erro: string | null;
  readonly iniciadaEm: string | null;
  readonly concluidaEm: string | null;
  readonly criadoEm: string;
  readonly criadoPor: { readonly id: string; readonly nome: string } | null;
}

export interface LinhaDaPrevia {
  readonly numero: number;
  readonly valores: readonly (string | null)[];
}

export interface Previa {
  readonly colunas: readonly string[];
  readonly linhas: readonly LinhaDaPrevia[];
  readonly totalLinhas: number;
  readonly sugestao: Mapeamento;
  readonly abas?: readonly string[];
}

export interface ImportacaoCriada extends Importacao {
  readonly previa: Previa;
}

export interface CampoImportavel {
  readonly chave: string;
  readonly rotulo: string;
  readonly obrigatorio: boolean;
}

export interface ModeloMapeamento {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoImportacao;
  readonly mapeamento: Mapeamento;
  readonly opcoes?: {
    readonly duplicados?: PoliticaDuplicados;
    readonly etiquetas?: readonly string[];
  };
  readonly criadoEm: string;
}

export interface LinhaImportada {
  readonly numero: number;
  readonly resultado: ResultadoLinha;
  readonly entidadeId: string | null;
  readonly motivo: string | null;
  readonly dados: Readonly<Record<string, unknown>> | null;
}

export interface AlteracaoImportacao {
  readonly mapeamento?: Mapeamento;
  readonly modeloId?: string | null;
  readonly duplicados?: PoliticaDuplicados;
  readonly etiquetas?: readonly string[];
  readonly estrategiaResponsavel?: EstrategiaResponsavel | null;
  readonly responsavelId?: string | null;
  readonly areaRodizio?: AreaRodizio | null;
  readonly origemDetalhe?: string | null;
  readonly leitura?: LeituraArquivo;
}

/** Evento de tempo real `importacao.progresso`. */
export interface ProgressoImportacao {
  readonly importacaoId: string;
  readonly status: StatusImportacao;
  readonly totalLinhas: number;
  readonly processadas: number;
  readonly criados: number;
  readonly atualizados: number;
  readonly ignorados: number;
  readonly erros: number;
  readonly relatorioId?: string | null;
}

export const ROTULO_TIPO: Readonly<Record<TipoImportacao, string>> = {
  CONTATOS: 'Contatos',
  EMPRESAS: 'Empresas',
  PARCELAS: 'Parcelas a receber',
};

export const ROTULO_STATUS: Readonly<Record<StatusImportacao, string>> = {
  RASCUNHO: 'Em preparo',
  NA_FILA: 'Na fila',
  PROCESSANDO: 'Importando',
  CONCLUIDA: 'Concluída',
  FALHOU: 'Falhou',
  CANCELADA: 'Cancelada',
};

export const VARIANTE_STATUS: Readonly<
  Record<StatusImportacao, 'neutro' | 'ciano' | 'menta' | 'lima' | 'coral' | 'contorno'>
> = {
  RASCUNHO: 'contorno',
  NA_FILA: 'ciano',
  PROCESSANDO: 'ciano',
  CONCLUIDA: 'menta',
  FALHOU: 'coral',
  CANCELADA: 'neutro',
};

export const ROTULO_RESULTADO: Readonly<Record<ResultadoLinha, string>> = {
  CRIADO: 'Criado',
  ATUALIZADO: 'Atualizado',
  IGNORADO: 'Ignorado',
  ERRO: 'Com erro',
};

export const VARIANTE_RESULTADO: Readonly<
  Record<ResultadoLinha, 'neutro' | 'ciano' | 'menta' | 'lima' | 'coral' | 'contorno'>
> = {
  CRIADO: 'menta',
  ATUALIZADO: 'ciano',
  IGNORADO: 'neutro',
  ERRO: 'coral',
};

export const ROTULO_AREA_RODIZIO: Readonly<Record<AreaRodizio, string>> = {
  MARKETING: 'Marketing',
  COMERCIAL: 'Comercial',
  CS: 'Sucesso do Cliente',
};

export const OPCOES_DUPLICADOS: readonly {
  readonly valor: PoliticaDuplicados;
  readonly rotulo: string;
  readonly dica: string;
}[] = [
  {
    valor: 'ATUALIZAR_VAZIOS',
    rotulo: 'Completar o que está vazio',
    dica: 'Se a pessoa já existe, só preenche o que faltava no cadastro. Nada do que já existe é trocado.',
  },
  {
    valor: 'IGNORAR',
    rotulo: 'Pular quem já existe',
    dica: 'Se a pessoa já existe, a linha é deixada de lado e aparece no relatório como ignorada.',
  },
  {
    valor: 'SOBRESCREVER',
    rotulo: 'Trocar pelos dados da planilha',
    dica: 'Se a pessoa já existe, os dados da planilha substituem os do cadastro. Use com cuidado.',
  },
];

export const ESTADOS_ATIVOS: readonly StatusImportacao[] = ['NA_FILA', 'PROCESSANDO'];

export function estaEmAndamento(status: StatusImportacao): boolean {
  return ESTADOS_ATIVOS.includes(status);
}

/** Etapa do assistente (1 a 4) para o estado da importação. */
export function etapaDoStatus(status: StatusImportacao): 2 | 4 {
  return status === 'RASCUNHO' ? 2 : 4;
}

/**
 * Chave de campo personalizado a partir do nome da coluna: minúsculas, números e `_`, sem
 * acento ("Data de Nascimento" → `data_de_nascimento`). Vazia se não sobrar nada.
 */
export function chaveDeCampoPersonalizado(coluna: string): string {
  return coluna
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export const PREFIXO_PERSONALIZADO = 'campos.';

/** Os campos que a importação exige para cada tipo, em texto simples. */
export interface ExigenciaMapeamento {
  readonly texto: string;
  readonly atendida: boolean;
}

/** O que falta no mapeamento para poder iniciar (R16.3). */
export function exigenciasDoMapeamento(
  tipo: TipoImportacao,
  mapeamento: Mapeamento,
): readonly ExigenciaMapeamento[] {
  const campos = new Set(Object.values(mapeamento));
  if (tipo === 'PARCELAS') {
    return [{ texto: 'Número do título', atendida: campos.has('numero') }];
  }
  const nome = { texto: 'Nome', atendida: campos.has('nome') };
  if (tipo === 'EMPRESAS') {
    return [nome];
  }
  return [
    nome,
    { texto: 'E-mail ou telefone', atendida: campos.has('email') || campos.has('telefone') },
  ];
}

/** Define (ou tira, com `campo` vazio) o campo de uma coluna, sem repetir o campo em outra. */
export function mapearColuna(
  mapeamento: Mapeamento,
  coluna: string,
  campo: string | null,
): Mapeamento {
  const novo: Record<string, string> = {};
  for (const [c, f] of Object.entries(mapeamento)) {
    if (c !== coluna && f !== campo) {
      novo[c] = f;
    }
  }
  if (campo) {
    novo[coluna] = campo;
  }
  return novo;
}

/** Junta o evento de tempo real à importação (ignora evento de outra importação). */
export function aplicarProgresso(atual: Importacao, evento: ProgressoImportacao): Importacao {
  if (evento.importacaoId !== atual.id) {
    return atual;
  }
  // Pode chegar repetido ou fora de ordem: nunca volta atrás nos contadores.
  if (evento.processadas < atual.processadas && evento.status === atual.status) {
    return atual;
  }
  const total = evento.totalLinhas || atual.totalLinhas;
  const concluida = evento.status === 'CONCLUIDA';
  return {
    ...atual,
    status: evento.status,
    totalLinhas: total,
    processadas: evento.processadas,
    criados: evento.criados,
    atualizados: evento.atualizados,
    ignorados: evento.ignorados,
    erros: evento.erros,
    relatorioId: evento.relatorioId ?? atual.relatorioId,
    progresso: concluida
      ? 100
      : total > 0
        ? Math.min(100, Math.floor((evento.processadas / total) * 100))
        : 0,
  };
}

/** Valida o arquivo escolhido antes de enviar (a API valida de novo). */
export function erroDoArquivo(arquivo: {
  readonly name: string;
  readonly size: number;
}): string | null {
  if (!/\.(csv|xlsx)$/i.test(arquivo.name)) {
    return 'Este formato não é aceito. Envie uma planilha .csv ou .xlsx.';
  }
  if (arquivo.size === 0) {
    return 'O arquivo está vazio.';
  }
  return null;
}
