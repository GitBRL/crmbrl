import type { Perfil, Permissoes } from '../../nucleo/sessao/perfil';

/**
 * Abas de Administração (TELAS-FASE1 §8), na ordem. A mesma regra libera a rota
 * (`exigirPermissao(secao.permite)`) e mostra a aba.
 */
export interface SecaoAdministracao {
  /** Caminho dentro de `/administracao`. */
  readonly caminho: string;
  readonly rotulo: string;
  readonly permite: (permissoes: Permissoes, perfil: Perfil) => boolean;
}

export const SECOES_ADMINISTRACAO: readonly SecaoAdministracao[] = [
  { caminho: 'auditoria', rotulo: 'Auditoria', permite: (p) => p.verAuditoria },
  { caminho: 'logs', rotulo: 'Logs técnicos', permite: (p) => p.verLogsTecnicos },
  {
    caminho: 'ia',
    rotulo: 'Dúvidas à IA',
    permite: (p) => p.verAuditoria || p.verLogsTecnicos,
  },
];

export function secaoAdministracao(caminho: string): SecaoAdministracao {
  const secao = SECOES_ADMINISTRACAO.find((item) => item.caminho === caminho);
  if (!secao) {
    throw new Error(`Seção da administração desconhecida: ${caminho}`);
  }
  return secao;
}
