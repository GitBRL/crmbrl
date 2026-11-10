import { erroDaApi } from '../../nucleo/api/erro-api';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import type { Perfil } from '../../nucleo/sessao/perfil';
import { nomeDoSetor, ordemDoSetor } from '../../nucleo/setores/setores';
import type { Funil, NivelNoFunil, VisibilidadeFunil } from './funis.tipos';
import { podeConfigurarFunil } from './regras-funis';

/**
 * Níveis de quem consulta um funil (R5.12): `VER` < `MEMBRO` < `GESTOR` < `CONFIGURAR`. A API
 * manda o `nivel` em cada funil; os botões das telas seguem este arquivo (funções puras, testadas
 * em nivel-funil.spec.ts). A API continua conferindo cada operação.
 */

const PESO: Readonly<Record<NivelNoFunil, number>> = {
  VER: 0,
  MEMBRO: 1,
  GESTOR: 2,
  CONFIGURAR: 3,
};

/**
 * O nível da pessoa no funil. Sem `nivel` na resposta (API antiga), cai nas permissões do perfil:
 * configura quem tem `configurarFunis` sobre o setor; os demais atuam como gestores.
 */
export function nivelDoFunil(
  funil: Pick<Funil, 'nivel' | 'area'> | null,
  perfil: Perfil | null,
): NivelNoFunil {
  if (!funil) {
    return 'VER';
  }
  if (funil.nivel) {
    return funil.nivel;
  }
  return podeConfigurarFunil(perfil, funil.area) ? 'CONFIGURAR' : 'GESTOR';
}

/** Cria, edita, move, assume e muda o responsável (`MEMBRO` ou mais). */
export function podeAgirNoFunil(nivel: NivelNoFunil): boolean {
  return PESO[nivel] >= PESO.MEMBRO;
}

/** Reabrir, excluir negócio e "Configurar funil": só `CONFIGURAR`. */
export function podeConfigurarPorNivel(nivel: NivelNoFunil): boolean {
  return nivel === 'CONFIGURAR';
}

export const ROTULO_NIVEL: Readonly<Record<NivelNoFunil, string>> = {
  VER: 'Só ver',
  MEMBRO: 'Como membro',
  GESTOR: 'Ver e editar todos',
  CONFIGURAR: 'Configurar',
};

export {
  DICA_NIVEL,
  NIVEIS_DE_ACESSO,
  OPCOES_NIVEL_ACESSO,
} from '../../ui/editor-de-acessos/editor-de-acessos';

export const ROTULO_VISIBILIDADE: Readonly<Record<VisibilidadeFunil, string>> = {
  SETOR: 'Todo o setor',
  RESTRITA: 'Só líderes e convidados',
};

export const DICA_VISIBILIDADE: Readonly<Record<VisibilidadeFunil, string>> = {
  SETOR:
    'Todas as pessoas do setor dono veem o funil. Os acessos gerais do setor também valem para ele.',
  RESTRITA:
    'Do setor dono, só os líderes veem o funil. Os membros e as pessoas de outros setores só entram se estiverem na lista de acessos deste funil; os acessos gerais do setor não valem.',
};

/** Funis de um setor, para listas agrupadas. */
export interface GrupoDeSetor<T extends Pick<Funil, 'area'>> {
  readonly area: string;
  readonly nome: string;
  readonly funis: readonly T[];
}

/**
 * Agrupa por setor dono: setores de base primeiro (Marketing, Comercial, CS), os demais por nome;
 * dentro do setor, o funil-base primeiro e depois por nome.
 */
export function agruparPorSetor<T extends Pick<Funil, 'area' | 'base' | 'nome' | 'nomeSetor'>>(
  funis: readonly T[],
): readonly GrupoDeSetor<T>[] {
  const porArea = new Map<string, T[]>();
  for (const funil of funis) {
    porArea.set(funil.area, [...(porArea.get(funil.area) ?? []), funil]);
  }
  return [...porArea.entries()]
    .map(([area, lista]) => ({
      area,
      nome: lista[0]?.nomeSetor || nomeDoSetor(area),
      funis: [...lista].sort(
        (a, b) => Number(b.base) - Number(a.base) || a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    }))
    .sort(
      (a, b) =>
        ordemDoSetor(a.area) - ordemDoSetor(b.area) || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

/** Opções do seletor de funis do quadro, agrupadas por setor (`optgroup`). */
export function opcoesDeFunisPorSetor(funis: readonly Funil[]): readonly OpcaoSeletor<string>[] {
  return agruparPorSetor(funis.filter((funil) => funil.ativo)).flatMap((grupo) =>
    grupo.funis.map((funil) => ({ valor: funil.id, rotulo: funil.nome, grupo: grupo.nome })),
  );
}

/** Mensagem clara para os 403/422 de nível (R5.12, R5.13) e de configurar (R5.1, R5.5). */
export function mensagemDeNivel(regra: string | null, padrao: string): string {
  switch (regra) {
    case 'R5.12':
      return 'Você só pode ver este funil: criar, editar, mover e excluir negócios exige o acesso "Como membro" ou mais.';
    case 'R5.13':
      return 'Esta pessoa não pode ser responsável: ela precisa ter o acesso "Como membro" ou mais neste funil.';
    case 'R5.5':
      return 'Só quem configura o funil (líder do setor, C-level e Admin) reabre negócios ou tira de uma etapa fechada.';
    default:
      return padrao;
  }
}

/**
 * A falha de uma ação em negócio, com texto claro para o 403/422 de nível (R5.12, R5.13, R5.5);
 * qualquer outra passa como veio (o aviso usa a mensagem da API).
 */
export function falhaClara(falha: unknown): unknown {
  const erro = erroDaApi(falha);
  const regra = erro.regra;
  if (
    (erro.status === 403 || erro.status === 422) &&
    (regra === 'R5.12' || regra === 'R5.13' || regra === 'R5.5')
  ) {
    return mensagemDeNivel(regra, erro.mensagem);
  }
  return falha;
}
