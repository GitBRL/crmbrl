import type {
  ConversaDetalhe,
  ConversaResumo,
  MensagemDaConversa,
  PaginaConversas,
  PaginaMensagens,
} from './atendimento.tipos';

/**
 * **Só para testes (specs).** Conversas, mensagens e páginas da API do Atendimento com valores
 * padrão plausíveis; cada teste muda só o que importa.
 */

/** O COMERCIAL de `perfilDeTeste` (nucleo/sessao/sessao-de-teste.ts). */
export const EU = { id: '00000000-0000-4000-8000-000000000004', nome: 'João Batista' };
export const ANA = { id: 'u-ana', nome: 'Ana Souza', avatarUrl: null };

export const CANAL_WHATSAPP = {
  id: 'canal-wa',
  tipo: 'WHATSAPP',
  nome: 'WhatsApp Vendas',
  ativo: true,
} as const;
export const CANAL_INSTAGRAM = {
  id: 'canal-ig',
  tipo: 'INSTAGRAM',
  nome: 'Instagram @brl',
  ativo: true,
} as const;
export const CANAL_OFICIAL = {
  id: 'canal-of',
  tipo: 'WHATSAPP_OFICIAL',
  nome: 'WhatsApp Oficial (demo)',
  ativo: true,
} as const;
export const FILA_VENDAS = { id: 'fila-vendas', nome: 'Vendas', area: 'COMERCIAL' } as const;

/** `minutos` atrás (negativo = no futuro), em ISO. */
export function ha(minutos: number, agora: Date = new Date()): string {
  return new Date(agora.getTime() - minutos * 60_000).toISOString();
}

export function conversaResumo(ajustes: Partial<ConversaResumo> = {}): ConversaResumo {
  return {
    id: 'c1',
    canal: CANAL_WHATSAPP,
    contato: { id: 'ct1', nome: 'Marina Lopes', email: null, telefone: '5511987654321' },
    fila: FILA_VENDAS,
    responsavel: { id: EU.id, nome: EU.nome, avatarUrl: null },
    status: 'ABERTA',
    prioridade: 'NORMAL',
    assunto: null,
    etiquetas: [],
    naoLidas: 0,
    ultimaMensagem: {
      id: 'm1',
      direcao: 'ENTRADA',
      tipo: 'TEXTO',
      previa: 'Oi! Queria saber dos planos.',
      autorNome: null,
      ocorridaEm: ha(5),
    },
    ultimaMensagemEm: ha(5),
    ultimaEntradaEm: ha(5),
    aguardandoDesde: null,
    atribuidaEm: ha(5),
    sla: {
      primeiraRespostaAte: null,
      resolucaoAte: null,
      primeiraRespostaEstourada: false,
      resolucaoEstourada: false,
    },
    janelaAte: null,
    negocioId: null,
    criadoEm: ha(6),
    resolvidaEm: null,
    ...ajustes,
  };
}

export function conversaDetalhe(ajustes: Partial<ConversaDetalhe> = {}): ConversaDetalhe {
  return {
    ...conversaResumo(),
    primeiraRespostaEm: null,
    resolvidaPor: null,
    reaberturas: 0,
    satisfacao: {
      solicitadaEm: null,
      nota: null,
      comentario: null,
      respondidaEm: null,
      aguardando: false,
    },
    negocio: null,
    podeResponder: { pode: true, motivo: null },
    acoes: {
      assumir: false,
      transferir: true,
      resolver: true,
      reabrir: false,
      responder: true,
      criarNegocio: true,
    },
    ...ajustes,
  };
}

export function mensagemDto(ajustes: Partial<MensagemDaConversa> = {}): MensagemDaConversa {
  return {
    id: 'm1',
    conversaId: 'c1',
    direcao: 'ENTRADA',
    tipo: 'TEXTO',
    texto: 'Oi! Queria saber dos planos.',
    arquivo: null,
    autor: null,
    autorTipo: null,
    automatica: false,
    status: null,
    erro: null,
    tentativas: 0,
    respostaA: null,
    metadados: null,
    ocorridaEm: ha(5),
    enviadaEm: null,
    entregueEm: null,
    lidaEm: null,
    editadaEm: null,
    excluida: false,
    ...ajustes,
  };
}

export function paginaConversas(
  itens: readonly ConversaResumo[],
  ajustes: Partial<PaginaConversas> = {},
): PaginaConversas {
  return {
    itens,
    total: itens.length,
    pagina: 1,
    porPagina: 30,
    contadores: { minhas: 1, semResponsavel: 0, todas: itens.length, naoLidas: 0 },
    ...ajustes,
  };
}

export function paginaMensagens(
  itens: readonly MensagemDaConversa[],
  proximoCursor: string | null = null,
): PaginaMensagens {
  return { itens, proximoCursor };
}

/** Deixa as promessas e os temporizadores de 0 ms rodarem (efeitos, respostas, renderização). */
export async function assentar(vezes = 3): Promise<void> {
  for (let i = 0; i < vezes; i++) {
    await new Promise((resolver) => setTimeout(resolver, 0));
  }
}

export const texto = (elemento: Element | null | undefined): string =>
  elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
