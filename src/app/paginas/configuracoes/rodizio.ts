import { ROTULO_PAPEL, type Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';
import type { RegraDistribuicao, Usuario, UsuarioResumo } from './configuracoes.modelos';
import { AREA_DO_PAPEL, ehLiderDeArea } from './hierarquia';

/**
 * Regra do rodízio (R5.8) como a tela mostra: cada pessoa da área, se participa, em que posição
 * da fila, se é a próxima da vez e por quê.
 */

/**
 * Quem está no rodízio sem nunca ter entrado no CRM: com o convite pendente (ainda não definiu
 * a senha) ou que nunca entrou. Recebe leads mesmo assim.
 */
export type AcessoPendente = 'convite' | 'nunca-entrou';

/** Uma pessoa da área no rodízio. */
export interface PessoaDoRodizio {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl: string | null;
  readonly papel: Papel;
  readonly ehLider: boolean;
  readonly participa: boolean;
  /** Posição na fila (1, 2, 3…), só para quem participa. */
  readonly posicao: number | null;
  readonly proximo: boolean;
  /** Ajuste manual em vigor, se houver. */
  readonly ajuste: 'incluido' | 'tirado' | null;
  /** O que a regra faria sem ajuste: membro participa; líder, só se a regra incluir líderes. */
  readonly padrao: boolean;
  /** "Membro da área", "Líder da área: fica fora pela regra"… */
  readonly motivo: string;
  readonly acessoPendente: AcessoPendente | null;
}

/** Pessoa da área como `GET /usuarios` devolve (a situação de acesso é opcional). */
export type PessoaDaArea = Pick<UsuarioResumo, 'id' | 'nome' | 'papel' | 'ativo'> &
  Partial<Pick<Usuario, 'senhaDefinida' | 'ultimoAcessoEm'>>;

function acessoPendente(pessoa: PessoaDaArea): AcessoPendente | null {
  if (pessoa.senhaDefinida === false) {
    return 'convite';
  }
  return pessoa.ultimoAcessoEm === null ? 'nunca-entrou' : null;
}

/** "Convite pendente: ainda não entrou no CRM", para a dica e o "Próximo da vez". */
export const TEXTO_ACESSO_PENDENTE: Readonly<Record<AcessoPendente, string>> = {
  convite: 'Convite pendente: ainda não entrou no CRM',
  'nunca-entrou': 'Ainda não entrou no CRM',
};

const PAPEL_DA_AREA = (papel: Papel, area: Area): boolean => AREA_DO_PAPEL[papel] === area;

/**
 * Junta a regra da API com as pessoas ativas da área (`GET /usuarios?area&ativo=true`): os
 * participantes na ordem em que recebem e, depois, quem está fora (por nome).
 */
export function pessoasDoRodizio(
  regra: RegraDistribuicao,
  pessoasDaArea: readonly PessoaDaArea[],
): PessoaDoRodizio[] {
  const acessos = new Map(pessoasDaArea.map((pessoa) => [pessoa.id, acessoPendente(pessoa)]));
  const area = regra.area;
  const participantes = new Map(regra.participantes.map((p, indice) => [p.id, { p, indice }]));
  const ajustes = new Map(
    regra.ajustes.filter((a) => a.ativo && PAPEL_DA_AREA(a.papel, area)).map((a) => [a.id, a]),
  );

  const candidatos = new Map<
    string,
    { id: string; nome: string; papel: Papel; avatarUrl: string | null }
  >();
  for (const pessoa of pessoasDaArea) {
    if (pessoa.ativo && PAPEL_DA_AREA(pessoa.papel, area)) {
      candidatos.set(pessoa.id, {
        id: pessoa.id,
        nome: pessoa.nome,
        papel: pessoa.papel,
        avatarUrl: null,
      });
    }
  }
  // Quem está na fila ou tem ajuste também entra (o líder pode não ver todos da área).
  for (const { p } of participantes.values()) {
    candidatos.set(p.id, {
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      avatarUrl: p.avatarUrl ?? null,
    });
  }
  for (const ajuste of ajustes.values()) {
    if (!candidatos.has(ajuste.id)) {
      candidatos.set(ajuste.id, {
        id: ajuste.id,
        nome: ajuste.nome,
        papel: ajuste.papel,
        avatarUrl: ajuste.avatarUrl ?? null,
      });
    }
  }

  const pessoas = [...candidatos.values()].map((pessoa): PessoaDoRodizio => {
    const naFila = participantes.get(pessoa.id);
    const ajuste = ajustes.get(pessoa.id);
    const ehLider = ehLiderDeArea(pessoa.papel);
    const participa = naFila !== undefined;
    const padrao = ehLider ? regra.incluirLideres : true;
    const proximo = participa && regra.proximo?.id === pessoa.id;
    const pendente = acessos.get(pessoa.id) ?? null;
    return {
      ...pessoa,
      avatarUrl: naFila?.p.avatarUrl ?? pessoa.avatarUrl,
      ehLider,
      participa,
      posicao: naFila ? naFila.indice + 1 : null,
      proximo,
      ajuste: ajuste ? (ajuste.participa ? 'incluido' : 'tirado') : null,
      padrao,
      motivo: motivo({
        ehLider,
        participa,
        ajuste: ajuste?.participa,
        papel: pessoa.papel,
        proximo,
        pendente,
      }),
      acessoPendente: pendente,
    };
  });

  return pessoas.sort((a, b) => {
    if (a.posicao !== null && b.posicao !== null) {
      return a.posicao - b.posicao;
    }
    if (a.posicao !== null || b.posicao !== null) {
      return a.posicao !== null ? -1 : 1;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

function motivo(dados: {
  ehLider: boolean;
  participa: boolean;
  ajuste: boolean | undefined;
  papel: Papel;
  proximo: boolean;
  pendente: AcessoPendente | null;
}): string {
  const papel = ROTULO_PAPEL[dados.papel];
  let texto: string;
  if (dados.participa) {
    texto =
      dados.ajuste === true
        ? `${papel} · incluído(a) à mão`
        : dados.ehLider
          ? `${papel} · entra pela regra da área`
          : `${papel} · membro da área`;
  } else {
    texto =
      dados.ajuste === false
        ? `${papel} · tirado(a) do rodízio à mão`
        : `${papel} · fica fora pela regra (o líder não entra)`;
  }
  if (dados.pendente) {
    texto = `${TEXTO_ACESSO_PENDENTE[dados.pendente]} · ${texto}`;
  }
  return dados.proximo ? `Recebe o próximo lead · ${texto}` : texto;
}

/**
 * Como chegar a `participa` para a pessoa (R5.8): voltando à regra (apaga o ajuste) quando o
 * desejado é o padrão, ou criando o ajuste manual.
 */
export function operacaoDeParticipacao(
  pessoa: Pick<PessoaDoRodizio, 'padrao' | 'ajuste'>,
  participa: boolean,
): 'remover-ajuste' | 'definir' {
  return participa === pessoa.padrao && pessoa.ajuste !== null ? 'remover-ajuste' : 'definir';
}

/** Texto do balão de ajuda (R5.8). */
export const DICA_RODIZIO =
  'Cada lead novo (de um webhook ou de uma passagem entre funis) vai para a próxima pessoa da fila, em ordem, e a vez passa para a seguinte. Quem é desligado sai sozinho. Sem ninguém na fila, o lead vai para o líder da área; sem líder, para um C-level.';

/** Para a frase quando a fila está vazia. */
export function destinoSemFila(regra: RegraDistribuicao): string {
  return regra.proximo
    ? `Ninguém na fila: os leads vão para ${regra.proximo.nome} até alguém entrar.`
    : 'Ninguém na fila e nenhum líder ou C-level ativo para receber os leads.';
}
