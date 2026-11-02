import type { OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import type { Area, Perfil } from '../../nucleo/sessao/perfil';
import { ROTULO_AREA } from '../../nucleo/sessao/perfil';
import type {
  ColunaQuadro,
  Etapa,
  Negocio,
  PassagemDoFunil,
  RegraDoRodizio,
  ResultadoMovimentacao,
  StatusNegocio,
  TipoEtapa,
  Usuario,
  VisaoQuadro,
} from './funis.tipos';

/**
 * Regras do quadro que o front reflete (crmbrl-api/docs/REGRAS-DE-NEGOCIO.md §5 e §12):
 * movimentação otimista dos cartões, quem pode o quê no funil e os textos das passagens.
 * Funções puras, testadas em regras-funis.spec.ts.
 */

// Etapas e colunas ---------------------------------------------------------------------------

export function ehFechada(tipo: TipoEtapa): boolean {
  return tipo !== 'ABERTA';
}

export function statusDaEtapa(tipo: TipoEtapa): StatusNegocio {
  return tipo === 'GANHO' ? 'GANHO' : tipo === 'PERDIDO' ? 'PERDIDO' : 'ABERTO';
}

const PESO_TIPO: Readonly<Record<TipoEtapa, number>> = { ABERTA: 0, GANHO: 1, PERDIDO: 2 };

/** Abertas na ordem do funil; ganho e perda sempre no fim do quadro (TELAS §3.1). */
export function ordenarEtapas<T extends Pick<Etapa, 'tipo' | 'ordem'>>(etapas: readonly T[]): T[] {
  return [...etapas].sort((a, b) => PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo] || a.ordem - b.ordem);
}

export function ordenarColunas(colunas: readonly ColunaQuadro[]): ColunaQuadro[] {
  const etapas = ordenarEtapas(colunas.map((coluna) => coluna.etapa));
  return etapas.map((etapa) => colunas.find((coluna) => coluna.etapa.id === etapa.id)!);
}

/** Valores em centavos, para somar texto decimal sem erro de ponto flutuante. */
function centavos(valor: string | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function decimal(totalCentavos: number): string {
  return (totalCentavos / 100).toFixed(2);
}

export function somarValores(valores: readonly (string | null | undefined)[]): string {
  return decimal(valores.reduce((soma, valor) => soma + centavos(valor), 0));
}

/** Onde o cartão está (etapa e índice), ou `null`. */
export interface Lugar {
  readonly etapaId: string;
  readonly indice: number;
}

export function lugarDoNegocio(colunas: readonly ColunaQuadro[], negocioId: string): Lugar | null {
  for (const coluna of colunas) {
    const indice = coluna.negocios.findIndex((negocio) => negocio.id === negocioId);
    if (indice >= 0) {
      return { etapaId: coluna.etapa.id, indice };
    }
  }
  return null;
}

/** O negócio como fica ao entrar na etapa (antes da resposta da API). */
export function negocioNaEtapa(negocio: Negocio, etapa: Etapa): Negocio {
  if (negocio.etapa.id === etapa.id) {
    return negocio;
  }
  return {
    ...negocio,
    etapa: {
      id: etapa.id,
      nome: etapa.nome,
      tipo: etapa.tipo,
      ordem: etapa.ordem,
      prazoDias: etapa.prazoDias ?? null,
      probabilidade: etapa.probabilidade ?? null,
    },
    status: statusDaEtapa(etapa.tipo),
    etapaDesde: new Date().toISOString(),
    diasNaEtapa: 0,
    parado: false,
  };
}

function semNegocio(coluna: ColunaQuadro, negocio: Negocio): ColunaQuadro {
  return {
    ...coluna,
    negocios: coluna.negocios.filter((item) => item.id !== negocio.id),
    total: Math.max(0, coluna.total - 1),
    valorTotal: decimal(centavos(coluna.valorTotal) - centavos(negocio.valor)),
    parados: Math.max(0, coluna.parados - (negocio.parado ? 1 : 0)),
  };
}

function comNegocio(coluna: ColunaQuadro, negocio: Negocio, indice: number): ColunaQuadro {
  const negocios = [...coluna.negocios];
  negocios.splice(Math.max(0, Math.min(indice, negocios.length)), 0, negocio);
  return {
    ...coluna,
    negocios,
    total: coluna.total + 1,
    valorTotal: decimal(centavos(coluna.valorTotal) + centavos(negocio.valor)),
    parados: coluna.parados + (negocio.parado ? 1 : 0),
  };
}

/**
 * Move o cartão para `paraEtapaId`, na posição `indice` (contada sem o próprio cartão),
 * acertando quantidade, soma e parados das duas colunas. Devolve as colunas de antes se o
 * cartão ou a etapa não existirem.
 */
export function moverCartao(
  colunas: readonly ColunaQuadro[],
  negocioId: string,
  paraEtapaId: string,
  indice: number,
  substituto?: Negocio,
): readonly ColunaQuadro[] {
  const de = lugarDoNegocio(colunas, negocioId);
  const destino = colunas.find((coluna) => coluna.etapa.id === paraEtapaId);
  if (!de || !destino) {
    return colunas;
  }
  const atual = colunas.find((coluna) => coluna.etapa.id === de.etapaId)!.negocios[de.indice];
  const movido = substituto ?? negocioNaEtapa(atual, destino.etapa);
  if (de.etapaId === paraEtapaId) {
    return colunas.map((coluna) => {
      if (coluna.etapa.id !== paraEtapaId) {
        return coluna;
      }
      const negocios = coluna.negocios.filter((item) => item.id !== negocioId);
      negocios.splice(Math.max(0, Math.min(indice, negocios.length)), 0, movido);
      const valorTotal = decimal(
        centavos(coluna.valorTotal) - centavos(atual.valor) + centavos(movido.valor),
      );
      return { ...coluna, negocios, valorTotal };
    });
  }
  return colunas.map((coluna) => {
    if (coluna.etapa.id === de.etapaId) {
      return semNegocio(coluna, atual);
    }
    if (coluna.etapa.id === paraEtapaId) {
      return comNegocio(coluna, movido, indice);
    }
    return coluna;
  });
}

/**
 * Troca o negócio pela versão que a API devolveu: no mesmo lugar, se a etapa não mudou; senão
 * na etapa nova, pela posição. Sem o cartão no quadro (fora dos filtros), nada muda.
 */
export function substituirNegocio(
  colunas: readonly ColunaQuadro[],
  negocio: Negocio,
): readonly ColunaQuadro[] {
  const de = lugarDoNegocio(colunas, negocio.id);
  if (!de) {
    return colunas;
  }
  if (de.etapaId === negocio.etapa.id) {
    return moverCartao(colunas, negocio.id, de.etapaId, de.indice, negocio);
  }
  const destino = colunas.find((coluna) => coluna.etapa.id === negocio.etapa.id);
  if (!destino) {
    return removerNegocio(colunas, negocio.id);
  }
  const indice = destino.negocios.findIndex((item) => item.posicao > negocio.posicao);
  return moverCartao(
    colunas,
    negocio.id,
    destino.etapa.id,
    indice < 0 ? destino.negocios.length : indice,
    negocio,
  );
}

export function removerNegocio(
  colunas: readonly ColunaQuadro[],
  negocioId: string,
): readonly ColunaQuadro[] {
  const de = lugarDoNegocio(colunas, negocioId);
  if (!de) {
    return colunas;
  }
  return colunas.map((coluna) =>
    coluna.etapa.id === de.etapaId ? semNegocio(coluna, coluna.negocios[de.indice]) : coluna,
  );
}

/** Acrescenta um negócio novo na etapa dele, pela posição (ou no topo). */
export function incluirNegocio(
  colunas: readonly ColunaQuadro[],
  negocio: Negocio,
): readonly ColunaQuadro[] {
  if (lugarDoNegocio(colunas, negocio.id)) {
    return substituirNegocio(colunas, negocio);
  }
  return colunas.map((coluna) => {
    if (coluna.etapa.id !== negocio.etapa.id) {
      return coluna;
    }
    const indice = coluna.negocios.findIndex((item) => item.posicao > negocio.posicao);
    return comNegocio(coluna, negocio, indice < 0 ? coluna.negocios.length : indice);
  });
}

/** Vizinhos na etapa de destino, para a API calcular a posição (`depoisDeId`/`antesDeId`). */
export function vizinhos(
  colunas: readonly ColunaQuadro[],
  negocioId: string,
): { depoisDeId?: string; antesDeId?: string } {
  const lugar = lugarDoNegocio(colunas, negocioId);
  if (!lugar) {
    return {};
  }
  const negocios = colunas.find((coluna) => coluna.etapa.id === lugar.etapaId)!.negocios;
  const acima = negocios[lugar.indice - 1];
  const abaixo = negocios[lugar.indice + 1];
  return {
    ...(acima ? { depoisDeId: acima.id } : {}),
    ...(abaixo ? { antesDeId: abaixo.id } : {}),
  };
}

// Permissões (matriz §12) ----------------------------------------------------------------------

function alcanca(escopo: string | undefined, perfil: Perfil, area: Area): boolean {
  return escopo === 'TODOS' || (escopo === 'AREA' && perfil.usuario.area === area);
}

/** Criar, renomear, reordenar e remover etapas: Admin, C-level e o líder da área (R5.1). */
export function podeConfigurarFunil(perfil: Perfil | null, area: Area): boolean {
  return !!perfil && alcanca(perfil.permissoes.configurarFunis, perfil, area);
}

/** Reabrir ganho/perdido (e tirar de etapa fechada): líder da área, C-level e Admin (R5.5). */
export function podeReabrir(perfil: Perfil | null, area: Area): boolean {
  return !!perfil && alcanca(perfil.permissoes.reabrirNegocios, perfil, area);
}

/** Responsável de negócio do funil: alguém da área, C-level ou Admin (R5.9). */
export function podeSerResponsavel(
  usuario: Pick<Usuario, 'area' | 'nivel'> | null | undefined,
  area: Area,
): boolean {
  if (!usuario) {
    return false;
  }
  return (
    usuario.nivel === 'ADMINISTRADOR' || usuario.nivel === 'DIRETORIA' || usuario.area === area
  );
}

/** Filtros "Meus · Da equipe · Todos" conforme o papel (o que não vale fica com o motivo). */
export function opcoesDeVisao(perfil: Perfil | null): OpcaoFiltro[] {
  const nivel = perfil?.usuario.nivel;
  const temEquipe = nivel === 'LIDER' || nivel === 'DIRETORIA';
  const membro = nivel === 'MEMBRO';
  return [
    { id: 'MEUS', rotulo: 'Meus' },
    {
      id: 'EQUIPE',
      rotulo: 'Da equipe',
      desabilitada: !temEquipe,
      motivo: temEquipe ? undefined : 'Só líderes e C-level têm equipe.',
    },
    {
      id: 'TODOS',
      rotulo: membro ? 'Todos que vejo' : 'Todos',
    },
  ];
}

export function ehVisao(valor: string | null | undefined): valor is VisaoQuadro {
  return valor === 'MEUS' || valor === 'EQUIPE' || valor === 'TODOS';
}

// Textos ------------------------------------------------------------------------------------

/** Comercial e CS mostram a soma dos valores por coluna; o Marketing conta leads. */
export function mostraValores(area: Area): boolean {
  return area !== 'MARKETING';
}

export const FRASE_DO_FUNIL: Readonly<Record<Area, string>> = {
  MARKETING: 'Acompanhe cada lead até virar uma oportunidade qualificada.',
  COMERCIAL: 'Acompanhe cada oportunidade até o fechamento.',
  CS: 'Acompanhe cada cliente da chegada à renovação.',
};

/** Nome do item no funil ("lead" no Marketing, "negócio" nos outros), para os textos. */
export function nomeDoItem(area: Area, plural = false): string {
  if (area === 'MARKETING') {
    return plural ? 'leads' : 'lead';
  }
  return plural ? 'negócios' : 'negócio';
}

/**
 * Dicas do cabeçalho quando o papel não lê a configuração (membros; a liderança não lê as
 * passagens): a configuração **padrão**, em frases condicionais, dizendo onde conferir. Quem
 * lê a configuração vê as dicas montadas dos dados (`dicaDasPassagens`, `dicaDoRodizio`).
 */
export const DICAS_DO_FUNIL: Readonly<Record<Area, { passagens: string; rodizio: string }>> = {
  MARKETING: {
    passagens:
      'Na configuração padrão, quando um lead entra em “Qualificado (MQL)”, o CRM cria sozinho um negócio no funil Comercial, com o mesmo contato e a mesma origem: uma única vez por lead e só enquanto a passagem estiver ligada. Admin e C-level ligam, desligam e escolhem quem recebe em Configurações › Passagens.',
    rodizio:
      'Os leads dos webhooks configurados com rodízio vão para a próxima pessoa da fila de Marketing, na ordem (cada webhook escolhe quem fica com o lead: rodízio, responsável fixo ou líder da área). Se a liderança entra na fila depende da configuração da área. Sem ninguém na fila, o lead vai para o líder da área. A liderança confere em Configurações › Distribuição.',
  },
  COMERCIAL: {
    passagens:
      'Na configuração padrão, chegam aqui, na etapa Novo, os leads qualificados (MQL) no Marketing; e, quando um negócio é ganho, o CRM cria sozinho um negócio no Customer Success, com o valor e o valor recorrente. Cada passagem roda uma única vez por negócio e só enquanto estiver ligada. Admin e C-level conferem em Configurações › Passagens.',
    rodizio:
      'Os negócios que chegam por uma passagem ou por um webhook configurados com rodízio vão para a próxima pessoa da fila Comercial, na ordem (cada um escolhe quem recebe: rodízio, responsável fixo ou líder da área). Se a liderança entra na fila depende da configuração da área. Sem ninguém na fila, vão para o líder da área. A liderança confere em Configurações › Distribuição.',
  },
  CS: {
    passagens:
      'Na configuração padrão, cada negócio ganho no Comercial chega aqui na etapa Boas-vindas, com o mesmo contato, a empresa, o valor e o valor recorrente: uma única vez por negócio e só enquanto a passagem estiver ligada. Admin e C-level conferem em Configurações › Passagens.',
    rodizio:
      'Os clientes que chegam por uma passagem ou por um webhook configurados com rodízio vão para a próxima pessoa da fila de Customer Success, na ordem (cada um escolhe quem recebe: rodízio, responsável fixo ou líder da área). Se a liderança entra na fila depende da configuração da área. Sem ninguém na fila, vão para o líder da área. A liderança confere em Configurações › Distribuição.',
  },
};

/** "pelo rodízio de Comercial", "aos cuidados de Rafael Mendes", "aos cuidados do líder de CS". */
function quemRecebeNaPassagem(passagem: PassagemDoFunil): string {
  const area = ROTULO_AREA[passagem.funilDestino.area];
  switch (passagem.estrategia) {
    case 'RODIZIO':
      return `pelo rodízio de ${area}`;
    case 'RESPONSAVEL_FIXO':
      return passagem.responsavelFixo
        ? `aos cuidados de ${passagem.responsavelFixo.nome}`
        : 'com um responsável fixo';
    case 'LIDER_DA_AREA':
      return `aos cuidados do líder de ${area}`;
  }
}

/**
 * Dica "Passagens" montada da configuração (`GET /passagens`): o que chega a este funil e o
 * que sai dele, quem recebe e se a passagem está desligada agora.
 */
export function dicaDasPassagens(
  area: Area,
  funilId: string | null,
  passagens: readonly PassagemDoFunil[],
): string {
  const desteFunil = (funil: { id: string; area: Area }) =>
    funilId ? funil.id === funilId : funil.area === area;
  const desligada = (passagem: PassagemDoFunil) =>
    passagem.ativa ? '' : ' Esta passagem está desligada no momento: nada passa por ela.';
  const frases: string[] = [];
  for (const passagem of passagens.filter((item) => desteFunil(item.funilDestino))) {
    const itens = nomeDoItem(passagem.funilOrigem.area, true);
    frases.push(
      `Chegam aqui, em “${passagem.etapaDestino.nome}”, os ${itens} que entram em “${passagem.etapaGatilho.nome}” no funil ${passagem.funilOrigem.nome}, ${quemRecebeNaPassagem(passagem)}.${desligada(passagem)}`,
    );
  }
  for (const passagem of passagens.filter((item) => desteFunil(item.funilOrigem))) {
    const item = nomeDoItem(area);
    frases.push(
      `Quando um ${item} entra em “${passagem.etapaGatilho.nome}”, o CRM cria sozinho um negócio no funil ${passagem.funilDestino.nome}, em “${passagem.etapaDestino.nome}”, ${quemRecebeNaPassagem(passagem)}.${desligada(passagem)}`,
    );
  }
  if (!frases.length) {
    return 'Nenhuma passagem automática chega a este funil nem sai dele. Admin e C-level criam e ajustam as passagens em Configurações › Passagens.';
  }
  return `${frases.join(' ')} Cada passagem roda uma única vez por negócio. Ajuste em Configurações › Passagens.`;
}

/**
 * Dica "Rodízio" montada da regra da área (`GET /regras-distribuicao`): quantas pessoas estão
 * na fila agora e se a liderança entra (R5.8).
 */
export function dicaDoRodizio(area: Area, regra: RegraDoRodizio): string {
  const itens = nomeDoItem(area, true);
  const quantos = regra.participantes.length;
  const fila =
    quantos === 0
      ? `Hoje a fila de ${ROTULO_AREA[area]} está vazia: o que chegar por rodízio vai para o líder da área (sem líder, para um C-level).`
      : `Hoje ${quantos === 1 ? 'há 1 pessoa' : `há ${quantos} pessoas`} na fila de ${ROTULO_AREA[area]}, ${regra.incluirLideres ? 'contando a liderança' : 'sem a liderança'}.`;
  return `Os ${itens} que chegam por rodízio vão para a próxima pessoa da fila, na ordem. ${fila} Só entram pelo rodízio os webhooks e as passagens configurados assim: cada um escolhe quem recebe (rodízio, responsável fixo ou líder da área). Quem participa fica em Configurações › Distribuição.`;
}

// O tempo na etapa ("12 d", "ontem", "hoje") é do núcleo: o detalhe do contato usa o mesmo.
export { rotuloDias } from '../../nucleo/formatos';

export function textoPrazo(etapa: Pick<Etapa, 'nome' | 'prazoDias'>): string | null {
  if (!etapa.prazoDias) {
    return null;
  }
  const dias = etapa.prazoDias === 1 ? '1 dia' : `${etapa.prazoDias} dias`;
  return `Prazo-alvo: ${dias} em “${etapa.nome}”. Depois disso o negócio aparece como parado, com o selo coral.`;
}

/** Nome do funil de destino de uma passagem: o visível, senão o que vem depois de "→". */
export function nomeDoDestino(
  passagem: { nome: string; funilDestinoId: string },
  nomesDosFunis: ReadonlyMap<string, string>,
): string {
  const visivel = nomesDosFunis.get(passagem.funilDestinoId);
  if (visivel) {
    return visivel;
  }
  const depoisDaSeta = passagem.nome.split('→')[1]?.trim();
  return depoisDaSeta || 'outro funil';
}

export interface MensagemMovimentacao {
  readonly tipo: 'sucesso' | 'info';
  readonly mensagem: string;
  /** Negócio criado (ou reconvertido) no destino, para "Ver negócio". */
  readonly destino?: { readonly funilId: string; readonly negocioId: string };
}

/**
 * O aviso depois de soltar (TELAS §3.1): ganho com passagem → "Negócio ganho! Enviado ao
 * Customer Success"; MQL no Marketing → "Lead qualificado enviado ao Comercial"; perda,
 * reposição e movimento comum.
 */
export function mensagemDaMovimentacao(
  resultado: ResultadoMovimentacao,
  mudouDeEtapa: boolean,
  nomesDosFunis: ReadonlyMap<string, string> = new Map(),
): MensagemMovimentacao {
  const { negocio, passagens } = resultado;
  const marketing = negocio.funil.area === 'MARKETING';
  const passagem = passagens[0];
  const destino = passagem
    ? { funilId: passagem.funilDestinoId, negocioId: passagem.negocioDestinoId }
    : undefined;
  const nomeDestino = passagem ? nomeDoDestino(passagem, nomesDosFunis) : '';
  // Sem parênteses: o nome da pessoa pode ter os seus ("Renata Vieira (férias)").
  const comQuem =
    passagem?.criado && passagem.responsavel
      ? `, aos cuidados de ${passagem.responsavel.nome}`
      : '';

  if (!mudouDeEtapa) {
    return {
      tipo: 'info',
      mensagem: `“${negocio.titulo}” reposicionado em ${negocio.etapa.nome}.`,
    };
  }
  if (negocio.etapa.tipo === 'GANHO') {
    const inicio = marketing ? 'Lead qualificado' : 'Negócio ganho!';
    if (!passagem) {
      return { tipo: 'sucesso', mensagem: marketing ? 'Lead qualificado!' : 'Negócio ganho!' };
    }
    if (passagem.reconversao) {
      return {
        tipo: 'sucesso',
        mensagem: `${inicio}${marketing ? '!' : ''} O contato já tinha um negócio aberto no ${nomeDestino}: registramos a reconversão nele.`,
        destino,
      };
    }
    return {
      tipo: 'sucesso',
      mensagem: marketing
        ? `Lead qualificado enviado ao ${nomeDestino}${comQuem}.`
        : `Negócio ganho! Enviado ao ${nomeDestino}${comQuem}.`,
      destino,
    };
  }
  if (negocio.etapa.tipo === 'PERDIDO') {
    return {
      tipo: 'info',
      mensagem: marketing
        ? `Lead “${negocio.titulo}” descartado.`
        : `Negócio “${negocio.titulo}” marcado como perdido.`,
    };
  }
  if (passagem) {
    return {
      tipo: 'sucesso',
      mensagem: `Movido para ${negocio.etapa.nome} e enviado ao ${nomeDestino}${comQuem}.`,
      destino,
    };
  }
  return { tipo: 'sucesso', mensagem: `“${negocio.titulo}” movido para ${negocio.etapa.nome}.` };
}

export { ROTULO_AREA };
