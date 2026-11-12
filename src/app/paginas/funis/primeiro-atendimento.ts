import { formatarDataHora } from '../../nucleo/formatos';
import type { PrimeiraInteracao, TipoPrimeiraInteracao } from './funis.tipos';

export const ROTULO_PRIMEIRA_INTERACAO: Readonly<Record<TipoPrimeiraInteracao, string>> = {
  LIGACAO: 'Ligação',
  MENSAGEM: 'Mensagem',
  EMAIL: 'E-mail',
  ATIVIDADE: 'Atividade concluída',
};

/** "menos de 1 min", "35 min", "2 h 10 min", "3 dias": do nascimento do negócio até a ação. */
export function duracaoAteAtendimento(criadoEm: string, em: string): string {
  const minutos = Math.max(
    0,
    Math.round((new Date(em).getTime() - new Date(criadoEm).getTime()) / 60_000),
  );
  if (minutos < 1) {
    return 'menos de 1 min';
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/**
 * R6.7 — "11/11/2026 às 14:05 · Ligação · por Fulano (em 2 h 10 min)", ou "Ainda não atendido"
 * quando nenhuma pessoa agiu com o contato depois da criação do negócio.
 */
export function descreverPrimeiroAtendimento(negocio: {
  readonly criadoEm: string;
  readonly primeiraInteracao?: PrimeiraInteracao | null;
}): string {
  const primeira = negocio.primeiraInteracao;
  if (!primeira) {
    return 'Ainda não atendido';
  }
  const quem = primeira.por ? ` · por ${primeira.por.nome}` : '';
  return `${formatarDataHora(primeira.em)} · ${ROTULO_PRIMEIRA_INTERACAO[primeira.tipo]}${quem} (em ${duracaoAteAtendimento(negocio.criadoEm, primeira.em)})`;
}
