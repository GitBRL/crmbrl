import type { Contato, Empresa } from './contatos.tipos';

/**
 * **Só para testes (specs).** Contato e empresa de exemplo, no formato da API. Nenhum código
 * do app importa isto.
 */

export function contatoDeTeste(ajustes: Partial<Contato> = {}): Contato {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Ana Beatriz Lopes',
    email: 'ana.lopes@clinica.example.com',
    telefone: '5541988771201',
    cargo: 'Diretora',
    empresa: { id: '22222222-2222-4222-8222-222222222222', nome: 'Clínica Vida Plena' },
    responsavel: { id: 'u1', nome: 'Mariana Costa', papel: 'MEMBRO', ativo: true },
    primeiraOrigem: { tipo: 'SITE', detalhe: null, utm: { source: 'google', medium: 'cpc' } },
    ultimaOrigem: {
      tipo: 'WEBHOOK',
      detalhe: 'Disparos BRL',
      utm: null,
      em: '2026-10-20T10:00:00Z',
    },
    conversoes: 2,
    etiquetas: ['Lead quente'],
    camposPersonalizados: {},
    optOutMarketing: false,
    optOutEm: null,
    consentimento: null,
    criadoPor: null,
    criadoEm: '2026-10-01T10:00:00Z',
    atualizadoEm: '2026-10-20T10:00:00Z',
    podeEditar: true,
    ...ajustes,
  };
}

export function empresaDeTeste(ajustes: Partial<Empresa> = {}): Empresa {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Clínica Vida Plena',
    cnpj: '11222333000181',
    cnpjFormatado: '11.222.333/0001-81',
    site: 'vidaplena.example.com.br',
    email: 'contato@vidaplena.example.com.br',
    telefone: '554130212202',
    segmento: 'Saúde',
    cidade: 'Curitiba',
    uf: 'PR',
    responsavel: { id: 'u2', nome: 'Juliana Alves', papel: 'MEMBRO', ativo: true },
    etiquetas: ['Cliente'],
    camposPersonalizados: {},
    quantidadeContatos: 2,
    criadoPor: null,
    criadoEm: '2026-10-01T10:00:00Z',
    atualizadoEm: '2026-10-20T10:00:00Z',
    podeEditar: false,
    ...ajustes,
  };
}
