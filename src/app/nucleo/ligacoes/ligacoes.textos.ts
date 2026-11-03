import { formatarData, formatarDataHora } from '../formatos';
import type { EstadoLigacao, Ligacao, PermissaoDeLigacao } from './ligacoes.tipos';

/** `m:ss` (ou `h:mm:ss`) de uma duração em segundos. */
export function formatarDuracao(segundos: number | null | undefined): string {
  const total = Math.max(0, Math.round(segundos ?? 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = String(total % 60).padStart(2, '0');
  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, '0')}:${resto}`
    : `${minutos}:${resto}`;
}

/** Duração falada, para leitor de tela: "2 minutos e 5 segundos". */
export function duracaoPorExtenso(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  const partes: string[] = [];
  if (minutos > 0) {
    partes.push(`${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`);
  }
  if (resto > 0 || partes.length === 0) {
    partes.push(`${resto} ${resto === 1 ? 'segundo' : 'segundos'}`);
  }
  return partes.join(' e ');
}

/** "(11) 99999-0001" a partir de dígitos, com ou sem o 55 do país. */
export function formatarTelefone(telefone: string | null | undefined): string {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  const nacional = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return telefone?.trim() || 'Número desconhecido';
}

export const ROTULO_ESTADO_LIGACAO: Readonly<Record<EstadoLigacao, string>> = {
  CHAMANDO: 'Chamando',
  TOCANDO: 'Tocando',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  PERDIDA: 'Perdida',
  RECUSADA: 'Recusada pelo cliente',
  SEM_RESPOSTA: 'Sem resposta',
  FALHOU: 'Falhou',
};

/** Frase curta para o resultado de uma ligação que terminou (barra e avisos). */
export function resumoDoFim(
  ligacao: Pick<Ligacao, 'estado' | 'motivoTexto' | 'duracaoSegundos'>,
): string {
  switch (ligacao.estado) {
    case 'ENCERRADA':
      return `Ligação encerrada. Duração: ${formatarDuracao(ligacao.duracaoSegundos)}.`;
    case 'RECUSADA':
      return 'O cliente recusou a ligação.';
    case 'SEM_RESPOSTA':
      return ligacao.motivoTexto ?? 'O cliente não atendeu.';
    case 'PERDIDA':
      return ligacao.motivoTexto ?? 'Ligação perdida.';
    case 'FALHOU':
      return ligacao.motivoTexto ?? 'A ligação falhou.';
    default:
      return ligacao.motivoTexto ?? ROTULO_ESTADO_LIGACAO[ligacao.estado];
  }
}

// ----- Permissão do cliente ----------------------------------------------------------------------

export type TomPermissao = 'ok' | 'aviso' | 'neutro' | 'erro';

export interface VisaoPermissao {
  readonly tom: TomPermissao;
  readonly titulo: string;
  readonly texto: string;
  readonly podeLigar: boolean;
  /** O CRM pode mandar o pedido agora (limites e janela conferidos). */
  readonly podePedir: boolean;
  /** Por que o pedido não pode sair agora (vazio quando pode). */
  readonly motivoSemPedido: string | null;
  /** Os limites da Meta, em linguagem simples, com o uso atual. */
  readonly limites: string;
}

/** Os limites da Meta para pedir permissão, com quantos pedidos ainda restam. */
export function explicarLimites(permissao: PermissaoDeLigacao): string {
  const { pedido } = permissao;
  const restam24 = Math.max(0, pedido.maximo24h - pedido.usoNas24h);
  const restam7 = Math.max(0, pedido.maximo7d - pedido.usoNos7d);
  const plural = (n: number) => (n === 1 ? 'pedido' : 'pedidos');
  return (
    `A Meta aceita ${pedido.maximo24h} ${plural(pedido.maximo24h)} de permissão por dia e ` +
    `${pedido.maximo7d} por semana para o mesmo cliente. Neste cliente restam ${restam24} ` +
    `${plural(restam24)} hoje e ${restam7} ${plural(restam7)} nesta semana.`
  );
}

function semPedido(permissao: PermissaoDeLigacao): string | null {
  const { pedido } = permissao;
  if (!pedido.pode) {
    const quando = pedido.liberaEm
      ? ` Novo pedido a partir de ${formatarDataHora(pedido.liberaEm)}.`
      : '';
    return pedido.motivo === 'limite_7d'
      ? `Já foram feitos ${pedido.maximo7d} pedidos nesta semana, o máximo da Meta.${quando}`
      : `Já foi feito um pedido nas últimas 24 horas, o máximo da Meta.${quando}`;
  }
  if (!permissao.janelaAberta && !permissao.temTemplateDePermissao) {
    return 'A conversa está fora da janela de 24 horas e o canal não tem um template de permissão aprovado. Espere o cliente escrever ou peça ao Admin para criar o template na Meta.';
  }
  return null;
}

/** Como a tela descreve a permissão de ligar de um cliente (estado, aviso e o que dá para fazer). */
export function visaoDaPermissao(permissao: PermissaoDeLigacao): VisaoPermissao {
  const motivoSemPedido = semPedido(permissao);
  const limites = explicarLimites(permissao);
  const base = {
    podeLigar: permissao.podeLigar,
    podePedir: !permissao.podeLigar && motivoSemPedido === null,
    motivoSemPedido: permissao.podeLigar ? null : motivoSemPedido,
    limites,
  };
  if (permissao.podeLigar) {
    const ate = permissao.validaAte ? formatarData(permissao.validaAte) : null;
    return {
      ...base,
      tom: 'ok',
      titulo: 'Permissão para ligar',
      texto:
        permissao.tipo === 'PERMANENTE'
          ? 'O cliente deixou a permissão sem prazo.'
          : ate
            ? `O cliente permitiu ligações até ${ate}.`
            : 'O cliente permitiu ligações.',
    };
  }
  switch (permissao.situacao) {
    case 'PEDIDA':
      return {
        ...base,
        tom: 'aviso',
        titulo: 'Aguardando o cliente',
        texto: permissao.ultimoPedidoEm
          ? `O pedido foi enviado em ${formatarDataHora(permissao.ultimoPedidoEm)}. A permissão só vale depois que o cliente tocar em "Permitir" no WhatsApp.`
          : 'O pedido foi enviado. A permissão só vale depois que o cliente tocar em "Permitir" no WhatsApp.',
      };
    case 'NEGADA':
      return {
        ...base,
        tom: 'erro',
        titulo: 'O cliente não permitiu',
        texto:
          'O cliente recusou o pedido. Você pode pedir de novo quando os limites da Meta deixarem.',
      };
    case 'REVOGADA':
      return {
        ...base,
        tom: 'erro',
        titulo: 'Permissão retirada',
        texto:
          'A Meta retirou a permissão (por exemplo, depois de 4 ligações seguidas sem resposta, ou porque o cliente a removeu). Peça de novo.',
      };
    case 'EXPIRADA':
      return {
        ...base,
        tom: 'aviso',
        titulo: 'Permissão vencida',
        texto: 'A permissão de 7 dias acabou. Peça uma nova para voltar a ligar.',
      };
    case 'CONCEDIDA':
      return {
        ...base,
        tom: 'aviso',
        titulo: 'Permissão indisponível agora',
        texto:
          'A permissão está registrada, mas a Meta não a confirmou agora. Atualize para conferir.',
      };
    default:
      return {
        ...base,
        tom: 'neutro',
        titulo: 'Sem permissão para ligar',
        texto:
          'O WhatsApp só deixa a empresa ligar depois que o cliente permite. Envie o pedido: ele aparece no WhatsApp do cliente com um botão para permitir.',
      };
  }
}
