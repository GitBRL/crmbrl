import type { MensagemConversa } from '../../ui/mensagens/mensagens';
import type { VarianteSelo } from '../../ui/selo/selo';
import type {
  DecisaoDoSdr,
  ModoSdr,
  SdrDaConversa,
  SituacaoSdr,
  TemperaturaSdr,
} from './sdr.tipos';

/** Como o SDR com IA aparece nas telas: rótulos, cores com texto e as decisões como eventos. */

export const ROTULO_MODO: Readonly<Record<ModoSdr, string>> = {
  DESLIGADO: 'Desligado',
  AUTOMATICO: 'Automático',
  SUGESTAO: 'Sugestão',
};

export const ROTULO_SITUACAO: Readonly<Record<SituacaoSdr, string>> = {
  ATIVA: 'IA atendendo',
  HUMANO: 'Com uma pessoa',
  PASSADA_HUMANO: 'Passada para a equipe',
  QUALIFICADA: 'Qualificada',
  DESQUALIFICADA: 'Desqualificada',
  ENCERRADA: 'Encerrada',
};

export const ROTULO_TEMPERATURA: Readonly<Record<TemperaturaSdr, string>> = {
  QUENTE: 'Quente',
  MORNO: 'Morno',
  FRIO: 'Frio',
};

/** Quente é coral, morno é lima e frio é ciano: o texto sempre acompanha a cor. */
export const VARIANTE_TEMPERATURA: Readonly<Record<TemperaturaSdr, VarianteSelo>> = {
  QUENTE: 'coral',
  MORNO: 'lima',
  FRIO: 'ciano',
};

export const VARIANTE_SITUACAO: Readonly<Record<SituacaoSdr, VarianteSelo>> = {
  ATIVA: 'menta',
  HUMANO: 'neutro',
  PASSADA_HUMANO: 'contorno',
  QUALIFICADA: 'menta',
  DESQUALIFICADA: 'contorno',
  ENCERRADA: 'contorno',
};

/** "IA atendendo · automático" (o selo da lista e do cabeçalho; só com a IA ativa). */
export function textoDoSeloIa(sdr: Pick<SdrDaConversa, 'modo'>): string {
  return sdr.modo === 'SUGESTAO' ? 'IA sugerindo' : 'IA atendendo';
}

/** O que o leitor de tela fala do selo de IA. */
export function descricaoDoSeloIa(sdr: Pick<SdrDaConversa, 'modo'>): string {
  return sdr.modo === 'SUGESTAO'
    ? 'IA sugerindo respostas, no modo sugestão: uma pessoa aprova antes de enviar'
    : 'IA atendendo, no modo automático';
}

/** "Quente, nota 100" para o leitor de tela. */
export function descricaoDaTemperatura(
  temperatura: TemperaturaSdr,
  nota: number | null | undefined,
): string {
  const rotulo = ROTULO_TEMPERATURA[temperatura].toLowerCase();
  return nota === null || nota === undefined
    ? `Lead ${rotulo}`
    : `Lead ${rotulo}, nota ${nota} de 100`;
}

/** 0,9 → "90%". */
export function percentual(confianca: number | null | undefined): string | null {
  if (confianca === null || confianca === undefined || !Number.isFinite(confianca)) {
    return null;
  }
  return `${Math.round(confianca * 100)}%`;
}

/** `PESSOA` (alguém corrigiu o campo) ou `IA`. */
export function rotuloDaOrigem(origem: string | null | undefined): string | null {
  if (!origem) {
    return null;
  }
  return origem.toUpperCase() === 'IA' ? 'IA' : 'Pessoa';
}

const LIMITE_RESUMO = 220;

function encurtar(texto: string, limite: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1).trimEnd()}…` : limpo;
}

/** "Respondeu · descobriu: Curso, Cidade · nota 40" → "Curso, Cidade". */
function criteriosDoTitulo(titulo: string): string | null {
  const achado = /descobriu:\s*([^·]+?)\s*(?:·|$)/i.exec(titulo);
  return achado?.[1]?.trim() || null;
}

/** O texto discreto de uma decisão da IA na conversa; `null` = não vira evento. */
export function textoDoEvento(decisao: DecisaoDoSdr): string | null {
  switch (decisao.tipo) {
    case 'ASSUMIU':
      return `A IA assumiu o atendimento deste lead.`;
    case 'TURNO': {
      // Passar para a equipe e qualificar têm a própria decisão logo depois.
      if (decisao.acao === 'QUALIFICADO' || decisao.acao === 'PASSAR_HUMANO') {
        return null;
      }
      const criterios = criteriosDoTitulo(decisao.titulo);
      if (!criterios) {
        return null;
      }
      const nota = decisao.nota === null ? '' : ` (nota ${decisao.nota})`;
      return `A IA descobriu: ${criterios}${nota}.`;
    }
    case 'QUALIFICADO':
      return `IA: ${fim(decisao.titulo)}${resumoDe(decisao)}`;
    case 'DESQUALIFICADO':
      return `IA: ${fim(decisao.titulo)}${decisao.motivo ? ` Motivo: ${encurtar(decisao.motivo, 160)}` : ''}`;
    case 'PASSOU_HUMANO':
      // O título padrão não leva o motivo (ele vai no campo próprio); os de bloqueio e falha já o dizem.
      return `IA: ${fim(decisao.titulo)}${decisao.motivo && decisao.titulo === 'Passou para a equipe' ? ` Motivo: ${encurtar(decisao.motivo, 160)}` : ''}${resumoDe(decisao)}`;
    case 'DEVOLVIDA':
      return fim(decisao.titulo);
    case 'BLOQUEIO':
    case 'FALHA':
      return `IA: ${fim(decisao.titulo)}`;
    default:
      // "Fulano assumiu a conversa" já aparece como aviso do sistema.
      return null;
  }
}

function fim(titulo: string): string {
  const limpo = titulo.trim();
  return /[.!?]$/.test(limpo) ? limpo : `${limpo}.`;
}

function resumoDe(decisao: DecisaoDoSdr): string {
  return decisao.resumo ? ` Resumo: ${encurtar(decisao.resumo, LIMITE_RESUMO)}` : '';
}

/** As decisões da IA como avisos discretos (`SISTEMA`) para misturar às mensagens por data. */
export function eventosDoSdr(decisoes: readonly DecisaoDoSdr[]): MensagemConversa[] {
  const eventos: MensagemConversa[] = [];
  for (const decisao of decisoes) {
    const texto = textoDoEvento(decisao);
    if (texto) {
      eventos.push({
        id: `sdr-${decisao.id}`,
        direcao: 'SISTEMA',
        tipo: 'TEXTO',
        texto,
        criadaEm: decisao.criadoEm,
      });
    }
  }
  return eventos;
}

/** Mensagens `SISTEMA` escritas pela IA repetem o que a decisão já conta: ficam só as decisões. */
export function repetidaPelaDecisao(dto: {
  readonly direcao: string;
  readonly autorTipo: string | null;
}): boolean {
  return dto.direcao === 'SISTEMA' && dto.autorTipo === 'IA';
}

/** A IA está atendendo esta conversa (selo). */
export function iaAtendendo(sdr: SdrDaConversa | null | undefined): boolean {
  return sdr?.situacao === 'ATIVA';
}
