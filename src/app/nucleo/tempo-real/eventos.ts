import type { Notificacao } from '../notificacoes.service';

/**
 * Eventos do tempo real (contrato da Onda A, §2.2): o que o servidor emite no namespace
 * `/tempo-real` e o que o cliente envia. Nomes e formatos são os do catálogo da API
 * (`crmbrl-api/src/tempo-real/catalogo.ts`, "mudou aqui, mudou lá"). As entidades do domínio
 * (conversa, mensagem, canal do chat) vêm como o DTO do módulo dono: o `id` é certo e o resto a
 * tela converte para o seu modelo.
 *
 * | Evento                | Dados                                                                |
 * | --------------------- | -------------------------------------------------------------------- |
 * | `notificacao.nova`    | `{ notificacao }` (como em `GET /notificacoes`)                      |
 * | `nao-lidas`           | `{ notificacoes?, atendimento?, chat? }` — campo ausente: não mudou  |
 * | `conversa.nova`       | `{ conversa }` (o resumo da lista do Atendimento)                    |
 * | `conversa.atualizada` | `{ conversa }`                                                       |
 * | `mensagem.nova`       | `{ conversaId, mensagem }`                                           |
 * | `mensagem.status`     | `{ conversaId, mensagemId, status, erro?, em }`                      |
 * | `digitando`           | `{ conversaId? \| canalId?, ativo, usuario?, contato? }`             |
 * | `chat.mensagem`       | `{ canalId, mensagem }` (nova, editada ou excluída)                  |
 * | `chat.atualizado`     | `{ canalId, canal?, removido? }`                                     |
 * | `whatsapp.conexao`    | `{ numeroId, canalId, status, qr?, qrExpiraEm?, telefone?, motivo? }` |
 * | `sessao.encerrada`    | `{ motivo }` — a conexão cai logo em seguida                         |
 *
 * Cliente → servidor (com confirmação `{ ok }` ou `{ ok: false, erro, mensagem }`):
 * `conversa.entrar`/`sair` `{ conversaId }`, `chat.entrar`/`sair` `{ canalId }` e `digitando`
 * `{ conversaId | canalId, ativo }` (só depois de entrar na sala).
 */

/** Status de entrega de uma mensagem (enum `StatusMensagem` da API). */
export type StatusMensagem = 'PENDENTE' | 'ENVIADA' | 'ENTREGUE' | 'LIDA' | 'FALHOU';

/** Status de um número de WhatsApp (modelo `WhatsappNumero`, §2.3). */
export type StatusWhatsapp =
  'DESCONECTADO' | 'AGUARDANDO_QR' | 'CONECTANDO' | 'CONECTADO' | 'ERRO' | 'BANIDO';

/** Contagens do menu: conversas do Atendimento e mensagens do Chat da equipe não lidas. */
export interface NaoLidas {
  readonly atendimento: number;
  readonly chat: number;
}

export const SEM_NAO_LIDAS: NaoLidas = { atendimento: 0, chat: 0 };

/** Entidade enviada inteira pela API: o `id` é certo; o resto, como o DTO do módulo dono. */
export interface EntidadeTempoReal {
  readonly id: string;
  readonly [campo: string]: unknown;
}

export interface EventoNotificacaoNova {
  readonly notificacao: Notificacao;
  /** Total de não lidas depois desta (quando a API mandar junto). */
  readonly naoLidas?: number;
}

/** `nao-lidas`: só os campos que mudaram (ausente = continua como estava). */
export interface EventoNaoLidas {
  /** Notificações não lidas (o sino). */
  readonly notificacoes?: number;
  /** Conversas com mensagens não lidas que a pessoa atende. */
  readonly atendimento?: number;
  /** Mensagens não lidas no Chat da equipe (fora dos canais silenciados). */
  readonly chat?: number;
}

export interface EventoConversa {
  readonly conversa: EntidadeTempoReal;
}

export interface EventoMensagemNova {
  readonly conversaId: string;
  readonly mensagem: EntidadeTempoReal;
}

export interface EventoStatusMensagem {
  readonly conversaId: string;
  readonly mensagemId: string;
  readonly status: StatusMensagem;
  /** Motivo da falha, em português (só com `FALHOU`). */
  readonly erro?: string | null;
  /** Quando mudou (ISO 8601). */
  readonly em?: string | null;
}

export interface EventoDigitando {
  /** Atendimento: a conversa em que alguém digita. */
  readonly conversaId?: string;
  /** Chat da equipe: o canal em que alguém digita. */
  readonly canalId?: string;
  /** `false`: parou de digitar (sem aviso, o cliente apaga sozinho depois de ~6 s). */
  readonly ativo: boolean;
  /** Quem digita, quando é alguém da equipe. */
  readonly usuario?: { readonly id: string; readonly nome: string } | null;
  /** `true` quando quem digita é o contato (chat do site, WhatsApp). */
  readonly contato?: boolean;
  /** Nome do contato que digita, quando a API mandar. */
  readonly nome?: string | null;
}

export interface EventoChatMensagem {
  readonly canalId: string;
  readonly mensagem: EntidadeTempoReal;
}

export interface EventoChatAtualizado {
  readonly canalId: string;
  /** O canal como a lista do chat mostra; ausente com `removido`. */
  readonly canal?: EntidadeTempoReal;
  /** A pessoa saiu (ou foi tirada) do canal. */
  readonly removido?: boolean;
}

export interface EventoWhatsappConexao {
  readonly numeroId: string;
  readonly canalId: string;
  readonly status: StatusWhatsapp;
  /** QR em data URL (`data:image/png;base64,…`) enquanto `AGUARDANDO_QR`. */
  readonly qr?: string | null;
  /** Quando o QR expira (ISO 8601); um novo chega antes disso. */
  readonly qrExpiraEm?: string | null;
  readonly telefone?: string | null;
  /** Motivo do status, em português (erro, banimento, desconectado pelo celular…). */
  readonly motivo?: string | null;
}

export interface EventoSessaoEncerrada {
  readonly motivo: 'sessao_revogada' | 'sessao_expirada' | 'usuario_inativo';
}

/** Servidor → cliente. */
export interface EventosServidor {
  'notificacao.nova': EventoNotificacaoNova;
  'nao-lidas': EventoNaoLidas;
  'conversa.nova': EventoConversa;
  'conversa.atualizada': EventoConversa;
  'mensagem.nova': EventoMensagemNova;
  'mensagem.status': EventoStatusMensagem;
  digitando: EventoDigitando;
  'chat.mensagem': EventoChatMensagem;
  'chat.atualizado': EventoChatAtualizado;
  'whatsapp.conexao': EventoWhatsappConexao;
  'sessao.encerrada': EventoSessaoEncerrada;
}

export type EventoServidor = keyof EventosServidor;

/** Onde alguém digita: uma conversa do Atendimento ou um canal do Chat da equipe. */
export type AlvoDigitando = { readonly conversaId: string } | { readonly canalId: string };

/** Cliente → servidor. */
export interface EventosCliente {
  'conversa.entrar': { readonly conversaId: string };
  'conversa.sair': { readonly conversaId: string };
  'chat.entrar': { readonly canalId: string };
  'chat.sair': { readonly canalId: string };
  digitando: AlvoDigitando & { readonly ativo: boolean };
}

/** Confirmação (ack) dos pedidos do cliente. */
export type RespostaTempoReal =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly erro: 'dados_invalidos' | 'sem_permissao' | 'erro_interno';
      readonly mensagem: string;
    };

/**
 * Sala que o cliente pede para acompanhar (as de usuário, área e papel o servidor põe
 * sozinho na conexão): `conversa:<id>` (com verificação de permissão) e `chat:<canalId>`
 * (só membros).
 */
export type SalaTempoReal =
  | { readonly tipo: 'conversa'; readonly id: string }
  | { readonly tipo: 'chat'; readonly id: string };

/** `conversa:<id>` / `chat:<id>` — o mesmo nome que o servidor usa. */
export function nomeDaSala(sala: SalaTempoReal): string {
  return `${sala.tipo}:${sala.id}`;
}

/** O evento de entrada/saída e os dados de cada tipo de sala. */
export function pedidoDaSala(
  sala: SalaTempoReal,
  acao: 'entrar' | 'sair',
): { evento: keyof EventosCliente; dados: EventosCliente[keyof EventosCliente] } {
  return sala.tipo === 'conversa'
    ? { evento: `conversa.${acao}`, dados: { conversaId: sala.id } }
    : { evento: `chat.${acao}`, dados: { canalId: sala.id } };
}

/**
 * Aplica um `nao-lidas` às contagens atuais sem confiar no formato: só os campos presentes e
 * numéricos mudam (negativos viram 0, frações caem); o resto continua como estava.
 */
export function lerNaoLidas(dados: unknown, atual: NaoLidas = SEM_NAO_LIDAS): NaoLidas {
  const objeto = (dados ?? {}) as Partial<Record<keyof NaoLidas, unknown>>;
  const contar = (valor: unknown, anterior: number) =>
    typeof valor === 'number' && Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : anterior;
  return {
    atendimento: contar(objeto.atendimento, atual.atendimento),
    chat: contar(objeto.chat, atual.chat),
  };
}
