import {
  LucideCamera,
  LucideGlobe,
  type LucideIconInput,
  LucideMail,
  LucideMessageCircle,
  LucideMessageCircleMore,
  LucideMessagesSquare,
} from '@lucide/angular';

import { formatarData, formatarHora, paraData } from '../../nucleo/formatos';
import { SLUG_AREA } from '../../nucleo/sessao/perfil';
import {
  type MensagemConversa,
  ROTULO_TIPO,
  trechosDoTexto,
  type TrechoMensagem,
} from '../../ui/mensagens/mensagens';
import type {
  ConversaResumo,
  EscopoConversas,
  FiltrosConversas,
  MensagemDaConversa,
  PrioridadeConversa,
  StatusConversa,
  TipoCanal,
} from './atendimento.tipos';

/**
 * Apresentação da caixa de entrada: rótulos, ícones, tempo de espera e SLA, prévia da última
 * mensagem, conversão do DTO de mensagem para o modelo dos componentes de conversa e o filtro
 * local usado pelo tempo real. Funções puras (testadas em `apresentacao.spec.ts`).
 */

// Canais ------------------------------------------------------------------------------------

export interface ApresentacaoCanal {
  readonly rotulo: string;
  readonly icone: LucideIconInput;
}

export const CANAL: Readonly<Record<TipoCanal, ApresentacaoCanal>> = {
  WHATSAPP: { rotulo: 'WhatsApp', icone: LucideMessageCircle },
  WHATSAPP_OFICIAL: { rotulo: 'WhatsApp oficial', icone: LucideMessageCircleMore },
  WEBCHAT: { rotulo: 'Chat do site', icone: LucideGlobe },
  EMAIL: { rotulo: 'E-mail', icone: LucideMail },
  INSTAGRAM: { rotulo: 'Instagram', icone: LucideCamera },
  MESSENGER: { rotulo: 'Messenger', icone: LucideMessagesSquare },
};

/** Canais da Meta: resposta comum só até 24 h depois da última mensagem do contato. */
export function temJanela24h(tipo: TipoCanal): boolean {
  return tipo === 'INSTAGRAM' || tipo === 'MESSENGER' || tipo === 'WHATSAPP_OFICIAL';
}

// Status e prioridade -------------------------------------------------------------------------

export const ROTULO_STATUS_CONVERSA: Readonly<Record<StatusConversa, string>> = {
  ABERTA: 'Aberta',
  PENDENTE: 'Aguardando o contato',
  RESOLVIDA: 'Resolvida',
};

export const ROTULO_PRIORIDADE: Readonly<Record<PrioridadeConversa, string>> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const ROTULO_ESCOPO: Readonly<Record<EscopoConversas, string>> = {
  MINHAS: 'Minhas',
  SEM_RESPONSAVEL: 'Sem responsável',
  TODAS: 'Todas',
};

// Tempos ---------------------------------------------------------------------------------------

function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/**
 * Hora curta da lista: "14:32" hoje, "ontem", o dia da semana abreviado nos últimos 7 dias
 * ("seg") e "20/10" antes disso (com o ano se for de outro ano).
 */
export function horaCurta(valor: string | null | undefined, agora: Date = new Date()): string {
  const data = paraData(valor ?? null);
  if (!data) {
    return '';
  }
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(data)) / 86_400_000);
  if (dias <= 0) {
    return formatarHora(data);
  }
  if (dias === 1) {
    return 'ontem';
  }
  if (dias < 7) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(data).replace('.', '');
  }
  return data.getFullYear() === agora.getFullYear()
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data)
    : formatarData(data);
}

/** Duração curta: "agora", "4 min", "2 h", "3 d" (o selo de espera da lista). */
export function duracaoCurta(milissegundos: number): string {
  const minutos = Math.floor(Math.max(0, milissegundos) / 60_000);
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return `${horas} h`;
  }
  return `${Math.floor(horas / 24)} d`;
}

/** Duração por extenso para o leitor de tela e as dicas: "4 minutos", "2 horas", "3 dias". */
export function duracaoPorExtenso(milissegundos: number): string {
  const minutos = Math.floor(Math.max(0, milissegundos) / 60_000);
  if (minutos < 1) {
    return 'menos de 1 minuto';
  }
  if (minutos < 60) {
    return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return horas === 1 ? '1 hora' : `${horas} horas`;
  }
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export interface Espera {
  /** "12 min". */
  readonly curta: string;
  /** "Esperando resposta há 12 minutos". */
  readonly frase: string;
  /** Passou do SLA (primeira resposta ou resolução): o selo fica coral. */
  readonly estourada: boolean;
}

/**
 * SLA estourado agora. A API calcula na hora da resposta; o relógio da tela continua andando, então
 * o prazo de resolução é conferido aqui também — e o da primeira resposta só quando se sabe que
 * ela ainda não saiu (o detalhe traz `primeiraRespostaEm`; a lista é conferida na API de tempos em
 * tempos).
 */
export function slaEstourado(
  conversa: ConversaResumo & { readonly primeiraRespostaEm?: string | null },
  agora: Date = new Date(),
): boolean {
  if (conversa.status === 'RESOLVIDA') {
    return false;
  }
  if (conversa.sla.primeiraRespostaEstourada || conversa.sla.resolucaoEstourada) {
    return true;
  }
  const passou = (iso: string | null) => {
    const data = paraData(iso);
    return !!data && data.getTime() < agora.getTime();
  };
  return (
    passou(conversa.sla.resolucaoAte) ||
    (conversa.primeiraRespostaEm === null && passou(conversa.sla.primeiraRespostaAte))
  );
}

/** Quanto o contato espera resposta (`null` quando ninguém espera ou a conversa foi resolvida). */
export function esperaDaConversa(
  conversa: ConversaResumo,
  agora: Date = new Date(),
): Espera | null {
  const desde = paraData(conversa.aguardandoDesde);
  if (!desde || conversa.status === 'RESOLVIDA') {
    return null;
  }
  const passou = agora.getTime() - desde.getTime();
  const estourada = slaEstourado(conversa, agora);
  return {
    curta: duracaoCurta(passou),
    frase: `Esperando resposta há ${duracaoPorExtenso(passou)}${estourada ? ', acima do prazo da fila' : ''}`,
    estourada,
  };
}

export interface Janela24h {
  readonly aberta: boolean;
  /** Até quando cabe resposta comum. */
  readonly ate: Date | null;
  /** "até 14:20 de amanhã" / "fechou ontem às 9:10". */
  readonly frase: string;
}

/** Janela de 24 h da Meta (Instagram, Messenger e WhatsApp oficial; `null` nos outros canais). */
export function janela24h(conversa: ConversaResumo, agora: Date = new Date()): Janela24h | null {
  if (!temJanela24h(conversa.canal.tipo)) {
    return null;
  }
  const ate = paraData(conversa.janelaAte);
  if (!ate) {
    return { aberta: false, ate: null, frase: 'o contato ainda não escreveu' };
  }
  const aberta = ate.getTime() > agora.getTime();
  const dia = Math.round((inicioDoDia(ate) - inicioDoDia(agora)) / 86_400_000);
  const quando =
    dia === 0
      ? `hoje às ${formatarHora(ate)}`
      : dia === 1
        ? `amanhã às ${formatarHora(ate)}`
        : dia === -1
          ? `ontem às ${formatarHora(ate)}`
          : `${formatarData(ate)} às ${formatarHora(ate)}`;
  return { aberta, ate, frase: aberta ? `aberta até ${quando}` : `fechou ${quando}` };
}

// Prévia e contato -----------------------------------------------------------------------------

/** A última mensagem na lista: "Você: …", "Ana: …", "Nota: …" ou só o texto do contato. */
export function previaDaConversa(
  conversa: Pick<ConversaResumo, 'ultimaMensagem'>,
  usuarioNome: string | null = null,
): string {
  const ultima = conversa.ultimaMensagem;
  if (!ultima) {
    return 'Sem mensagens';
  }
  const apagada = ultima.previa === null && ultima.tipo === 'TEXTO';
  const corpo = ultima.previa?.trim() || (apagada ? 'Mensagem apagada' : ROTULO_TIPO[ultima.tipo]);
  const tipo =
    ultima.tipo !== 'TEXTO' && ultima.tipo !== 'REACAO' && ultima.previa?.trim()
      ? `${ROTULO_TIPO[ultima.tipo]} · `
      : '';
  switch (ultima.direcao) {
    case 'INTERNA':
      return `Nota: ${tipo}${corpo}`;
    case 'SAIDA': {
      const autor = ultima.autorNome;
      const quem = !autor
        ? 'Automática'
        : usuarioNome && autor === usuarioNome
          ? 'Você'
          : primeiroNome(autor);
      return `${quem}: ${tipo}${corpo}`;
    }
    default:
      return `${tipo}${corpo}`;
  }
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

/** `5511987654321` → `+55 (11) 98765-4321` (outros formatos voltam como vieram, com "+"). */
export function formatarTelefone(telefone: string | null | undefined): string {
  if (!telefone) {
    return '';
  }
  const digitos = telefone.replace(/\D/g, '');
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  if (br) {
    return `+55 (${br[1]}) ${br[2]}-${br[3]}`;
  }
  return digitos ? `+${digitos}` : telefone;
}

/** Como chamar o contato na tela: o nome, ou o telefone/e-mail quando o nome é genérico. */
export function nomeDoContato(contato: ConversaResumo['contato']): string {
  return contato.nome?.trim() || formatarTelefone(contato.telefone) || contato.email || 'Contato';
}

/** Rota do negócio no quadro (`/funis/<área>/<id>`). */
export function rotaDoNegocio(negocio: {
  readonly id: string;
  readonly funil: { readonly area: keyof typeof SLUG_AREA };
}): readonly string[] {
  return ['/funis', SLUG_AREA[negocio.funil.area], negocio.id];
}

// Mensagens ------------------------------------------------------------------------------------

export interface ContextoMensagens {
  /** Nome do contato (autor das mensagens de entrada). */
  readonly contato: string;
}

/** Texto e trechos de tipos especiais (localização, contato, reação). */
function textoEspecial(
  dto: MensagemDaConversa,
): { texto: string; trechos?: readonly TrechoMensagem[] } | null {
  const meta = dto.metadados ?? {};
  if (dto.tipo === 'LOCALIZACAO') {
    const latitude = Number(meta['latitude']);
    const longitude = Number(meta['longitude']);
    const nome = typeof meta['nome'] === 'string' ? meta['nome'] : null;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const rotulo = nome ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      return {
        texto: `Localização: ${rotulo}`,
        trechos: [
          { texto: 'Localização: ' },
          {
            texto: rotulo,
            link: `https://www.google.com/maps?q=${latitude},${longitude}`,
            externo: true,
            tipo: 'link',
          },
        ],
      };
    }
  }
  if (dto.tipo === 'REACAO' && typeof meta['emoji'] === 'string') {
    return { texto: `Reagiu com ${meta['emoji']}` };
  }
  if (dto.tipo === 'CONTATO' && !dto.texto) {
    const vcard = typeof meta['vcard'] === 'string' ? meta['vcard'] : '';
    const nome = /^FN[^:]*:(.+)$/m.exec(vcard)?.[1]?.trim();
    return { texto: nome ? `Contato compartilhado: ${nome}` : 'Contato compartilhado' };
  }
  return null;
}

/** DTO da API → modelo dos componentes de conversa (DESIGN-SYSTEM §4.6). */
export function paraMensagemConversa(
  dto: MensagemDaConversa,
  contexto: ContextoMensagens,
): MensagemConversa {
  const especial = textoEspecial(dto);
  const autor =
    dto.direcao === 'ENTRADA'
      ? { nome: contexto.contato }
      : dto.autor
        ? { id: dto.autor.id, nome: dto.autor.nome, foto: dto.autor.avatarUrl ?? null }
        : dto.direcao === 'SAIDA'
          ? { nome: dto.autorTipo === 'IA' ? 'IA' : 'Resposta automática' }
          : null;
  const citada = dto.respostaA;
  return {
    id: dto.id,
    direcao: dto.direcao,
    tipo: dto.tipo,
    texto: especial?.texto ?? dto.texto,
    etiqueta: dto.metadados?.['template'] ? 'template' : dto.autorTipo === 'IA' ? 'IA' : null,
    trechos: especial?.trechos ?? (dto.texto ? trechosDoTexto(dto.texto) : null),
    anexo: dto.arquivo
      ? {
          nome: dto.arquivo.nome,
          mime: dto.arquivo.mime,
          url: dto.arquivo.url,
          tamanho: dto.arquivo.tamanho,
          duracao: dto.arquivo.duracaoSegundos,
          largura: dto.arquivo.largura,
          altura: dto.arquivo.altura,
        }
      : null,
    status: dto.direcao === 'SAIDA' ? dto.status : null,
    erro: dto.erro,
    criadaEm: dto.ocorridaEm,
    autor,
    respondeA: citada
      ? {
          autor: citada.autorNome ?? (citada.direcao === 'ENTRADA' ? contexto.contato : null),
          texto: citada.texto,
          tipo: citada.tipo,
        }
      : null,
    editada: !!dto.editadaEm,
    excluida: dto.excluida,
  };
}

/**
 * Junta mensagens novas às atuais pelo id (a nova versão vence), em ordem cronológica — para o
 * tempo real, as páginas anteriores e as respostas do envio não repetirem nem embaralharem.
 */
export function juntarMensagens(
  atuais: readonly MensagemDaConversa[],
  novas: readonly MensagemDaConversa[],
): MensagemDaConversa[] {
  const porId = new Map(atuais.map((mensagem) => [mensagem.id, mensagem]));
  for (const nova of novas) {
    porId.set(nova.id, nova);
  }
  return [...porId.values()].sort(
    (a, b) => Date.parse(a.ocorridaEm) - Date.parse(b.ocorridaEm) || a.id.localeCompare(b.id),
  );
}

// Lista e tempo real ---------------------------------------------------------------------------

/** Da mais recente para a mais antiga (a ordem da API). */
export function ordenarConversas(conversas: readonly ConversaResumo[]): ConversaResumo[] {
  const momento = (c: ConversaResumo) => Date.parse(c.ultimaMensagemEm ?? c.criadoEm) || 0;
  return [...conversas].sort((a, b) => momento(b) - momento(a) || a.id.localeCompare(b.id));
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * A conversa entra na lista com estes filtros? Usado quando o tempo real manda uma conversa
 * nova ou alterada: a lista se ajusta na hora, e a recarga em segundo plano confirma depois
 * (contadores, paginação e a visibilidade, que só a API sabe).
 */
export function cabeNoFiltro(
  conversa: ConversaResumo,
  filtros: FiltrosConversas,
  usuarioId: string | null,
): boolean {
  const status = filtros.status?.length ? filtros.status : ['ABERTA', 'PENDENTE'];
  if (!status.includes(conversa.status)) {
    return false;
  }
  if (filtros.escopo === 'MINHAS' && conversa.responsavel?.id !== usuarioId) {
    return false;
  }
  if (filtros.escopo === 'SEM_RESPONSAVEL' && conversa.responsavel) {
    return false;
  }
  if (filtros.tipoCanal?.length && !filtros.tipoCanal.includes(conversa.canal.tipo)) {
    return false;
  }
  if (filtros.canalId && conversa.canal.id !== filtros.canalId) {
    return false;
  }
  if (filtros.filaId && conversa.fila?.id !== filtros.filaId) {
    return false;
  }
  if (filtros.etiqueta?.length) {
    const etiquetas = conversa.etiquetas.map((etiqueta) => etiqueta.toLowerCase());
    if (!filtros.etiqueta.some((etiqueta) => etiquetas.includes(etiqueta.toLowerCase()))) {
      return false;
    }
  }
  if (filtros.naoLidas && conversa.naoLidas === 0) {
    return false;
  }
  if (filtros.slaEstourado && !slaEstourado(conversa)) {
    return false;
  }
  const busca = filtros.busca?.trim();
  if (busca) {
    const termo = normalizar(busca);
    const campos = [
      conversa.contato.nome,
      conversa.contato.email ?? '',
      conversa.contato.telefone ?? '',
      conversa.assunto ?? '',
    ];
    if (!campos.some((campo) => normalizar(campo).includes(termo))) {
      return false;
    }
  }
  return true;
}

// Respostas rápidas ----------------------------------------------------------------------------

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora (como a API faz na variável `saudacao`). */
export function saudacao(agora: Date = new Date()): string {
  const hora = agora.getHours();
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** As variáveis das respostas rápidas (as mesmas da API, `variaveis.ts`) para uma conversa. */
export function variaveisDaConversa(
  conversa: Pick<ConversaResumo, 'contato' | 'canal'>,
  usuario: { readonly nome: string } | null,
  empresa: string | null = null,
  agora: Date = new Date(),
): Readonly<Record<string, string | null>> {
  return {
    'contato.nome': conversa.contato.nome,
    'contato.primeiroNome': primeiroNome(conversa.contato.nome),
    'contato.email': conversa.contato.email,
    'contato.telefone': formatarTelefone(conversa.contato.telefone) || null,
    'contato.empresa': empresa,
    'usuario.nome': usuario?.nome ?? null,
    'usuario.primeiroNome': usuario ? primeiroNome(usuario.nome) : null,
    'canal.nome': conversa.canal.nome,
    saudacao: saudacao(agora),
    'data.hoje': formatarData(agora),
  };
}
