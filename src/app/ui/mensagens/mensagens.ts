import { formatarHora, paraData } from '../../nucleo/formatos';
import type { StatusMensagem } from '../../nucleo/tempo-real/eventos';

export type { StatusMensagem } from '../../nucleo/tempo-real/eventos';

/**
 * Modelo de mensagem dos componentes de conversa (`ui/mensagens/`, DESIGN-SYSTEM.md §4.6). As
 * telas convertem o DTO da API para ele (os nomes dos enums são os da API, §2.4 do contrato da
 * Onda A). No Chat da equipe, as mensagens do próprio usuário são `SAIDA` e as dos outros,
 * `ENTRADA`.
 */

/** `ENTRADA` do contato · `SAIDA` da equipe · `INTERNA` nota só da equipe · `SISTEMA` aviso. */
export type DirecaoMensagem = 'ENTRADA' | 'SAIDA' | 'INTERNA' | 'SISTEMA';

export type TipoMensagem =
  | 'TEXTO'
  | 'IMAGEM'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENTO'
  | 'LOCALIZACAO'
  | 'CONTATO'
  | 'FIGURINHA'
  | 'REACAO';

export interface AutorMensagem {
  readonly id?: string | null;
  readonly nome: string;
  readonly foto?: string | null;
}

/** Arquivo de uma mensagem. `url` abre pela API (`/api/v1/arquivos/<id>`). */
export interface AnexoMensagem {
  readonly nome: string;
  readonly mime: string;
  readonly url: string;
  /** Bytes. */
  readonly tamanho?: number | null;
  /** Segundos (áudio e vídeo), para mostrar antes de carregar. */
  readonly duracao?: number | null;
  /** Dimensões (imagem e vídeo), para reservar o espaço antes de carregar. */
  readonly largura?: number | null;
  readonly altura?: number | null;
}

/**
 * Pedaço do texto com link: menção (`@Ana`), referência a negócio/contato (link interno, com
 * `routerLink`) ou endereço da web (`externo`). Sem `trechos`, a bolha acha sozinha os
 * endereços `http(s)://` e `www.` do texto.
 */
export interface TrechoMensagem {
  readonly texto: string;
  /** Rota interna (`'/contatos/1'` ou `['/funis', 'cs', id]`) ou, com `externo`, a URL. */
  readonly link?: string | readonly unknown[] | null;
  readonly externo?: boolean;
  readonly tipo?: 'mencao' | 'referencia' | 'link';
}

/** A mensagem citada numa resposta. */
export interface RespostaCitada {
  readonly autor?: string | null;
  readonly texto?: string | null;
  readonly tipo?: TipoMensagem | null;
}

export interface MensagemConversa {
  readonly id: string;
  readonly direcao: DirecaoMensagem;
  readonly tipo: TipoMensagem;
  readonly texto?: string | null;
  readonly trechos?: readonly TrechoMensagem[] | null;
  readonly anexo?: AnexoMensagem | null;
  /** Só nas de `SAIDA` (as que a equipe envia). */
  readonly status?: StatusMensagem | null;
  /** Motivo da falha, quando `status` é `FALHOU` (já em português). */
  readonly erro?: string | null;
  /** ISO 8601 ou `Date`. */
  readonly criadaEm: string | Date;
  readonly autor?: AutorMensagem | null;
  readonly respondeA?: RespostaCitada | null;
  readonly editada?: boolean;
  readonly excluida?: boolean;
}

export type TipoAnexo = 'imagem' | 'video' | 'audio' | 'documento';

/** Imagem, vídeo, áudio ou documento, pelo MIME (e pela extensão, se o MIME for genérico). */
export function tipoDoAnexo(mime: string | null | undefined, nome = ''): TipoAnexo {
  const tipo = (mime ?? '').toLowerCase();
  if (tipo.startsWith('image/')) {
    return 'imagem';
  }
  if (tipo.startsWith('video/')) {
    return 'video';
  }
  if (tipo.startsWith('audio/')) {
    return 'audio';
  }
  const ext = extensao(nome).toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'imagem';
  }
  if (['mp4', 'webm', 'mov'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'ogg', 'oga', 'opus', 'm4a', 'wav'].includes(ext)) {
    return 'audio';
  }
  return 'documento';
}

/** "relatorio.final.pdf" → "PDF" (sem extensão: ""). */
export function extensao(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 && ponto < nome.length - 1 ? nome.slice(ponto + 1).toUpperCase() : '';
}

/** "512 B", "12 KB", "1,2 MB", "1,1 GB" (base 1024, uma casa a partir de MB). */
export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  const casas = indice === 0 ? 0 : 1;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(valor)} ${unidades[indice]}`;
}

/** 12 → "0:12"; 65 → "1:05"; 3723 → "1:02:03". */
export function duracaoLegivel(segundos: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number.isFinite(segundos) ? (segundos as number) : 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = String(total % 60).padStart(2, '0');
  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, '0')}:${resto}`
    : `${minutos}:${resto}`;
}

/** Duração falada: 65 → "1 minuto e 5 segundos". */
export function duracaoFalada(segundos: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number.isFinite(segundos) ? (segundos as number) : 0));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  const partes: string[] = [];
  if (minutos) {
    partes.push(minutos === 1 ? '1 minuto' : `${minutos} minutos`);
  }
  if (resto || !minutos) {
    partes.push(resto === 1 ? '1 segundo' : `${resto} segundos`);
  }
  return partes.join(' e ');
}

/** "10:32". */
export function horaDaMensagem(valor: string | Date): string {
  return formatarHora(valor);
}

function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/** Mesmo dia no fuso do navegador. */
export function mesmoDia(a: string | Date, b: string | Date): boolean {
  const x = paraData(a);
  const y = paraData(b);
  return !!x && !!y && inicioDoDia(x) === inicioDoDia(y);
}

/**
 * Rótulo do separador de data: "Hoje", "Ontem", o dia da semana nos últimos 7 dias
 * ("Segunda-feira"), "20 de outubro" no mesmo ano e "20 de outubro de 2025" antes.
 */
export function rotuloDoDia(valor: string | Date, agora: Date = new Date()): string {
  const data = paraData(valor);
  if (!data) {
    return '';
  }
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(data)) / 86_400_000);
  if (dias === 0) {
    return 'Hoje';
  }
  if (dias === 1) {
    return 'Ontem';
  }
  if (dias > 1 && dias < 7) {
    const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(data);
    return semana.charAt(0).toUpperCase() + semana.slice(1);
  }
  const opcoes: Intl.DateTimeFormatOptions =
    data.getFullYear() === agora.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
}

const URL_NO_TEXTO = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
/** Pontuação que costuma fechar a frase, não o endereço. */
const PONTUACAO_FINAL = /[.,;:!?)\]}]+$/;

/**
 * Texto em trechos, com os endereços da web (`http(s)://`, `www.`) como links externos. Só
 * texto: nada de HTML (o Angular escapa tudo na interpolação).
 */
export function trechosDoTexto(texto: string | null | undefined): readonly TrechoMensagem[] {
  if (!texto) {
    return [];
  }
  const trechos: TrechoMensagem[] = [];
  let inicio = 0;
  for (const achado of texto.matchAll(URL_NO_TEXTO)) {
    let endereco = achado[1];
    const sobra = PONTUACAO_FINAL.exec(endereco)?.[0] ?? '';
    endereco = endereco.slice(0, endereco.length - sobra.length);
    const posicao = achado.index ?? 0;
    if (!endereco || /^(https?:\/\/|www\.)$/i.test(endereco)) {
      continue;
    }
    if (posicao > inicio) {
      trechos.push({ texto: texto.slice(inicio, posicao) });
    }
    const link = /^www\./i.test(endereco) ? `https://${endereco}` : endereco;
    trechos.push({ texto: endereco, link, externo: true, tipo: 'link' });
    inicio = posicao + endereco.length;
  }
  if (inicio < texto.length) {
    trechos.push({ texto: texto.slice(inicio) });
  }
  return trechos;
}

/** `{{contato.nome}}` → o valor de `variaveis['contato.nome']`; variável sem valor fica como está. */
export function substituirVariaveis(
  texto: string,
  variaveis: Readonly<Record<string, string | null | undefined>>,
): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (original, chave: string) => {
    const valor = variaveis[chave];
    return valor === null || valor === undefined || valor === '' ? original : valor;
  });
}

/** "Maria está digitando…", "Maria e Ana estão digitando…", "3 pessoas estão digitando…". */
export function fraseDigitando(nomes: readonly string[]): string {
  if (nomes.length === 0) {
    return '';
  }
  if (nomes.length === 1) {
    return `${nomes[0]} está digitando…`;
  }
  if (nomes.length === 2) {
    return `${nomes[0]} e ${nomes[1]} estão digitando…`;
  }
  return `${nomes.length} pessoas estão digitando…`;
}

/** Rótulo falado e visível de cada status de entrega. */
export const ROTULO_STATUS: Readonly<Record<StatusMensagem, string>> = {
  PENDENTE: 'Enviando',
  ENVIADA: 'Enviada',
  ENTREGUE: 'Entregue',
  LIDA: 'Lida',
  FALHOU: 'Não enviada',
};

/** O que dizer de uma mensagem sem texto (prévia, leitor de tela): "Áudio", "Imagem"… */
export const ROTULO_TIPO: Readonly<Record<TipoMensagem, string>> = {
  TEXTO: 'Mensagem',
  IMAGEM: 'Imagem',
  AUDIO: 'Áudio',
  VIDEO: 'Vídeo',
  DOCUMENTO: 'Documento',
  LOCALIZACAO: 'Localização',
  CONTATO: 'Contato',
  FIGURINHA: 'Figurinha',
  REACAO: 'Reação',
};

// Lista ---------------------------------------------------------------------------------------

/** Mensagens do mesmo autor com menos que isto entre elas ficam agrupadas (sem repetir nome). */
export const JANELA_GRUPO_MS = 5 * 60_000;

export type ItemLista =
  | { readonly tipo: 'topo'; readonly id: string }
  | { readonly tipo: 'data'; readonly id: string; readonly rotulo: string }
  | {
      readonly tipo: 'mensagem';
      /** `m:<id da mensagem>` (as chaves dos outros itens nunca começam com `m:`). */
      readonly id: string;
      readonly mensagem: MensagemConversa;
      /** Continua a mensagem anterior (mesmo autor, mesma direção, pouco tempo depois). */
      readonly continuacao: boolean;
      /** A próxima é continuação desta (o avatar vai na última do grupo). */
      readonly seguida: boolean;
    };

function chaveDoAutor(mensagem: MensagemConversa): string {
  return `${mensagem.direcao}|${mensagem.autor?.id ?? mensagem.autor?.nome ?? ''}`;
}

function agrupa(anterior: MensagemConversa | undefined, atual: MensagemConversa): boolean {
  if (!anterior || anterior.direcao === 'SISTEMA' || atual.direcao === 'SISTEMA') {
    return false;
  }
  if (
    chaveDoAutor(anterior) !== chaveDoAutor(atual) ||
    !mesmoDia(anterior.criadaEm, atual.criadaEm)
  ) {
    return false;
  }
  const a = paraData(anterior.criadaEm)?.getTime() ?? 0;
  const b = paraData(atual.criadaEm)?.getTime() ?? 0;
  return Math.abs(b - a) <= JANELA_GRUPO_MS;
}

/**
 * Itens da lista de mensagens (da mais antiga para a mais nova): o topo ("carregar
 * anteriores" ou "início da conversa"), um separador a cada dia e as mensagens, marcadas como
 * continuação quando o mesmo autor manda várias em sequência.
 */
export function itensDaLista(
  mensagens: readonly MensagemConversa[],
  agora: Date = new Date(),
): readonly ItemLista[] {
  if (!mensagens.length) {
    return [];
  }
  const itens: ItemLista[] = [{ tipo: 'topo', id: 'topo' }];
  for (let i = 0; i < mensagens.length; i++) {
    const mensagem = mensagens[i];
    const anterior = mensagens[i - 1];
    if (!anterior || !mesmoDia(anterior.criadaEm, mensagem.criadaEm)) {
      const data = paraData(mensagem.criadaEm);
      const chave = data
        ? `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`
        : `sem-data-${i}`;
      itens.push({
        tipo: 'data',
        id: `data:${chave}`,
        rotulo: rotuloDoDia(mensagem.criadaEm, agora),
      });
    }
    itens.push({
      tipo: 'mensagem',
      id: `m:${mensagem.id}`,
      mensagem,
      continuacao: agrupa(anterior, mensagem),
      seguida: i + 1 < mensagens.length && agrupa(mensagem, mensagens[i + 1]),
    });
  }
  return itens;
}

// Arquivos -----------------------------------------------------------------------------------

/** Limites de envio (R11): 25 MB por padrão, documentos até 100 MB; SVG e HTML recusados. */
export interface LimitesAnexo {
  readonly padraoMb: number;
  readonly documentoMb: number;
}

export const LIMITES_ANEXO: LimitesAnexo = { padraoMb: 25, documentoMb: 100 };

const MIMES_RECUSADOS = ['image/svg+xml', 'text/html', 'application/xhtml+xml'];
const EXTENSOES_RECUSADAS = ['SVG', 'SVGZ', 'HTML', 'HTM', 'XHTML'];

/** Tipos que o seletor de arquivos oferece (a API confere de novo). */
export const ACEITAR_ANEXOS =
  'image/png,image/jpeg,image/gif,image/webp,audio/*,video/mp4,video/webm,video/quicktime,' +
  'application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.csv,.txt,.zip';

/** `null` quando o arquivo pode ir; senão, o motivo (frase pronta para a tela). */
export function motivoDeRecusa(
  arquivo: Pick<File, 'name' | 'type' | 'size'>,
  limites: LimitesAnexo = LIMITES_ANEXO,
): string | null {
  const mime = (arquivo.type || '').toLowerCase();
  if (MIMES_RECUSADOS.includes(mime) || EXTENSOES_RECUSADAS.includes(extensao(arquivo.name))) {
    return `“${arquivo.name}” não pode ser enviado: arquivos SVG e HTML não são aceitos.`;
  }
  const documento = tipoDoAnexo(mime, arquivo.name) === 'documento';
  const limiteMb = documento ? limites.documentoMb : limites.padraoMb;
  if (arquivo.size > limiteMb * 1024 * 1024) {
    return `“${arquivo.name}” passa de ${limiteMb} MB, o limite para ${documento ? 'documentos' : 'imagens, áudios e vídeos'}.`;
  }
  return null;
}
