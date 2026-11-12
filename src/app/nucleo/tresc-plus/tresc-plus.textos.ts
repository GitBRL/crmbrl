import type { EstadoDaLigacaoTresc, EstadoDoAgente } from './tresc-plus.tipos';
import type { VarianteSelo } from '../../ui/selo/selo';

export interface VisaoDoEstado {
  readonly rotulo: string;
  readonly variante: VarianteSelo;
  /** Descrição curta para o leitor de tela e para a dica. */
  readonly descricao: string;
}

export const VISAO_DO_AGENTE: Readonly<Record<EstadoDoAgente, VisaoDoEstado>> = {
  desconectado: {
    rotulo: 'Fora da campanha',
    variante: 'neutro',
    descricao: 'Você não está em nenhuma campanha do 3C+.',
  },
  ocioso: { rotulo: 'Disponível', variante: 'menta', descricao: 'Pronto para o discador.' },
  manual: { rotulo: 'Manual', variante: 'menta', descricao: 'Em campanha, pronto para ligar.' },
  em_ligacao: { rotulo: 'Em ligação', variante: 'ciano', descricao: 'Você está numa ligação.' },
  pos_atendimento: {
    rotulo: 'Pós-atendimento',
    variante: 'lima',
    descricao: 'Qualifique a ligação para ficar livre.',
  },
  pausa: { rotulo: 'Em pausa', variante: 'coral', descricao: 'Você está numa pausa.' },
};

export const ROTULO_LIGACAO_TRESC: Readonly<Record<EstadoDaLigacaoTresc, string>> = {
  CHAMANDO: 'Chamando…',
  TOCANDO: 'Tocando…',
  EM_ANDAMENTO: 'Em ligação',
  ENCERRADA: 'Encerrada',
  PERDIDA: 'Perdida',
  SEM_RESPOSTA: 'Sem resposta',
  FALHOU: 'Falhou',
};

export const LIGACAO_TRESC_TERMINAL: readonly EstadoDaLigacaoTresc[] = [
  'ENCERRADA',
  'PERDIDA',
  'SEM_RESPOSTA',
  'FALHOU',
];

/** "1:05" / "1:02:03" a partir de segundos. */
export function formatarCronometro(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/** Segundos entre o ISO e `agora` (0 se o ISO for inválido ou futuro). */
export function segundosDesde(iso: string | null, agora: number): number {
  if (!iso) {
    return 0;
  }
  const inicio = Date.parse(iso);
  return Number.isNaN(inicio) ? 0 : Math.max(0, Math.floor((agora - inicio) / 1000));
}

/** O texto de um cronômetro para o leitor de tela: "2 minutos e 5 segundos". */
export function cronometroFalado(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  const partes: string[] = [];
  if (m) {
    partes.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  }
  partes.push(`${s} ${s === 1 ? 'segundo' : 'segundos'}`);
  return partes.join(' e ');
}
