import type {
  CriterioDaQualificacao,
  DecisaoDoSdr,
  EstadoDoSdr,
  QualificacaoDoSdr,
} from './sdr.tipos';

/** **Só para testes (specs).** Estados do SDR com IA prontos para ajustar. */

export function decisaoDeTeste(ajustes: Partial<DecisaoDoSdr> = {}): DecisaoDoSdr {
  return {
    id: 'd1',
    conversaId: 'c1',
    tipo: 'ASSUMIU',
    acao: null,
    titulo: 'A IA assumiu o atendimento deste lead',
    motivo: null,
    resumo: null,
    nota: null,
    temperatura: null,
    modo: 'AUTOMATICO',
    usuario: null,
    criadoEm: '2026-11-03T12:00:00.000Z',
    ...ajustes,
  };
}

export function criterioDeTeste(
  ajustes: Partial<CriterioDaQualificacao> = {},
): CriterioDaQualificacao {
  return {
    chave: 'curso',
    rotulo: 'Curso de interesse',
    tipo: 'TEXTO',
    obrigatorio: true,
    peso: 20,
    descoberto: true,
    valorFormatado: 'Direito',
    confianca: 0.9,
    origem: 'IA',
    destino: null,
    atualizadoEm: '2026-11-03T12:00:00.000Z',
    ...ajustes,
  };
}

export function qualificacaoDeTeste(ajustes: Partial<QualificacaoDoSdr> = {}): QualificacaoDoSdr {
  return {
    conversaId: 'c1',
    situacao: 'ATIVA',
    rotuloDaSituacao: 'IA atendendo',
    nota: 40,
    temperatura: 'MORNO',
    notaMinima: 70,
    faixas: { quente: 80, morno: 40 },
    resumo: null,
    motivo: null,
    negocioId: null,
    criterios: [
      criterioDeTeste(),
      criterioDeTeste({
        chave: 'cidade',
        rotulo: 'Cidade',
        obrigatorio: false,
        descoberto: false,
        valorFormatado: null,
        confianca: null,
        origem: null,
      }),
    ],
    faltamObrigatorios: [],
    atualizadoEm: '2026-11-03T12:00:00.000Z',
    ...ajustes,
  };
}

type AjustesDoEstado = Partial<Omit<EstadoDoSdr, 'acoes'>> & {
  acoes?: Partial<EstadoDoSdr['acoes']>;
};

/** O estado padrão: a IA atendendo no modo automático, sem sugestão. */
export function estadoSdrDeTeste(ajustes: AjustesDoEstado = {}): EstadoDoSdr {
  const { acoes, ...resto } = ajustes;
  return {
    conversaId: 'c1',
    situacao: 'ATIVA',
    rotuloDaSituacao: 'IA atendendo',
    ativa: true,
    modo: 'AUTOMATICO',
    humano: null,
    qualificacao: null,
    sugestao: null,
    decisoes: [],
    ...resto,
    acoes: {
      assumir: true,
      devolver: false,
      aprovarSugestao: false,
      descartarSugestao: false,
      ...acoes,
    },
  };
}

/** A IA nunca atendeu a conversa (resposta de `GET /sdr/conversas/:id`). */
export function estadoSdrSemIa(conversaId = 'c1'): EstadoDoSdr {
  return {
    conversaId,
    situacao: null,
    rotuloDaSituacao: null,
    ativa: false,
    modo: null,
    humano: null,
    qualificacao: null,
    sugestao: null,
    decisoes: [],
    acoes: { assumir: false, devolver: false, aprovarSugestao: false, descartarSugestao: false },
  };
}
