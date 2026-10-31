import type {
  Segmento,
  CondicaoSegmento,
  OperadorSegmento,
} from '../../ui/construtor-segmento/segmento';
import { type Agenda, agendaPadrao, type FrequenciaAgenda } from '../../ui/seletor-agenda/agenda';
import {
  type DiaSemana,
  FUSO_PADRAO,
  type JanelaEnvio,
} from '../../ui/seletor-janela-envio/janela-envio';
import { gerarId } from '../../ui/tipos';
import type { TipoGatilho } from './automacoes.tipos';

/**
 * Conversões entre os modelos de tela (construtor de segmento, seletor de janela, seletor de
 * agenda) e o formato JSON da API (`src/comum/segmentos`, `horario_atendimento`, `gatilhoConfig`).
 * Funções puras. Quando o JSON da API tem algo que a tela não sabe mostrar, o retorno diz
 * (`completo: false`) e quem chama mantém o original até a pessoa trocar por algo simples.
 */

// --- Segmento -----------------------------------------------------------------------------------

interface CondicaoApi {
  campo: string;
  operador: string;
  valor?: unknown;
}

interface SegmentoApi {
  combinacao?: 'todas' | 'qualquer';
  condicoes: (CondicaoApi | { grupo: SegmentoApi })[];
}

function umaCondicaoParaApi(c: CondicaoSegmento): CondicaoApi | null {
  const valor = c.valor;
  const op: OperadorSegmento = c.operador;
  switch (c.campo) {
    case 'etiqueta':
      if (valor === null || valor === '') return null;
      return {
        campo: 'etiquetas',
        operador: op === 'nao-e' ? 'nao_contem' : 'contem_alguma',
        valor: [String(valor)],
      };
    case 'origem':
      if (valor === null || valor === '') return null;
      return {
        campo: 'origem',
        operador: op === 'nao-e' ? 'fora_de' : 'em',
        valor: [String(valor)],
      };
    case 'responsavel':
      if (op === 'vazio' || op === 'preenchido') {
        return { campo: 'responsavel', operador: op };
      }
      if (valor === null || valor === '') return null;
      return {
        campo: 'responsavel',
        operador: op === 'nao-e' ? 'fora_de' : 'em',
        valor: [String(valor)],
      };
    case 'email':
    case 'telefone':
      return { campo: c.campo, operador: op === 'vazio' ? 'vazio' : 'preenchido' };
    case 'criado_em':
    case 'ultima_interacao_em':
      if (op === 'ultimos-dias' || op === 'ha-mais-de-dias') {
        if (valor === null || valor === '') return null;
        return {
          campo: c.campo,
          operador: op === 'ultimos-dias' ? 'ultimos_dias' : 'mais_de_dias',
          valor: Number(valor),
        };
      }
      if (op === 'antes' || op === 'depois') {
        if (!valor) return null;
        return { campo: c.campo, operador: op, valor: String(valor) };
      }
      return null;
    case 'opt_out':
      return { campo: 'opt_out', operador: 'igual', valor: op === 'sim' };
    case 'negocio':
      return { campo: 'negocio', operador: op === 'sim' ? 'tem' : 'nao_tem', valor: {} };
    default:
      return null;
  }
}

/** Segmento da tela → JSON da API. Condições incompletas ficam de fora. */
export function segmentoParaApi(segmento: Segmento): SegmentoApi {
  const condicoes = segmento.condicoes
    .map(umaCondicaoParaApi)
    .filter((c): c is CondicaoApi => c !== null);
  return { combinacao: segmento.combinacao === 'qualquer' ? 'qualquer' : 'todas', condicoes };
}

function umaCondicaoDaApi(c: CondicaoApi): CondicaoSegmento | null {
  const id = gerarId('cond');
  const lista = Array.isArray(c.valor) ? c.valor : null;
  const unico = lista && lista.length === 1 ? String(lista[0]) : null;
  switch (c.campo) {
    case 'etiquetas':
      if (unico !== null && (c.operador === 'contem_alguma' || c.operador === 'nao_contem')) {
        return {
          id,
          campo: 'etiqueta',
          operador: c.operador === 'nao_contem' ? 'nao-e' : 'e',
          valor: unico,
        };
      }
      return null;
    case 'origem':
      if (unico !== null && (c.operador === 'em' || c.operador === 'fora_de')) {
        return {
          id,
          campo: 'origem',
          operador: c.operador === 'fora_de' ? 'nao-e' : 'e',
          valor: unico,
        };
      }
      return null;
    case 'responsavel':
      if (c.operador === 'vazio' || c.operador === 'preenchido') {
        return { id, campo: 'responsavel', operador: c.operador, valor: null };
      }
      if (unico !== null && (c.operador === 'em' || c.operador === 'fora_de')) {
        return {
          id,
          campo: 'responsavel',
          operador: c.operador === 'fora_de' ? 'nao-e' : 'e',
          valor: unico,
        };
      }
      return null;
    case 'email':
    case 'telefone':
      if (c.operador === 'vazio' || c.operador === 'preenchido') {
        return { id, campo: c.campo, operador: c.operador, valor: null };
      }
      return null;
    case 'criado_em':
    case 'ultima_interacao_em':
      if (c.operador === 'ultimos_dias' || c.operador === 'mais_de_dias') {
        return {
          id,
          campo: c.campo,
          operador: c.operador === 'ultimos_dias' ? 'ultimos-dias' : 'ha-mais-de-dias',
          valor: Number(c.valor),
        };
      }
      if ((c.operador === 'antes' || c.operador === 'depois') && typeof c.valor === 'string') {
        return { id, campo: c.campo, operador: c.operador, valor: c.valor.slice(0, 10) };
      }
      return null;
    case 'opt_out':
      if (c.operador === 'igual' && typeof c.valor === 'boolean') {
        return { id, campo: 'opt_out', operador: c.valor ? 'sim' : 'nao', valor: null };
      }
      return null;
    case 'negocio':
      if (
        (c.operador === 'tem' || c.operador === 'nao_tem') &&
        (c.valor === undefined || Object.keys((c.valor as object) ?? {}).length === 0)
      ) {
        return {
          id,
          campo: 'negocio',
          operador: c.operador === 'tem' ? 'sim' : 'nao',
          valor: null,
        };
      }
      return null;
    default:
      return null;
  }
}

/** JSON da API → segmento da tela. `completo: false` = há filtros que a tela não mostra. */
export function segmentoDaApi(api: unknown): { segmento: Segmento; completo: boolean } {
  const bruto = api as SegmentoApi | null | undefined;
  if (!bruto || !Array.isArray(bruto.condicoes)) {
    return { segmento: { combinacao: 'todos', condicoes: [] }, completo: true };
  }
  const condicoes: CondicaoSegmento[] = [];
  let completo = true;
  for (const c of bruto.condicoes) {
    const convertida = 'grupo' in c ? null : umaCondicaoDaApi(c);
    if (convertida) {
      condicoes.push(convertida);
    } else {
      completo = false;
    }
  }
  return {
    segmento: { combinacao: bruto.combinacao === 'qualquer' ? 'qualquer' : 'todos', condicoes },
    completo,
  };
}

/** Segmento sem nenhuma condição não filtra nada: a API recebe "sem segmento". */
export function segmentoTemCondicoes(s: unknown): boolean {
  const bruto = s as SegmentoApi | null | undefined;
  return !!bruto && Array.isArray(bruto.condicoes) && bruto.condicoes.length > 0;
}

// --- Horário (janela) ---------------------------------------------------------------------------

interface HorarioApi {
  fusoHorario?: string;
  dias?: Record<string, { inicio: string; fim: string }[]>;
}

export function janelaParaHorario(janela: JanelaEnvio): HorarioApi {
  const dias: Record<string, { inicio: string; fim: string }[]> = {};
  for (const dia of janela.dias) {
    dias[String(dia)] = [{ inicio: janela.inicio, fim: janela.fim }];
  }
  return { fusoHorario: janela.fuso || FUSO_PADRAO, dias };
}

/** `null` quando o horário tem faixas diferentes por dia (a tela só edita uma faixa). */
export function horarioParaJanela(api: unknown): JanelaEnvio | null {
  const h = api as HorarioApi | null | undefined;
  if (!h?.dias) return null;
  const entradas = Object.entries(h.dias).filter(([, f]) => Array.isArray(f) && f.length > 0);
  if (entradas.length === 0) return null;
  const [, primeira] = entradas[0];
  if (
    entradas.some(
      ([, f]) =>
        f.length !== 1 || f[0].inicio !== primeira[0].inicio || f[0].fim !== primeira[0].fim,
    )
  ) {
    return null;
  }
  return {
    dias: entradas.map(([d]) => Number(d) as DiaSemana).sort((a, b) => a - b),
    inicio: primeira[0].inicio,
    fim: primeira[0].fim,
    fuso: h.fusoHorario || FUSO_PADRAO,
  };
}

// --- Gatilho ------------------------------------------------------------------------------------

export type FiltrosGatilho = Readonly<Record<string, string | number | null>>;

const FILTROS_NUMERICOS = new Set([
  'diasAlemDoPrazo',
  'horasAlemDoVencimento',
  'notaMinima',
  'notaMaxima',
]);

/** Filtros da tela (texto/número) → `gatilhoConfig` de EVENTO. */
export function filtrosParaConfig(filtros: FiltrosGatilho): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === null || valor === undefined || String(valor).trim() === '') continue;
    if (chave === 'palavras') {
      const palavras = String(valor)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (palavras.length) config[chave] = palavras;
    } else if (FILTROS_NUMERICOS.has(chave)) {
      config[chave] = Number(valor);
    } else {
      config[chave] = String(valor);
    }
  }
  return config;
}

export function configParaFiltros(
  config: Record<string, unknown> | null | undefined,
): FiltrosGatilho {
  const filtros: Record<string, string | number | null> = {};
  for (const [chave, valor] of Object.entries(config ?? {})) {
    if (Array.isArray(valor)) filtros[chave] = valor.join(', ');
    else if (typeof valor === 'number') filtros[chave] = valor;
    else if (typeof valor === 'string') filtros[chave] = valor;
  }
  return filtros;
}

/** Agenda (recorrente ou relativa) → `gatilhoConfig`. */
export function agendaParaConfig(tipo: TipoGatilho, agenda: Agenda): Record<string, unknown> {
  if (tipo === 'RECORRENCIA') {
    const base: Record<string, unknown> = { frequencia: agenda.frequencia, hora: agenda.hora };
    if (agenda.frequencia === 'semanal') base['diasDaSemana'] = [...agenda.diasSemana];
    if (agenda.frequencia === 'mensal') base['diaDoMes'] = agenda.diaMes;
    return base;
  }
  return {
    campo: agenda.campo,
    dias: agenda.sentido === 'antes' ? -Math.abs(agenda.quantidade) : Math.abs(agenda.quantidade),
    hora: agenda.hora,
  };
}

export function configParaAgenda(
  tipo: TipoGatilho,
  config: Record<string, unknown> | null | undefined,
): Agenda {
  const c = config ?? {};
  if (tipo === 'RECORRENCIA') {
    const freq = (['diaria', 'semanal', 'mensal'] as const).includes(
      c['frequencia'] as FrequenciaAgenda,
    )
      ? (c['frequencia'] as FrequenciaAgenda)
      : 'semanal';
    return {
      ...agendaPadrao('recorrente'),
      frequencia: freq,
      hora: typeof c['hora'] === 'string' ? c['hora'] : '09:00',
      diasSemana: Array.isArray(c['diasDaSemana']) ? (c['diasDaSemana'] as DiaSemana[]) : [1],
      diaMes: typeof c['diaDoMes'] === 'number' ? c['diaDoMes'] : 1,
    };
  }
  const dias = typeof c['dias'] === 'number' ? c['dias'] : -3;
  return {
    ...agendaPadrao('relativa'),
    campo: typeof c['campo'] === 'string' ? c['campo'] : null,
    quantidade: Math.abs(dias),
    sentido: dias < 0 ? 'antes' : 'depois',
    hora: typeof c['hora'] === 'string' ? c['hora'] : '09:00',
  };
}
