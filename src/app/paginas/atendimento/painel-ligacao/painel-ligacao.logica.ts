import type {
  EstadoGravacao,
  EstadoResumo,
  EstadoTranscricao,
  FalanteDoTrecho,
  SentimentoDaLigacao,
  TipoDeSugestao,
  TrechoDaTranscricao,
} from '../../../nucleo/ligacoes/gravacao.tipos';
import { formatarDuracao } from '../../../nucleo/ligacoes/ligacoes.textos';

/** Lógica pura do painel da ligação (busca, trecho tocando, textos e prazos). */

export const ROTULO_FALANTE: Readonly<Record<FalanteDoTrecho, string>> = {
  atendente: 'Atendente',
  cliente: 'Cliente',
  participante: 'Participante',
};

export const ROTULO_SENTIMENTO: Readonly<Record<SentimentoDaLigacao, string>> = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  negativo: 'Negativo',
  misto: 'Misto',
};

export const ROTULO_TIPO_SUGESTAO: Readonly<Record<TipoDeSugestao, string>> = {
  TAREFA: 'Tarefa',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
};

/** Etapa ainda em andamento (a tela acompanha pelo tempo real). */
export function emProcessamento(
  estado: EstadoGravacao | EstadoTranscricao | EstadoResumo | null | undefined,
): boolean {
  return estado === 'enviando' || estado === 'pendente' || estado === 'processando';
}

/** `m:ss` do início do trecho, e a frase falada para o leitor de tela. */
export function marcaDeTempo(segundos: number): string {
  return formatarDuracao(segundos);
}

export function marcaFalada(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return minutos > 0 ? `${minutos} min ${resto} s` : `${resto} s`;
}

export interface PedacoDeTexto {
  readonly texto: string;
  readonly achado: boolean;
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Parte o texto em pedaços, marcando onde a busca aparece (sem diferenciar maiúsculas nem
 * acentos). Nada de HTML: o template mostra cada pedaço como texto.
 */
export function destacarBusca(texto: string, busca: string): readonly PedacoDeTexto[] {
  const termo = semAcento(busca.trim());
  if (!termo) {
    return [{ texto, achado: false }];
  }
  // `normalize('NFD')` pode mudar o tamanho; compara letra a letra para manter os índices.
  const letras = Array.from(texto);
  const base = letras.map((letra) => semAcento(letra));
  let mapa = '';
  const origem: number[] = [];
  base.forEach((parte, indice) => {
    for (const _ of parte) {
      origem.push(indice);
    }
    mapa += parte;
  });
  const pedacos: PedacoDeTexto[] = [];
  let cursor = 0;
  let posicao = mapa.indexOf(termo);
  while (posicao !== -1) {
    const de = origem[posicao]!;
    const ate = origem[posicao + termo.length - 1]! + 1;
    if (de > cursor) {
      pedacos.push({ texto: letras.slice(cursor, de).join(''), achado: false });
    }
    pedacos.push({ texto: letras.slice(de, ate).join(''), achado: true });
    cursor = ate;
    posicao = mapa.indexOf(termo, posicao + termo.length);
  }
  if (cursor < letras.length) {
    pedacos.push({ texto: letras.slice(cursor).join(''), achado: false });
  }
  return pedacos;
}

/** Quais trechos contêm a busca (índices). Busca vazia: nenhum filtro (todos). */
export function trechosEncontrados(
  trechos: readonly TrechoDaTranscricao[],
  busca: string,
): readonly number[] {
  const termo = semAcento(busca.trim());
  const todos = trechos.map((_, indice) => indice);
  if (!termo) {
    return todos;
  }
  return todos.filter((indice) => semAcento(trechos[indice]!.texto).includes(termo));
}

/** O trecho que está tocando: o último que já começou. `-1` antes do primeiro. */
export function trechoAtual(trechos: readonly TrechoDaTranscricao[], segundos: number): number {
  let atual = -1;
  for (let i = 0; i < trechos.length; i++) {
    if (trechos[i]!.inicio <= segundos + 0.05) {
      atual = i;
    } else {
      break;
    }
  }
  return atual;
}
