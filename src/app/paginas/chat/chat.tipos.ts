import type { Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';
import { ordemDoSetor } from '../../nucleo/setores/setores';
import {
  type AnexoMensagem,
  type MensagemConversa,
  tipoDoAnexo,
  type TipoMensagem,
  type TrechoMensagem,
  trechosDoTexto,
} from '../../ui/mensagens/mensagens';

/**
 * Modelos do Chat da equipe (`/api/v1/chat`, §2.6 do contrato da Onda A, R15) e as funções
 * puras da tela: conversão para o modelo dos componentes de conversa (`ui/mensagens/`), seções
 * da lista de canais, prévias e as marcações de menção e referência do texto.
 */

// API ---------------------------------------------------------------------------------------

export type TipoChatCanal = 'GERAL' | 'AREA' | 'GRUPO' | 'DIRETO';
export type TipoReferencia = 'negocio' | 'contato' | 'empresa';

/** Pessoa como o chat mostra (autor, membro, outra pessoa da direta, busca de pessoas). */
export interface ChatPessoa {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl: string | null;
  readonly papel: Papel;
  readonly rotuloPapel: string;
  readonly area: Area | null;
  /** `false`: desligada (o histórico continua). */
  readonly ativo: boolean;
  /** Com o CRM aberto no momento da resposta. */
  readonly online: boolean;
}

/** Item citado numa mensagem, já resolvido pela API. */
export interface ChatReferencia {
  readonly tipo: TipoReferencia;
  readonly id: string;
  readonly titulo: string | null;
  /** Rota do front (`/funis/<funilId>?negocio=<id>`, `/contatos/<id>`, `/empresas/<id>`). */
  readonly link: string | null;
  readonly disponivel: boolean;
}

/** Pedaço do texto: texto puro, menção (`@Nome`) ou referência (título do item). */
export interface ChatParte {
  readonly tipo: 'texto' | 'mencao' | 'referencia';
  readonly texto: string;
  readonly usuarioId?: string;
  readonly referencia?: ChatReferencia;
}

export interface ChatMensagemCitada {
  readonly id: string;
  readonly autor: string | null;
  readonly resumo: string;
  readonly anexoNome: string | null;
  readonly excluida: boolean;
}

/** Arquivo como a API devolve (`ArquivoDto`). */
export interface ArquivoChat {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly tamanho: number;
  readonly largura?: number | null;
  readonly altura?: number | null;
  readonly duracaoSegundos?: number | null;
  readonly url: string;
}

export interface ChatMensagem {
  readonly id: string;
  readonly canalId: string;
  /** `null` nos avisos do sistema. */
  readonly autor: ChatPessoa | null;
  readonly sistema: boolean;
  /** O texto com as marcações (`<@id>`, `<negocio:id>`…), para editar. */
  readonly texto: string | null;
  readonly partes: readonly ChatParte[];
  readonly anexo: ArquivoChat | null;
  readonly mencoes: readonly string[];
  readonly referencias: readonly ChatReferencia[];
  readonly respostaA: ChatMensagemCitada | null;
  readonly editadaEm: string | null;
  readonly excluida: boolean;
  readonly excluidaEm?: string | null;
  readonly criadaEm: string;
}

export interface ChatUltimaMensagem {
  readonly id: string;
  readonly autorId: string | null;
  readonly autorNome: string | null;
  readonly resumo: string;
  readonly excluida: boolean;
  readonly criadaEm: string;
}

/** Canal do ponto de vista de quem pergunta. */
export interface ChatCanal {
  readonly id: string;
  readonly tipo: TipoChatCanal;
  /** Na direta, o nome da outra pessoa. */
  readonly nome: string;
  readonly descricao: string | null;
  readonly area: Area | null;
  readonly outraPessoa: ChatPessoa | null;
  readonly totalMembros: number;
  readonly administrador: boolean;
  /** No canal pelo papel (Geral e áreas): só dá para silenciar. */
  readonly automatico: boolean;
  readonly silenciado: boolean;
  readonly naoLidas: number;
  readonly mencoesNaoLidas: number;
  readonly ultimaLeituraEm: string | null;
  readonly ultimaMensagem: ChatUltimaMensagem | null;
  readonly ultimaMensagemEm: string | null;
  readonly arquivadoEm: string | null;
  readonly podeEnviar: boolean;
  readonly motivoSemEnvio: string | null;
  readonly podeGerenciar: boolean;
  readonly podeSair: boolean;
  readonly criadoEm: string;
}

export interface ChatMembro {
  readonly usuario: ChatPessoa;
  readonly administrador: boolean;
  readonly automatico: boolean;
  readonly entrouEm: string;
}

export interface PaginaMensagensChat {
  /** Da mais antiga para a mais nova. */
  readonly itens: readonly ChatMensagem[];
  readonly temAnteriores: boolean;
  readonly temPosteriores: boolean;
}

export interface ResultadoDireta {
  readonly criada: boolean;
  readonly canal: ChatCanal;
}

export interface ResultadoBuscaChat {
  readonly mensagem: ChatMensagem;
  readonly canal: { readonly id: string; readonly tipo: TipoChatCanal; readonly nome: string };
}

/** Limites da API (regras-chat.ts). */
export const LIMITES_CHAT = {
  texto: 4_000,
  nome: 80,
  descricao: 500,
  membrosDoGrupo: 200,
} as const;

// Texto -------------------------------------------------------------------------------------

/** Minúsculas e sem acentos, para buscar ("José" acha "jose"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

export interface PedacoDestacado {
  readonly texto: string;
  readonly destaque: boolean;
}

/**
 * O texto em pedaços, com os termos da busca destacados (sem diferenciar acentos nem
 * maiúsculas, como a busca da API): "Proposta da Acme" + "acme" → "Proposta da " · "Acme".
 */
export function destacarTermos(texto: string, busca: string): readonly PedacoDestacado[] {
  const termos = normalizar(busca)
    .split(/\s+/)
    .filter((termo) => termo.length > 0);
  if (!texto || !termos.length) {
    return texto ? [{ texto, destaque: false }] : [];
  }
  // Texto normalizado e, para cada caractere dele, a posição no original.
  let normalizado = '';
  const origem: number[] = [];
  Array.from(texto).reduce((posicao, caractere) => {
    for (const simples of normalizar(caractere)) {
      normalizado += simples;
      origem.push(posicao);
    }
    return posicao + caractere.length;
  }, 0);
  const marcado = Array.from({ length: texto.length }, () => false);
  for (const termo of termos) {
    for (let i = normalizado.indexOf(termo); i >= 0; i = normalizado.indexOf(termo, i + 1)) {
      const inicio = origem[i];
      const fim = i + termo.length < origem.length ? origem[i + termo.length] : texto.length;
      marcado.fill(true, inicio, fim);
    }
  }
  const pedacos: PedacoDestacado[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = pedacos[pedacos.length - 1];
    if (ultimo && ultimo.destaque === marcado[i]) {
      pedacos[pedacos.length - 1] = { texto: ultimo.texto + texto[i], destaque: marcado[i] };
    } else {
      pedacos.push({ texto: texto[i], destaque: marcado[i] });
    }
  }
  return pedacos;
}

/** "Ana Beatriz Lopes" → "Ana". */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

// Mensagens ---------------------------------------------------------------------------------

/**
 * Link interno de uma referência. O do negócio vem com consulta (`/funis/<funilId>?negocio=
 * <id>`), que o `routerLink` em texto codificaria (`%3F`); ele passa pela rota
 * `/chat/negocio/<funilId>/<id>`, que leva ao negócio (chat.routes.ts).
 */
export function rotaDaReferencia(referencia: ChatReferencia): string | readonly string[] | null {
  const link = referencia.link?.trim();
  if (!referencia.disponivel || !link || !link.startsWith('/')) {
    return null;
  }
  const negocio = /^\/funis\/([^/?#]+)\?negocio=([^&#]+)$/.exec(link);
  if (negocio) {
    return ['/chat', 'negocio', decodeURIComponent(negocio[1]), decodeURIComponent(negocio[2])];
  }
  return link.split(/[?#]/)[0];
}

/** Menção: abre a conversa direta com a pessoa (`/chat/pessoa/<id>`); a si mesmo, o perfil. */
export function rotaDaMencao(usuarioId: string, eu: string | null): readonly string[] {
  return usuarioId === eu ? ['/configuracoes', 'perfil'] : ['/chat', 'pessoa', usuarioId];
}

/** As partes da API em trechos da bolha (endereços da web do texto viram links). */
export function trechosDasPartes(
  partes: readonly ChatParte[],
  eu: string | null,
): readonly TrechoMensagem[] {
  const trechos: TrechoMensagem[] = [];
  for (const parte of partes) {
    if (parte.tipo === 'mencao' && parte.usuarioId) {
      trechos.push({
        texto: parte.texto,
        link: rotaDaMencao(parte.usuarioId, eu),
        tipo: 'mencao',
      });
    } else if (parte.tipo === 'referencia' && parte.referencia) {
      const rota = rotaDaReferencia(parte.referencia);
      trechos.push(
        rota ? { texto: parte.texto, link: rota, tipo: 'referencia' } : { texto: parte.texto },
      );
    } else if (parte.texto) {
      trechos.push(...trechosDoTexto(parte.texto));
    }
  }
  return trechos;
}

/** O texto como se lê (menções como `@Nome`, referências pelo título). */
export function textoDasPartes(partes: readonly ChatParte[]): string {
  return partes.map((parte) => parte.texto).join('');
}

/** Aviso do sistema ("Ana adicionou Pedro"): as pessoas pelo nome, sem o "@" das menções. */
export function textoDoAviso(partes: readonly ChatParte[]): string {
  return partes
    .map((parte) => (parte.tipo === 'mencao' ? parte.texto.replace(/^@/, '') : parte.texto))
    .join('');
}

function tipoPeloAnexo(anexo: ArquivoChat | null): TipoMensagem {
  if (!anexo) {
    return 'TEXTO';
  }
  switch (tipoDoAnexo(anexo.mime, anexo.nome)) {
    case 'imagem':
      return 'IMAGEM';
    case 'audio':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    default:
      return 'DOCUMENTO';
  }
}

export function anexoDaMensagem(anexo: ArquivoChat): AnexoMensagem {
  return {
    nome: anexo.nome,
    mime: anexo.mime,
    url: anexo.url,
    tamanho: anexo.tamanho,
    duracao: anexo.duracaoSegundos ?? null,
    largura: anexo.largura ?? null,
    altura: anexo.altura ?? null,
  };
}

/** Resumo da mensagem citada numa resposta. */
export function resumoDaCitada(citada: ChatMensagemCitada): string {
  if (citada.excluida) {
    return 'Mensagem apagada';
  }
  return citada.resumo || (citada.anexoNome ? `Anexo: ${citada.anexoNome}` : '');
}

/**
 * A mensagem da API no modelo dos componentes de conversa: as do próprio usuário são
 * `SAIDA`, as dos outros `ENTRADA` e os avisos do sistema `SISTEMA`.
 */
export function paraMensagemConversa(mensagem: ChatMensagem, eu: string | null): MensagemConversa {
  const sistema = mensagem.sistema || !mensagem.autor;
  const direcao = sistema ? 'SISTEMA' : mensagem.autor?.id === eu ? 'SAIDA' : 'ENTRADA';
  return {
    id: mensagem.id,
    direcao,
    tipo: tipoPeloAnexo(mensagem.anexo),
    texto: (sistema ? textoDoAviso(mensagem.partes) : textoDasPartes(mensagem.partes)) || null,
    trechos: sistema ? null : trechosDasPartes(mensagem.partes, eu),
    anexo: mensagem.anexo ? anexoDaMensagem(mensagem.anexo) : null,
    criadaEm: mensagem.criadaEm,
    autor: mensagem.autor
      ? { id: mensagem.autor.id, nome: mensagem.autor.nome, foto: mensagem.autor.avatarUrl }
      : null,
    respondeA:
      mensagem.respostaA && !mensagem.excluida
        ? { autor: mensagem.respostaA.autor, texto: resumoDaCitada(mensagem.respostaA) }
        : null,
    editada: !!mensagem.editadaEm && !mensagem.excluida,
    excluida: mensagem.excluida,
  };
}

/** Insere ou troca (pelo id) e mantém a ordem de criação. */
export function mesclarMensagens(
  atuais: readonly ChatMensagem[],
  novas: readonly ChatMensagem[],
): readonly ChatMensagem[] {
  if (!novas.length) {
    return atuais;
  }
  const porId = new Map(atuais.map((mensagem) => [mensagem.id, mensagem]));
  for (const mensagem of novas) {
    porId.set(mensagem.id, mensagem);
  }
  return [...porId.values()].sort(
    (a, b) => Date.parse(a.criadaEm) - Date.parse(b.criadaEm) || a.id.localeCompare(b.id),
  );
}

// Marcações no texto --------------------------------------------------------------------------

/**
 * O que a pessoa vê no campo (`@Ana Lima`, `#ACME — implantação`) e a marcação que vai para a
 * API (`<@id>`, `<negocio:id>`).
 */
export interface Marcacao {
  readonly visivel: string;
  readonly marcacao: string;
}

/** Rascunho de um canal (guardado ao trocar de canal). */
export interface RascunhoChat {
  readonly texto: string;
  readonly marcacoes: readonly Marcacao[];
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Troca no texto o que foi escolhido nas sugestões pela marcação da API. Só troca a ocorrência
 * inteira (`@Ana` não pega o começo de `@Anabela`); as mais longas primeiro.
 */
export function aplicarMarcacoes(texto: string, marcacoes: readonly Marcacao[]): string {
  const validas = marcacoes.filter((item) => item.visivel.length > 1);
  if (!validas.length || !texto) {
    return texto;
  }
  const porVisivel = new Map(validas.map((item) => [item.visivel, item.marcacao]));
  const alternativas = [...porVisivel.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escaparRegex)
    .join('|');
  const padrao = new RegExp(`(${alternativas})(?![\\p{L}\\p{N}_])`, 'gu');
  return texto.replace(padrao, (achado) => porVisivel.get(achado) ?? achado);
}

/** As marcações que ainda aparecem no texto (as outras foram apagadas pela pessoa). */
export function marcacoesPresentes(
  texto: string,
  marcacoes: readonly Marcacao[],
): readonly Marcacao[] {
  return marcacoes.filter((item) => texto.includes(item.visivel));
}

/** Marcação de menção e de referência, como a API espera. */
export function marcarMencao(usuarioId: string): string {
  return `<@${usuarioId}>`;
}

export function marcarReferencia(tipo: TipoReferencia, id: string): string {
  return `<${tipo}:${id}>`;
}

/**
 * O texto de uma mensagem pronto para editar no campo, com as marcações de volta à forma
 * visível (`<@id>` → `@Ana Lima`, `<negocio:id>` → `#ACME`) e a lista para desfazer isso ao
 * salvar.
 */
export function textoParaEdicao(mensagem: ChatMensagem): {
  readonly texto: string;
  readonly marcacoes: readonly Marcacao[];
} {
  const marcacoes: Marcacao[] = [];
  let texto = '';
  for (const parte of mensagem.partes) {
    if (parte.tipo === 'mencao' && parte.usuarioId) {
      const visivel = parte.texto.startsWith('@') ? parte.texto : `@${parte.texto}`;
      marcacoes.push({ visivel, marcacao: marcarMencao(parte.usuarioId) });
      texto += visivel;
    } else if (parte.tipo === 'referencia' && parte.referencia) {
      const visivel = `#${parte.texto}`;
      marcacoes.push({
        visivel,
        marcacao: marcarReferencia(parte.referencia.tipo, parte.referencia.id),
      });
      texto += visivel;
    } else {
      texto += parte.texto;
    }
  }
  return { texto, marcacoes };
}

/**
 * O gatilho de sugestão logo antes do cursor: `@` (pessoa) ou `#` (negócio, contato ou
 * empresa) no começo de uma palavra, seguido do que já foi digitado (até 40 caracteres, no
 * máximo dois espaços, sem quebra de linha).
 */
export interface GatilhoSugestao {
  readonly tipo: 'mencao' | 'referencia';
  /** Onde está o `@`/`#`. */
  readonly inicio: number;
  readonly consulta: string;
}

export function gatilhoNoCursor(texto: string, cursor: number): GatilhoSugestao | null {
  const antes = texto.slice(0, Math.max(0, cursor));
  const achado = /(^|[\s(])([@#])([^\s@#]*(?: [^\s@#]*){0,2})$/u.exec(antes);
  if (!achado || achado[3].length > 40) {
    return null;
  }
  const inicio = antes.length - achado[3].length - 1;
  return {
    tipo: achado[2] === '@' ? 'mencao' : 'referencia',
    inicio,
    consulta: achado[3],
  };
}

/** Pessoas que combinam com a consulta: primeiro as que têm um nome começando com ela. */
export function filtrarPessoas<T extends { readonly nome: string }>(
  pessoas: readonly T[],
  consulta: string,
  limite = 8,
): readonly T[] {
  const termo = normalizar(consulta.trim());
  if (!termo) {
    return pessoas.slice(0, limite);
  }
  const comeca = pessoas.filter((pessoa) =>
    normalizar(pessoa.nome)
      .split(/\s+/)
      .some((parte, i, partes) => partes.slice(i).join(' ').startsWith(termo)),
  );
  const contem = pessoas.filter(
    (pessoa) => !comeca.includes(pessoa) && normalizar(pessoa.nome).includes(termo),
  );
  return [...comeca, ...contem].slice(0, limite);
}

// Lista de canais ---------------------------------------------------------------------------

export type IdSecao = 'canais' | 'grupos' | 'diretas' | 'arquivados';

export interface SecaoCanais {
  readonly id: IdSecao;
  readonly rotulo: string;
  readonly canais: readonly ChatCanal[];
}

const ROTULO_SECAO: Readonly<Record<IdSecao, string>> = {
  canais: 'Canais',
  grupos: 'Grupos',
  diretas: 'Conversas diretas',
  arquivados: 'Arquivados',
};

function momento(canal: ChatCanal): number {
  return Date.parse(canal.ultimaMensagemEm ?? canal.criadoEm) || 0;
}

function porMaisRecente(a: ChatCanal, b: ChatCanal): number {
  return momento(b) - momento(a) || a.nome.localeCompare(b.nome, 'pt-BR');
}

/** Canais de setor: os de base primeiro (Marketing, Comercial, CS), os outros por nome. */
function ordemDaArea(area: Area | null): number {
  return area ? ordemDoSetor(area) : -1;
}

/**
 * Seções da lista: **Canais** (o Geral e os dos setores, nesta ordem), **Grupos** e **Conversas
 * diretas** (as mais recentes primeiro) e **Arquivados**. Com `filtro`, só os canais cujo nome
 * contém o termo (sem acentos); seções vazias somem.
 */
export function secoesDosCanais(canais: readonly ChatCanal[], filtro = ''): readonly SecaoCanais[] {
  const termo = normalizar(filtro.trim());
  const visiveis = termo
    ? canais.filter((canal) => normalizar(canal.nome).includes(termo))
    : canais;
  const fixos = visiveis
    .filter((canal) => canal.tipo === 'GERAL' || canal.tipo === 'AREA')
    .sort(
      (a, b) =>
        (a.tipo === 'GERAL' ? -2 : ordemDaArea(a.area)) -
          (b.tipo === 'GERAL' ? -2 : ordemDaArea(b.area)) || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  const grupos = visiveis
    .filter((canal) => canal.tipo === 'GRUPO' && !canal.arquivadoEm)
    .sort(porMaisRecente);
  const diretas = visiveis.filter((canal) => canal.tipo === 'DIRETO').sort(porMaisRecente);
  const arquivados = visiveis
    .filter((canal) => canal.tipo === 'GRUPO' && !!canal.arquivadoEm)
    .sort(porMaisRecente);
  const secoes: [IdSecao, readonly ChatCanal[]][] = [
    ['canais', fixos],
    ['grupos', grupos],
    ['diretas', diretas],
    ['arquivados', arquivados],
  ];
  return secoes
    .filter(([, lista]) => lista.length > 0)
    .map(([id, lista]) => ({ id, rotulo: ROTULO_SECAO[id], canais: lista }));
}

/** "Canal geral", "Canal do setor", "Grupo", "Conversa direta". */
export function rotuloDoTipo(canal: Pick<ChatCanal, 'tipo' | 'arquivadoEm'>): string {
  switch (canal.tipo) {
    case 'GERAL':
      return 'Canal de toda a equipe';
    case 'AREA':
      return 'Canal do setor';
    case 'GRUPO':
      return canal.arquivadoEm ? 'Grupo arquivado' : 'Grupo';
    default:
      return 'Conversa direta';
  }
}

/** A linha de baixo do item na lista: "Você: …", "Ana: …" ou a descrição. */
export function previaDoCanal(canal: ChatCanal, eu: string | null): string {
  const ultima = canal.ultimaMensagem;
  if (!ultima) {
    return canal.tipo === 'DIRETO' ? 'Diga olá!' : 'Nenhuma mensagem ainda';
  }
  if (!ultima.autorId && !ultima.autorNome) {
    // Aviso do sistema: as pessoas citadas pelo nome, sem o "@".
    return ultima.resumo.replace(/(^|\s)@(?=\p{L})/gu, '$1');
  }
  const resumo = ultima.excluida ? 'Mensagem excluída' : ultima.resumo;
  if (ultima.autorId && ultima.autorId === eu) {
    return `Você: ${resumo}`;
  }
  if (!ultima.autorNome || canal.tipo === 'DIRETO') {
    return resumo;
  }
  return `${primeiroNome(ultima.autorNome)}: ${resumo}`;
}

function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/** Quando foi a última mensagem: "10:32", "Ontem", "seg.", "12/10" ou "12/10/25". */
export function quandoCurto(iso: string | null | undefined, agora: Date = new Date()): string {
  const data = iso ? new Date(iso) : null;
  if (!data || Number.isNaN(data.getTime())) {
    return '';
  }
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(data)) / 86_400_000);
  if (dias <= 0) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
  }
  if (dias === 1) {
    return 'Ontem';
  }
  if (dias < 7) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(data);
  }
  return new Intl.DateTimeFormat(
    'pt-BR',
    data.getFullYear() === agora.getFullYear()
      ? { day: '2-digit', month: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: '2-digit' },
  ).format(data);
}

/** "99+" acima de 99. */
export function textoContagem(total: number): string {
  return total > 99 ? '99+' : String(total);
}

/** O nome acessível do item da lista ("Geral, 3 não lidas, 1 menção a você"). */
export function rotuloDoItem(canal: ChatCanal, ativo: boolean): string {
  const partes = [canal.nome];
  if (canal.tipo === 'DIRETO' && canal.outraPessoa) {
    partes.push(canal.outraPessoa.online ? 'online' : 'offline');
  }
  if (!ativo && canal.naoLidas > 0) {
    partes.push(canal.naoLidas === 1 ? '1 não lida' : `${canal.naoLidas} não lidas`);
  }
  if (!ativo && canal.mencoesNaoLidas > 0) {
    partes.push(
      canal.mencoesNaoLidas === 1 ? '1 menção a você' : `${canal.mencoesNaoLidas} menções a você`,
    );
  }
  if (canal.silenciado) {
    partes.push('silenciado');
  }
  return partes.join(', ');
}
