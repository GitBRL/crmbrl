import type { Contrato, Parcela } from './financeiro.tipos';

/** Dados falsos para os specs do Financeiro (nenhum código do app importa isto). */
export function contrato(id: string, extra: Partial<Contrato> = {}): Contrato {
  return {
    id,
    numero: 12,
    codigo: 'C-000012',
    empresa: { id: 'e1', nome: 'Indústria Norte Ltda' },
    contato: { id: 'c1', nome: 'Paulo Henriques' },
    negocio: null,
    produto: 'Suporte Premium',
    descricao: null,
    valor: '6500.00',
    periodicidade: 'MENSAL',
    mrr: '6500.00',
    inicioEm: '2026-10-01',
    fimEm: null,
    renovacaoEm: '2027-10-01',
    renovacaoAutomatica: false,
    diaVencimento: 10,
    status: 'ATIVO',
    responsavelCs: { id: 'u1', nome: 'Fernanda Ribeiro' },
    canceladoEm: null,
    motivoCancelamento: null,
    encerradoEm: null,
    podeEditar: true,
    ...extra,
  };
}

export function parcela(id: string, extra: Partial<Parcela> = {}): Parcela {
  return {
    id,
    numero: 'T-0001',
    sequencia: 1,
    contrato: { id: 'k1', codigo: 'C-000012', produto: 'Suporte Premium' },
    contato: { id: 'c1', nome: 'Paulo Henriques', email: null, telefone: null },
    empresa: { id: 'e1', nome: 'Indústria Norte Ltda' },
    origem: null,
    descricao: null,
    vencimento: '2026-10-10',
    vencimentoOriginal: null,
    valor: '1500.00',
    valorPago: null,
    status: 'ATRASADO',
    statusGravado: 'ABERTO',
    diasEmAtraso: 21,
    faixaDeAtraso: '0-30',
    linkBoleto: null,
    linkPagamento: null,
    pix: null,
    pagoEm: null,
    formaPagamento: null,
    baixaOrigem: null,
    renegociadaParaId: null,
    promessaAte: null,
    podeEditar: true,
    ...extra,
  };
}
