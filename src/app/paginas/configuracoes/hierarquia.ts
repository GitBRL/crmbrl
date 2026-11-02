import { ROTULO_PAPEL, type Papel } from '../../nucleo/papeis';
import { ROTULO_AREA, type Area } from '../../nucleo/sessao/perfil';
import type {
  ContagensEncaminhamento,
  Equipe,
  Indicadores,
  MembroDaEquipe,
  PreviaDesligamento,
  Usuario,
  UsuarioResumo,
} from './configuracoes.modelos';

/**
 * Regras de hierarquia que a tela reflete (REGRAS-DE-NEGOCIO §1 e §7). A API continua sendo a
 * autoridade: aqui só o que evita erro bobo e explica o porquê.
 */

/** Área de cada papel; `null` para Admin e C-level (R1, tabela da seção 1). */
export const AREA_DO_PAPEL: Readonly<Record<Papel, Area | null>> = {
  ADMIN: null,
  C_LEVEL: null,
  LIDER_COMERCIAL: 'COMERCIAL',
  COMERCIAL: 'COMERCIAL',
  LIDER_MARKETING: 'MARKETING',
  MARKETING: 'MARKETING',
  LIDER_CS: 'CS',
  CS: 'CS',
};

/** O líder de cada área. */
export const LIDER_DA_AREA: Readonly<Record<Area, Papel>> = {
  COMERCIAL: 'LIDER_COMERCIAL',
  MARKETING: 'LIDER_MARKETING',
  CS: 'LIDER_CS',
};

const MEMBRO_DA_AREA: Readonly<Record<Area, Papel>> = {
  COMERCIAL: 'COMERCIAL',
  MARKETING: 'MARKETING',
  CS: 'CS',
};

export function ehLiderDeArea(papel: Papel): boolean {
  const area = AREA_DO_PAPEL[papel];
  return area !== null && LIDER_DA_AREA[area] === papel;
}

export function ehMembroDeArea(papel: Papel): boolean {
  const area = AREA_DO_PAPEL[papel];
  return area !== null && MEMBRO_DA_AREA[area] === papel;
}

/**
 * O papel que o líder de quem tem `papel` precisa ter (R1.2): membro → o líder da mesma área;
 * líder → C-level (o "C-level responsável"); Admin e C-level → nenhum.
 */
export function liderEsperado(papel: Papel): Papel | null {
  const area = AREA_DO_PAPEL[papel];
  if (area === null) {
    return null;
  }
  return ehLiderDeArea(papel) ? 'C_LEVEL' : LIDER_DA_AREA[area];
}

/** "um Líder Comercial" / "um C-level". */
function umPapel(papel: Papel): string {
  return `um ${ROTULO_PAPEL[papel]}`;
}

/** Plural dos papéis de líder, para "Só aparecem Líderes Comerciais ativos". */
const PLURAL_PAPEL: Readonly<Record<Papel, string>> = {
  ADMIN: 'Admins',
  C_LEVEL: 'C-levels',
  LIDER_COMERCIAL: 'Líderes Comerciais',
  COMERCIAL: 'pessoas do Comercial',
  LIDER_MARKETING: 'Líderes Marketing',
  MARKETING: 'pessoas do Marketing',
  LIDER_CS: 'Líderes CS',
  CS: 'pessoas de CS',
};

/**
 * Por que o seletor de líder só oferece certas pessoas (R1.2), para o papel escolhido. Vai na
 * dica do campo.
 */
export function explicacaoDoLider(papel: Papel | null): string {
  if (papel === null) {
    return 'Escolha o papel primeiro: é ele que define quem pode ser o líder.';
  }
  const esperado = liderEsperado(papel);
  if (esperado === null) {
    return `Quem é ${ROTULO_PAPEL[papel]} não tem líder.`;
  }
  if (esperado === 'C_LEVEL') {
    return `Quem é ${ROTULO_PAPEL[papel]} responde a um C-level ativo (o C-level responsável). Por isso só aparecem C-levels.`;
  }
  return `Quem é ${ROTULO_PAPEL[papel]} responde a ${umPapel(esperado)} ativo, da mesma área. Por isso só aparecem ${PLURAL_PAPEL[esperado]}.`;
}

/** Texto curto da ajuda (balão) do seletor de líder. */
export const AJUDA_LIDER =
  'Cada pessoa responde a um líder: quem é de uma área responde ao líder daquela área; os líderes respondem a um C-level. Admin e C-level não têm líder. Só aparecem pessoas ativas.';

/** Quando não há ninguém que possa liderar o papel. */
export function semLiderDisponivel(papel: Papel): string {
  const esperado = liderEsperado(papel);
  if (esperado === null) {
    return '';
  }
  return `Não há nenhum ${ROTULO_PAPEL[esperado]} ativo para liderar quem é ${ROTULO_PAPEL[papel]}. Convide ou reative ${umPapel(esperado)} antes.`;
}

/**
 * Responde provisoriamente a quem não é o líder que o papel exige (R7.3: depois do
 * desligamento de um líder, os liderados respondem ao destinatário até o Admin definir um novo
 * líder). Só para ativos.
 */
export function aguardaNovoLider(usuario: Pick<Usuario, 'papel' | 'ativo' | 'lider'>): boolean {
  if (!usuario.ativo) {
    return false;
  }
  const esperado = liderEsperado(usuario.papel);
  if (esperado === null) {
    return false;
  }
  const lider = usuario.lider;
  return lider === null || !lider.ativo || lider.papel !== esperado;
}

/** "Pedro" de "Pedro Santos" (a confirmação forte do desligamento). */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) {
    return nomes.join('');
  }
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Uma linha da prévia do desligamento: número e o que é. */
export interface ItemEncaminhado {
  readonly chave: keyof ContagensEncaminhamento;
  readonly quantidade: number;
  /** "atividades pendentes" (o número vai à parte, em destaque). */
  readonly rotulo: string;
}

const ROTULOS_ENCAMINHADOS: Readonly<
  Record<keyof ContagensEncaminhamento, readonly [string, string]>
> = {
  atividades: ['atividade pendente', 'atividades pendentes'],
  negocios: ['negócio aberto', 'negócios abertos'],
  contatos: ['contato', 'contatos'],
  empresas: ['empresa', 'empresas'],
  liderados: ['liderado', 'liderados'],
  responsavelFixo: [
    'webhook ou passagem com responsável fixo',
    'webhooks e passagens com responsável fixo',
  ],
};

/** O que vai para o destinatário, sem as contagens zeradas, na ordem da prévia (R7.1). */
export function itensEncaminhados(contagens: ContagensEncaminhamento): ItemEncaminhado[] {
  return (Object.keys(ROTULOS_ENCAMINHADOS) as (keyof ContagensEncaminhamento)[])
    .filter((chave) => contagens[chave] > 0)
    .map((chave) => {
      const [singular, plural] = ROTULOS_ENCAMINHADOS[chave];
      return {
        chave,
        quantidade: contagens[chave],
        rotulo: contagens[chave] === 1 ? singular : plural,
      };
    });
}

/**
 * A frase da prévia (TELAS §6): "As 12 atividades pendentes, 3 negócios abertos e 5 contatos de
 * Pedro vão para Carla (Líder Comercial)." Sem nada para encaminhar, diz isso.
 */
export function fraseDoEncaminhamento(previa: PreviaDesligamento): string {
  const nome = primeiroNome(previa.usuario.nome);
  const itens = itensEncaminhados(previa.contagens).filter((item) =>
    ITENS_DA_FRASE.includes(item.chave),
  );
  if (itens.length === 0) {
    return `${nome} não tem atividades pendentes, negócios abertos, contatos nem empresas para encaminhar.`;
  }
  const lista = juntarNomes(itens.map((item) => `${item.quantidade} ${item.rotulo}`));
  const total = itens.reduce((soma, item) => soma + item.quantidade, 0);
  // "As 12 atividades…", "Os 3 negócios…". Quando o primeiro item é um só, sem artigo ("1 contato
  // de Pedro vai…", "1 atividade pendente e 2 negócios abertos de Pedro vão…"): "As 1 atividade"
  // não concorda.
  const feminino = itens[0].chave === 'atividades' || itens[0].chave === 'empresas';
  const inicio = itens[0].quantidade === 1 ? lista : `${feminino ? 'As' : 'Os'} ${lista}`;
  const verbo = total === 1 ? 'vai' : 'vão';
  const destino = previa.destinatario
    ? `${previa.destinatario.nome} (${previa.destinatario.rotuloPapel})`
    : 'o C-level que você escolher';
  return `${inicio} de ${nome} ${verbo} para ${destino}.`;
}

/** O que entra na frase da prévia (liderados e responsável fixo aparecem à parte). */
const ITENS_DA_FRASE: readonly (keyof ContagensEncaminhamento)[] = [
  'atividades',
  'negocios',
  'contatos',
  'empresas',
];

/** "Comercial", "Customer Success"; Admin e C-level → "Diretoria". */
export function rotuloDaAreaDoPapel(papel: Papel): string {
  const area = AREA_DO_PAPEL[papel];
  return area ? ROTULO_AREA[area] : papel === 'ADMIN' ? 'Sistema' : 'Diretoria';
}

/** Situação de um usuário na lista: texto e cor do selo (nunca só a cor). */
export interface SituacaoUsuario {
  readonly rotulo: string;
  readonly variante: 'menta' | 'lima' | 'ciano' | 'neutro' | 'contorno';
  readonly descricao: string;
}

export function situacaoDoUsuario(usuario: Usuario): SituacaoUsuario {
  if (!usuario.ativo) {
    return {
      rotulo: 'Desligado',
      variante: 'contorno',
      descricao: 'Sem acesso ao CRM. O que estava com ele(a) foi encaminhado.',
    };
  }
  if (!usuario.senhaDefinida) {
    return {
      rotulo: 'Convite pendente',
      variante: 'lima',
      descricao: 'Ainda não criou a senha pelo link do convite.',
    };
  }
  if (usuario.deveTrocarSenha) {
    return {
      rotulo: 'Troca de senha pendente',
      variante: 'ciano',
      descricao: 'Precisa trocar a senha no próximo acesso.',
    };
  }
  return { rotulo: 'Ativo', variante: 'neutro', descricao: 'Acessa o CRM normalmente.' };
}

// Minha equipe (árvore) ----------------------------------------------------------------------

/** Um nó da árvore: a pessoa, os números dela e quem responde a ela. */
export interface NoEquipe {
  readonly pessoa: UsuarioResumo;
  readonly indicadores: Indicadores;
  readonly aguardandoNovoLider: boolean;
  readonly area: Area | null;
  readonly filhos: readonly NoEquipe[];
}

/**
 * Monta a árvore a partir da lista de equipes da API (`GET /usuarios/equipes`): a equipe do
 * C-level traz os líderes como membros, e cada líder tem a própria equipe — aqui ela entra
 * debaixo dele. As equipes que não ficam debaixo de ninguém são as raízes.
 */
export function montarArvore(equipes: readonly Equipe[]): NoEquipe[] {
  const porLider = new Map<string, Equipe>();
  for (const equipe of equipes) {
    porLider.set(equipe.lider.usuario.id, equipe);
  }
  const aninhadas = new Set<string>();
  for (const equipe of equipes) {
    for (const membro of equipe.membros) {
      if (porLider.has(membro.usuario.id) && membro.usuario.id !== equipe.lider.usuario.id) {
        aninhadas.add(membro.usuario.id);
      }
    }
  }

  const montar = (membro: MembroDaEquipe, visitados: ReadonlySet<string>): NoEquipe => {
    const id = membro.usuario.id;
    const equipe = visitados.has(id) ? undefined : porLider.get(id);
    const proximos = new Set(visitados).add(id);
    return {
      pessoa: membro.usuario,
      indicadores: membro.indicadores,
      aguardandoNovoLider: membro.aguardandoNovoLider,
      area: equipe?.area ?? membro.usuario.area,
      filhos: (equipe?.membros ?? [])
        .filter((filho) => filho.usuario.id !== id)
        .map((filho) => montar(filho, proximos)),
    };
  };

  return equipes
    .filter((equipe) => !aninhadas.has(equipe.lider.usuario.id))
    .map((equipe) => montar(equipe.lider, new Set()));
}

/** Soma dos números de todas as pessoas da árvore (cada pessoa uma vez). */
export interface ResumoEquipe {
  readonly pessoas: number;
  readonly atividadesPendentes: number;
  readonly atividadesAtrasadas: number;
  readonly negociosAbertos: number;
  readonly valorEmAberto: number;
  readonly aguardandoNovoLider: number;
}

export function resumirArvore(raizes: readonly NoEquipe[]): ResumoEquipe {
  const vistos = new Set<string>();
  const resumo = {
    pessoas: 0,
    atividadesPendentes: 0,
    atividadesAtrasadas: 0,
    negociosAbertos: 0,
    valorEmAberto: 0,
    aguardandoNovoLider: 0,
  };
  const visitar = (no: NoEquipe): void => {
    if (!vistos.has(no.pessoa.id)) {
      vistos.add(no.pessoa.id);
      resumo.pessoas += 1;
      resumo.atividadesPendentes += no.indicadores.atividadesPendentes;
      resumo.atividadesAtrasadas += no.indicadores.atividadesAtrasadas;
      resumo.negociosAbertos += no.indicadores.negociosAbertos;
      resumo.valorEmAberto += Number(no.indicadores.valorEmAberto) || 0;
      resumo.aguardandoNovoLider += no.aguardandoNovoLider ? 1 : 0;
    }
    no.filhos.forEach(visitar);
  };
  raizes.forEach(visitar);
  return resumo;
}
