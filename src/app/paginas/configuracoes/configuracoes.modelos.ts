import type { Papel } from '../../nucleo/papeis';
import type { Area, NivelUsuario } from '../../nucleo/sessao/perfil';

/**
 * Contratos da API usados por Configurações (crmbrl-api: usuarios/dto, funis/dto). O detalhe
 * de cada campo está no OpenAPI (`/api/docs`).
 */

/** `UsuarioResumoDto`: líder, destinatário, liderados. */
export interface UsuarioResumo {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  readonly rotuloPapel: string;
  readonly area: Area | null;
  /** Falso para quem foi desligado. */
  readonly ativo: boolean;
}

/** `UsuarioDto`. */
export interface Usuario extends UsuarioResumo {
  readonly nivel: NivelUsuario;
  /** Membro → líder da área; líder → C-level responsável; Admin e C-level: nulo (R1.2). */
  readonly lider: UsuarioResumo | null;
  readonly desligadoEm: string | null;
  /** Troca de senha obrigatória no próximo acesso (R2.7). */
  readonly deveTrocarSenha: boolean;
  /** Falso para quem foi convidado e ainda não definiu a senha (R2.8). */
  readonly senhaDefinida: boolean;
  readonly telefone: string | null;
  /** Nome com que o usuário aparece nas integrações (campo "dono" do recebimento); opcional e único. */
  readonly identificadorIntegracao?: string | null;
  readonly avatarUrl: string | null;
  readonly ultimoAcessoEm: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** Filtros de `GET /usuarios`. */
export interface FiltrosUsuarios {
  readonly busca?: string | null;
  readonly papel?: Papel | null;
  readonly area?: Area | null;
  /** Só ativos (`true`) ou só desligados (`false`); sem o filtro, todos. */
  readonly ativo?: boolean | null;
  readonly liderId?: string | null;
  readonly pagina?: number;
  readonly porPagina?: number;
}

/** `POST /usuarios`. Sem `senhaTemporaria`, a API envia o convite por e-mail. */
export interface DadosNovoUsuario {
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  readonly liderId?: string | null;
  readonly telefone?: string | null;
  readonly identificadorIntegracao?: string | null;
  readonly senhaTemporaria?: string;
}

/** `PATCH /usuarios/:id` (só os campos que mudaram). */
export interface DadosEdicaoUsuario {
  readonly nome?: string;
  readonly email?: string;
  readonly papel?: Papel;
  readonly liderId?: string | null;
  readonly telefone?: string | null;
  readonly identificadorIntegracao?: string | null;
}

/** `UsuarioCriadoDto`. */
export interface UsuarioCriado {
  readonly usuario: Usuario;
  /** Nulo quando o Admin definiu uma senha temporária. */
  readonly convite: { readonly enviado: boolean; readonly expiraEm: string | null } | null;
}

/** `ConviteEnviadoDto`. */
export interface ConviteEnviado {
  readonly mensagem: string;
  readonly expiraEm: string;
}

/** Por que este destinatário (R7.2). */
export type MotivoDestinatario =
  | 'LIDER'
  | 'C_LEVEL_RESPONSAVEL'
  | 'SUBIU_NA_CADEIA'
  | 'C_LEVEL_ATIVO'
  | 'ESCOLHIDO_PELO_ADMIN'
  | 'ADMIN_EXECUTOR'
  | 'SEM_C_LEVEL_ATIVO';

/** O que vai para o destinatário (R7.1). */
export interface ContagensEncaminhamento {
  /** Atividades pendentes. */
  readonly atividades: number;
  /** Negócios abertos. */
  readonly negocios: number;
  readonly contatos: number;
  readonly empresas: number;
  /** Liderados ativos, que passam a responder ao destinatário. */
  readonly liderados: number;
  /** Webhooks de entrada e passagens com o usuário como responsável fixo. */
  readonly responsavelFixo: number;
}

/** `PreviaDesligamentoDto`. */
export interface PreviaDesligamento {
  readonly usuario: UsuarioResumo;
  /** Nulo enquanto o Admin não escolhe (C-level desligado). */
  readonly destinatario: UsuarioResumo | null;
  readonly motivoDestinatario: MotivoDestinatario | null;
  /** Frase pronta da API: "O que está com Pedro (Comercial) vai para o líder, Ana." */
  readonly explicacao: string;
  /** C-level: o Admin precisa escolher outro C-level ativo. */
  readonly exigeEscolha: boolean;
  readonly candidatos: readonly UsuarioResumo[];
  /** Líderes desligados pulados ao subir na cadeia. */
  readonly ignorados: readonly UsuarioResumo[];
  readonly contagens: ContagensEncaminhamento;
  readonly liderados: readonly UsuarioResumo[];
  /** Desligamento de um líder: os Admins recebem o alerta "equipe sem líder" (R7.3). */
  readonly alertaEquipeSemLider: boolean;
}

/** `ResultadoDesligamentoDto`. */
export interface ResultadoDesligamento {
  readonly usuario: Usuario;
  readonly destinatario: UsuarioResumo;
  readonly motivoDestinatario: MotivoDestinatario;
  readonly contagens: ContagensEncaminhamento & { readonly sessoesRevogadas: number };
}

/** `POST /usuarios/:id/reativar`. */
export interface DadosReativacao {
  readonly papel?: Papel;
  readonly liderId?: string | null;
}

/** Carga de trabalho de cada pessoa na visão de equipe. */
export interface Indicadores {
  readonly atividadesPendentes: number;
  readonly atividadesAtrasadas: number;
  readonly negociosAbertos: number;
  /** Soma do valor dos negócios abertos, em reais ("15000.00"). */
  readonly valorEmAberto: string;
  readonly contatos: number;
}

export interface MembroDaEquipe {
  readonly usuario: UsuarioResumo;
  readonly indicadores: Indicadores;
  /** Responde provisoriamente a quem não é o líder que o papel exige (R7.3). */
  readonly aguardandoNovoLider: boolean;
}

/** `EquipeDto`: um líder (ou C-level) e quem responde a ele. */
export interface Equipe {
  readonly lider: MembroDaEquipe;
  /** Nula para a equipe de um C-level. */
  readonly area: Area | null;
  readonly membros: readonly MembroDaEquipe[];
}

/** Pessoa em listas curtas (rodízio, passagens). */
export interface ResumoPessoa {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl?: string | null;
}

export type MotivoNoRodizio =
  'MEMBRO_DA_AREA' | 'LIDER_INCLUIDO_PELA_REGRA' | 'INCLUIDO_MANUALMENTE';

export interface ParticipanteDoRodizio extends ResumoPessoa {
  readonly papel: Papel;
  readonly motivo: MotivoNoRodizio;
}

/**
 * Por que alguém que a regra (ou um ajuste) poria no rodízio ainda está fora dele: o rodízio
 * só inclui quem já ativou o acesso (R5.8).
 */
export type MotivoAguardandoAcesso = 'CONVITE_PENDENTE' | 'PRIMEIRO_ACESSO_PENDENTE';

/** `AguardandoAcessoDto`: fora da fila até ativar o acesso; entra sozinho quando ativar. */
export interface AguardandoAcesso extends ResumoPessoa {
  readonly papel: Papel;
  readonly motivo: MotivoAguardandoAcesso;
}

/** Ajuste manual: alguém incluído (`participa`) ou tirado do rodízio. */
export interface AjusteDoRodizio extends ResumoPessoa {
  readonly papel: Papel;
  readonly ativo: boolean;
  readonly participa: boolean;
}

/** `RegraDistribuicaoDto` (R5.8). */
export interface RegraDistribuicao {
  readonly id: string;
  readonly area: Area;
  /** O líder da área entra no rodízio. */
  readonly incluirLideres: boolean;
  /** O último escolhido (o ponteiro). */
  readonly ultimoUsuario: ResumoPessoa | null;
  /** Quem recebe o próximo negócio. Sem participantes: o líder da área ou um C-level. */
  readonly proximo: ResumoPessoa | null;
  /** Quem está no rodízio agora, na ordem em que recebe. */
  readonly participantes: readonly ParticipanteDoRodizio[];
  readonly ajustes: readonly AjusteDoRodizio[];
  /** Quem ainda não ativou o acesso e por isso está fora da fila (opcional: API anterior). */
  readonly aguardandoAcesso?: readonly AguardandoAcesso[];
  readonly atualizadoEm: string;
}

export type EstrategiaDistribuicao = 'RODIZIO' | 'RESPONSAVEL_FIXO' | 'LIDER_DA_AREA';

export interface ResumoFunil {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
}

export interface ResumoEtapa {
  readonly id: string;
  readonly nome: string;
  readonly tipo: 'ABERTA' | 'GANHO' | 'PERDIDO';
  readonly ordem: number;
}

/** `PassagemDto` (R5.7). */
export interface Passagem {
  readonly id: string;
  readonly chave: string | null;
  readonly nome: string;
  readonly funilOrigem: ResumoFunil;
  /** Entrar nesta etapa dispara a passagem. */
  readonly etapaGatilho: ResumoEtapa;
  readonly funilDestino: ResumoFunil;
  /** Etapa (aberta) onde o negócio criado entra. */
  readonly etapaDestino: ResumoEtapa;
  readonly estrategia: EstrategiaDistribuicao;
  readonly responsavelFixo: ResumoPessoa | null;
  readonly ativa: boolean;
  /** Quantas vezes já rodou (uma por negócio de origem). */
  readonly execucoes: number;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}
