import type { ColunaQuadro, Etapa, Funil, Negocio, Quadro, TipoEtapa } from './funis.tipos';

/**
 * **Só para testes (specs).** Funil, etapas, negócios e quadro de mentira, no formato da API.
 * Nenhum código do app importa isto.
 */

export const FUNIL_ID = 'funil-comercial';

export function etapaDeTeste(
  id: string,
  nome: string,
  ordem: number,
  tipo: TipoEtapa = 'ABERTA',
  extra: Partial<Etapa> = {},
): Etapa {
  return {
    id,
    funilId: FUNIL_ID,
    nome,
    ordem,
    tipo,
    prazoDias: tipo === 'ABERTA' ? 5 : null,
    probabilidade: null,
    ...extra,
  };
}

export const ETAPAS: readonly Etapa[] = [
  etapaDeTeste('novo', 'Novo', 1, 'ABERTA', { prazoDias: 1 }),
  etapaDeTeste('proposta', 'Proposta', 2, 'ABERTA', { prazoDias: 7, probabilidade: 60 }),
  etapaDeTeste('ganho', 'Ganho', 3, 'GANHO'),
  etapaDeTeste('perdido', 'Perdido', 4, 'PERDIDO'),
];

export function funilDeTeste(extra: Partial<Funil> = {}): Funil {
  return {
    id: FUNIL_ID,
    nome: 'Comercial',
    area: 'COMERCIAL',
    base: true,
    ordem: 1,
    ativo: true,
    descricao: null,
    etapas: ETAPAS,
    ...extra,
  };
}

export function negocioDeTeste(id: string, etapa: Etapa, extra: Partial<Negocio> = {}): Negocio {
  return {
    id,
    titulo: `Negócio ${id}`,
    status: etapa.tipo === 'GANHO' ? 'GANHO' : etapa.tipo === 'PERDIDO' ? 'PERDIDO' : 'ABERTO',
    valor: '1000.00',
    valorRecorrente: null,
    previsaoFechamento: null,
    motivoPerda: null,
    ganhoEm: null,
    perdidoEm: null,
    etapaDesde: '2026-10-20T12:00:00.000Z',
    diasNaEtapa: 1,
    parado: false,
    posicao: 0,
    origem: 'MANUAL',
    origemDetalhe: null,
    utm: null,
    reconversoes: 0,
    ultimaReconversaoEm: null,
    camposPersonalizados: {},
    negocioOrigemId: null,
    funil: { id: FUNIL_ID, nome: 'Comercial', area: 'COMERCIAL' },
    etapa: {
      id: etapa.id,
      nome: etapa.nome,
      tipo: etapa.tipo,
      ordem: etapa.ordem,
      prazoDias: etapa.prazoDias ?? null,
      probabilidade: etapa.probabilidade ?? null,
    },
    contato: {
      id: `contato-${id}`,
      nome: `Contato ${id}`,
      email: null,
      telefone: null,
      etiquetas: [],
    },
    empresa: null,
    responsavel: { id: 'u-lucas', nome: 'Lucas Pereira', avatarUrl: null },
    criadoPorId: null,
    criadoEm: '2026-10-20T12:00:00.000Z',
    atualizadoEm: '2026-10-20T12:00:00.000Z',
    ...extra,
  };
}

/** Colunas a partir de { etapaId: negócios } (totais e somas calculados). */
export function colunasDeTeste(
  porEtapa: Readonly<Record<string, readonly Negocio[]>>,
  etapas: readonly Etapa[] = ETAPAS,
): ColunaQuadro[] {
  return etapas.map((etapa) => {
    const negocios = porEtapa[etapa.id] ?? [];
    const soma = negocios.reduce(
      (total, negocio) => total + Math.round(Number(negocio.valor) * 100),
      0,
    );
    return {
      etapa,
      negocios,
      total: negocios.length,
      valorTotal: (soma / 100).toFixed(2),
      parados: negocios.filter((negocio) => negocio.parado).length,
      temMais: false,
    };
  });
}

export function quadroDeTeste(colunas: readonly ColunaQuadro[]): Quadro {
  return {
    funil: { id: FUNIL_ID, nome: 'Comercial', area: 'COMERCIAL' },
    ativo: true,
    colunas,
    total: colunas.reduce((total, coluna) => total + coluna.total, 0),
    valorTotal: '0.00',
  };
}
