import type { ErroApi } from '../../nucleo/api/erro-api';
import type {
  ConfigPasso,
  PassoDefinicao,
  ProblemaDefinicao,
  RamoDefinicao,
  TipoDePasso,
} from './chatbot.tipos';

/**
 * Funções puras da definição de um fluxo (a árvore de passos): criar passos novos, manter os ramos
 * em dia com as opções, achar o que falta preencher, resumir e converter campos de texto.
 */

export const MAXIMO_DE_PASSOS = 150;
export const MINIMO_DE_OPCOES = 2;
export const MAXIMO_DE_OPCOES = 10;
export const NIVEL_MAXIMO_DE_RAMOS = 3;

export const RAMO_SEM_RESPOSTA = 'sem_resposta';
export const RAMO_INVALIDA = 'invalida';
export const RAMO_SENAO = 'senao';

export function novoId(prefixo: string): string {
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${prefixo}_${aleatorio}${Date.now().toString(36).slice(-3)}`;
}

export type CondicaoFluxo = Record<string, unknown> & { tipo?: string };

export function condicaoVazia(): CondicaoFluxo {
  return { tipo: 'variavel', chave: '', operador: 'igual', valor: '' };
}

export function novaOpcao(): { id: string; rotulo: string } {
  return { id: novoId('opcao'), rotulo: '' };
}

/** Passo novo do tipo pedido, com a configuração inicial e os ramos que o tipo pede. */
export function novoPasso(tipo: string): PassoDefinicao {
  const id = novoId('passo');
  switch (tipo) {
    case 'mensagem':
      return { id, tipo, config: { texto: '' } };
    case 'pergunta.opcoes': {
      const opcoes = [novaOpcao(), novaOpcao()];
      return sincronizarRamosDaPergunta({
        id,
        tipo,
        config: { texto: '', opcoes, tentativas: 3 },
        ramos: [],
      });
    }
    case 'pergunta.aberta':
      return { id, tipo, config: { texto: '', variavel: '', tentativas: 3 } };
    case 'condicao':
      return {
        id,
        tipo,
        ramos: [
          {
            id: novoId('ramo'),
            rotulo: 'Se for verdade',
            config: { condicoes: [condicaoVazia()] },
            passos: [],
          },
          { id: RAMO_SENAO, rotulo: 'Senão', passos: [] },
        ],
      };
    case 'acao.etiquetar':
      return { id, tipo, config: { adicionar: [], remover: [] } };
    case 'acao.mover_fila':
      return { id, tipo, config: { filaId: '', distribuir: true } };
    case 'acao.criar_atividade':
      return { id, tipo, config: { tipo: 'TAREFA', titulo: '', prazoHoras: 24 } };
    case 'transferir':
      return { id, tipo, config: { mensagem: '', incluirResumo: true } };
    case 'aguardar':
      return { id, tipo, config: { quantidade: 5, unidade: 'minutos' } };
    default:
      return { id, tipo, config: {} };
  }
}

export function opcoesDaPergunta(passo: PassoDefinicao): { id: string; rotulo: string }[] {
  const opcoes = passo.config?.['opcoes'];
  return Array.isArray(opcoes) ? (opcoes as { id: string; rotulo: string }[]) : [];
}

/**
 * Deixa os ramos da pergunta com opções como a API espera: um ramo por opção (`ramo.id` = `opcao.id`,
 * na ordem das opções) e, depois, os ramos extras `sem_resposta` e `invalida` que já existiam.
 * Mantém os passos de cada ramo e descarta o ramo de uma opção removida.
 */
export function sincronizarRamosDaPergunta(passo: PassoDefinicao): PassoDefinicao {
  const antigos = new Map((passo.ramos ?? []).map((ramo) => [ramo.id, ramo]));
  const ramos: RamoDefinicao[] = opcoesDaPergunta(passo).map((opcao) => ({
    ...(antigos.get(opcao.id) ?? { passos: [] }),
    id: opcao.id,
    rotulo: opcao.rotulo,
    passos: antigos.get(opcao.id)?.passos ?? [],
  }));
  for (const extra of [RAMO_SEM_RESPOSTA, RAMO_INVALIDA]) {
    const existente = antigos.get(extra);
    if (existente) {
      ramos.push(existente);
    }
  }
  return { ...passo, ramos };
}

/** Liga ou desliga o ramo extra (`sem_resposta` ou `invalida`) de uma pergunta. */
export function alternarRamoExtra(
  passo: PassoDefinicao,
  id: typeof RAMO_SEM_RESPOSTA | typeof RAMO_INVALIDA,
  ligado: boolean,
): PassoDefinicao {
  const ramos = (passo.ramos ?? []).filter((ramo) => ramo.id !== id);
  if (ligado) {
    ramos.push({
      id,
      rotulo: id === RAMO_SEM_RESPOSTA ? 'Se não responder' : 'Se responder errado',
      passos: [],
    });
  }
  // sem_resposta sempre antes de invalida, depois dos ramos de opções.
  ramos.sort((a, b) => peso(a.id) - peso(b.id));
  return { ...passo, ramos };
}

function peso(id: string): number {
  return id === RAMO_SEM_RESPOSTA ? 1 : id === RAMO_INVALIDA ? 2 : 0;
}

export function temRamoExtra(passo: PassoDefinicao, id: string): boolean {
  return (passo.ramos ?? []).some((ramo) => ramo.id === id);
}

// ---------- condições ----------

export function condicoesDoRamo(ramo: RamoDefinicao): CondicaoFluxo[] {
  const config = ramo.config ?? {};
  if (Array.isArray(config['condicoes'])) {
    return config['condicoes'] as CondicaoFluxo[];
  }
  return config['condicao'] ? [config['condicao'] as CondicaoFluxo] : [];
}

/** Ramo sem condição = o "senão" (só vale o último). */
export function ehSenao(ramo: RamoDefinicao): boolean {
  return condicoesDoRamo(ramo).length === 0;
}

export function problemaDaCondicao(c: CondicaoFluxo): string | null {
  switch (c.tipo) {
    case 'variavel':
    case 'campo_contato': {
      const alvo = c.tipo === 'variavel' ? c['chave'] : c['campo'];
      if (!texto(alvo)) {
        return c.tipo === 'variavel' ? 'Informe a variável.' : 'Escolha o campo do contato.';
      }
      if (!c['operador']) {
        return 'Escolha a comparação.';
      }
      if (!['existe', 'nao_existe'].includes(String(c['operador'])) && !texto(c['valor'])) {
        return 'Informe o valor.';
      }
      return null;
    }
    case 'etiqueta':
      return texto(c['etiqueta']) ? null : 'Informe a etiqueta.';
    case 'canal':
      return Array.isArray(c['canalTipos']) && c['canalTipos'].length > 0
        ? null
        : 'Escolha o canal.';
    case 'horario':
      return null;
    default:
      return 'Escolha o tipo da condição.';
  }
}

// ---------- leitura de config ----------

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : typeof valor === 'number' ? String(valor) : '';
}

export function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

/** Etiquetas a adicionar (a API também aceita o apelido `etiquetas`). */
export function etiquetasAAdicionar(config: ConfigPasso): string[] {
  return listaDeTextos(config['adicionar'] ?? config['etiquetas']);
}

/** "a, b, c" → ["a","b","c"] (sem vazios nem repetidos). */
export function textoParaLista(entrada: string): string[] {
  return [
    ...new Set(
      entrada
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function listaParaTexto(valor: unknown): string {
  return listaDeTextos(valor).join(', ');
}

/** Cabeçalhos do webhook: uma linha "Nome: valor" por cabeçalho. */
export function cabecalhosParaTexto(valor: unknown): string {
  if (typeof valor !== 'object' || valor === null) {
    return '';
  }
  return Object.entries(valor as Record<string, unknown>)
    .map(([nome, conteudo]) => `${nome}: ${String(conteudo)}`)
    .join('\n');
}

export function textoParaCabecalhos(entrada: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const linha of entrada.split('\n')) {
    const corte = linha.indexOf(':');
    if (corte > 0) {
      const nome = linha.slice(0, corte).trim();
      if (nome) {
        saida[nome] = linha.slice(corte + 1).trim();
      }
    }
  }
  return saida;
}

export function corpoParaTexto(valor: unknown): string {
  return typeof valor === 'object' && valor !== null ? JSON.stringify(valor, null, 2) : '';
}

/** Converte o JSON digitado; `null` se estiver quebrado, `undefined` se vazio. */
export function textoParaCorpo(entrada: string): Record<string, unknown> | null | undefined {
  if (!entrada.trim()) {
    return undefined;
  }
  try {
    const bruto: unknown = JSON.parse(entrada);
    return typeof bruto === 'object' && bruto !== null && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ---------- varredura ----------

export function percorrer(
  passos: readonly PassoDefinicao[],
  visitante: (passo: PassoDefinicao) => void,
): void {
  for (const passo of passos) {
    visitante(passo);
    for (const ramo of passo.ramos ?? []) {
      percorrer(ramo.passos, visitante);
    }
  }
}

export function contarPassos(passos: readonly PassoDefinicao[]): number {
  let total = 0;
  percorrer(passos, () => total++);
  return total;
}

/** Variáveis gravadas pelas perguntas do fluxo (para sugerir nas condições e nos textos). */
export function variaveisDoFluxo(passos: readonly PassoDefinicao[]): string[] {
  const nomes = new Set<string>();
  percorrer(passos, (passo) => {
    const nome = texto(passo.config?.['variavel']);
    if (nome && passo.tipo.startsWith('pergunta.')) {
      nomes.add(nome);
      if (passo.tipo === 'pergunta.opcoes') {
        nomes.add(`${nome}_id`);
      }
    }
    const salvarEm = texto(passo.config?.['salvarEm']);
    if (salvarEm) {
      nomes.add(salvarEm);
    }
  });
  return [...nomes];
}

/** Um passo e o que falta nele (mensagens curtas para quem não é técnico). */
export function problemasDoPasso(passo: PassoDefinicao): string[] {
  const c: ConfigPasso = passo.config ?? {};
  const faltas: string[] = [];
  switch (passo.tipo) {
    case 'mensagem':
      if (!texto(c['texto']) && !texto(c['arquivoId'])) {
        faltas.push('Escreva a mensagem.');
      }
      break;
    case 'pergunta.opcoes': {
      if (!texto(c['texto'])) {
        faltas.push('Escreva a pergunta.');
      }
      const opcoes = opcoesDaPergunta(passo);
      if (opcoes.length < MINIMO_DE_OPCOES || opcoes.some((o) => !texto(o.rotulo))) {
        faltas.push('Preencha ao menos duas opções, todas com texto.');
      }
      break;
    }
    case 'pergunta.aberta':
      if (!texto(c['texto'])) {
        faltas.push('Escreva a pergunta.');
      }
      if (!texto(c['variavel'])) {
        faltas.push('Dê um nome para guardar a resposta.');
      }
      break;
    case 'condicao': {
      const ramos = passo.ramos ?? [];
      if (ramos.length === 0) {
        faltas.push('Adicione ao menos um caminho.');
      }
      for (const ramo of ramos) {
        for (const condicao of condicoesDoRamo(ramo)) {
          const problema = problemaDaCondicao(condicao);
          if (problema) {
            faltas.push(`${ramo.rotulo ?? 'Caminho'}: ${problema}`);
            break;
          }
        }
      }
      break;
    }
    case 'acao.etiquetar':
      if (etiquetasAAdicionar(c).length + listaDeTextos(c['remover']).length === 0) {
        faltas.push('Informe as etiquetas a adicionar ou remover.');
      }
      break;
    case 'acao.definir_campo':
      if (!texto(c['campo'])) {
        faltas.push('Escolha o campo.');
      }
      if (!texto(c['valor'])) {
        faltas.push('Informe o valor.');
      }
      break;
    case 'acao.mover_fila':
      if (!texto(c['filaId'])) {
        faltas.push('Escolha a fila.');
      }
      break;
    case 'acao.atribuir':
      if (!texto(c['usuarioId'])) {
        faltas.push('Escolha a pessoa.');
      }
      break;
    case 'acao.criar_atividade':
      if (!texto(c['titulo'])) {
        faltas.push('Informe o título da atividade.');
      }
      break;
    case 'acao.webhook':
      if (!/^https?:\/\//i.test(texto(c['url']))) {
        faltas.push('Informe o endereço (http:// ou https://).');
      }
      break;
    case 'aguardar':
      if (!(Number(c['quantidade']) > 0) && !texto(c['ate'])) {
        faltas.push('Informe quanto tempo esperar.');
      }
      break;
    default:
      break;
  }
  return faltas;
}

/** Problemas de preenchimento por id de passo. */
export function problemasDaArvore(passos: readonly PassoDefinicao[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  percorrer(passos, (passo) => {
    const lista = problemasDoPasso(passo);
    if (lista.length > 0) {
      mapa.set(passo.id, lista);
    }
  });
  return mapa;
}

/** Resumo de uma linha do passo fechado. */
export function resumoDoPasso(passo: PassoDefinicao): string {
  const c: ConfigPasso = passo.config ?? {};
  switch (passo.tipo) {
    case 'mensagem':
    case 'pergunta.opcoes':
    case 'pergunta.aberta':
      return texto(c['texto']);
    case 'condicao':
      return `${passo.ramos?.length ?? 0} caminhos`;
    case 'acao.etiquetar':
      return [
        etiquetasAAdicionar(c).length ? `+ ${etiquetasAAdicionar(c).join(', ')}` : '',
        listaDeTextos(c['remover']).length ? `− ${listaParaTexto(c['remover'])}` : '',
      ]
        .filter(Boolean)
        .join('  ');
    case 'acao.definir_campo':
      return texto(c['campo']) ? `${texto(c['campo'])} = ${texto(c['valor'])}` : '';
    case 'acao.criar_atividade':
      return texto(c['titulo']);
    case 'acao.webhook':
      return texto(c['url']);
    case 'transferir':
      return texto(c['mensagem']);
    case 'aguardar':
      return c['ate']
        ? `até ${texto(c['ate'])}`
        : `${texto(c['quantidade'])} ${texto(c['unidade'])}`;
    case 'encerrar':
      return texto(c['motivo']);
    default:
      return '';
  }
}

export function rotuloDoTipo(catalogo: readonly TipoDePasso[], tipo: string): string {
  return catalogo.find((t) => t.tipo === tipo)?.rotulo ?? tipo;
}

/** Muda um campo da configuração do passo (imutável). */
export function comConfig(passo: PassoDefinicao, mudancas: ConfigPasso): PassoDefinicao {
  const config: ConfigPasso = { ...(passo.config ?? {}), ...mudancas };
  for (const chave of Object.keys(config)) {
    if (config[chave] === undefined) {
      delete config[chave];
    }
  }
  return { ...passo, config };
}

export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || para < 0 || para >= lista.length) {
    return [...lista];
  }
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** Cópia profunda do passo com ids novos (as opções da pergunta levam os ramos junto). */
export function clonarPasso(passo: PassoDefinicao): PassoDefinicao {
  const fixos = new Set([RAMO_SEM_RESPOSTA, RAMO_INVALIDA, RAMO_SENAO]);
  const trocas = new Map<string, string>();
  let config = passo.config ? structuredClone(passo.config) : undefined;
  if (passo.tipo === 'pergunta.opcoes' && config) {
    config['opcoes'] = opcoesDaPergunta({ ...passo, config }).map((opcao) => {
      const id = novoId('opcao');
      trocas.set(opcao.id, id);
      return { ...opcao, id };
    });
  }
  config = config ? structuredClone(config) : undefined;
  return {
    ...passo,
    id: novoId('passo'),
    ...(config ? { config } : {}),
    ...(passo.proximo ? { proximo: undefined } : {}),
    ...(passo.ramos
      ? {
          ramos: passo.ramos.map((ramo) => ({
            ...structuredClone({ ...ramo, passos: [] }),
            id: trocas.get(ramo.id) ?? (fixos.has(ramo.id) ? ramo.id : novoId('ramo')),
            passos: ramo.passos.map(clonarPasso),
          })),
        }
      : {}),
  };
}

/** Explicações curtas para quem não é técnico (as da API citam campos internos). */
export const DESCRICAO_DO_PASSO: Readonly<Record<string, string>> = {
  mensagem: 'O robô manda um texto para o cliente e segue para o próximo passo.',
  'pergunta.opcoes':
    'O robô faz uma pergunta com respostas prontas. Cada opção pode seguir um caminho diferente.',
  'pergunta.aberta':
    'O robô faz uma pergunta e guarda o que o cliente escrever, podendo conferir se é e-mail, telefone, número ou data.',
  condicao:
    'O robô escolhe o caminho conforme uma resposta, um dado do contato, a etiqueta, o canal ou o horário.',
  'acao.etiquetar': 'Coloca ou tira etiquetas do contato.',
  'acao.definir_campo': 'Grava um valor num campo do cadastro do contato.',
  'acao.mover_fila': 'Leva a conversa para outra fila de atendimento.',
  'acao.atribuir': 'Entrega a conversa para uma pessoa específica.',
  'acao.criar_negocio': 'Abre um negócio para este contato num funil.',
  'acao.criar_atividade': 'Cria uma tarefa, ligação ou reunião para alguém da equipe.',
  'acao.webhook': 'Avisa outro sistema pela internet (para quem tem integração).',
  transferir:
    'O robô se despede e passa a conversa para uma fila ou pessoa, com o resumo das respostas.',
  aguardar: 'O robô espera um tempo antes de seguir.',
  encerrar: 'O robô para por aqui. A conversa continua com a equipe.',
};

/**
 * 422 `R5.9` (funil invisível) ou `R5.12` (sem permissão de criar) com `detalhes.passos` (ids dos
 * passos "criar negócio"): um problema por passo, com a mensagem da API, para destacar no editor.
 * `null` se o erro é de outro tipo.
 */
export function problemasDeNegocioDoPasso(erro: ErroApi): readonly ProblemaDefinicao[] | null {
  if (erro.status !== 422 || (erro.regra !== 'R5.9' && erro.regra !== 'R5.12')) {
    return null;
  }
  const passos = erro.detalhes?.['passos'];
  const ids = Array.isArray(passos)
    ? passos.filter((id): id is string => typeof id === 'string' && id !== '')
    : [];
  return ids.map((passoId) => ({ caminho: `passos.${passoId}`, mensagem: erro.resumo, passoId }));
}
