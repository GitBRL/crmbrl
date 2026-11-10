import { ehDiretoria, ehLider } from '../../nucleo/papeis';
import {
  podeConfigurarAtendimento,
  podeGerenciarCanais,
  type Perfil,
  type Permissoes,
} from '../../nucleo/sessao/perfil';

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
    permite: (_p, perfil) => perfil.usuario.papel === 'C_LEVEL' || ehLider(perfil.usuario),
  },
  {
    caminho: 'distribuicao',
    rotulo: 'Distribuição de leads',
    permite: (p) => p.configurarRodizio !== 'NENHUM',
  },
  { caminho: 'funis', rotulo: 'Funis', permite: (p) => p.verNegocios !== 'NENHUM' },
  {
    caminho: 'setores',
    rotulo: 'Setores',
    permite: (_p, perfil) => ehDiretoria(perfil.usuario) || ehLider(perfil.usuario),
  },
  { caminho: 'passagens', rotulo: 'Passagens entre funis', permite: (p) => p.configurarPassagens },
  // Canais, Atendimento e SDR com IA moram em subpastas (rotas em app.routes.ts) e a mesma regra libera a rota.
  { caminho: 'canais', rotulo: 'Canais', permite: podeGerenciarCanais },
  { caminho: 'atendimento', rotulo: 'Atendimento', permite: podeConfigurarAtendimento },
  {
    caminho: 'apps-de-login',
    rotulo: 'Apps de login',
    permite: (_p, perfil) => perfil.usuario.papel === 'ADMIN',
  },
  {
    caminho: 'disparos',
    rotulo: 'Disparos',
    permite: (_p, perfil) => perfil.usuario.papel === 'ADMIN' || perfil.usuario.papel === 'C_LEVEL',
  },
  {
    caminho: 'assistente',
    rotulo: 'Assistente de ajuda',
    permite: (_p, perfil) => perfil.usuario.papel === 'ADMIN',
  },
  {
    caminho: 'sdr',
    rotulo: 'SDR com IA',
    permite: (_p, perfil) => perfil.usuario.papel === 'ADMIN',
  },
  { caminho: 'perfil', rotulo: 'Meu perfil', permite: () => true },
];

export function secaoConfiguracoes(caminho: string): SecaoConfiguracoes {
  const secao = SECOES_CONFIGURACOES.find((item) => item.caminho === caminho);
  if (!secao) {
    throw new Error(`Seção de configurações desconhecida: ${caminho}`);
  }
  return secao;
}
