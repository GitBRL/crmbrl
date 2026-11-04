/**
 * Tabela de eventos das plataformas de curso (Hotmart, Kiwify e Eduzz; REGRAS-DE-NEGOCIO R32.15):
 * cada evento da plataforma tem uma ação no CRM. O formato é o da API (`configuracao.eventos`).
 */

export type AcaoDoEvento = 'IGNORAR' | 'ABRIR' | 'GANHO' | 'PERDIDO' | 'ETIQUETAR';
export type GrupoDeEvento =
  'COMPRA' | 'PAGAMENTO_PENDENTE' | 'CARRINHO' | 'POS_VENDA' | 'ASSINATURA';

export interface RegraDoEvento {
  readonly acao: AcaoDoEvento;
  /** Só em `ABRIR`: etapa aberta do funil; `null` usa a etapa de entrada da integração. */
  readonly etapaId?: string | null;
  /** Só em `PERDIDO`; sem motivo vale o motivo padrão da integração. */
  readonly motivoPerda?: string | null;
  readonly etiquetas?: readonly string[];
}

export interface DefinicaoDeEvento {
  readonly codigo: string;
  readonly nome: string;
  readonly descricao: string;
  readonly grupo: GrupoDeEvento;
  readonly padrao: RegraDoEvento;
}

export interface ModeloDeEventos {
  readonly codigo: string;
  readonly nome: string;
  readonly descricao: string;
  readonly regras: Readonly<Record<string, RegraDoEvento>>;
}

export interface EventosDoAplicativo {
  readonly eventos: readonly DefinicaoDeEvento[];
  readonly modelos: readonly ModeloDeEventos[];
  readonly filtroPorProduto: boolean;
}

export type TabelaDeEventos = Readonly<Record<string, RegraDoEvento>>;

export const ACOES_DO_EVENTO: readonly AcaoDoEvento[] = [
  'IGNORAR',
  'ABRIR',
  'GANHO',
  'PERDIDO',
  'ETIQUETAR',
];

export const ROTULO_ACAO_DO_EVENTO: Readonly<Record<AcaoDoEvento, string>> = {
  IGNORAR: 'Ignorar',
  ABRIR: 'Abrir negócio',
  GANHO: 'Ganho, com valor',
  PERDIDO: 'Perdido, com motivo',
  ETIQUETAR: 'Só etiquetar',
};

export const DICA_ACAO_DO_EVENTO: Readonly<Record<AcaoDoEvento, string>> = {
  IGNORAR: 'Fica no histórico como ignorado e não mexe em nada.',
  ABRIR: 'Cria o negócio do comprador, ou atualiza o aberto, na etapa escolhida.',
  GANHO: 'Fecha o negócio como ganho, com o valor e o produto da compra.',
  PERDIDO: 'Fecha o negócio como perdido, com o motivo informado.',
  ETIQUETAR: 'Só coloca as etiquetas no contato, sem mexer em negócio.',
};

export const ROTULO_GRUPO_DE_EVENTO: Readonly<Record<GrupoDeEvento, string>> = {
  COMPRA: 'Compra',
  PAGAMENTO_PENDENTE: 'Pagamento pendente',
  CARRINHO: 'Carrinho',
  POS_VENDA: 'Pós-venda',
  ASSINATURA: 'Assinatura',
};

export const ORDEM_DOS_GRUPOS: readonly GrupoDeEvento[] = [
  'COMPRA',
  'PAGAMENTO_PENDENTE',
  'CARRINHO',
  'POS_VENDA',
  'ASSINATURA',
];

/** Só o que a API aceita em cada ação (etapa só em ABRIR, motivo só em PERDIDO, IGNORAR sem etiquetas). */
export function regraParaApi(regra: RegraDoEvento): RegraDoEvento {
  const etiquetas = regra.acao === 'IGNORAR' ? [] : [...(regra.etiquetas ?? [])];
  return {
    acao: regra.acao,
    etapaId: regra.acao === 'ABRIR' ? (regra.etapaId ?? null) : null,
    motivoPerda: regra.acao === 'PERDIDO' ? regra.motivoPerda?.trim() || null : null,
    etiquetas,
  };
}

export function tabelaParaApi(tabela: TabelaDeEventos): TabelaDeEventos {
  return Object.fromEntries(
    Object.entries(tabela).map(([codigo, regra]) => [codigo, regraParaApi(regra)]),
  );
}

/** A tabela inicial: o que a integração já tem; senão, as regras do modelo (ou o padrão de cada evento). */
export function tabelaInicial(
  eventos: EventosDoAplicativo,
  salva: TabelaDeEventos | null | undefined,
  modelo = 'VENDAS',
): TabelaDeEventos {
  const base = eventos.modelos.find((m) => m.codigo === modelo)?.regras ?? {};
  const tabela: Record<string, RegraDoEvento> = {};
  for (const evento of eventos.eventos) {
    tabela[evento.codigo] = salva?.[evento.codigo] ?? base[evento.codigo] ?? evento.padrao;
  }
  for (const [codigo, regra] of Object.entries(salva ?? {})) {
    tabela[codigo] ??= regra;
  }
  return tabela;
}

/** Aplica um modelo pronto: o que ele não diz volta ao padrão do evento; os códigos extras ficam. */
export function aplicarModelo(
  eventos: EventosDoAplicativo,
  modelo: ModeloDeEventos,
  atual: TabelaDeEventos,
): TabelaDeEventos {
  const conhecidos = new Set(eventos.eventos.map((e) => e.codigo));
  const tabela: Record<string, RegraDoEvento> = {};
  for (const evento of eventos.eventos) {
    tabela[evento.codigo] = modelo.regras[evento.codigo] ?? { acao: 'IGNORAR', etiquetas: [] };
  }
  for (const [codigo, regra] of Object.entries(atual)) {
    if (!conhecidos.has(codigo)) {
      tabela[codigo] = regra;
    }
  }
  return tabela;
}

function mesmaRegra(a: RegraDoEvento | undefined, b: RegraDoEvento | undefined): boolean {
  if (!a || !b) {
    return !a && !b;
  }
  const x = regraParaApi(a);
  const y = regraParaApi(b);
  return (
    x.acao === y.acao &&
    x.etapaId === y.etapaId &&
    x.motivoPerda === y.motivoPerda &&
    (x.etiquetas ?? []).join('|') === (y.etiquetas ?? []).join('|')
  );
}

/** O código do modelo pronto que a tabela repete (ignorando a etapa dos eventos ABRIR); senão `null`. */
export function modeloDaTabela(
  eventos: EventosDoAplicativo,
  tabela: TabelaDeEventos,
): string | null {
  const conhecidos = new Set(eventos.eventos.map((e) => e.codigo));
  if (Object.keys(tabela).some((codigo) => !conhecidos.has(codigo))) {
    return null;
  }
  for (const modelo of eventos.modelos) {
    const igual = eventos.eventos.every((evento) => {
      const esperada = modelo.regras[evento.codigo] ?? { acao: 'IGNORAR', etiquetas: [] };
      const atual = tabela[evento.codigo];
      return mesmaRegra(
        { ...esperada, etapaId: null },
        atual ? { ...atual, etapaId: null } : undefined,
      );
    });
    if (igual) {
      return modelo.codigo;
    }
  }
  return null;
}

/** Eventos PERDIDO sem motivo próprio: precisam do motivo padrão da integração. */
export function perdidosSemMotivo(tabela: TabelaDeEventos): readonly string[] {
  return Object.entries(tabela)
    .filter(([, regra]) => regra.acao === 'PERDIDO' && !regra.motivoPerda?.trim())
    .map(([codigo]) => codigo);
}

/** "a, b , A" → ["a", "b"] (sem repetir, sem diferenciar maiúsculas); vazio vira `[]`. */
export function listaDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const parte of texto.split(',')) {
    const produto = parte.trim();
    const chave = produto.toLocaleLowerCase('pt-BR');
    if (produto && !vistos.has(chave)) {
      vistos.add(chave);
      lista.push(produto);
    }
  }
  return lista;
}
