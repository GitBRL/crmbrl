import type { ErroApi } from '../../nucleo/api/erro-api';
import type { CorDoSetor } from '../../nucleo/setores/setores';
import type { VarianteSelo } from '../../ui/selo/selo';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';

/** Cores aceitas pela API, com o rótulo mostrado no seletor. */
export const OPCOES_DE_COR: readonly OpcaoSeletor<CorDoSetor>[] = [
  { valor: 'ciano', rotulo: 'Ciano' },
  { valor: 'menta', rotulo: 'Menta' },
  { valor: 'lima', rotulo: 'Lima' },
  { valor: 'coral', rotulo: 'Coral' },
  { valor: 'neutro', rotulo: 'Neutro' },
];

const CORES: readonly string[] = OPCOES_DE_COR.map((opcao) => String(opcao.valor));

/** O selo do setor: a cor dele, ou neutro quando a API mandar algo fora da lista. */
export function varianteDoSetor(cor: string | null | undefined): VarianteSelo {
  return cor && CORES.includes(cor) ? (cor as VarianteSelo) : 'neutro';
}

export const DICA_NOVO_SETOR =
  'O setor nasce com um funil próprio (Novo, Em andamento, Ganho e Perdido) e com o rodízio de leads. Quem você escolher como líder passa a liderar o setor e responde ao C-level responsável.';

export const DICA_ACESSOS_DO_SETOR =
  'Estes acessos valem para os funis do setor com visibilidade “Todo o setor”. Funis restritos não os usam: neles só entram os líderes e quem estiver na lista do próprio funil.';

/** Quem tem liderados e por isso não pode virar líder de outro setor (409 R1.3). */
export interface PendenciaDeLider {
  readonly lider: { readonly id: string; readonly nome: string };
  readonly liderados: readonly { readonly id: string; readonly nome: string }[];
}

/** O que impede desativar um setor (409 R1.10). */
export interface PendenciasDoSetor {
  readonly usuarios: readonly {
    readonly id: string;
    readonly nome: string;
    readonly rotulo: string;
  }[];
  readonly funis: readonly { readonly id: string; readonly nome: string; readonly base: boolean }[];
  readonly filas: readonly { readonly id: string; readonly nome: string }[];
}

function lista(valor: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/** `detalhes.pendencias` do 409 R1.3. */
export function pendenciasDeLideres(erro: ErroApi): readonly PendenciaDeLider[] {
  return lista(erro.detalhes?.['pendencias']).map((item) => {
    const usuario = (item['usuario'] ?? {}) as Record<string, unknown>;
    return {
      lider: { id: texto(usuario['id']), nome: texto(usuario['nome']) },
      liderados: lista(item['liderados']).map((liderado) => ({
        id: texto(liderado['id']),
        nome: texto(liderado['nome']),
      })),
    };
  });
}

/** `detalhes.usuarios/funis/filas` do 409 R1.10. */
export function pendenciasDoSetor(erro: ErroApi): PendenciasDoSetor {
  const detalhes = erro.detalhes;
  return {
    usuarios: lista(detalhes?.['usuarios']).map((item) => ({
      id: texto(item['id']),
      nome: texto(item['nome']),
      rotulo: texto(item['rotuloPapel']) || texto(item['papel']),
    })),
    funis: lista(detalhes?.['funis']).map((item) => ({
      id: texto(item['id']),
      nome: texto(item['nome']),
      base: item['base'] === true,
    })),
    filas: lista(detalhes?.['filas']).map((item) => ({
      id: texto(item['id']),
      nome: texto(item['nome']),
    })),
  };
}

export function temPendencias(pendencias: PendenciasDoSetor): boolean {
  return pendencias.usuarios.length + pendencias.funis.length + pendencias.filas.length > 0;
}

/** "1 pessoa", "3 pessoas". */
export function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
