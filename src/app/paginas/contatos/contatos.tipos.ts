import type { Papel } from '../../nucleo/papeis';
import { compararNaJornada } from '../../nucleo/setores/setores';
import type { Area } from '../../nucleo/sessao/perfil';

/**
 * Contrato de contatos e empresas com a API (crmbrl-api, contatos/dto/*.dto.ts; OpenAPI em
 * `TRABALHO/openapi.json`) e as funções puras que as telas desta pasta usam (telefone, CNPJ,
 * origem, jornada entre funis).
 */

// ---------------------------------------------------------------------------------------------
// Origem (R4.3)
// ---------------------------------------------------------------------------------------------

export type OrigemContato =
  'MANUAL' | 'WEBHOOK' | 'WHATSAPP' | 'SITE' | 'INDICACAO' | 'IMPORTACAO' | 'PASSAGEM' | 'OUTRO';

export const ORIGENS: readonly OrigemContato[] = [
  'MANUAL',
  'SITE',
  'WHATSAPP',
  'INDICACAO',
  'WEBHOOK',
  'PASSAGEM',
  'IMPORTACAO',
  'OUTRO',
];

/** Origens que uma pessoa escolhe ao cadastrar; as outras são só do sistema. */
export const ORIGENS_MANUAIS: readonly OrigemContato[] = [
  'MANUAL',
  'SITE',
  'WHATSAPP',
  'INDICACAO',
  'OUTRO',
];

export const ROTULO_ORIGEM: Readonly<Record<OrigemContato, string>> = {
  MANUAL: 'Cadastro manual',
  WEBHOOK: 'Webhook',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  INDICACAO: 'Indicação',
  IMPORTACAO: 'Importação',
  PASSAGEM: 'Passagem entre funis',
  OUTRO: 'Outra',
};

export interface Utm {
  readonly source?: string;
  readonly medium?: string;
  readonly campaign?: string;
  readonly term?: string;
  readonly content?: string;
}

export const CAMPOS_UTM: readonly (keyof Utm)[] = [
  'source',
  'medium',
  'campaign',
  'term',
  'content',
];

export const ROTULO_UTM: Readonly<Record<keyof Utm, string>> = {
  source: 'Fonte',
  medium: 'Meio',
  campaign: 'Campanha',
  term: 'Termo',
  content: 'Conteúdo',
};

export interface Origem {
  readonly tipo: OrigemContato;
  /** Ex.: o nome do webhook de entrada. */
  readonly detalhe: string | null;
  readonly utm: Utm | null;
}

export interface UltimaOrigem extends Origem {
  readonly em: string;
}

/** "Fonte: google · Campanha: black-friday" (só as partes preenchidas). */
export function descreverUtm(utm: Utm | null | undefined): string | null {
  if (!utm) {
    return null;
  }
  const partes = CAMPOS_UTM.flatMap((campo) => {
    const valor = utm[campo]?.trim();
    return valor ? [`${ROTULO_UTM[campo]}: ${valor}`] : [];
  });
  return partes.length ? partes.join(' · ') : null;
}

/** "Site", "Webhook · Landing Black Friday". */
export function descreverOrigem(origem: Origem | null | undefined): string {
  if (!origem) {
    return '—';
  }
  const detalhe = origem.detalhe?.trim();
  return detalhe ? `${ROTULO_ORIGEM[origem.tipo]} · ${detalhe}` : ROTULO_ORIGEM[origem.tipo];
}

// ---------------------------------------------------------------------------------------------
// Contatos e empresas
// ---------------------------------------------------------------------------------------------

/** Usuário ligado a um registro (responsável, quem criou). */
export interface UsuarioVinculado {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
  /** Falso para quem foi desligado. */
  readonly ativo: boolean;
}

export interface EmpresaVinculada {
  readonly id: string;
  readonly nome: string;
}

export interface Consentimento {
  readonly em: string | null;
  readonly origem: string | null;
}

export type CamposPersonalizados = Readonly<Record<string, unknown>>;

export interface Contato {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  /** E.164 só com dígitos (`5511987654321`). */
  readonly telefone: string | null;
  readonly cargo: string | null;
  readonly empresa: EmpresaVinculada | null;
  readonly responsavel: UsuarioVinculado | null;
  readonly primeiraOrigem: Origem;
  readonly ultimaOrigem: UltimaOrigem;
  /** 1 na criação, +1 a cada reconversão (R4.2). */
  readonly conversoes: number;
  readonly etiquetas: readonly string[];
  readonly camposPersonalizados: CamposPersonalizados;
  readonly optOutMarketing: boolean;
  readonly optOutEm: string | null;
  readonly consentimento: Consentimento | null;
  readonly criadoPor: UsuarioVinculado | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  /** Quem pede pode editar (matriz §12). */
  readonly podeEditar: boolean;
}

export interface Empresa {
  readonly id: string;
  readonly nome: string;
  readonly cnpj: string | null;
  readonly cnpjFormatado: string | null;
  readonly site: string | null;
  readonly email: string | null;
  readonly telefone: string | null;
  readonly segmento: string | null;
  readonly cidade: string | null;
  readonly uf: string | null;
  readonly responsavel: UsuarioVinculado | null;
  readonly etiquetas: readonly string[];
  readonly camposPersonalizados: CamposPersonalizados;
  /** Contatos ativos ligados à empresa. */
  readonly quantidadeContatos: number;
  readonly criadoPor: UsuarioVinculado | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly podeEditar: boolean;
}

export interface ResultadoCriacaoContato {
  /** `false`: já existia um contato com o mesmo e-mail ou telefone, que foi reconvertido (R4.2). */
  readonly criado: boolean;
  readonly contato: Contato;
}

export interface EtiquetaEmUso {
  readonly etiqueta: string;
  readonly quantidade: number;
}

export interface EntradaConsentimento {
  readonly origem: string;
  /** ISO; padrão: agora (não pode ser no futuro). */
  readonly em?: string;
}

export interface NovoContato {
  readonly nome: string;
  readonly email?: string | null;
  readonly telefone?: string | null;
  readonly cargo?: string | null;
  readonly empresaId?: string | null;
  readonly empresaNome?: string | null;
  readonly responsavelId?: string;
  readonly origem?: OrigemContato;
  readonly origemDetalhe?: string | null;
  readonly utm?: Utm | null;
  readonly etiquetas?: readonly string[];
  readonly optOutMarketing?: boolean;
  readonly consentimento?: EntradaConsentimento | null;
}

export interface AlteracaoContato {
  readonly nome?: string;
  readonly email?: string | null;
  readonly telefone?: string | null;
  readonly cargo?: string | null;
  readonly empresaId?: string | null;
  readonly responsavelId?: string;
  readonly etiquetas?: readonly string[];
  readonly camposPersonalizados?: CamposPersonalizados | null;
  readonly optOutMarketing?: boolean;
  readonly consentimento?: EntradaConsentimento | null;
}

export interface NovaEmpresa {
  readonly nome: string;
  readonly cnpj?: string | null;
  readonly site?: string | null;
  readonly email?: string | null;
  readonly telefone?: string | null;
  readonly segmento?: string | null;
  readonly cidade?: string | null;
  readonly uf?: string | null;
  readonly responsavelId?: string;
  readonly etiquetas?: readonly string[];
}

export type AlteracaoEmpresa = Partial<NovaEmpresa>;

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type Uf = (typeof UFS)[number];

// ---------------------------------------------------------------------------------------------
// Filtros das listas
// ---------------------------------------------------------------------------------------------

export type OrdenacaoContatos = 'criadoEm' | 'atualizadoEm' | 'nome' | 'ultimaOrigemEm';
export type OrdenacaoEmpresas = 'nome' | 'criadoEm' | 'atualizadoEm';

export interface FiltrosContatos {
  readonly busca?: string | null;
  readonly responsavelId?: string | null;
  readonly semResponsavel?: boolean | null;
  readonly empresaId?: string | null;
  readonly origem?: OrigemContato | null;
  readonly etiqueta?: string | null;
  readonly optOut?: boolean | null;
  readonly ordenarPor?: OrdenacaoContatos | null;
  readonly ordem?: 'asc' | 'desc' | null;
  readonly pagina?: number;
  readonly porPagina?: number;
}

export interface FiltrosEmpresas {
  readonly busca?: string | null;
  readonly responsavelId?: string | null;
  readonly semResponsavel?: boolean | null;
  readonly etiqueta?: string | null;
  readonly uf?: string | null;
  readonly ordenarPor?: OrdenacaoEmpresas | null;
  readonly ordem?: 'asc' | 'desc' | null;
  readonly pagina?: number;
  readonly porPagina?: number;
}

// ---------------------------------------------------------------------------------------------
// Linha do tempo (R3.5)
// ---------------------------------------------------------------------------------------------

export type TipoAtor = 'USUARIO' | 'SISTEMA' | 'WEBHOOK' | 'AUTOMACAO' | 'IA';
export type TipoAtividade = 'TAREFA' | 'LIGACAO' | 'REUNIAO' | 'EMAIL' | 'WHATSAPP' | 'NOTA';
export type StatusAtividade = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
export type PrioridadeAtividade = 'BAIXA' | 'MEDIA' | 'ALTA';

export const ROTULO_TIPO_ATIVIDADE: Readonly<Record<TipoAtividade, string>> = {
  TAREFA: 'Tarefa',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  NOTA: 'Nota',
};

export interface EventoDaLinhaDoTempo {
  readonly id: string;
  /** `entidade.verbo`: `contato.reconvertido`, `negocio.movido`… */
  readonly acao: string;
  readonly entidade: string;
  readonly entidadeId: string | null;
  /** Resumo legível, em português. */
  readonly resumo: string;
  readonly dados?: Readonly<Record<string, unknown>> | null;
  readonly tipoAtor: TipoAtor;
  readonly usuarioId: string | null;
  readonly atorDescricao: string | null;
  readonly criadoEm: string;
}

export interface AtividadeDaLinhaDoTempo {
  readonly id: string;
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly status: StatusAtividade;
  readonly prioridade: PrioridadeAtividade;
  readonly atrasada: boolean;
  readonly venceEm: string | null;
  readonly inicioEm: string | null;
  readonly fimEm: string | null;
  readonly concluidaEm: string | null;
  readonly canceladaEm: string | null;
  readonly responsavel: UsuarioVinculado;
  readonly criadoPor: UsuarioVinculado | null;
  readonly contatoId: string | null;
  readonly empresaId: string | null;
  readonly negocioId: string | null;
  readonly criadoEm: string;
}

/** Ligação na linha do tempo (Onda E, E4); o painel com player e transcrição abre pelo `id`. */
export interface LigacaoDaLinhaDoTempo {
  readonly id: string;
  readonly direcao: 'RECEBIDA' | 'FEITA';
  readonly estado: string;
  readonly resultado: 'atendida' | 'perdida' | 'recusada' | 'sem_resposta' | 'falhou' | null;
  readonly motivoTexto: string | null;
  readonly duracaoSegundos: number | null;
  readonly conversaId: string | null;
  readonly canalId: string | null;
  readonly canalNome: string | null;
  /** R34.3: de onde vem a ligação (ausente = WhatsApp). */
  readonly provedor?: 'WHATSAPP' | 'TRESC_PLUS';
  readonly negocioId?: string | null;
  readonly qualificacaoNome?: string | null;
  readonly campanhaNome?: string | null;
  readonly atendente: { readonly id: string; readonly nome: string } | null;
  readonly iniciadaEm: string;
  readonly encerradaEm: string | null;
  readonly resumoAssunto: string | null;
  readonly resumoTrecho: string | null;
  readonly temGravacao: boolean;
  readonly temTranscricao: boolean;
}

export interface RegistroDaLinhaDoTempo {
  readonly tipo: 'evento' | 'atividade' | 'ligacao';
  readonly ocorridoEm: string;
  readonly evento: EventoDaLinhaDoTempo | null;
  readonly atividade: AtividadeDaLinhaDoTempo | null;
  /** Só nos registros do tipo `ligacao`; `null` (ou ausente) nos outros. */
  readonly ligacao?: LigacaoDaLinhaDoTempo | null;
}

export type ConteudoDaLinhaDoTempo = 'tudo' | 'eventos' | 'atividades' | 'ligacoes';

/** Uma alteração de campo registrada num evento (`dados.alteracoes`). */
export interface AlteracaoDeCampo {
  readonly campo: string;
  readonly antes: string;
  readonly depois: string;
}

const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  cargo: 'Cargo',
  empresaId: 'Empresa',
  responsavelId: 'Responsável',
  etiquetas: 'Etiquetas',
  camposPersonalizados: 'Campos personalizados',
  optOutMarketing: 'Opt-out de marketing',
  optOutEm: 'Opt-out desde',
  consentimentoEm: 'Consentimento em',
  consentimentoOrigem: 'Origem do consentimento',
  cnpj: 'CNPJ',
  site: 'Site',
  segmento: 'Segmento',
  cidade: 'Cidade',
  uf: 'UF',
  titulo: 'Título',
  valor: 'Valor',
  valorRecorrente: 'Valor recorrente',
  previsaoFechamento: 'Previsão de fechamento',
  motivoPerda: 'Motivo da perda',
  contatoId: 'Contato',
  etapaId: 'Etapa',
};

/** Nome técnico com cara de campo da API (`valor`, `previsaoFechamento`). */
const NOME_DE_CAMPO = /^[a-z][a-zA-Z]*$/;

/**
 * Resumo do evento para a tela. Alguns resumos da API listam os campos alterados pelo nome
 * técnico — `Negócio "X" atualizado (valor, previsaoFechamento)` —: aqui eles viram rótulos
 * (`valor, previsão de fechamento`). Os outros resumos passam como vieram.
 */
export function resumoDoEvento(evento: Pick<EventoDaLinhaDoTempo, 'acao' | 'resumo'>): string {
  if (!evento.acao.endsWith('.atualizado')) {
    return evento.resumo;
  }
  return evento.resumo.replace(/\(([^()]+)\)$/, (trecho, lista: string) => {
    const campos = lista.split(',').map((campo) => campo.trim());
    if (!campos.every((campo) => NOME_DE_CAMPO.test(campo))) {
      return trecho;
    }
    const rotulos = campos.map((campo) =>
      (ROTULO_CAMPO[campo] ?? campo.replace(/([A-Z])/g, ' $1')).toLowerCase(),
    );
    return `(${rotulos.join(', ')})`;
  });
}

function textoDoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return 'vazio';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'sim' : 'não';
  }
  if (Array.isArray(valor)) {
    return valor.length ? valor.map((item) => textoDoValor(item)).join(', ') : 'vazio';
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return String(valor);
}

/** `dados.alteracoes: { campo: { antes, depois } }` → linhas legíveis ("E-mail: a → b"). */
export function alteracoesDoEvento(evento: EventoDaLinhaDoTempo): readonly AlteracaoDeCampo[] {
  const alteracoes = evento.dados?.['alteracoes'];
  if (!alteracoes || typeof alteracoes !== 'object' || Array.isArray(alteracoes)) {
    return [];
  }
  return Object.entries(alteracoes as Record<string, unknown>).flatMap(([campo, valor]) => {
    if (!valor || typeof valor !== 'object') {
      return [];
    }
    const { antes, depois } = valor as { antes?: unknown; depois?: unknown };
    return [
      {
        campo: ROTULO_CAMPO[campo] ?? campo,
        antes: textoDoValor(antes),
        depois: textoDoValor(depois),
      },
    ];
  });
}

// ---------------------------------------------------------------------------------------------
// Negócios e atividades ligados ao contato/empresa (de outros módulos; só o que a tela usa)
// ---------------------------------------------------------------------------------------------

export type StatusNegocio = 'ABERTO' | 'GANHO' | 'PERDIDO';

export const ROTULO_STATUS_NEGOCIO: Readonly<Record<StatusNegocio, string>> = {
  ABERTO: 'Aberto',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export interface NegocioRelacionado {
  readonly id: string;
  readonly titulo: string;
  readonly status: StatusNegocio;
  /** Texto decimal ("1500.00"). */
  readonly valor: string;
  readonly valorRecorrente?: string | null;
  readonly diasNaEtapa: number;
  /** Quando entrou na etapa (ISO): "ontem" ou "hoje" abaixo de 24 h. */
  readonly etapaDesde?: string | null;
  readonly parado: boolean;
  readonly negocioOrigemId?: string | null;
  readonly funil: { readonly id: string; readonly nome: string; readonly area: Area };
  readonly etapa: { readonly id: string; readonly nome: string; readonly tipo: string };
  readonly contato: { readonly id: string; readonly nome: string };
  readonly empresa?: { readonly id: string; readonly nome: string } | null;
  readonly responsavel?: { readonly id: string; readonly nome: string } | null;
  readonly ganhoEm?: string | null;
  readonly perdidoEm?: string | null;
  readonly criadoEm: string;
}

export interface AtividadeRelacionada {
  readonly id: string;
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly status: StatusAtividade;
  readonly prioridade: PrioridadeAtividade;
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly fimEm?: string | null;
  readonly atrasada: boolean;
  /** R6.6 — reunião pendente cujo início já passou. */
  readonly aguardandoResultado?: boolean;
  readonly resultadoReuniao?: 'COMPARECEU' | 'NAO_COMPARECEU' | 'REMARCADA' | null;
  readonly responsavel: { readonly id: string; readonly nome: string };
  readonly concluidaEm?: string | null;
  readonly canceladaEm?: string | null;
  readonly negocio?: {
    readonly id: string;
    readonly titulo: string;
    readonly funilId: string;
  } | null;
  readonly encaminhadaDe?: { readonly id: string; readonly nome: string } | null;
}

export interface NovaAtividade {
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly fimEm?: string | null;
  readonly contatoId?: string;
  readonly empresaId?: string;
}

/** Usuário que pode ser responsável (lista de `GET /usuarios`). */
export interface UsuarioResumo {
  readonly id: string;
  readonly nome: string;
  readonly papel: Papel;
  readonly rotuloPapel: string;
  readonly ativo: boolean;
}

// ---------------------------------------------------------------------------------------------
// Jornada entre funis (R5.7)
// ---------------------------------------------------------------------------------------------

export interface VinculoDaJornada {
  readonly id: string;
  readonly titulo: string;
  readonly area: Area;
  readonly funilId: string;
}

export interface NegocioNaJornada {
  readonly negocio: NegocioRelacionado;
  /** De onde veio por passagem (o negócio de origem, quando quem vê tem acesso a ele). */
  readonly veioDe: VinculoDaJornada | null;
  /** Veio de outro negócio por passagem, mas de um funil que a pessoa não vê. */
  readonly veioDeOculto: boolean;
  /** Negócios criados a partir deste por passagem (os que a pessoa vê). */
  readonly gerou: readonly VinculoDaJornada[];
}

function vinculo(negocio: NegocioRelacionado): VinculoDaJornada {
  return {
    id: negocio.id,
    titulo: negocio.titulo,
    area: negocio.funil.area,
    funilId: negocio.funil.id,
  };
}

/**
 * Os negócios do contato na ordem da jornada (a `ordem` dos setores; em cada setor, os
 * mais antigos primeiro), com os vínculos "veio de" e "gerou" entre eles.
 */
export function montarJornada(
  negocios: readonly NegocioRelacionado[],
): readonly NegocioNaJornada[] {
  const porId = new Map(negocios.map((negocio) => [negocio.id, negocio]));
  return [...negocios]
    .sort(
      (a, b) =>
        compararNaJornada(a.funil.area, b.funil.area) || a.criadoEm.localeCompare(b.criadoEm),
    )
    .map((negocio) => {
      const origemId = negocio.negocioOrigemId ?? null;
      const origem = origemId ? porId.get(origemId) : undefined;
      return {
        negocio,
        veioDe: origem ? vinculo(origem) : null,
        veioDeOculto: !!origemId && !origem,
        gerou: negocios.filter((outro) => outro.negocioOrigemId === negocio.id).map(vinculo),
      };
    });
}

// ---------------------------------------------------------------------------------------------
// Telefone e CNPJ
// ---------------------------------------------------------------------------------------------

/**
 * Telefone como a API grava (R4.1): só dígitos, E.164; números brasileiros com 10 ou 11
 * dígitos ganham o 55. Serve para comparar o que a pessoa digita com os contatos existentes.
 * `"(11) 98765-4321"` → `"5511987654321"`.
 */
export function normalizarTelefone(texto: string | null | undefined): string | null {
  const digitos = (texto ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digitos) {
    return null;
  }
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

/**
 * `"5511987654321"` → `"+55 (11) 98765-4321"`; `"554130212202"` → `"+55 (41) 3021-2202"`.
 * Números de outros países ficam como `+<dígitos>`.
 */
export function formatarTelefone(e164: string | null | undefined): string {
  const digitos = (e164 ?? '').replace(/\D/g, '');
  if (!digitos) {
    return '';
  }
  const brasil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  if (brasil) {
    const [, ddd, parte1, parte2] = brasil;
    return `+55 (${ddd}) ${parte1}-${parte2}`;
  }
  return `+${digitos}`;
}

/** Link `tel:` com o número completo. */
export function linkTelefone(e164: string): string {
  return `tel:+${e164.replace(/\D/g, '')}`;
}

/** CNPJ sem pontuação e em maiúsculas (aceita o alfanumérico). */
export function limparCnpj(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[\s./-]/g, '').toUpperCase();
}

function digitoVerificadorCnpj(base: string): number {
  let peso = base.length - 7;
  let soma = 0;
  for (const caractere of base) {
    soma += (caractere.charCodeAt(0) - 48) * peso;
    peso = peso === 2 ? 9 : peso - 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * CNPJ válido pelos dígitos verificadores (R4.4), numérico ou alfanumérico (12 caracteres
 * de letras ou dígitos + 2 dígitos verificadores). Sequências repetidas não valem.
 */
export function cnpjValido(texto: string | null | undefined): boolean {
  const cnpj = limparCnpj(texto);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false;
  }
  const dv1 = digitoVerificadorCnpj(cnpj.slice(0, 12));
  const dv2 = digitoVerificadorCnpj(cnpj.slice(0, 12) + dv1);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

/** E-mail como a API grava: aparado e em minúsculas. */
export function normalizarEmail(texto: string | null | undefined): string | null {
  const email = (texto ?? '').trim().toLowerCase();
  return email || null;
}

/** Primeiro nome ("Ana Beatriz Lopes" → "Ana"). */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Endereço do site com protocolo, para o link (`acme.com.br` → `https://acme.com.br`). */
export function linkDoSite(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

/** Etiqueta e campo personalizado que a régua de cobrança respeita (R24.7). */
export const ETIQUETA_NAO_CONTATAR_WHATSAPP = 'nao-contatar-whatsapp';
export const CAMPO_NAO_CONTATAR_WHATSAPP = 'nao_contatar_whatsapp';

function campoLigado(valor: unknown): boolean {
  return (
    valor === true ||
    (typeof valor === 'string' && ['true', 'sim', '1', 'yes'].includes(valor.trim().toLowerCase()))
  );
}

/** O contato pediu para não ser cobrado por WhatsApp (etiqueta ou campo personalizado)? */
export function marcadoNaoContatarWhatsapp(
  contato: Pick<Contato, 'etiquetas' | 'camposPersonalizados'>,
): boolean {
  return (
    contato.etiquetas.includes(ETIQUETA_NAO_CONTATAR_WHATSAPP) ||
    campoLigado(contato.camposPersonalizados?.[CAMPO_NAO_CONTATAR_WHATSAPP])
  );
}

/**
 * A alteração que liga ou desliga a marca. Ligar põe a etiqueta; desligar tira a etiqueta e,
 * se o campo personalizado estava ligado, tira o campo também (senão a régua continuaria
 * respeitando a marca antiga).
 */
export function alteracaoNaoContatarWhatsapp(
  contato: Pick<Contato, 'etiquetas' | 'camposPersonalizados'>,
  ligado: boolean,
): AlteracaoContato {
  const semEtiqueta = contato.etiquetas.filter((e) => e !== ETIQUETA_NAO_CONTATAR_WHATSAPP);
  if (ligado) {
    return { etiquetas: [...semEtiqueta, ETIQUETA_NAO_CONTATAR_WHATSAPP] };
  }
  const { [CAMPO_NAO_CONTATAR_WHATSAPP]: _campo, ...resto } = contato.camposPersonalizados ?? {};
  return { etiquetas: semEtiqueta, camposPersonalizados: resto };
}
