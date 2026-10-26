import type { CanalDoAtendimento, Fila, RespostaRapida } from './atendimento.modelos';

/**
 * **Só para testes (specs) de Configurações → Atendimento.** Filas, canais e respostas falsos no
 * formato da API.
 */

export function fila(ajustes: Partial<Fila> = {}): Fila {
  return {
    id: 'f-com',
    chave: null,
    nome: 'Comercial — WhatsApp',
    area: 'COMERCIAL',
    descricao: null,
    slaPrimeiraRespostaMinutos: 15,
    slaResolucaoMinutos: 1440,
    estrategia: 'RODIZIO',
    ativa: true,
    modoParticipantes: 'AREA',
    pessoas: [
      {
        id: 'u-lucas',
        nome: 'Lucas Pereira',
        avatarUrl: null,
        papel: 'COMERCIAL',
        participa: true,
        motivo: 'AREA',
        emAberto: 2,
      },
      {
        id: 'u-juliana',
        nome: 'Juliana Alves',
        avatarUrl: null,
        papel: 'COMERCIAL',
        participa: true,
        motivo: 'AREA',
        emAberto: 0,
      },
      {
        id: 'u-rafael',
        nome: 'Rafael Mendes',
        avatarUrl: null,
        papel: 'LIDER_COMERCIAL',
        participa: false,
        motivo: 'LIDER',
        emAberto: 0,
      },
    ],
    proximo: { id: 'u-juliana', nome: 'Juliana Alves', avatarUrl: null },
    canais: [{ id: 'c-wa-1', tipo: 'WHATSAPP', nome: 'Comercial — principal', ativo: true }],
    conversasEmAberto: 3,
    conversasSemResponsavel: 1,
    podeEditar: true,
    criadoEm: '2026-10-20T12:00:00.000Z',
    atualizadoEm: '2026-10-20T12:00:00.000Z',
    ...ajustes,
  };
}

export function canalDoAtendimento(ajustes: Partial<CanalDoAtendimento> = {}): CanalDoAtendimento {
  return {
    id: 'c-wa-1',
    tipo: 'WHATSAPP',
    nome: 'Comercial — principal',
    ativo: true,
    disponivel: true,
    filaPadrao: { id: 'f-com', nome: 'Comercial — WhatsApp', area: 'COMERCIAL' },
    horarioAtendimento: null,
    situacaoHorario: { aberto: true, proximaAbertura: null, proximoFechamento: null },
    mensagemForaHorario: null,
    pesquisaSatisfacao: false,
    mensagemSatisfacao: null,
    perguntaPadrao:
      'Como você avalia o nosso atendimento? Responda com uma nota de 1 (ruim) a 5 (ótimo).',
    conversasEmAberto: 3,
    ultimoErro: null,
    ultimoErroEm: null,
    podeEditar: true,
    ...ajustes,
  };
}

export function resposta(ajustes: Partial<RespostaRapida> = {}): RespostaRapida {
  return {
    id: 'r-1',
    atalho: 'boas-vindas',
    titulo: 'Boas-vindas',
    texto: '{{saudacao}}, {{contato.primeiroNome}}! Sou {{usuario.primeiroNome}}, da BRL.',
    area: null,
    arquivo: null,
    ativa: true,
    variaveis: ['saudacao', 'contato.primeiroNome', 'usuario.primeiroNome'],
    criadoPor: { id: 'u-admin', nome: 'Administrador', avatarUrl: null },
    podeEditar: true,
    criadoEm: '2026-10-20T12:00:00.000Z',
    atualizadoEm: '2026-10-20T12:00:00.000Z',
    ...ajustes,
  };
}

export const VARIAVEIS = [
  { nome: 'contato.nome', descricao: 'Nome completo do contato', exemplo: 'Maria Souza' },
  { nome: 'contato.primeiroNome', descricao: 'Primeiro nome do contato', exemplo: 'Maria' },
  {
    nome: 'usuario.primeiroNome',
    descricao: 'Primeiro nome de quem está atendendo',
    exemplo: 'Ana',
  },
  {
    nome: 'saudacao',
    descricao: '"Bom dia", "Boa tarde" ou "Boa noite", pela hora',
    exemplo: 'Boa tarde',
  },
];
