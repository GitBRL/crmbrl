import type { LucideIconInput } from '@lucide/angular';

import type { OpcaoSeletor } from '../seletor/seletor';

/**
 * Modelo do editor de passos: uma lista de "Quando… / Se… / Então… / Aguardar…" que o chatbot e as
 * automações compartilham. O editor não conhece nenhum passo específico: quem usa entrega as
 * `DefinicaoPasso` (que passos existem e que campos cada um tem) e recebe a lista de `Passo`
 * (tipo + valores). A conversão para o JSON da API é de quem usa. Funções puras.
 */

/**
 * - `quando`: o gatilho (um só, fixo no topo);
 * - `se`: condição, com ramos ("Se sim" / "Se não"), cada um com a sua lista de passos;
 * - `entao`: ação;
 * - `aguardar`: espera por um tempo (ou por uma resposta).
 */
export type FasePasso = 'quando' | 'se' | 'entao' | 'aguardar';

export const ROTULO_FASE: Readonly<Record<FasePasso, string>> = {
  quando: 'Quando',
  se: 'Se',
  entao: 'Então',
  aguardar: 'Aguardar',
};

export type TipoCampoPasso = 'texto' | 'texto-longo' | 'numero' | 'opcao';

export type ValorConfig = string | number | null;
export type ConfigPasso = Readonly<Record<string, ValorConfig>>;

export interface CampoPasso {
  readonly id: string;
  readonly rotulo: string;
  readonly tipo: TipoCampoPasso;
  /** Para `opcao`. */
  readonly opcoes?: readonly OpcaoSeletor<string>[];
  readonly placeholder?: string;
  readonly dica?: string;
  /** Sem valor, o passo mostra "Falta preencher". */
  readonly obrigatorio?: boolean;
  /** Valor inicial de um passo novo. */
  readonly padrao?: ValorConfig;
}

export interface DefinicaoPasso {
  /** Identificador estável, vai para a API (`enviar-whatsapp`, `condicao-etiqueta`…). */
  readonly tipo: string;
  readonly fase: FasePasso;
  /** Nome curto: "Enviar WhatsApp". */
  readonly rotulo: string;
  /** Uma frase para o menu de adicionar. */
  readonly descricao: string;
  readonly icone?: LucideIconInput;
  readonly campos: readonly CampoPasso[];
  /** Só na fase `se`: os rótulos dos ramos, na ordem ("Se sim", "Se não"). */
  readonly ramos?: readonly string[];
  /** Resumo de uma linha mostrado com o passo fechado; sem ele, o primeiro campo preenchido. */
  readonly resumo?: (config: ConfigPasso) => string | null;
}

export interface RamoPasso {
  readonly rotulo: string;
  readonly passos: readonly Passo[];
}

export interface Passo {
  readonly id: string;
  readonly tipo: string;
  readonly config: ConfigPasso;
  readonly ramos?: readonly RamoPasso[];
}

export interface ProblemaPasso {
  readonly passoId: string;
  readonly mensagem: string;
}

export const UNIDADES_ESPERA: readonly OpcaoSeletor<string>[] = [
  { valor: 'minutos', rotulo: 'minutos' },
  { valor: 'horas', rotulo: 'horas' },
  { valor: 'dias', rotulo: 'dias' },
];

/** Definição pronta de "Aguardar um tempo", para quem não precisa de outra. */
export const DEFINICAO_AGUARDAR: DefinicaoPasso = {
  tipo: 'aguardar',
  fase: 'aguardar',
  rotulo: 'Aguardar um tempo',
  descricao: 'Espera antes de seguir para o próximo passo.',
  campos: [
    { id: 'quantidade', rotulo: 'Quanto tempo', tipo: 'numero', obrigatorio: true, padrao: 1 },
    { id: 'unidade', rotulo: 'Unidade', tipo: 'opcao', opcoes: UNIDADES_ESPERA, padrao: 'horas' },
  ],
  resumo: (config) => {
    const quantidade = Number(config['quantidade']);
    if (!quantidade) {
      return null;
    }
    const unidade = String(config['unidade'] ?? 'horas');
    return `${quantidade} ${quantidade === 1 ? unidade.replace(/s$/, '') : unidade}`;
  },
};

/** Passo novo de uma definição, com os valores iniciais e os ramos vazios. */
export function novoPasso(definicao: DefinicaoPasso, id: string): Passo {
  const config: Record<string, ValorConfig> = {};
  for (const campo of definicao.campos) {
    config[campo.id] = campo.padrao ?? null;
  }
  return {
    id,
    tipo: definicao.tipo,
    config,
    ...(definicao.ramos
      ? { ramos: definicao.ramos.map((rotulo) => ({ rotulo, passos: [] })) }
      : {}),
  };
}

export function valorVazio(valor: ValorConfig | undefined): boolean {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

/** Campos obrigatórios sem valor, pelo nome. */
export function camposFaltando(definicao: DefinicaoPasso | undefined, passo: Passo): string[] {
  return (definicao?.campos ?? [])
    .filter((campo) => campo.obrigatorio && valorVazio(passo.config[campo.id]))
    .map((campo) => campo.rotulo);
}

/** Resumo de uma linha do passo fechado. */
export function resumirPasso(definicao: DefinicaoPasso | undefined, passo: Passo): string {
  if (!definicao) {
    return '';
  }
  const proprio = definicao.resumo?.(passo.config);
  if (proprio) {
    return proprio;
  }
  for (const campo of definicao.campos) {
    const valor = passo.config[campo.id];
    if (!valorVazio(valor)) {
      const opcao = campo.opcoes?.find((o) => o.valor === valor);
      return String(opcao?.rotulo ?? valor);
    }
  }
  return '';
}

/** Todos os problemas de preenchimento, incluindo os passos dentro dos ramos. */
export function validarPassos(
  passos: readonly Passo[],
  definicoes: readonly DefinicaoPasso[],
): readonly ProblemaPasso[] {
  const problemas: ProblemaPasso[] = [];
  const visitar = (lista: readonly Passo[]) => {
    for (const passo of lista) {
      const definicao = definicoes.find((d) => d.tipo === passo.tipo);
      if (!definicao) {
        problemas.push({ passoId: passo.id, mensagem: `Passo desconhecido: ${passo.tipo}.` });
        continue;
      }
      for (const nome of camposFaltando(definicao, passo)) {
        problemas.push({ passoId: passo.id, mensagem: `${definicao.rotulo}: preencha “${nome}”.` });
      }
      for (const ramo of passo.ramos ?? []) {
        visitar(ramo.passos);
      }
    }
  };
  visitar(passos);
  return problemas;
}

/** Quantos passos há, contando os dos ramos. */
export function contarPassos(passos: readonly Passo[]): number {
  return passos.reduce(
    (total, passo) =>
      total + 1 + (passo.ramos ?? []).reduce((soma, ramo) => soma + contarPassos(ramo.passos), 0),
    0,
  );
}

/** Move um item de `de` para `para`, sem alterar a lista original. */
export function moverItem<T>(lista: readonly T[], de: number, para: number): readonly T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}
