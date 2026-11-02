import { formatarDataHora, formatarNumero } from '../../nucleo/formatos';
import { ROTULO_PAPEL } from '../../nucleo/papeis';
import { ROTULO_AREA } from '../../nucleo/sessao/perfil';
import { ROTULO_ESTRATEGIA, ROTULO_MODELO } from '../integracoes/tipos';

/** Data e hora ISO (como a API grava: `2026-10-21T21:10:51.380Z`). */
const DATA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[A-Z][A-Z_]+$/;

/** Códigos dos enums da API (prisma/schema.prisma) que aparecem no antes/depois. */
const ROTULO_CODIGO: Readonly<Record<string, string>> = {
  ...ROTULO_PAPEL,
  ...ROTULO_AREA,
  ...ROTULO_ESTRATEGIA,
  ...ROTULO_MODELO,
  ABERTA: 'Aberta',
  ABERTO: 'Aberto',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
  MANUAL: 'Cadastro manual',
  WEBHOOK: 'Webhook',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  INDICACAO: 'Indicação',
  IMPORTACAO: 'Importação',
  PASSAGEM: 'Passagem entre funis',
  OUTRO: 'Outro',
  TAREFA: 'Tarefa',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  NOTA: 'Nota',
  PENDENTE: 'Pendente',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

export interface ValorFormatado {
  readonly texto: string;
  /** Sem valor ("—"): aparece em tom suave. */
  readonly vazio: boolean;
  /** Valor original quando o texto é um nome ou rótulo no lugar dele (vai no `title`). */
  readonly original?: string;
  /** Id que não conseguimos traduzir em nome: aparece em fonte monoespaçada. */
  readonly id?: boolean;
}

/** Id → nome conhecido (pessoas, funis, etapas e o que o próprio evento registrou). */
export type NomesConhecidos = ReadonlyMap<string, string>;

/**
 * Um valor do antes/depois da auditoria, legível: vazio vira "—", booleano "Sim"/"Não", data
 * ISO "21/10/2026 às 18:10", número em pt-BR, códigos da API em português ("RODIZIO" →
 * "Rodízio da área"), ids viram o nome quando sabemos qual é, lista separada por vírgula e
 * objeto como "chave: valor". Campos sensíveis chegam como `[omitido]` (R3.1).
 */
export function formatarValor(valor: unknown, nomes?: NomesConhecidos): ValorFormatado {
  if (valor === null || valor === undefined || valor === '') {
    return { texto: '—', vazio: true };
  }
  if (valor === '[omitido]') {
    return { texto: 'omitido (dado sensível)', vazio: true };
  }
  if (typeof valor === 'boolean') {
    return { texto: valor ? 'Sim' : 'Não', vazio: false };
  }
  if (typeof valor === 'number') {
    return { texto: formatarNumero(valor), vazio: false };
  }
  if (typeof valor === 'string') {
    return formatarTexto(valor, nomes);
  }
  if (Array.isArray(valor)) {
    if (!valor.length) {
      return { texto: 'nenhum', vazio: true };
    }
    const simples = valor.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
    return {
      texto: simples
        ? valor.map((item) => formatarValor(item, nomes).texto).join(', ')
        : JSON.stringify(valor),
      vazio: false,
    };
  }
  if (typeof valor === 'object') {
    const pares = Object.entries(valor as Record<string, unknown>);
    if (!pares.length) {
      return { texto: 'nenhum', vazio: true };
    }
    if (pares.every(([, item]) => item === null || typeof item !== 'object')) {
      return {
        texto: pares
          .map(([chave, item]) => `${chave}: ${formatarValor(item, nomes).texto}`)
          .join('; '),
        vazio: false,
      };
    }
  }
  try {
    return { texto: JSON.stringify(valor), vazio: false };
  } catch {
    return { texto: String(valor), vazio: false };
  }
}

function formatarTexto(valor: string, nomes?: NomesConhecidos): ValorFormatado {
  if (DATA_HORA_ISO.test(valor)) {
    return { texto: formatarDataHora(valor), vazio: false };
  }
  if (UUID.test(valor)) {
    const nome = nomes?.get(valor.toLowerCase());
    return nome
      ? { texto: nome, vazio: false, original: valor }
      : { texto: valor, vazio: false, id: true };
  }
  if (CODIGO.test(valor) && ROTULO_CODIGO[valor]) {
    return { texto: ROTULO_CODIGO[valor], vazio: false, original: valor };
  }
  return { texto: valor, vazio: false };
}

/**
 * Nomes que o próprio evento registrou: todo objeto `{ id, nome }` dentro dos dados (ex.:
 * `deEtapa`, `paraEtapa`, `de`, `para`, `responsavel`), até três níveis.
 */
export function nomesDosDados(
  dados: unknown,
  nomes = new Map<string, string>(),
  nivel = 0,
): Map<string, string> {
  if (!dados || typeof dados !== 'object' || nivel > 3) {
    return nomes;
  }
  if (Array.isArray(dados)) {
    dados.forEach((item) => nomesDosDados(item, nomes, nivel + 1));
    return nomes;
  }
  const registro = dados as Record<string, unknown>;
  if (typeof registro['id'] === 'string' && typeof registro['nome'] === 'string') {
    nomes.set(registro['id'].toLowerCase(), registro['nome']);
  }
  for (const item of Object.values(registro)) {
    nomesDosDados(item, nomes, nivel + 1);
  }
  return nomes;
}

/** Uma linha de "Dados registrados", legível. */
export interface DadoLegivel {
  readonly campo: string;
  readonly valor: ValorFormatado;
}

/**
 * Os dados que o evento gravou (fora o diff), como lista "campo: valor" para quem não é da TI:
 * pessoa vira o nome (com o papel), contagens viram "1 atividade · 3 rodízios" (sem os
 * zeros), códigos e ids passam por `formatarValor`. O JSON continua disponível à parte.
 */
export function dadosLegiveis(
  dados: Readonly<Record<string, unknown>>,
  rotular: (campo: string) => string,
  nomes?: NomesConhecidos,
): DadoLegivel[] {
  return Object.entries(dados).map(([chave, valor]) => {
    const motivo = chave === 'motivoDestinatario' && typeof valor === 'string';
    return {
      campo: rotular(chave),
      valor:
        motivo && MOTIVO_DESTINATARIO[valor]
          ? { texto: MOTIVO_DESTINATARIO[valor], vazio: false, original: valor }
          : valorLegivel(valor, rotular, nomes),
    };
  });
}

/** Por que o destinatário do desligamento foi essa pessoa (R7.2). */
const MOTIVO_DESTINATARIO: Readonly<Record<string, string>> = {
  LIDER: 'É o líder de quem saiu',
  C_LEVEL_RESPONSAVEL: 'É o C-level responsável pelo líder que saiu',
  SUBIU_NA_CADEIA: 'O líder estava inativo: foi para quem está acima dele',
  C_LEVEL_ATIVO: 'Ninguém ativo acima: foi para um C-level ativo',
  ESCOLHIDO_PELO_ADMIN: 'Escolhido por quem fez o desligamento',
  ADMIN_EXECUTOR: 'Quem fez o desligamento (Admin)',
  SEM_C_LEVEL_ATIVO: 'Sem C-level ativo: foi para quem fez o desligamento',
};

function valorLegivel(
  valor: unknown,
  rotular: (campo: string) => string,
  nomes?: NomesConhecidos,
): ValorFormatado {
  const pessoa = comoPessoa(valor);
  if (pessoa) {
    return { texto: pessoa, vazio: false };
  }
  if (Array.isArray(valor)) {
    if (!valor.length) {
      return { texto: '—', vazio: true };
    }
    const pessoas = valor.map(comoPessoa);
    if (pessoas.every(Boolean)) {
      return { texto: pessoas.join(', '), vazio: false };
    }
  }
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const numeros = Object.entries(valor as Record<string, unknown>);
    if (numeros.length && numeros.every(([, n]) => typeof n === 'number')) {
      const partes = numeros
        .filter(([, n]) => n !== 0)
        .map(
          ([campo, n]) =>
            contagem(campo, n as number) ?? `${rotular(campo)}: ${formatarNumero(n as number)}`,
        );
      return partes.length
        ? { texto: partes.join(' · '), vazio: false }
        : { texto: 'nada', vazio: true };
    }
  }
  return formatarValor(valor, nomes);
}

/** Contagens conhecidas (as do desligamento), por extenso: [singular, plural]. */
const CONTAGENS: Readonly<Record<string, readonly [string, string]>> = {
  atividades: ['1 atividade', '# atividades'],
  negocios: ['1 negócio', '# negócios'],
  contatos: ['1 contato', '# contatos'],
  empresas: ['1 empresa', '# empresas'],
  liderados: ['1 liderado', '# liderados'],
  rodizios: ['saiu de 1 rodízio', 'saiu de # rodízios'],
  responsavelFixo: ['era responsável fixo em 1 lugar', 'era responsável fixo em # lugares'],
  sessoesRevogadas: ['1 sessão encerrada', '# sessões encerradas'],
  linksDeSenhaInvalidados: ['1 link de senha cancelado', '# links de senha cancelados'],
};

function contagem(campo: string, quantos: number): string | null {
  const formas = CONTAGENS[campo];
  if (!formas) {
    return null;
  }
  return quantos === 1 ? formas[0] : formas[1].replace('#', formatarNumero(quantos));
}

/** `{ id, nome, papel? }` → "Rafael Mendes (Líder Comercial)"; outra coisa → `null`. */
function comoPessoa(valor: unknown): string | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return null;
  }
  const { nome, papel } = valor as { nome?: unknown; papel?: unknown };
  if (typeof nome !== 'string') {
    return null;
  }
  const rotuloPapel = typeof papel === 'string' ? ROTULO_CODIGO[papel] : undefined;
  return rotuloPapel ? `${nome} (${rotuloPapel})` : nome;
}
