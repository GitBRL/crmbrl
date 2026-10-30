/**
 * Segmento: o filtro de contatos de uma campanha ou de uma condição de automação, em linguagem
 * simples ("Etiqueta é Cliente", "Última interação há mais de 30 dias"). É o modelo da tela;
 * a conversão para o JSON da API (`src/comum/segmentos/`) é de quem usa o componente.
 * Funções puras.
 */

export type TipoCampoSegmento = 'texto' | 'numero' | 'data' | 'opcao' | 'booleano';

export interface OpcaoCampoSegmento {
  readonly valor: string;
  readonly rotulo: string;
}

export interface CampoSegmento {
  /** Identificador estável (ex.: `etiqueta`, `origem`, `ultima_interacao`). */
  readonly id: string;
  /** Nome em português ("Etiqueta", "Última interação"). */
  readonly rotulo: string;
  readonly tipo: TipoCampoSegmento;
  /** Para `opcao`: as escolhas (etiquetas, origens, funis…). */
  readonly opcoes?: readonly OpcaoCampoSegmento[];
  /** Agrupa na lista de campos ("Contato", "Negócio"…). Só informativo. */
  readonly grupo?: string;
}

export type OperadorSegmento =
  | 'e'
  | 'nao-e'
  | 'contem'
  | 'nao-contem'
  | 'vazio'
  | 'preenchido'
  | 'igual'
  | 'maior'
  | 'menor'
  | 'antes'
  | 'depois'
  | 'ultimos-dias'
  | 'ha-mais-de-dias'
  | 'sim'
  | 'nao';

export interface CondicaoSegmento {
  readonly id: string;
  readonly campo: string;
  readonly operador: OperadorSegmento;
  /** Texto, número (como número) ou data "AAAA-MM-DD"; `null` quando o operador não pede valor. */
  readonly valor: string | number | null;
}

export type Combinacao = 'todos' | 'qualquer';

export interface Segmento {
  readonly combinacao: Combinacao;
  readonly condicoes: readonly CondicaoSegmento[];
}

export const SEGMENTO_VAZIO: Segmento = { combinacao: 'todos', condicoes: [] };

export const ROTULO_OPERADOR: Readonly<Record<OperadorSegmento, string>> = {
  e: 'é',
  'nao-e': 'não é',
  contem: 'contém',
  'nao-contem': 'não contém',
  vazio: 'está vazio',
  preenchido: 'está preenchido',
  igual: 'é igual a',
  maior: 'é maior que',
  menor: 'é menor que',
  antes: 'é antes de',
  depois: 'é depois de',
  'ultimos-dias': 'foi nos últimos… dias',
  'ha-mais-de-dias': 'foi há mais de… dias',
  sim: 'é sim',
  nao: 'é não',
};

const OPERADORES_POR_TIPO: Readonly<Record<TipoCampoSegmento, readonly OperadorSegmento[]>> = {
  texto: ['e', 'nao-e', 'contem', 'nao-contem', 'vazio', 'preenchido'],
  numero: ['igual', 'maior', 'menor', 'vazio', 'preenchido'],
  data: ['ultimos-dias', 'ha-mais-de-dias', 'antes', 'depois', 'vazio', 'preenchido'],
  opcao: ['e', 'nao-e', 'vazio', 'preenchido'],
  booleano: ['sim', 'nao'],
};

export function operadoresDoTipo(tipo: TipoCampoSegmento): readonly OperadorSegmento[] {
  return OPERADORES_POR_TIPO[tipo];
}

/** Como o valor é digitado: nada, texto, número, data ou escolha entre as opções do campo. */
export type EntradaValor = 'nenhuma' | 'texto' | 'numero' | 'data' | 'opcao';

export function entradaDoValor(tipo: TipoCampoSegmento, operador: OperadorSegmento): EntradaValor {
  if (['vazio', 'preenchido', 'sim', 'nao'].includes(operador)) {
    return 'nenhuma';
  }
  if (operador === 'ultimos-dias' || operador === 'ha-mais-de-dias') {
    return 'numero';
  }
  switch (tipo) {
    case 'opcao':
      return 'opcao';
    case 'numero':
      return 'numero';
    case 'data':
      return 'data';
    default:
      return 'texto';
  }
}

export function valorVazio(valor: CondicaoSegmento['valor']): boolean {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

/** Motivo de a condição estar incompleta, ou `null`. */
export function erroDaCondicao(
  condicao: CondicaoSegmento,
  campos: readonly CampoSegmento[],
): string | null {
  const campo = campos.find((c) => c.id === condicao.campo);
  if (!campo) {
    return 'Escolha o campo.';
  }
  if (entradaDoValor(campo.tipo, condicao.operador) !== 'nenhuma' && valorVazio(condicao.valor)) {
    return 'Informe o valor.';
  }
  return null;
}

/** Uma condição nova para o primeiro campo da lista, já com um operador válido. */
export function novaCondicao(id: string, campo: CampoSegmento): CondicaoSegmento {
  return { id, campo: campo.id, operador: operadoresDoTipo(campo.tipo)[0], valor: null };
}

/**
 * Troca o campo. Mantém o operador se ainda existir no tipo novo e o valor só quando o tipo é o
 * mesmo e não é de opções (cada campo de opções tem as suas).
 */
export function trocarCampo(
  condicao: CondicaoSegmento,
  antigo: CampoSegmento | undefined,
  novo: CampoSegmento,
): CondicaoSegmento {
  const operadores = operadoresDoTipo(novo.tipo);
  const operador = operadores.includes(condicao.operador) ? condicao.operador : operadores[0];
  const manterValor =
    antigo?.tipo === novo.tipo && novo.tipo !== 'opcao' && operador === condicao.operador;
  return { ...condicao, campo: novo.id, operador, valor: manterValor ? condicao.valor : null };
}

/** Frase de uma condição: `Etiqueta é “Cliente”`. */
export function descreverCondicao(
  condicao: CondicaoSegmento,
  campos: readonly CampoSegmento[],
): string {
  const campo = campos.find((c) => c.id === condicao.campo);
  const nome = campo?.rotulo ?? condicao.campo;
  const operador = ROTULO_OPERADOR[condicao.operador];
  if (condicao.operador === 'ultimos-dias' || condicao.operador === 'ha-mais-de-dias') {
    const dias = `${condicao.valor ?? ''} dias`;
    return `${nome} ${condicao.operador === 'ultimos-dias' ? 'nos últimos' : 'há mais de'} ${dias}`;
  }
  if (!campo || entradaDoValor(campo.tipo, condicao.operador) === 'nenhuma') {
    return `${nome} ${operador}`;
  }
  const valor =
    campo.tipo === 'opcao'
      ? (campo.opcoes?.find((o) => o.valor === String(condicao.valor))?.rotulo ??
        String(condicao.valor ?? ''))
      : String(condicao.valor ?? '');
  return `${nome} ${operador} “${valor}”`;
}

/** Só as condições completas contam para a contagem ao vivo. */
export function segmentoCompleto(segmento: Segmento, campos: readonly CampoSegmento[]): Segmento {
  return {
    ...segmento,
    condicoes: segmento.condicoes.filter((c) => erroDaCondicao(c, campos) === null),
  };
}

/** Troca o operador; o valor só fica se o jeito de digitar for o mesmo. */
export function trocarOperador(
  condicao: CondicaoSegmento,
  campo: CampoSegmento | undefined,
  operador: OperadorSegmento,
): CondicaoSegmento {
  const tipo = campo?.tipo ?? 'texto';
  const igual = entradaDoValor(tipo, condicao.operador) === entradaDoValor(tipo, operador);
  return { ...condicao, operador, valor: igual ? condicao.valor : null };
}
