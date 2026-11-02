import {
  type AcoesDaCampanha,
  type Campanha,
  CONTADORES_ZERADOS,
  type ResumoCampanha,
} from './disparos.tipos';

/** Fábricas para os specs dos Disparos (resumo, detalhe e ações). */

export const SEM_ACOES: AcoesDaCampanha = {
  editar: false,
  editarConteudo: false,
  iniciar: false,
  aprovar: false,
  reprovar: false,
  pausar: false,
  retomar: false,
  cancelar: false,
  reenviarFalhas: false,
  excluir: false,
  duplicar: false,
};

export function resumo(id: string, ajustes: Partial<ResumoCampanha> = {}): ResumoCampanha {
  return {
    id,
    nome: `Campanha ${id}`,
    descricao: null,
    area: 'COMERCIAL',
    canal: 'WHATSAPP',
    status: 'EM_ANDAMENTO',
    tipoPublico: 'SEGMENTO',
    importacaoId: null,
    modeloId: null,
    arquivo: null,
    agendadaPara: null,
    iniciadaEm: '2026-10-30T12:00:00.000Z',
    pausadaEm: null,
    pausaMotivo: null,
    concluidaEm: null,
    canceladaEm: null,
    proximoEnvioEm: null,
    aguardando: null,
    canais: [],
    contadores: { ...CONTADORES_ZERADOS, total: 10, pendentes: 6, enviados: 4 },
    progresso: 40,
    campanhaOrigemId: null,
    criadoPor: { id: 'u1', nome: 'Rafael Mendes' },
    criadoEm: '2026-10-30T11:00:00.000Z',
    atualizadoEm: '2026-10-30T12:00:00.000Z',
    acoes: { ...SEM_ACOES, pausar: true, cancelar: true, duplicar: true },
    ...ajustes,
  };
}

export function detalhe(id: string, ajustes: Partial<Campanha> = {}): Campanha {
  return {
    ...resumo(id),
    segmento: {
      condicoes: [{ campo: 'etiquetas', operador: 'contem_alguma', valor: ['Cliente'] }],
    },
    assunto: null,
    texto: 'Oi, {{contato.primeiro_nome}}!',
    ritmo: {
      intervaloMinimoSegundos: 20,
      intervaloMaximoSegundos: 60,
      loteTamanho: null,
      lotePausaSegundos: null,
      simularDigitando: true,
      pausarAposFalhas: 5,
    },
    janelaEnvio: null,
    aprovacao: { solicitadaEm: null, aprovadaEm: null, aprovadaPor: null, reprovacaoMotivo: null },
    ...ajustes,
  };
}
