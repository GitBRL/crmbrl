import { formatarDuracao } from '../../../nucleo/ligacoes/ligacoes.textos';
import type {
  DirecaoLigacao,
  EstadoLigacao,
  FiltrosLigacoes,
  Ligacao,
} from '../../../nucleo/ligacoes/ligacoes.tipos';
import type { VarianteSelo } from '../../../ui/selo/selo';
import { destacarBusca, type PedacoDeTexto } from '../painel-ligacao/painel-ligacao.logica';

/** Como a ligação terminou, nas palavras da tela. */
export type ResultadoDaLigacao =
  'atendida' | 'perdida' | 'recusada' | 'sem_resposta' | 'falhou' | 'em_andamento';

export function resultadoDoEstado(estado: EstadoLigacao): ResultadoDaLigacao {
  switch (estado) {
    case 'ENCERRADA':
      return 'atendida';
    case 'PERDIDA':
      return 'perdida';
    case 'RECUSADA':
      return 'recusada';
    case 'SEM_RESPOSTA':
      return 'sem_resposta';
    case 'FALHOU':
      return 'falhou';
    default:
      return 'em_andamento';
  }
}

export const ROTULO_RESULTADO: Readonly<Record<ResultadoDaLigacao, string>> = {
  atendida: 'Atendida',
  perdida: 'Perdida',
  recusada: 'Recusada',
  sem_resposta: 'Sem resposta',
  falhou: 'Falhou',
  em_andamento: 'Em andamento',
};

export const VARIANTE_RESULTADO: Readonly<Record<ResultadoDaLigacao, VarianteSelo>> = {
  atendida: 'menta',
  perdida: 'coral',
  recusada: 'neutro',
  sem_resposta: 'neutro',
  falhou: 'coral',
  em_andamento: 'ciano',
};

export const ROTULO_DIRECAO: Readonly<Record<DirecaoLigacao, string>> = {
  RECEBIDA: 'Recebida',
  FEITA: 'Feita',
};

/** Situações do filtro (os estados da API, com os nomes da tela). */
export const SITUACOES_DO_FILTRO: readonly { id: EstadoLigacao; rotulo: string }[] = [
  { id: 'ENCERRADA', rotulo: 'Atendidas' },
  { id: 'PERDIDA', rotulo: 'Perdidas' },
  { id: 'RECUSADA', rotulo: 'Recusadas' },
  { id: 'SEM_RESPOSTA', rotulo: 'Sem resposta' },
  { id: 'FALHOU', rotulo: 'Falharam' },
  { id: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
];

export type PeriodoDoHistorico = '7' | '30' | '90' | 'todos' | 'outro';

export interface FiltrosDoHistorico {
  readonly periodo: PeriodoDoHistorico;
  /** AAAA-MM-DD (só vale em "Outro período"). */
  readonly de: string | null;
  readonly ate: string | null;
  readonly direcao: DirecaoLigacao | null;
  readonly situacoes: readonly string[];
  /** Uuid, ou `sem` (as perdidas, que não tiveram atendente). */
  readonly atendenteId: string | null;
  readonly filaId: string | null;
  readonly canalId: string | null;
  readonly busca: string;
}

export const FILTROS_INICIAIS: FiltrosDoHistorico = {
  periodo: '30',
  de: null,
  ate: null,
  direcao: null,
  situacoes: [],
  atendenteId: null,
  filaId: null,
  canalId: null,
  busca: '',
};

/** Quantos filtros além do período padrão estão ligados (o número do botão "Filtros"). */
export function filtrosLigados(filtros: FiltrosDoHistorico): number {
  return (
    (filtros.periodo !== FILTROS_INICIAIS.periodo ? 1 : 0) +
    (filtros.direcao ? 1 : 0) +
    (filtros.situacoes.length > 0 ? 1 : 0) +
    (filtros.atendenteId ? 1 : 0) +
    (filtros.filaId ? 1 : 0) +
    (filtros.canalId ? 1 : 0)
  );
}

function inicioDoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a!, m! - 1, d!, 0, 0, 0, 0).toISOString();
}

function fimDoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a!, m! - 1, d!, 23, 59, 59, 999).toISOString();
}

/** Filtros da tela em parâmetros do `GET /ligacoes` (datas pelo dia local de quem olha). */
export function paraParametros(
  filtros: FiltrosDoHistorico,
  agora: Date = new Date(),
): FiltrosLigacoes {
  let de: string | undefined;
  let ate: string | undefined;
  if (filtros.periodo === 'outro') {
    de = filtros.de ? inicioDoDia(filtros.de) : undefined;
    ate = filtros.ate ? fimDoDia(filtros.ate) : undefined;
  } else if (filtros.periodo !== 'todos') {
    const dias = Number(filtros.periodo);
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - (dias - 1));
    de = inicio.toISOString();
  }
  const busca = filtros.busca.trim().slice(0, 200);
  return {
    ...(de ? { de } : {}),
    ...(ate ? { ate } : {}),
    ...(filtros.direcao ? { direcao: filtros.direcao } : {}),
    ...(filtros.situacoes.length > 0 ? { situacao: filtros.situacoes.join(',') } : {}),
    ...(filtros.atendenteId ? { atendenteId: filtros.atendenteId } : {}),
    ...(filtros.filaId ? { filaId: filtros.filaId } : {}),
    ...(filtros.canalId ? { canalId: filtros.canalId } : {}),
    ...(busca ? { busca } : {}),
  };
}

/**
 * Palavras e frases que a busca procura (sem os operadores `-palavra` e `or`), para destacar
 * nos trechos. A busca da API ignora acento, maiúscula e flexão; o destaque só acerta a grafia.
 */
export function termosDaBusca(busca: string): readonly string[] {
  const termos: string[] = [];
  const re = /(-?)"([^"]+)"|(\S+)/g;
  let achado = re.exec(busca);
  while (achado) {
    if (achado[2] !== undefined) {
      if (achado[1] !== '-') {
        termos.push(achado[2].trim());
      }
    } else {
      const palavra = achado[3]!;
      if (!palavra.startsWith('-') && palavra.toLowerCase() !== 'or') {
        termos.push(palavra.replace(/^["']|["']$/g, ''));
      }
    }
    achado = re.exec(busca);
  }
  return termos.filter((termo) => termo.length > 0);
}

/** Parte o texto marcando todos os termos (um depois do outro, sem HTML). */
export function destacarTermos(texto: string, termos: readonly string[]): readonly PedacoDeTexto[] {
  let pedacos: readonly PedacoDeTexto[] = [{ texto, achado: false }];
  for (const termo of termos) {
    pedacos = pedacos.flatMap((pedaco) =>
      pedaco.achado ? [pedaco] : destacarBusca(pedaco.texto, termo),
    );
  }
  return pedacos;
}

/** Linha de resumo da ligação para leitor de tela e títulos: "Recebida, perdida, de Maria". */
export function descricaoDaLigacao(
  ligacao: Pick<Ligacao, 'direcao' | 'estado' | 'duracaoSegundos'> & {
    contato: { nome: string };
  },
): string {
  const resultado = ROTULO_RESULTADO[resultadoDoEstado(ligacao.estado)].toLowerCase();
  const duracao =
    ligacao.estado === 'ENCERRADA'
      ? `, ${formatarDuracao(ligacao.duracaoSegundos)} de duração`
      : '';
  return `${ROTULO_DIRECAO[ligacao.direcao]}, ${resultado}${duracao}, ${ligacao.contato.nome}`;
}
