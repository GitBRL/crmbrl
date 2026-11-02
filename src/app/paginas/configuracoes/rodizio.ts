import { ROTULO_PAPEL, type Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';
import type {
  MotivoAguardandoAcesso,
  RegraDistribuicao,
  UsuarioResumo,
} from './configuracoes.modelos';
import { AREA_DO_PAPEL, ehLiderDeArea } from './hierarquia';

/**
 * Regra do rodízio (R5.8) como a tela mostra: cada pessoa da área, se participa, em que posição
 * da fila, se é a próxima da vez e por quê.
 */

/**
 * Quem a regra poria no rodízio, mas ainda não ativou o acesso (R5.8): com o convite pendente
 * (ainda não definiu a senha) ou com a senha temporária ainda não trocada no primeiro login.
 * Fica fora da fila e entra sozinho quando ativar.
 */
export type AcessoPendente = 'convite' | 'primeiro-acesso';

/** O motivo da API (`aguardandoAcesso[].motivo`) como a tela o trata. */
export const ACESSO_PENDENTE: Readonly<Record<MotivoAguardandoAcesso, AcessoPendente>> = {
  CONVITE_PENDENTE: 'convite',
  PRIMEIRO_ACESSO_PENDENTE: 'primeiro-acesso',
};

/** Uma pessoa da área no rodízio. */
export interface PessoaDoRodizio {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl: string | null;
  readonly papel: Papel;
  readonly ehLider: boolean;
  /**
   * O alternador: a pessoa participa do rodízio. Para quem ainda não ativou o acesso, é o que
   * vale quando ativar (a regra ou o ajuste) — ela ainda não está na fila.
   */
  readonly participa: boolean;
  /** Posição na fila (1, 2, 3…), só para quem está na fila agora. */
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

/** Pessoa da área como `GET /usuarios` devolve. */
export type PessoaDaArea = Pick<UsuarioResumo, 'id' | 'nome' | 'papel' | 'ativo'>;

/** "Convite pendente", "Primeiro acesso pendente": o começo da dica de quem está aguardando. */
export const TEXTO_ACESSO_PENDENTE: Readonly<Record<AcessoPendente, string>> = {
  convite: 'Convite pendente',
  'primeiro-acesso': 'Primeiro acesso pendente',
};

/** O que falta para entrar na fila. */
export const QUANDO_ENTRA: Readonly<Record<AcessoPendente, string>> = {
  convite: 'entra na fila quando definir a senha do convite',
  'primeiro-acesso': 'entra na fila quando entrar e trocar a senha temporária',
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
  const area = regra.area;
  const participantes = new Map(regra.participantes.map((p, indice) => [p.id, { p, indice }]));
  const aguardando = new Map(
    (regra.aguardandoAcesso ?? [])
      .filter((a) => PAPEL_DA_AREA(a.papel, area))
      .map((a) => [a.id, a]),
  );
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
  for (const pessoa of aguardando.values()) {
    candidatos.set(pessoa.id, {
      id: pessoa.id,
      nome: pessoa.nome,
      papel: pessoa.papel,
      avatarUrl: pessoa.avatarUrl ?? null,
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
    const padrao = ehLider ? regra.incluirLideres : true;
    const espera = aguardando.get(pessoa.id);
    const pendente = espera ? ACESSO_PENDENTE[espera.motivo] : null;
    // Quem aguarda o acesso não está na fila: o alternador mostra o que vale quando ativar.
    const participa =
      naFila !== undefined || (pendente !== null && (ajuste ? ajuste.participa : padrao));
    const proximo = naFila !== undefined && regra.proximo?.id === pessoa.id;
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
    // "Convite pendente: entra na fila quando definir a senha do convite · Marketing · …"
    texto = dados.participa
      ? `${TEXTO_ACESSO_PENDENTE[dados.pendente]}: ${QUANDO_ENTRA[dados.pendente]} · ${texto}`
      : `${TEXTO_ACESSO_PENDENTE[dados.pendente]} · ${texto}`;
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
  'Cada lead novo (de um webhook ou de uma passagem entre funis) vai para a próxima pessoa da fila, em ordem, e a vez passa para a seguinte. Só fica na fila quem já ativou o acesso: quem tem o convite pendente ou ainda não trocou a senha temporária entra sozinho quando ativar. Quem é desligado sai sozinho. Sem ninguém na fila, o lead vai para o líder da área; sem líder, para um C-level.';

/** Para a frase quando a fila está vazia. */
export function destinoSemFila(regra: RegraDistribuicao): string {
  return regra.proximo
    ? `Ninguém na fila: os leads vão para ${regra.proximo.nome} até alguém entrar.`
    : 'Ninguém na fila e nenhum líder ou C-level ativo para receber os leads.';
}
