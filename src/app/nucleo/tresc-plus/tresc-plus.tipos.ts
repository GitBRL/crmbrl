/** Tipos das rotas `/api/v1/tresc-plus` (R34) e dos eventos `tresc.*` do tempo real. */

export type EstadoDoAgente =
  'desconectado' | 'ocioso' | 'manual' | 'em_ligacao' | 'pos_atendimento' | 'pausa';

export type ModoDoAgente = 'manual' | 'dialer';

export interface ItemNomeado {
  readonly id: number;
  readonly nome: string;
}

export type EstadoDoOuvinte = 'conectado' | 'reconectando' | 'desconectado' | 'erro';

export interface ConexaoTrescPlus {
  readonly ativa: boolean;
  readonly urlApi: string;
  readonly urlSocket: string | null;
  readonly caminhoSocket: string;
  readonly formatoEnvelope: 'AUTO' | 'EVENTO_DADOS' | 'OBJETO';
  readonly tokenConfigurado: boolean;
  /** "••••xxxx": só os 4 últimos caracteres. */
  readonly token: string | null;
  readonly campanhaPadrao: ItemNomeado | null;
  readonly teste: { readonly em: string; readonly ok: boolean; readonly mensagem: string } | null;
  readonly ouvinte: { readonly estado: EstadoDoOuvinte | null; readonly em: string | null };
  readonly reconciliadaEm: string | null;
}

export interface DadosConexaoTrescPlus {
  readonly ativa?: boolean;
  readonly urlApi?: string;
  readonly urlSocket?: string | null;
  readonly caminhoSocket?: string;
  readonly formatoEnvelope?: ConexaoTrescPlus['formatoEnvelope'];
  readonly token?: string;
  readonly limparToken?: boolean;
  readonly campanhaPadraoId?: number | null;
  readonly campanhaPadraoNome?: string | null;
}

export interface ResultadoDoTeste {
  readonly ok: boolean;
  readonly mensagem: string;
}

export interface VinculoDoUsuario {
  readonly vinculado: boolean;
  readonly usuarioId?: string;
  readonly ramal?: string | null;
  readonly nome3c?: string | null;
  readonly trescUsuarioId?: number;
  readonly token?: string;
  readonly vinculadoEm?: string;
  readonly usuarioNome?: string;
}

export interface EstadoDoAgenteApi {
  readonly vinculado: boolean;
  readonly estado: EstadoDoAgente;
  readonly desde: string | null;
  readonly campanha: ItemNomeado | null;
  readonly modo: ModoDoAgente | null;
  readonly pausa: ItemNomeado | null;
  readonly ligacaoId: string | null;
  readonly campanhaPadrao: ItemNomeado | null;
}

export interface CampanhaTresc {
  readonly id: number;
  readonly nome: string;
  readonly pausada?: boolean;
}

export interface PausaTresc {
  readonly id: number;
  readonly nome: string;
  readonly minutos?: number | null;
  readonly cor?: string | null;
}

export interface QualificacaoTresc {
  readonly id: number;
  readonly nome: string;
  readonly cor: string | null;
  readonly conversao: boolean;
  readonly permiteAgendar: boolean;
}

export interface ListaTresc {
  readonly id: number;
  readonly nome: string;
}

export interface DadosLigarTresc {
  readonly contatoId?: string;
  readonly negocioId?: string;
  readonly telefone?: string;
}

export type EstadoDaLigacaoTresc =
  'CHAMANDO' | 'TOCANDO' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'PERDIDA' | 'SEM_RESPOSTA' | 'FALHOU';

/** Resposta de `POST /tresc-plus/ligacoes` (o que a tela usa do `LigacaoDto`). */
export interface LigacaoTrescCriada {
  readonly id: string;
  readonly estado: EstadoDaLigacaoTresc;
  readonly contato: { readonly id: string; readonly nome: string } | null;
  readonly negocioId?: string | null;
  readonly campanha?: { readonly id?: number | string; readonly nome: string } | null;
}

export interface DadosQualificar {
  readonly qualificacaoId: number;
  readonly observacao?: string;
  readonly agendarPara?: string;
  readonly telefoneDoAgendamento?: string;
}

export interface DadosEnviarAoDiscador {
  readonly campanhaId: number;
  readonly listaId?: number;
  readonly nomeLista?: string;
  readonly negocioIds?: readonly string[];
  readonly contatoIds?: readonly string[];
}

export interface RelatorioDoDiscador {
  readonly envioId: string;
  readonly campanhaId: number;
  readonly listaId: number;
  readonly listaNome: string;
  readonly enviados: number;
  readonly importados: number;
  readonly filtrados: number;
  readonly detalhes: readonly {
    readonly identifier: string | null;
    readonly telefone: string;
    readonly motivo: string;
  }[];
}

// Tempo real ---------------------------------------------------------------------------------

export interface EventoTrescAgente {
  readonly estado: EstadoDoAgente;
  readonly desde: string | null;
  readonly campanha: ItemNomeado | null;
  readonly modo: ModoDoAgente | null;
  readonly pausa: ItemNomeado | null;
  readonly erro?: string | null;
}

export interface EventoTrescLigacao {
  readonly ligacaoId: string;
  readonly estado: EstadoDaLigacaoTresc;
  readonly direcao: 'RECEBIDA' | 'FEITA';
  readonly telefone: string | null;
  readonly contatoId: string | null;
  readonly negocioId: string | null;
  readonly campanhaId: number | null;
  readonly motivo: string | null;
  readonly motivoTexto: string | null;
  readonly atendidaEm: string | null;
  readonly encerradaEm: string | null;
  readonly duracaoSegundos: number | null;
  readonly qualificacao: string | null;
}

export interface EventoTrescRecebida {
  readonly ligacaoId: string | null;
  readonly telefone: string;
  readonly contato: {
    readonly id: string;
    readonly nome: string;
    readonly empresa?: string | null;
  } | null;
  readonly negocios: readonly {
    readonly id: string;
    readonly titulo: string;
  }[];
  readonly novoContato: boolean;
}

export interface EventoTrescQualificar {
  readonly ligacaoId: string;
  readonly campanhaId: number | null;
}
