/**
 * Tipos da gravação, transcrição e resumo das ligações (Onda E, E3). O que
 * `crmbrl-api/src/ligacoes/gravacao` devolve e emite: "mudou lá, mude aqui".
 */

export type EstadoGravacao = 'sem' | 'enviando' | 'pronta' | 'falhou';
export type EstadoTranscricao = 'pendente' | 'processando' | 'pronta' | 'falhou' | 'desativada';
export type EstadoResumo = 'pendente' | 'processando' | 'pronto' | 'falhou' | 'desativado';
export type FalanteDoTrecho = 'atendente' | 'cliente' | 'participante';
export type SentimentoDaLigacao = 'positivo' | 'neutro' | 'negativo' | 'misto';
export type TipoDeSugestao = 'LIGACAO' | 'TAREFA' | 'EMAIL' | 'WHATSAPP' | 'REUNIAO';

/** Trecho de `GET /ligacoes/:id/transcricao`; tempos em segundos desde o início da gravação. */
export interface TrechoDaTranscricao {
  readonly falante: FalanteDoTrecho;
  readonly inicio: number;
  readonly fim: number;
  readonly texto: string;
}

/** `GET /ligacoes/:id/transcricao`. */
export interface TranscricaoCompleta {
  readonly situacao: EstadoTranscricao;
  readonly erro: string | null;
  readonly modelo: string | null;
  readonly duracaoSegundos: number | null;
  readonly trechos: readonly TrechoDaTranscricao[];
}

export interface SugestaoDeAtividade {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tipo: TipoDeSugestao;
  /** Prazo sugerido, em dias a partir de hoje. */
  readonly prazoEmDias: number;
  /** Preenchido depois que alguém criou a atividade a partir da sugestão. */
  readonly atividadeId: string | null;
  readonly descartadaEm: string | null;
}

export interface ConteudoDoResumo {
  readonly assunto: string;
  readonly pontosPrincipais: readonly string[];
  readonly combinados: readonly string[];
  readonly proximosPassos: readonly string[];
  readonly sentimento: SentimentoDaLigacao;
  readonly sentimentoMotivo: string;
  readonly sugestoes: readonly SugestaoDeAtividade[];
  readonly modelo: string;
}

/** O bloco `gravacao` do `GET /ligacoes/:id` (a transcrição e o resumo vêm nos irmãos). */
export interface GravacaoDaLigacao {
  readonly situacao: EstadoGravacao;
  readonly erro: string | null;
  readonly duracaoSegundos: number | null;
  /** Há áudio para ouvir (falso depois da remoção pela guarda). */
  readonly disponivel: boolean;
  /** Quando a guarda apagou a gravação e a transcrição (ou a anonimização). */
  readonly removidaEm: string | null;
  /** Só Admin e líderes baixam. */
  readonly podeBaixar: boolean;
}

/** `situacao` nula: a ligação não foi gravada. */
export interface TranscricaoDaLigacao {
  readonly situacao: EstadoTranscricao | null;
  readonly erro: string | null;
  readonly processadaEm: string | null;
}

export interface ResumoDaLigacao {
  readonly situacao: EstadoResumo | null;
  /** Falha, ou o motivo de estar desativado (sem chave, conversa curta…). */
  readonly erro: string | null;
  readonly processadoEm: string | null;
  readonly conteudo: ConteudoDoResumo | null;
}

/** Resposta de confirmar/descartar uma sugestão. */
export interface RespostaDeSugestao {
  readonly sugestaoId: string;
  readonly atividadeId: string | null;
  readonly resumo: ResumoDaLigacao;
}

/** Evento de tempo real: a transcrição ou o resumo terminaram (ou falharam). */
export interface EventoLigacaoProcessada {
  readonly ligacaoId: string;
  readonly etapa?: 'gravacao' | 'transcricao' | 'resumo';
}

/** O áudio de aviso que acabou de ser enviado (a configuração só guarda o id do arquivo). */
export interface AudioDeAviso {
  readonly id: string;
  readonly nome: string;
  readonly tamanhoBytes: number;
}
