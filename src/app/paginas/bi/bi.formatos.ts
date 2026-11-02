import { abreviarNumero } from '../../nucleo/formatos';
import type { Cartao, LinhaBi, TipoColuna, UnidadeCartao } from './bi.tipos';

const LOCALE = 'pt-BR';

/** Rótulos dos códigos que a API devolve nas tabelas (o resto aparece como veio). */
export const ROTULO_ORIGEM: Readonly<Record<string, string>> = {
  SITE: 'Site',
  WEBHOOK: 'Webhook',
  IMPORTACAO: 'Importação',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Messenger',
  INDICACAO: 'Indicação',
  MANUAL: 'Cadastro manual',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  WEBCHAT: 'Chat do site',
  PASSAGEM: 'Passagem entre funis',
  OUTRO: 'Outra',
};

export const ROTULO_STATUS_CAMPANHA: Readonly<Record<string, string>> = {
  RASCUNHO: 'Rascunho',
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADA: 'Pausada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

/** Colunas de texto cujo valor é um código da API. */
const ROTULO_FAIXA: Readonly<Record<string, string>> = {
  '0-30': 'Até 30 dias',
  '31-60': '31 a 60 dias',
  '61-90': '61 a 90 dias',
  '90+': 'Mais de 90 dias',
};

const CODIGOS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  faixa: ROTULO_FAIXA,
  origem: ROTULO_ORIGEM,
  canal: ROTULO_ORIGEM,
  tipo: ROTULO_ORIGEM,
  status: ROTULO_STATUS_CAMPANHA,
};

const numero = (valor: number, maximo = 2, minimo = 0) =>
  new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: maximo,
    minimumFractionDigits: minimo,
  }).format(valor);

/** 45 → "45 s"; 314 → "5 min 14 s"; 4420 → "1 h 14 min"; 200000 → "2 d 7 h". */
export function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  if (total < 60) {
    return `${total} s`;
  }
  if (total < 3600) {
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return resto ? `${minutos} min ${resto} s` : `${minutos} min`;
  }
  if (total < 86_400) {
    const horas = Math.floor(total / 3600);
    const minutos = Math.round((total % 3600) / 60);
    return minutos ? `${horas} h ${minutos} min` : `${horas} h`;
  }
  const dias = Math.floor(total / 86_400);
  const horas = Math.round((total % 86_400) / 3600);
  return horas ? `${dias} d ${horas} h` : `${dias} d`;
}

/** AAAA-MM-DD → "18/10/2026" (ou "18/10", curta). Texto fora do padrão volta como veio. */
export function formatarDia(dia: string, curta = false): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  if (!partes) {
    return dia;
  }
  return curta ? `${partes[3]}/${partes[2]}` : `${partes[3]}/${partes[2]}/${partes[1]}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10" → "out/26". */
export function formatarMes(mes: string): string {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes);
  return partes ? `${MESES[Number(partes[2]) - 1] ?? partes[2]}/${partes[1].slice(2)}` : mes;
}

/** O valor de uma célula, escrito para ler (a tabela é a alternativa textual dos gráficos). */
export function formatarCelula(
  valor: string | number | null,
  tipo: TipoColuna,
  chave = '',
): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  if (typeof valor === 'string') {
    if (tipo === 'data') {
      return formatarDia(valor);
    }
    if (chave === 'mes') {
      return formatarMes(valor);
    }
    return CODIGOS[chave]?.[valor] ?? valor;
  }
  switch (tipo) {
    case 'moeda':
      return `R$ ${numero(valor, 0)}`;
    case 'percentual':
      return `${numero(valor, 1)}%`;
    case 'segundos':
      return formatarDuracao(valor);
    case 'dias':
      return `${numero(valor, 1)} d`;
    case 'nota':
      return numero(valor, 1);
    case 'numero':
      return chave === 'hora' ? `${valor} h` : numero(valor, 1);
    default:
      return numero(valor, 0);
  }
}

export interface ValorDoCartao {
  readonly valor: number | string;
  readonly prefixo: string | null;
  readonly unidade: string | null;
  /** Casas do indicador (digitsInfo do Angular). */
  readonly casas: string;
}

/** O número grande de um cartão, com o prefixo e a unidade pequenos ("R$ 119,5 mil", "5 min"). */
export function valorDoCartao(cartao: Pick<Cartao, 'valor' | 'unidade'>): ValorDoCartao | null {
  const { valor, unidade } = cartao;
  if (valor === null) {
    return null;
  }
  const sem = (resto: Partial<ValorDoCartao> & { valor: number | string }): ValorDoCartao => ({
    prefixo: null,
    unidade: null,
    casas: '1.0-1',
    ...resto,
  });
  const porUnidade: Readonly<Record<UnidadeCartao, () => ValorDoCartao>> = {
    numero: () => sem({ valor, casas: Number.isInteger(valor) ? '1.0-0' : '1.0-1' }),
    moeda: () => {
      const abreviado = abreviarNumero(valor, LOCALE);
      return sem({ valor: abreviado.numero, prefixo: 'R$', unidade: abreviado.sufixo || null });
    },
    percentual: () => sem({ valor, unidade: '%' }),
    segundos: () => {
      if (valor < 60) {
        return sem({ valor: Math.round(valor), unidade: 's', casas: '1.0-0' });
      }
      if (valor < 3600) {
        return sem({ valor: valor / 60, unidade: 'min' });
      }
      if (valor < 86_400) {
        return sem({ valor: valor / 3600, unidade: 'h' });
      }
      return sem({ valor: valor / 86_400, unidade: 'dias' });
    },
    dias: () => sem({ valor, unidade: 'dias' }),
    nota: () => sem({ valor, unidade: '/ 5' }),
  };
  return porUnidade[unidade]();
}

/** Soma de uma coluna numérica (para o resumo "N linhas · total"). */
export function somar(linhas: readonly LinhaBi[], chave: string): number {
  return linhas.reduce((total, linha) => total + (Number(linha[chave]) || 0), 0);
}
