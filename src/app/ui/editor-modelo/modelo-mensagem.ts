/**
 * Modelo de mensagem: texto com variáveis `{{contato.nome}}`, valor padrão `{{contato.nome|cliente}}`
 * e variações `{olá|oi|e aí}` (uma é sorteada por destinatário, de forma reprodutível pela
 * semente). A mesma sintaxe do renderizador da API (`src/comum/modelos/`); aqui serve para a
 * prévia e para avisar de erros enquanto a pessoa escreve. Funções puras.
 */

export interface VariavelModelo {
  /** Caminho usado no texto: `contato.primeiro_nome`. */
  readonly id: string;
  /** Nome em português para o botão: "Primeiro nome". */
  readonly rotulo: string;
}

export const VARIAVEIS_PADRAO: readonly VariavelModelo[] = [
  { id: 'contato.nome', rotulo: 'Nome do contato' },
  { id: 'contato.primeiro_nome', rotulo: 'Primeiro nome' },
  { id: 'empresa.nome', rotulo: 'Empresa' },
  { id: 'negocio.titulo', rotulo: 'Negócio' },
  { id: 'responsavel.nome', rotulo: 'Responsável' },
];

/** Prefixo dos campos personalizados, sempre aceitos: `contato.campos.vencimento`. */
export const PREFIXO_CAMPOS = 'contato.campos.';

/** Valores de um destinatário, por caminho de variável. */
export type ContextoModelo = Readonly<Record<string, string | undefined>>;

export interface ContatoPrevia {
  readonly id: string;
  /** Nome mostrado no seletor da prévia. */
  readonly rotulo: string;
  readonly dados: ContextoModelo;
}

export type TipoParte = 'texto' | 'variavel' | 'variacao' | 'faltando';

export interface ParteModelo {
  readonly tipo: TipoParte;
  readonly texto: string;
}

export interface ProblemaModelo {
  readonly mensagem: string;
}

// Variável (`{{x}}`, `{{x|padrão}}`) ou variação (`{a|b}`, com ao menos uma barra).
const PADRAO = /\{\{([^{}]*)\}\}|\{([^{}]*\|[^{}]*)\}/g;

/** Números pseudoaleatórios reprodutíveis a partir de um texto (FNV-1a + mulberry32). */
export function sorteador(semente: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  }
  let estado = h >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function separarVariavel(conteudo: string): { id: string; padrao: string | null } {
  const barra = conteudo.indexOf('|');
  return barra < 0
    ? { id: conteudo.trim(), padrao: null }
    : { id: conteudo.slice(0, barra).trim(), padrao: conteudo.slice(barra + 1) };
}

/**
 * Monta a mensagem de um destinatário em partes (texto fixo, valor de variável, variação
 * sorteada, variável sem valor), para a tela destacar o que veio do modelo. Sem `innerHTML`.
 */
export function renderizarModelo(
  texto: string,
  contexto: ContextoModelo,
  semente: string,
): readonly ParteModelo[] {
  const sorte = sorteador(semente);
  const partes: ParteModelo[] = [];
  let fim = 0;
  for (const achado of texto.matchAll(PADRAO)) {
    const inicio = achado.index ?? 0;
    if (inicio > fim) {
      partes.push({ tipo: 'texto', texto: texto.slice(fim, inicio) });
    }
    fim = inicio + achado[0].length;
    if (achado[1] !== undefined) {
      const { id, padrao } = separarVariavel(achado[1]);
      const valor = contexto[id]?.trim();
      if (valor) {
        partes.push({ tipo: 'variavel', texto: valor });
      } else if (padrao !== null && padrao !== '') {
        partes.push({ tipo: 'variavel', texto: padrao });
      } else {
        partes.push({ tipo: 'faltando', texto: id });
      }
    } else {
      const opcoes = (achado[2] ?? '').split('|');
      partes.push({ tipo: 'variacao', texto: opcoes[Math.floor(sorte() * opcoes.length)] });
    }
  }
  if (fim < texto.length) {
    partes.push({ tipo: 'texto', texto: texto.slice(fim) });
  }
  return partes;
}

/** O texto final, sem destaques (para contar caracteres ou copiar). */
export function textoRenderizado(partes: readonly ParteModelo[]): string {
  return partes.map((parte) => (parte.tipo === 'faltando' ? '' : parte.texto)).join('');
}

/** Quantas mensagens diferentes o modelo pode gerar (produto das opções de cada variação). */
export function contarCombinacoes(texto: string): number {
  let total = 1;
  for (const achado of texto.matchAll(PADRAO)) {
    if (achado[2] !== undefined) {
      total *= achado[2].split('|').length;
    }
  }
  return total;
}

export function temVariacao(texto: string): boolean {
  return contarCombinacoes(texto) > 1;
}

/** Variáveis desconhecidas, variações com opção vazia e chaves sem par. */
export function validarModelo(
  texto: string,
  variaveis: readonly VariavelModelo[] = VARIAVEIS_PADRAO,
): readonly ProblemaModelo[] {
  const problemas: ProblemaModelo[] = [];
  const conhecidas = new Set(variaveis.map((variavel) => variavel.id));
  const desconhecidas = new Set<string>();
  let variacaoVazia = false;
  for (const achado of texto.matchAll(PADRAO)) {
    if (achado[1] !== undefined) {
      const { id } = separarVariavel(achado[1]);
      if (
        !conhecidas.has(id) &&
        !(id.startsWith(PREFIXO_CAMPOS) && id.length > PREFIXO_CAMPOS.length)
      ) {
        desconhecidas.add(id);
      }
    } else if ((achado[2] ?? '').split('|').some((opcao) => opcao.trim() === '')) {
      variacaoVazia = true;
    }
  }
  for (const id of desconhecidas) {
    problemas.push({
      mensagem: `A variável “${id || 'vazia'}” não existe. Use um dos botões acima.`,
    });
  }
  if (variacaoVazia) {
    problemas.push({
      mensagem: 'Uma das variações está vazia. Preencha todas as opções entre as barras.',
    });
  }
  const semPares = texto.replace(PADRAO, '');
  if (/[{}]/.test(semPares)) {
    problemas.push({
      mensagem: 'Há uma chave sem par. Cada “{{” precisa de um “}}” e cada “{” de um “}”.',
    });
  }
  return problemas;
}

/** Texto a inserir ao clicar numa variável. */
export function marcadorDaVariavel(id: string): string {
  return `{{${id}}}`;
}

/**
 * Insere `inserir` no lugar da seleção `[inicio, fim)`. Devolve o novo texto e a nova seleção
 * (dentro do que foi inserido, para a pessoa já poder digitar por cima).
 */
export function inserirNoTexto(
  texto: string,
  inicio: number,
  fim: number,
  inserir: string,
  selecao?: { de: number; ate: number },
): { texto: string; de: number; ate: number } {
  const novo = texto.slice(0, inicio) + inserir + texto.slice(fim);
  const base = inicio + (selecao?.de ?? inserir.length);
  return { texto: novo, de: base, ate: selecao ? inicio + selecao.ate : base };
}
