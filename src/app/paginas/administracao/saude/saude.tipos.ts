/**
 * Corpo de `GET /api/v1/administracao/saude-do-sistema` (R27). O front não compartilha tipos
 * com a API: mudou lá (`saude-do-sistema.dto.ts`), mude aqui.
 */

export type SituacaoGeral = 'ok' | 'atencao' | 'critico';
export type GravidadeAlerta = 'aviso' | 'critico';

export interface AlertaDeSaude {
  readonly chave: string;
  readonly codigo: string;
  readonly gravidade: GravidadeAlerta;
  readonly titulo: string;
  readonly detalhe: string;
  /** O que fazer. */
  readonly dica: string;
  /** Também vai por e-mail ao Admin. */
  readonly porEmail: boolean;
}

export interface FilaDeSaude {
  readonly nome: string;
  readonly pendentes: number;
  readonly ativas: number;
  readonly falhasRecentes: number;
  readonly maisAntigaParadaSegundos: number | null;
  readonly travada: boolean;
}

export interface FilasDeSaude {
  readonly disponivel: boolean;
  readonly itens: readonly FilaDeSaude[];
  readonly totalPendentes: number;
  readonly totalAtivas: number;
  readonly totalFalhasRecentes: number;
  readonly maisAntigaParadaSegundos: number | null;
}

export type StatusDoGateway = 'ok' | 'degradado' | 'fora_do_ar';

export type StatusDoNumero =
  'DESCONECTADO' | 'AGUARDANDO_QR' | 'CONECTANDO' | 'CONECTADO' | 'ERRO' | 'BANIDO';

export interface NumeroDeSaude {
  readonly id: string;
  readonly nome: string;
  readonly telefone: string | null;
  readonly status: StatusDoNumero;
  readonly motivo: string | null;
  readonly canalAtivo: boolean;
  readonly pausado: boolean;
  readonly comProblema: boolean;
  readonly desconectadoEm: string | null;
}

export interface CanalDeSaude {
  readonly id: string;
  readonly tipo: string;
  readonly nome: string;
  readonly ativo: boolean;
  readonly ultimoErro: string | null;
  readonly ultimoErroEm: string | null;
  readonly comErroRecente: boolean;
}

export interface ErroRecente {
  readonly id: string;
  readonly criadoEm: string;
  readonly contexto: string;
  readonly mensagem: string;
}

export interface DiscoDeSaude {
  readonly caminho: string;
  readonly totalBytes: number;
  readonly livreBytes: number;
  readonly livrePercentual: number;
  readonly situacao: 'ok' | 'aviso' | 'critico';
  readonly bancoBytes: number | null;
}

export type SituacaoDoBackup = 'ok' | 'falhou' | 'atrasado' | 'nenhum' | 'ilegivel';

export interface UltimoBackup {
  readonly inicio: string;
  readonly fim: string;
  readonly arquivo: string | null;
  readonly tamanhoBytes: number | null;
  readonly ok: boolean;
  readonly erro: string | null;
}

export interface SaudeDoSistema {
  readonly geradoEm: string;
  readonly situacao: SituacaoGeral;
  readonly alertas: readonly AlertaDeSaude[];
  readonly filas: FilasDeSaude;
  readonly gateway: { readonly status: StatusDoGateway; readonly simulado: boolean };
  readonly numeros: readonly NumeroDeSaude[];
  readonly canais: readonly CanalDeSaude[];
  readonly erros: { readonly total24h: number; readonly recentes: readonly ErroRecente[] };
  readonly disco: DiscoDeSaude | null;
  readonly backup: {
    readonly situacao: SituacaoDoBackup;
    readonly ultimo: UltimoBackup | null;
    readonly idadeHoras: number | null;
  };
  readonly emailConfigurado: boolean;
}

export const ROTULO_SITUACAO: Readonly<Record<SituacaoGeral, string>> = {
  ok: 'Tudo funcionando',
  atencao: 'Pede atenção',
  critico: 'Precisa de ação agora',
};

export const ROTULO_STATUS_NUMERO: Readonly<Record<StatusDoNumero, string>> = {
  CONECTADO: 'Conectado',
  CONECTANDO: 'Conectando',
  AGUARDANDO_QR: 'Aguardando QR',
  DESCONECTADO: 'Desconectado',
  ERRO: 'Com erro',
  BANIDO: 'Banido',
};

export const ROTULO_GATEWAY: Readonly<Record<StatusDoGateway, string>> = {
  ok: 'No ar',
  degradado: 'Instável',
  fora_do_ar: 'Fora do ar',
};

export const ROTULO_BACKUP: Readonly<Record<SituacaoDoBackup, string>> = {
  ok: 'Em dia',
  falhou: 'Falhou',
  atrasado: 'Atrasado',
  nenhum: 'Nenhum registrado',
  ilegivel: 'Registro ilegível',
};

export const ROTULO_TIPO_CANAL: Readonly<Record<string, string>> = {
  EMAIL: 'E-mail',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Messenger',
  WEBCHAT: 'Chat do site',
  WHATSAPP: 'WhatsApp',
};

/** `1,5 GB`, `320 MB`, `12 KB`. */
export function formatarBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let valor = Math.max(0, bytes);
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  const texto = indice === 0 || valor >= 100 ? Math.round(valor).toString() : valor.toFixed(1);
  return `${texto.replace(/\.0$/, '').replace('.', ',')} ${unidades[indice]}`;
}

/** `45 s`, `12 min`, `3 h 5 min`, `2 d 4 h`. */
export function formatarParada(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) {
    return '—';
  }
  const minutos = Math.floor(segundos / 60);
  if (minutos < 1) {
    return `${Math.max(0, Math.floor(segundos))} s`;
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return `${horas} h ${minutos % 60} min`;
  }
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
}
