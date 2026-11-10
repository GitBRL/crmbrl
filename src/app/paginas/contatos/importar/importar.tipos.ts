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
  /** Planilha sem linha de títulos: as colunas viram "Coluna 1", "Coluna 2"… */
  readonly semCabecalho?: boolean;
}

export type OperadorFiltro =
  | 'IGUAL'
  | 'DIFERENTE'
  | 'CONTEM'
  | 'NAO_CONTEM'
  | 'COMECA_COM'
  | 'TERMINA_COM'
  | 'UM_DE'
  | 'VAZIO'
  | 'PREENCHIDO'
  | 'MAIOR_QUE'
  | 'MENOR_QUE';

export interface RegraDoFiltro {
  readonly coluna: string;
  readonly operador: OperadorFiltro;
  readonly valor?: string | null;
}

export interface FiltroDaPlanilha {
  readonly combinacao: 'TODAS' | 'QUALQUER';
  readonly regras: readonly RegraDoFiltro[];
}

export interface NegocioParaTodos {
  readonly funilId: string;
  readonly etapaId: string;
  readonly titulo?: string | null;
  readonly valor?: string | null;
}

export type NegocioDaImportacao = NegocioParaTodos & {
  readonly funil: { readonly id: string; readonly nome: string };
  readonly etapa: { readonly id: string; readonly nome: string };
};

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
  readonly filtro?: FiltroDaPlanilha | null;
  readonly negocio?: NegocioDaImportacao | null;
  /** '55' quando não definido. */
  readonly ddiPadrao?: string;
  readonly filtradas?: number;
  readonly negociosCriados?: number;
  readonly negociosReconvertidos?: number;
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
  /** Linhas que passam no filtro (igual a `totalLinhas` sem filtro). */
  readonly linhasNoFiltro?: number;
}

export interface ImportacaoCriada extends Importacao {
  readonly previa: Previa;
}

export interface CampoImportavel {
  readonly chave: string;
  readonly rotulo: string;
  readonly obrigatorio: boolean;
  /** 'Contato' | 'Negócio' | 'Campos personalizados' | 'Empresa' | 'Parcela'. */
  readonly grupo?: string;
}

export interface ModeloMapeamento {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoImportacao;
  readonly mapeamento: Mapeamento;
  readonly opcoes?: {
    readonly duplicados?: PoliticaDuplicados;
    readonly etiquetas?: readonly string[];
    readonly filtro?: FiltroDaPlanilha | null;
    readonly negocio?: NegocioParaTodos | null;
    readonly ddiPadrao?: string;
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
  readonly filtro?: FiltroDaPlanilha | null;
  readonly negocio?: NegocioParaTodos | null;
  readonly ddiPadrao?: string;
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

export const ROTULO_OPERADOR: Readonly<Record<OperadorFiltro, string>> = {
  IGUAL: 'é igual a',
  DIFERENTE: 'não é igual a',
  CONTEM: 'contém',
  NAO_CONTEM: 'não contém',
  COMECA_COM: 'começa com',
  TERMINA_COM: 'termina com',
  UM_DE: 'é um destes',
  VAZIO: 'está vazio',
  PREENCHIDO: 'está preenchido',
  MAIOR_QUE: 'maior que',
  MENOR_QUE: 'menor que',
};

export const MAXIMO_REGRAS_FILTRO = 10;

/** Estes operadores não têm valor para digitar. */
export function operadorSemValor(operador: OperadorFiltro): boolean {
  return operador === 'VAZIO' || operador === 'PREENCHIDO';
}

/** Regra em edição na tela: pode estar incompleta até a pessoa terminar de preencher. */
export interface RegraEmEdicao {
  readonly chave: number;
  readonly coluna: string | null;
  readonly operador: OperadorFiltro;
  readonly valor: string;
}

export function regraCompleta(regra: RegraEmEdicao): boolean {
  return regra.coluna !== null && (operadorSemValor(regra.operador) || regra.valor.trim() !== '');
}

/** O filtro a enviar à API: só as regras completas; `null` quando não sobra nenhuma. */
export function filtroDasRegras(
  combinacao: FiltroDaPlanilha['combinacao'],
  regras: readonly RegraEmEdicao[],
): FiltroDaPlanilha | null {
  const prontas = regras.filter(regraCompleta).map<RegraDoFiltro>((r) => ({
    coluna: r.coluna as string,
    operador: r.operador,
    ...(operadorSemValor(r.operador) ? {} : { valor: r.valor.trim() }),
  }));
  return prontas.length > 0 ? { combinacao, regras: prontas } : null;
}

/** Etapas que um negócio criado pela importação pode ter: a de perda não serve (R5.x). */
export function etapasParaImportacao<E extends { readonly tipo: string }>(
  etapas: readonly E[],
): readonly E[] {
  return etapas.filter((e) => e.tipo !== 'PERDIDO');
}

/** Resumo do rodapé: "1.240 de 3.500 linhas · negócio em Comercial › Novo lead". */
export function resumoDoRodape(dados: {
  readonly totalLinhas: number;
  readonly linhasNoFiltro: number | null;
  readonly negocio: { readonly funil: string; readonly etapa: string } | null;
}): string {
  const numero = (n: number) => n.toLocaleString('pt-BR');
  const partes: string[] = [];
  partes.push(
    dados.linhasNoFiltro !== null
      ? `${numero(dados.linhasNoFiltro)} de ${numero(dados.totalLinhas)} linhas`
      : `${numero(dados.totalLinhas)} linhas`,
  );
  if (dados.negocio) {
    partes.push(`negócio em ${dados.negocio.funil} › ${dados.negocio.etapa}`);
  }
  return partes.join(' · ');
}
