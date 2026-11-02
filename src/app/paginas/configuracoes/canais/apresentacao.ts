import { formatarData, formatarDataHora, formatarTempoRelativo } from '../../../nucleo/formatos';
import type { VarianteSelo } from '../../../ui/selo/selo';
import { formatarTelefone } from '../textos';
import type {
  CanalBase,
  NumeroWhatsapp,
  StatusWhatsapp,
  TipoCanal,
  TipoCanalMeta,
} from './canais.modelos';

/**
 * Textos e estados visuais dos canais (sem ícones: estes ficam em `icones.ts`, que importa o
 * Lucide). Funções puras, testadas em `apresentacao.spec.ts`.
 */

export interface TipoDeCanalVisual {
  /** "WhatsApp". */
  readonly rotulo: string;
  /** Uma frase do que o canal faz, para quem nunca configurou. */
  readonly descricao: string;
  /** Pedaço da URL da tela do canal: `/configuracoes/canais/<caminho>/…`. */
  readonly caminho: string;
  /** "Novo número", "Novo chat do site"… */
  readonly textoNovo: string;
  /** "número"/"números" no complemento do cartão. */
  readonly singular: string;
  readonly plural: string;
}

export const TIPO_DE_CANAL: Readonly<Record<TipoCanal, TipoDeCanalVisual>> = {
  WHATSAPP: {
    rotulo: 'WhatsApp',
    descricao:
      'Conecte um número lendo um QR com o celular. As mensagens chegam ao Atendimento e as respostas saem pelo próprio número.',
    caminho: 'whatsapp',
    textoNovo: 'Novo número',
    singular: 'número',
    plural: 'números',
  },
  WEBCHAT: {
    rotulo: 'Chat do site',
    descricao:
      'Um botão de conversa no seu site. Você escolhe as cores e cola um trecho de código nas páginas.',
    caminho: 'site',
    textoNovo: 'Novo chat do site',
    singular: 'chat',
    plural: 'chats',
  },
  EMAIL: {
    rotulo: 'E-mail',
    descricao:
      'Uma caixa de e-mail (como atendimento@suaempresa.com.br). Os e-mails viram conversas e as respostas saem da mesma caixa.',
    caminho: 'email',
    textoNovo: 'Nova caixa de e-mail',
    singular: 'caixa',
    plural: 'caixas',
  },
  INSTAGRAM: {
    rotulo: 'Instagram',
    descricao:
      'As mensagens diretas (Direct) de uma conta profissional do Instagram, por um app da Meta.',
    caminho: 'instagram',
    textoNovo: 'Nova conta do Instagram',
    singular: 'conta',
    plural: 'contas',
  },
  MESSENGER: {
    rotulo: 'Messenger',
    descricao: 'As mensagens da página da empresa no Facebook, por um app da Meta.',
    caminho: 'messenger',
    textoNovo: 'Nova página do Messenger',
    singular: 'página',
    plural: 'páginas',
  },
};

/** "2 números", "1 caixa", "nenhum ainda". */
export function contagemDoTipo(tipo: TipoCanal, quantidade: number): string {
  if (quantidade === 0) {
    return tipo === 'EMAIL' || tipo === 'MESSENGER' || tipo === 'INSTAGRAM'
      ? 'nenhuma ainda'
      : 'nenhum ainda';
  }
  const visual = TIPO_DE_CANAL[tipo];
  return `${quantidade} ${quantidade === 1 ? visual.singular : visual.plural}`;
}

/** A rota da tela de um canal já criado. */
export function linkDoCanal(tipo: TipoCanal, id: string): string[] {
  const caminho =
    tipo === 'INSTAGRAM' || tipo === 'MESSENGER' ? 'meta' : TIPO_DE_CANAL[tipo].caminho;
  return ['/configuracoes', 'canais', caminho, id];
}

/** A rota para criar um canal do tipo (o WhatsApp é criado num modal da lista). */
export function linkDoNovo(tipo: Exclude<TipoCanal, 'WHATSAPP'>): string[] {
  return ['/configuracoes', 'canais', TIPO_DE_CANAL[tipo].caminho, 'novo'];
}

export function ehTipoMeta(tipo: TipoCanal): tipo is TipoCanalMeta {
  return tipo === 'INSTAGRAM' || tipo === 'MESSENGER';
}

// Situação --------------------------------------------------------------------------------------

export interface SituacaoVisual {
  readonly rotulo: string;
  readonly variante: VarianteSelo;
  /** Ponto no selo (estado "ao vivo"). */
  readonly ponto: boolean;
}

export const SITUACAO_WHATSAPP: Readonly<Record<StatusWhatsapp, SituacaoVisual>> = {
  CONECTADO: { rotulo: 'Conectado', variante: 'menta', ponto: true },
  AGUARDANDO_QR: { rotulo: 'Esperando o QR', variante: 'lima', ponto: true },
  CONECTANDO: { rotulo: 'Conectando…', variante: 'ciano', ponto: true },
  DESCONECTADO: { rotulo: 'Desconectado', variante: 'neutro', ponto: false },
  ERRO: { rotulo: 'Com erro', variante: 'coral', ponto: false },
  BANIDO: { rotulo: 'Bloqueado pelo WhatsApp', variante: 'coral', ponto: false },
};

/** O que cada status quer dizer, numa frase (dica e leitor de tela). */
export const EXPLICACAO_STATUS_WHATSAPP: Readonly<Record<StatusWhatsapp, string>> = {
  CONECTADO: 'O número está ligado ao CRM: recebe e envia mensagens.',
  AGUARDANDO_QR: 'Falta ler o QR com o celular do número.',
  CONECTANDO: 'O CRM está ligando o número ao WhatsApp. Leva alguns segundos.',
  DESCONECTADO: 'O número não está ligado ao CRM: nada chega nem sai por ele.',
  ERRO: 'A conexão falhou. Tente conectar de novo.',
  BANIDO:
    'O WhatsApp bloqueou este número. Fale com o suporte do WhatsApp antes de tentar de novo.',
};

/** Situação de um canal extra: desligado, com erro (último erro técnico) ou ativo. */
export function situacaoDoCanal(canal: Pick<CanalBase, 'ativo' | 'ultimoErro'>): SituacaoVisual {
  if (!canal.ativo) {
    return { rotulo: 'Desligado', variante: 'neutro', ponto: false };
  }
  if (canal.ultimoErro) {
    return { rotulo: 'Com erro', variante: 'coral', ponto: false };
  }
  return { rotulo: 'Ativo', variante: 'menta', ponto: true };
}

// Textos do número --------------------------------------------------------------------------------

/** "+55 (11) 98888-7777", ou o convite para conectar quando ainda não leu o QR. */
export function telefoneDoNumero(numero: Pick<NumeroWhatsapp, 'telefone'>): string {
  return numero.telefone ? formatarTelefone(numero.telefone) : 'Telefone aparece depois do QR';
}

/** "42 de 500 envios hoje". */
export function enviosDeHoje(numero: Pick<NumeroWhatsapp, 'hoje'>): string {
  const { enviados, limite } = numero.hoje;
  return `${formatarInteiro(enviados)} de ${formatarInteiro(limite)} ${limite === 1 ? 'envio' : 'envios'} hoje`;
}

/**
 * O aquecimento em uma frase: "Aquecendo: dia 3 de 14", "Aquecimento concluído", "Começa na
 * primeira conexão" ou "Sem aquecimento".
 */
export function resumoDoAquecimento(numero: Pick<NumeroWhatsapp, 'aquecimento'>): string {
  const { ativo, dia, dias, inicioEm } = numero.aquecimento;
  if (dias <= 0) {
    return 'Sem aquecimento';
  }
  if (!inicioEm) {
    return `Aquecimento de ${dias} ${dias === 1 ? 'dia' : 'dias'} começa na primeira conexão`;
  }
  if (ativo && dia !== null) {
    return `Aquecendo: dia ${dia} de ${dias}`;
  }
  return 'Aquecimento concluído';
}

/** Explicação do aquecimento para a dica (com a data em que termina, quando ativo). */
export function explicacaoDoAquecimento(
  numero: Pick<NumeroWhatsapp, 'aquecimento' | 'limiteDiario'>,
): string {
  const base =
    'Número novo que manda muitas mensagens de uma vez chama a atenção do WhatsApp e pode ser bloqueado. No aquecimento, o limite de envios do dia começa baixo e cresce aos poucos até o limite cheio.';
  const { ativo, terminaEm } = numero.aquecimento;
  if (ativo && terminaEm) {
    return `${base} O limite cheio (${formatarInteiro(numero.limiteDiario)} por dia) vale a partir de ${formatarData(terminaEm)}.`;
  }
  return `${base} Respostas a conversas que o contato abriu não contam.`;
}

/** "Pausado à mão em 23/10/2026 às 14:05 · Troca de chip" ou "Pausado sozinho …". */
export function resumoDaPausa(numero: Pick<NumeroWhatsapp, 'pausa'>): string | null {
  const pausa = numero.pausa;
  if (!pausa) {
    return null;
  }
  const quem = pausa.automatica ? 'Pausado pelo CRM' : 'Pausado';
  const motivo = pausa.motivo ? ` · ${pausa.motivo}` : '';
  return `${quem} em ${formatarDataHora(pausa.pausadoEm)}${motivo}`;
}

/** "Conectado há 2 h", "Desconectado ontem"… para a linha de detalhe. */
export function desdeQuando(
  numero: Pick<NumeroWhatsapp, 'status' | 'conectadoEm' | 'desconectadoEm'>,
  agora: Date = new Date(),
): string | null {
  if (numero.status === 'CONECTADO' && numero.conectadoEm) {
    return `Conectado ${formatarTempoRelativo(numero.conectadoEm, agora)}`;
  }
  if (numero.status === 'DESCONECTADO' && numero.desconectadoEm) {
    return `Desconectado ${formatarTempoRelativo(numero.desconectadoEm, agora)}`;
  }
  return null;
}

/** "2 a 6 segundos entre um envio e outro". */
export function resumoDoRitmo(
  numero: Pick<NumeroWhatsapp, 'intervaloMinimoSegundos' | 'intervaloMaximoSegundos'>,
): string {
  const { intervaloMinimoSegundos: minimo, intervaloMaximoSegundos: maximo } = numero;
  if (maximo <= 0) {
    return 'Sem espera entre um envio e outro';
  }
  if (minimo === maximo) {
    return `${minimo} ${minimo === 1 ? 'segundo' : 'segundos'} entre um envio e outro`;
  }
  return `${minimo} a ${maximo} segundos entre um envio e outro`;
}

/**
 * Segundos que faltam até `ate` (nunca negativo; `null` sem data). Serve para a contagem do QR.
 */
export function segundosAte(
  ate: string | null | undefined,
  agora: number = Date.now(),
): number | null {
  if (!ate) {
    return null;
  }
  const alvo = new Date(ate).getTime();
  if (Number.isNaN(alvo)) {
    return null;
  }
  return Math.max(0, Math.ceil((alvo - agora) / 1000));
}

const INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** 1000 → "1.000". */
export function formatarInteiro(valor: number): string {
  return INTEIRO.format(valor);
}

// Canais extras --------------------------------------------------------------------------------------

/** A linha de detalhe de um canal extra na lista: domínio, endereço, página. */
export function detalheDoCanal(
  canal: CanalBase & { dominios?: readonly string[]; endereco?: string; pageId?: string },
): string {
  if (canal.tipo === 'WEBCHAT') {
    const dominios = canal.dominios ?? [];
    if (dominios.length === 0) {
      return 'Nenhum site autorizado ainda';
    }
    const primeiro = dominios[0].replace(/^https?:\/\//, '');
    return dominios.length === 1 ? primeiro : `${primeiro} e mais ${dominios.length - 1}`;
  }
  if (canal.tipo === 'EMAIL') {
    return canal.endereco ?? canal.idExterno ?? '';
  }
  return canal.pageId ? `Página ${canal.pageId}` : (canal.idExterno ?? '');
}

/** "Fila: Comercial — WhatsApp" ou "Sem fila: ficam com o Admin e o C-level". */
export function textoDaFila(canal: {
  readonly filaPadrao: { readonly nome: string } | null;
}): string {
  return canal.filaPadrao
    ? `Fila: ${canal.filaPadrao.nome}`
    : 'Sem fila: as conversas ficam sem responsável';
}
