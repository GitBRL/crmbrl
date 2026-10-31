import type {
  CampoSegmento,
  CondicaoSegmento,
  OperadorSegmento,
  Segmento,
} from '../../ui/construtor-segmento/segmento';
import {
  type DiaSemana,
  FUSO_PADRAO,
  type JanelaEnvio,
} from '../../ui/seletor-janela-envio/janela-envio';
import { gerarId } from '../../ui/tipos';
import { ROTULO_ORIGEM } from '../contatos/contatos.tipos';
import type { CondicaoApi, JanelaEnvioApi, SegmentoApi } from './disparos.tipos';

/**
 * Conversão entre os modelos de tela (construtor de segmento e seletor de janela) e o formato
 * JSON da API (`src/comum/segmentos`). Funções puras.
 */

// Segmento ------------------------------------------------------------------------------------

const OPERADORES_DATA: readonly OperadorSegmento[] = [
  'ultimos-dias',
  'ha-mais-de-dias',
  'antes',
  'depois',
];

const OPERADORES_PRESENCA: readonly OperadorSegmento[] = ['preenchido', 'vazio'];

/** Os campos que o construtor oferece nos Disparos (todos têm tradução para a API). */
export function camposDoSegmento(
  etiquetas: readonly string[],
  usuarios: readonly { id: string; nome: string }[],
): readonly CampoSegmento[] {
  return [
    {
      id: 'etiquetas',
      rotulo: 'Etiqueta',
      tipo: 'opcao',
      operadores: ['e', 'nao-e'],
      opcoes: etiquetas.map((etiqueta) => ({ valor: etiqueta, rotulo: etiqueta })),
      grupo: 'Contato',
    },
    {
      id: 'origem',
      rotulo: 'Origem (última)',
      tipo: 'opcao',
      operadores: ['e', 'nao-e'],
      opcoes: Object.entries(ROTULO_ORIGEM).map(([valor, rotulo]) => ({ valor, rotulo })),
      grupo: 'Contato',
    },
    {
      id: 'responsavel',
      rotulo: 'Responsável',
      tipo: 'opcao',
      operadores: ['e', 'nao-e', ...OPERADORES_PRESENCA],
      opcoes: usuarios.map((u) => ({ valor: u.id, rotulo: u.nome })),
      grupo: 'Contato',
    },
    {
      id: 'ultima_interacao_em',
      rotulo: 'Última conversa',
      tipo: 'data',
      operadores: OPERADORES_DATA,
      grupo: 'Contato',
    },
    {
      id: 'criado_em',
      rotulo: 'Cadastro',
      tipo: 'data',
      operadores: OPERADORES_DATA,
      grupo: 'Contato',
    },
  ];
}

const OPERADOR_PARA_API: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  etiquetas: { e: 'contem_alguma', 'nao-e': 'nao_contem' },
  origem: { e: 'em', 'nao-e': 'fora_de' },
  responsavel: { e: 'em', 'nao-e': 'fora_de', preenchido: 'preenchido', vazio: 'vazio' },
  ultima_interacao_em: {
    'ultimos-dias': 'ultimos_dias',
    'ha-mais-de-dias': 'mais_de_dias',
    antes: 'antes',
    depois: 'depois',
  },
  criado_em: {
    'ultimos-dias': 'ultimos_dias',
    'ha-mais-de-dias': 'mais_de_dias',
    antes: 'antes',
    depois: 'depois',
  },
};

/** Tela → API. Condições incompletas ficam de fora (o chamador confere com `segmentoCompleto`). */
export function segmentoParaApi(segmento: Segmento): SegmentoApi {
  const condicoes: CondicaoApi[] = [];
  for (const c of segmento.condicoes) {
    const operador = OPERADOR_PARA_API[c.campo]?.[c.operador];
    if (!operador) {
      continue;
    }
    if (operador === 'preenchido' || operador === 'vazio') {
      condicoes.push({ campo: c.campo, operador });
      continue;
    }
    if (c.valor === null || c.valor === undefined || String(c.valor).trim() === '') {
      continue;
    }
    const dias = operador === 'ultimos_dias' || operador === 'mais_de_dias';
    const lista = ['contem_alguma', 'nao_contem', 'em', 'fora_de'].includes(operador);
    condicoes.push({
      campo: c.campo,
      operador,
      valor: dias ? Number(c.valor) : lista ? [String(c.valor)] : String(c.valor),
    });
  }
  return { combinacao: segmento.combinacao === 'qualquer' ? 'qualquer' : 'todas', condicoes };
}

export interface SegmentoLido {
  readonly segmento: Segmento;
  /** Havia filtros que o construtor não mostra (feitos por outra via); eles são descartados. */
  readonly perdeu: boolean;
}

/** API → tela (o que o construtor entende; o resto é descartado e `perdeu` avisa). */
export function segmentoDaApi(json: SegmentoApi | null | undefined): SegmentoLido {
  const condicoes: CondicaoSegmento[] = [];
  let perdeu = false;
  for (const c of json?.condicoes ?? []) {
    if (!('campo' in c)) {
      perdeu = true;
      continue;
    }
    const entrada = Object.entries(OPERADOR_PARA_API[c.campo] ?? {}).find(
      ([, api]) => api === c.operador,
    );
    if (!entrada) {
      perdeu = true;
      continue;
    }
    const valor = Array.isArray(c.valor) ? c.valor : [c.valor];
    if (valor.length > 1) {
      // Uma linha por valor só faz sentido no "qualquer"; senão perderia o sentido do filtro.
      perdeu = true;
    }
    const nenhum = c.valor === undefined || c.valor === null;
    condicoes.push({
      id: gerarId('cond'),
      campo: c.campo,
      operador: entrada[0] as OperadorSegmento,
      valor: nenhum ? null : typeof valor[0] === 'number' ? valor[0] : String(valor[0] ?? ''),
    });
  }
  return {
    segmento: { combinacao: json?.combinacao === 'qualquer' ? 'qualquer' : 'todos', condicoes },
    perdeu,
  };
}

// Janela de envio -----------------------------------------------------------------------------

/** Tela → API: cada dia marcado ganha a mesma faixa de horas. */
export function janelaParaApi(janela: JanelaEnvio): JanelaEnvioApi {
  const dias: Record<string, { inicio: string; fim: string }[]> = {};
  for (const dia of janela.dias) {
    dias[String(dia)] = [{ inicio: janela.inicio, fim: janela.fim }];
  }
  return { fusoHorario: janela.fuso || FUSO_PADRAO, dias };
}

/** API → tela. Dias com horas diferentes viram a faixa do primeiro dia (`perdeu` avisa). */
export function janelaDaApi(
  janela: JanelaEnvioApi | null | undefined,
): { janela: JanelaEnvio; perdeu: boolean } | null {
  if (!janela) {
    return null;
  }
  const dias = Object.keys(janela.dias)
    .map(Number)
    .filter((n) => n >= 0 && n <= 6 && (janela.dias[String(n)]?.length ?? 0) > 0)
    .sort((a, b) => a - b) as DiaSemana[];
  if (dias.length === 0) {
    return null;
  }
  const faixas = dias.map((d) => janela.dias[String(d)]);
  const primeira = faixas[0][0];
  const perdeu = faixas.some(
    (f) => f.length > 1 || f[0].inicio !== primeira.inicio || f[0].fim !== primeira.fim,
  );
  return {
    janela: {
      dias,
      inicio: primeira.inicio,
      fim: primeira.fim,
      fuso: janela.fusoHorario || FUSO_PADRAO,
    },
    perdeu,
  };
}

// Descrições em linguagem simples -------------------------------------------------------------

const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  etiquetas: 'Etiqueta',
  origem: 'Origem',
  responsavel: 'Responsável',
  ultima_interacao_em: 'Última conversa',
  criado_em: 'Cadastro',
};

/** Frases curtas do público ("Etiqueta: Cliente, VIP"); filtros que a tela não conhece ficam genéricos. */
export function descreverSegmento(segmento: SegmentoApi | null | undefined): readonly string[] {
  return (segmento?.condicoes ?? []).map((c) => {
    if (!('campo' in c)) {
      return 'Grupo de filtros';
    }
    const nome = ROTULO_CAMPO[c.campo] ?? c.campo;
    const valores = Array.isArray(c.valor) ? c.valor.map(String) : [String(c.valor ?? '')];
    switch (c.operador) {
      case 'contem_alguma':
        return `${nome}: ${valores.join(' ou ')}`;
      case 'nao_contem':
        return `${nome}: nenhuma de ${valores.join(', ')}`;
      case 'em':
        return c.campo === 'origem'
          ? `${nome}: ${valores.map((v) => ROTULO_ORIGEM[v as keyof typeof ROTULO_ORIGEM] ?? v).join(' ou ')}`
          : `${nome} escolhido`;
      case 'fora_de':
        return c.campo === 'origem'
          ? `${nome}: exceto ${valores.map((v) => ROTULO_ORIGEM[v as keyof typeof ROTULO_ORIGEM] ?? v).join(', ')}`
          : `${nome} fora dos escolhidos`;
      case 'preenchido':
        return `${nome}: preenchido`;
      case 'vazio':
        return `${nome}: vazio`;
      case 'ultimos_dias':
        return `${nome}: nos últimos ${valores[0]} dias`;
      case 'mais_de_dias':
        return `${nome}: há mais de ${valores[0]} dias`;
      case 'antes':
        return `${nome}: antes de ${valores[0]}`;
      case 'depois':
        return `${nome}: depois de ${valores[0]}`;
      default:
        return `${nome} ${c.operador}`;
    }
  });
}
