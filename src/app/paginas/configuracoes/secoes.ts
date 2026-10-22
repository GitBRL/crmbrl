import { LIDERES } from '../../nucleo/papeis';
import type { Perfil, Permissoes } from '../../nucleo/sessao/perfil';

/**
 * Seções de Configurações (TELAS-FASE1 §6), na ordem das abas. Cada uma diz quem a acessa:
 * a mesma regra libera a rota (`exigirPermissao(secao.permite)`) e mostra a aba.
 */
export interface SecaoConfiguracoes {
  /** Caminho dentro de `/configuracoes`. */
  readonly caminho: string;
  readonly rotulo: string;
  readonly permite: (permissoes: Permissoes, perfil: Perfil) => boolean;
}

export const SECOES_CONFIGURACOES: readonly SecaoConfiguracoes[] = [
  { caminho: 'usuarios', rotulo: 'Usuários', permite: (p) => p.gerenciarUsuarios },
  {
    caminho: 'equipe',
    rotulo: 'Minha equipe',
    permite: (_p, perfil) =>
      perfil.usuario.papel === 'C_LEVEL' || LIDERES.includes(perfil.usuario.papel),
  },
  {
    caminho: 'distribuicao',
    rotulo: 'Distribuição de leads',
    permite: (p) => p.configurarRodizio !== 'NENHUM',
  },
  { caminho: 'passagens', rotulo: 'Passagens entre funis', permite: (p) => p.configurarPassagens },
  { caminho: 'perfil', rotulo: 'Meu perfil', permite: () => true },
];

export function secaoConfiguracoes(caminho: string): SecaoConfiguracoes {
  const secao = SECOES_CONFIGURACOES.find((item) => item.caminho === caminho);
  if (!secao) {
    throw new Error(`Seção de configurações desconhecida: ${caminho}`);
  }
  return secao;
}
