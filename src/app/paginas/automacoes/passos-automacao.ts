import {
  LucideBell,
  LucideBriefcase,
  LucideBot,
  LucideCircleStop,
  LucideListTodo,
  LucideMail,
  LucideMessageCircle,
  LucideMoveRight,
  LucideTag,
  LucideUserCheck,
  LucideWebhook,
  LucideGitBranch,
} from '@lucide/angular';

import {
  type ConfigPasso,
  DEFINICAO_AGUARDAR,
  type DefinicaoPasso,
  type Passo,
  type ValorConfig,
} from '../../ui/editor-passos/passos';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import type { PassoApi } from './automacoes.tipos';

/**
 * Passos da automação: as definições para o editor (campos simples, em português) e a conversão
 * entre os passos da tela (`config` plana de texto e número) e os da API (`config` com listas e
 * objetos). O que a tela não edita (rótulo do passo, canal, espera "até uma data"…) fica guardado
 * em `Bruto` e volta para a API como estava.
 */

export interface ApoioDePassos {
  /** Etapas de todos os funis, "Funil › Etapa". */
  readonly etapas: readonly OpcaoSeletor<string>[];
  readonly usuarios: readonly OpcaoSeletor<string>[];
  readonly fluxos: readonly OpcaoSeletor<string>[];
  readonly webhooks: readonly OpcaoSeletor<string>[];
  readonly modelosWhatsapp: readonly OpcaoSeletor<string>[];
  readonly modelosEmail: readonly OpcaoSeletor<string>[];
  readonly etiquetas: readonly OpcaoSeletor<string>[];
}

export const APOIO_VAZIO: ApoioDePassos = {
  etapas: [],
  usuarios: [],
  fluxos: [],
  webhooks: [],
  modelosWhatsapp: [],
  modelosEmail: [],
  etiquetas: [],
};

const DICA_VARIAVEIS =
  'Use {{contato.primeiro_nome}} para o nome, {{negocio.titulo}} para o negócio e {Olá|Oi} para variar a saudação.';

const TIPOS_ATIVIDADE: readonly OpcaoSeletor<string>[] = [
  { valor: 'TAREFA', rotulo: 'Tarefa' },
  { valor: 'LIGACAO', rotulo: 'Ligação' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'WHATSAPP', rotulo: 'WhatsApp' },
];

const PRIORIDADES: readonly OpcaoSeletor<string>[] = [
  { valor: 'BAIXA', rotulo: 'Baixa' },
  { valor: 'MEDIA', rotulo: 'Média' },
  { valor: 'ALTA', rotulo: 'Alta' },
];

const UNIDADES: readonly OpcaoSeletor<string>[] = [
  { valor: 'minutos', rotulo: 'minutos' },
  { valor: 'horas', rotulo: 'horas' },
  { valor: 'dias', rotulo: 'dias' },
];

export const TIPOS_DE_CONDICAO: readonly OpcaoSeletor<string>[] = [
  { valor: 'etiqueta', rotulo: 'Tem a etiqueta' },
  { valor: 'sem_etiqueta', rotulo: 'Não tem a etiqueta' },
  { valor: 'tem_email', rotulo: 'Tem e-mail cadastrado' },
  { valor: 'tem_telefone', rotulo: 'Tem telefone cadastrado' },
  { valor: 'sem_responsavel', rotulo: 'Está sem responsável' },
  { valor: 'avancada', rotulo: 'Condição avançada (criada fora da tela)' },
];

/** Definições dos passos para o editor; as listas dependem do que a API devolveu. */
export function definicoesDePassos(apoio: ApoioDePassos): readonly DefinicaoPasso[] {
  const vazioOu = (op: readonly OpcaoSeletor<string>[]) => [
    { valor: '', rotulo: '(nenhum)' },
    ...op,
  ];
  return [
    {
      tipo: 'acao.whatsapp',
      fase: 'entao',
      rotulo: 'Enviar WhatsApp',
      descricao: 'Manda uma mensagem de WhatsApp para o contato.',
      icone: LucideMessageCircle,
      campos: [
        {
          id: 'texto',
          rotulo: 'Mensagem',
          tipo: 'texto-longo',
          dica: DICA_VARIAVEIS,
          placeholder: 'Olá, {{contato.primeiro_nome}}! …',
        },
        {
          id: 'modeloId',
          rotulo: 'Ou use um modelo salvo',
          tipo: 'opcao',
          opcoes: vazioOu(apoio.modelosWhatsapp),
          dica: 'Se escolher um modelo, ele vale no lugar do texto acima.',
        },
      ],
    },
    {
      tipo: 'acao.email',
      fase: 'entao',
      rotulo: 'Enviar e-mail',
      descricao: 'Manda um e-mail para o contato.',
      icone: LucideMail,
      campos: [
        { id: 'assunto', rotulo: 'Assunto', tipo: 'texto' },
        { id: 'texto', rotulo: 'Mensagem', tipo: 'texto-longo', dica: DICA_VARIAVEIS },
        {
          id: 'modeloId',
          rotulo: 'Ou use um modelo salvo',
          tipo: 'opcao',
          opcoes: vazioOu(apoio.modelosEmail),
        },
      ],
    },
    {
      tipo: 'acao.atividade',
      fase: 'entao',
      rotulo: 'Criar atividade',
      descricao: 'Cria uma tarefa, ligação ou lembrete para alguém do time.',
      icone: LucideListTodo,
      campos: [
        { id: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: TIPOS_ATIVIDADE, padrao: 'TAREFA' },
        {
          id: 'titulo',
          rotulo: 'Título',
          tipo: 'texto',
          obrigatorio: true,
          placeholder: 'Ligar para {{contato.nome}}',
        },
        { id: 'descricao', rotulo: 'Detalhes', tipo: 'texto-longo' },
        {
          id: 'prioridade',
          rotulo: 'Prioridade',
          tipo: 'opcao',
          opcoes: PRIORIDADES,
          padrao: 'MEDIA',
        },
        { id: 'prazoQuantidade', rotulo: 'Prazo (quanto)', tipo: 'numero', padrao: 1 },
        {
          id: 'prazoUnidade',
          rotulo: 'Prazo (unidade)',
          tipo: 'opcao',
          opcoes: UNIDADES,
          padrao: 'dias',
        },
        {
          id: 'responsavelId',
          rotulo: 'Responsável',
          tipo: 'opcao',
          opcoes: vazioOu(apoio.usuarios),
          dica: 'Vazio: quem cuida do negócio ou do contato.',
        },
      ],
      resumo: (c) => (c['titulo'] ? String(c['titulo']) : null),
    },
    {
      tipo: 'acao.mover_etapa',
      fase: 'entao',
      rotulo: 'Mover o negócio de etapa',
      descricao: 'Leva o negócio para outra etapa do funil.',
      icone: LucideMoveRight,
      campos: [
        {
          id: 'etapaId',
          rotulo: 'Etapa de destino',
          tipo: 'opcao',
          opcoes: apoio.etapas,
          obrigatorio: true,
        },
        {
          id: 'motivoPerda',
          rotulo: 'Motivo (se for etapa de perda)',
          tipo: 'texto',
        },
      ],
    },
    {
      tipo: 'acao.atribuir',
      fase: 'entao',
      rotulo: 'Escolher o responsável',
      descricao: 'Define quem cuida do contato ou do negócio.',
      icone: LucideUserCheck,
      campos: [
        {
          id: 'estrategia',
          rotulo: 'Como escolher',
          tipo: 'opcao',
          obrigatorio: true,
          padrao: 'RODIZIO',
          opcoes: [
            { valor: 'RESPONSAVEL_FIXO', rotulo: 'Uma pessoa específica' },
            { valor: 'RODIZIO', rotulo: 'Rodízio da área' },
            { valor: 'LIDER_DA_AREA', rotulo: 'O líder da área' },
          ],
        },
        {
          id: 'responsavelId',
          rotulo: 'Pessoa (se for específica)',
          tipo: 'opcao',
          opcoes: vazioOu(apoio.usuarios),
        },
        {
          id: 'area',
          rotulo: 'Área (rodízio ou líder)',
          tipo: 'opcao',
          opcoes: [
            { valor: '', rotulo: '(a do registro)' },
            { valor: 'MARKETING', rotulo: 'Marketing' },
            { valor: 'COMERCIAL', rotulo: 'Comercial' },
            { valor: 'CS', rotulo: 'CS' },
          ],
        },
      ],
    },
    {
      tipo: 'acao.etiquetar',
      fase: 'entao',
      rotulo: 'Mudar etiquetas',
      descricao: 'Coloca ou tira etiquetas do contato.',
      icone: LucideTag,
      campos: [
        {
          id: 'adicionar',
          rotulo: 'Colocar',
          tipo: 'texto',
          placeholder: 'quente, cliente',
          dica: 'Separe várias etiquetas com vírgula.',
        },
        { id: 'remover', rotulo: 'Tirar', tipo: 'texto', placeholder: 'frio' },
      ],
      resumo: (c) =>
        [c['adicionar'] ? `+ ${c['adicionar']}` : '', c['remover'] ? `− ${c['remover']}` : '']
          .filter(Boolean)
          .join('  ') || null,
    },
    {
      tipo: 'acao.criar_negocio',
      fase: 'entao',
      rotulo: 'Criar negócio',
      descricao: 'Abre um negócio para o contato em um funil.',
      icone: LucideBriefcase,
      campos: [
        {
          id: 'etapaId',
          rotulo: 'Etapa inicial',
          tipo: 'opcao',
          opcoes: apoio.etapas,
          obrigatorio: true,
        },
        {
          id: 'titulo',
          rotulo: 'Título',
          tipo: 'texto',
          placeholder: 'Oportunidade — {{contato.nome}}',
        },
        { id: 'valor', rotulo: 'Valor (R$)', tipo: 'numero' },
      ],
    },
    {
      tipo: 'acao.notificar',
      fase: 'entao',
      rotulo: 'Avisar alguém',
      descricao: 'Manda um aviso no sino do CRM.',
      icone: LucideBell,
      campos: [
        {
          id: 'para',
          rotulo: 'Quem recebe',
          tipo: 'opcao',
          obrigatorio: true,
          padrao: 'responsavel',
          opcoes: [
            { valor: 'responsavel', rotulo: 'O responsável' },
            { valor: 'lider', rotulo: 'O líder' },
            { valor: 'usuarios', rotulo: 'Uma pessoa específica' },
          ],
        },
        {
          id: 'usuarioId',
          rotulo: 'Pessoa (se for específica)',
          tipo: 'opcao',
          opcoes: vazioOu(apoio.usuarios),
        },
        { id: 'titulo', rotulo: 'Título do aviso', tipo: 'texto', obrigatorio: true },
        { id: 'texto', rotulo: 'Texto', tipo: 'texto-longo' },
      ],
      resumo: (c) => (c['titulo'] ? String(c['titulo']) : null),
    },
    {
      tipo: 'acao.webhook',
      fase: 'entao',
      rotulo: 'Chamar um webhook',
      descricao: 'Avisa outro sistema pelo webhook de saída.',
      icone: LucideWebhook,
      campos: [
        apoio.webhooks.length
          ? {
              id: 'webhookId',
              rotulo: 'Webhook',
              tipo: 'opcao',
              opcoes: apoio.webhooks,
              obrigatorio: true,
            }
          : {
              id: 'webhookId',
              rotulo: 'Código do webhook',
              tipo: 'texto',
              obrigatorio: true,
              dica: 'Copie o código na tela de integrações (só o Admin vê a lista).',
            },
      ],
    },
    {
      tipo: 'acao.chatbot',
      fase: 'entao',
      rotulo: 'Iniciar um chatbot',
      descricao: 'Começa um fluxo de chatbot na conversa.',
      icone: LucideBot,
      campos: [
        { id: 'fluxoId', rotulo: 'Fluxo', tipo: 'opcao', opcoes: apoio.fluxos, obrigatorio: true },
      ],
    },
    {
      tipo: 'condicao',
      fase: 'se',
      rotulo: 'Se… senão',
      descricao: 'Segue por um caminho ou por outro, conforme o contato.',
      icone: LucideGitBranch,
      ramos: ['Se sim', 'Se não'],
      campos: [
        {
          id: 'tipoCondicao',
          rotulo: 'O contato…',
          tipo: 'opcao',
          obrigatorio: true,
          padrao: 'etiqueta',
          opcoes: TIPOS_DE_CONDICAO,
        },
        {
          id: 'valor',
          rotulo: 'Etiqueta',
          tipo: 'texto',
          dica: 'Só para “Tem / Não tem a etiqueta”.',
          placeholder: 'cliente',
        },
      ],
      resumo: (c) => {
        const t = TIPOS_DE_CONDICAO.find((o) => o.valor === c['tipoCondicao']);
        if (!t) return null;
        return c['valor'] && String(c['tipoCondicao']).includes('etiqueta')
          ? `${t.rotulo} “${c['valor']}”`
          : t.rotulo;
      },
    },
    DEFINICAO_AGUARDAR,
    {
      tipo: 'encerrar',
      fase: 'entao',
      rotulo: 'Encerrar aqui',
      descricao: 'Termina a automação neste ponto.',
      icone: LucideCircleStop,
      campos: [{ id: 'motivo', rotulo: 'Motivo (opcional)', tipo: 'texto' }],
    },
  ];
}

// --- Conversão ---------------------------------------------------------------------------------

/** O que a tela não edita, por id de passo. */
export type Bruto = Map<string, { rotulo?: string; config: Record<string, unknown> }>;

type Plano = Record<string, ValorConfig>;

function texto(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}
function lista(v: unknown): string | null {
  return Array.isArray(v) && v.length ? v.join(', ') : null;
}
function numero(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
function itens(v: ValorConfig | undefined): string[] {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
function preenchido(v: ValorConfig | undefined): boolean {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function planoDaApi(tipo: string, c: Record<string, unknown>): Plano {
  switch (tipo) {
    case 'acao.whatsapp':
      return { texto: texto(c['texto']), modeloId: texto(c['modeloId']) };
    case 'acao.email':
      return {
        assunto: texto(c['assunto']),
        texto: texto(c['texto']),
        modeloId: texto(c['modeloId']),
      };
    case 'acao.atividade': {
      const prazo = (c['prazo'] ?? {}) as Record<string, unknown>;
      return {
        tipo: texto(c['tipo']) ?? 'TAREFA',
        titulo: texto(c['titulo']),
        descricao: texto(c['descricao']),
        prioridade: texto(c['prioridade']) ?? 'MEDIA',
        prazoQuantidade: numero(prazo['quantidade']),
        prazoUnidade: texto(prazo['unidade']) ?? 'dias',
        responsavelId: texto(c['responsavelId']),
      };
    }
    case 'acao.mover_etapa':
      return { etapaId: texto(c['etapaId']), motivoPerda: texto(c['motivoPerda']) };
    case 'acao.atribuir':
      return {
        estrategia: texto(c['estrategia']) ?? 'RODIZIO',
        responsavelId: texto(c['responsavelId']),
        area: texto(c['area']),
      };
    case 'acao.etiquetar':
      return { adicionar: lista(c['adicionar']), remover: lista(c['remover']) };
    case 'acao.criar_negocio':
      return {
        etapaId: texto(c['etapaId']),
        titulo: texto(c['titulo']),
        valor: numero(c['valor']),
      };
    case 'acao.notificar': {
      const ids = Array.isArray(c['usuarioIds']) ? (c['usuarioIds'] as string[]) : [];
      return {
        para: texto(c['para']) ?? 'responsavel',
        usuarioId: ids[0] ?? null,
        titulo: texto(c['titulo']),
        texto: texto(c['texto']),
      };
    }
    case 'acao.webhook':
      return { webhookId: texto(c['webhookId']) };
    case 'acao.chatbot':
      return { fluxoId: texto(c['fluxoId']) };
    case 'aguardar':
      return { quantidade: numero(c['quantidade']), unidade: texto(c['unidade']) ?? 'horas' };
    case 'encerrar':
      return { motivo: texto(c['motivo']) };
    case 'condicao':
      return condicaoDaApi(c['segmento']);
    default:
      return {};
  }
}

function condicaoDaApi(segmento: unknown): Plano {
  const s = segmento as {
    condicoes?: { campo: string; operador: string; valor?: unknown }[];
  } | null;
  const conds = s?.condicoes ?? [];
  if (conds.length === 1 && !('grupo' in conds[0])) {
    const c = conds[0];
    const v = Array.isArray(c.valor) && c.valor.length === 1 ? String(c.valor[0]) : null;
    if (c.campo === 'etiquetas' && v !== null) {
      return { tipoCondicao: c.operador === 'nao_contem' ? 'sem_etiqueta' : 'etiqueta', valor: v };
    }
    if (c.campo === 'email' && c.operador === 'preenchido')
      return { tipoCondicao: 'tem_email', valor: null };
    if (c.campo === 'telefone' && c.operador === 'preenchido')
      return { tipoCondicao: 'tem_telefone', valor: null };
    if (c.campo === 'responsavel' && c.operador === 'vazio')
      return { tipoCondicao: 'sem_responsavel', valor: null };
  }
  return { tipoCondicao: 'avancada', valor: null };
}

function condicaoParaApi(p: ConfigPasso, bruto: Record<string, unknown>): Record<string, unknown> {
  const valor = String(p['valor'] ?? '').trim();
  switch (p['tipoCondicao']) {
    case 'etiqueta':
      return {
        segmento: {
          condicoes: [{ campo: 'etiquetas', operador: 'contem_alguma', valor: [valor] }],
        },
      };
    case 'sem_etiqueta':
      return {
        segmento: { condicoes: [{ campo: 'etiquetas', operador: 'nao_contem', valor: [valor] }] },
      };
    case 'tem_email':
      return { segmento: { condicoes: [{ campo: 'email', operador: 'preenchido' }] } };
    case 'tem_telefone':
      return { segmento: { condicoes: [{ campo: 'telefone', operador: 'preenchido' }] } };
    case 'sem_responsavel':
      return { segmento: { condicoes: [{ campo: 'responsavel', operador: 'vazio' }] } };
    default:
      return bruto;
  }
}

function configParaApi(
  tipo: string,
  p: ConfigPasso,
  bruto: Record<string, unknown>,
  funilDaEtapa: (etapaId: string) => string | undefined,
): Record<string, unknown> {
  // `bruto` entra primeiro: o que a tela não conhece volta como estava.
  const base: Record<string, unknown> = { ...bruto };
  const definir = (chave: string, valor: unknown) => {
    if (valor === null || valor === undefined || valor === '') delete base[chave];
    else base[chave] = valor;
  };
  switch (tipo) {
    case 'acao.whatsapp':
      definir('texto', texto(p['texto']));
      definir('modeloId', texto(p['modeloId']));
      return base;
    case 'acao.email':
      definir('assunto', texto(p['assunto']));
      definir('texto', texto(p['texto']));
      definir('modeloId', texto(p['modeloId']));
      return base;
    case 'acao.atividade':
      definir('tipo', p['tipo']);
      definir('titulo', p['titulo']);
      definir('descricao', texto(p['descricao']));
      definir('prioridade', p['prioridade']);
      definir(
        'prazo',
        preenchido(p['prazoQuantidade'])
          ? { quantidade: Number(p['prazoQuantidade']), unidade: p['prazoUnidade'] ?? 'dias' }
          : null,
      );
      definir('responsavelId', texto(p['responsavelId']));
      return base;
    case 'acao.mover_etapa':
      definir('etapaId', p['etapaId']);
      definir('motivoPerda', texto(p['motivoPerda']));
      return base;
    case 'acao.atribuir':
      definir('estrategia', p['estrategia']);
      definir(
        'responsavelId',
        p['estrategia'] === 'RESPONSAVEL_FIXO' ? texto(p['responsavelId']) : null,
      );
      definir('area', texto(p['area']));
      return base;
    case 'acao.etiquetar':
      definir('adicionar', itens(p['adicionar']).length ? itens(p['adicionar']) : null);
      definir('remover', itens(p['remover']).length ? itens(p['remover']) : null);
      return base;
    case 'acao.criar_negocio': {
      const etapaId = texto(p['etapaId']);
      definir('etapaId', etapaId);
      if (etapaId) definir('funilId', funilDaEtapa(etapaId));
      definir('titulo', texto(p['titulo']));
      definir('valor', preenchido(p['valor']) ? Number(p['valor']) : null);
      return base;
    }
    case 'acao.notificar':
      definir('para', p['para']);
      definir(
        'usuarioIds',
        p['para'] === 'usuarios' && texto(p['usuarioId']) ? [p['usuarioId']] : null,
      );
      definir('titulo', p['titulo']);
      definir('texto', texto(p['texto']));
      return base;
    case 'acao.webhook':
      definir('webhookId', p['webhookId']);
      return base;
    case 'acao.chatbot':
      definir('fluxoId', p['fluxoId']);
      return base;
    case 'aguardar':
      if (preenchido(p['quantidade'])) {
        delete base['ate'];
        base['quantidade'] = Number(p['quantidade']);
        base['unidade'] = p['unidade'] ?? 'horas';
      }
      return base;
    case 'encerrar':
      definir('motivo', texto(p['motivo']));
      return base;
    case 'condicao':
      return condicaoParaApi(p, bruto);
    default:
      return base;
  }
}

const RAMOS_CONDICAO = [
  { id: 'sim', rotulo: 'Se sim' },
  { id: 'nao', rotulo: 'Se não' },
];

/** Passos da API → passos da tela. Guarda em `bruto` o que a tela não edita. */
export function passosDaApi(passos: readonly PassoApi[], bruto: Bruto): Passo[] {
  return passos.map((p) => {
    const config = (p.config ?? {}) as Record<string, unknown>;
    bruto.set(p.id, { rotulo: p.rotulo, config });
    const plano = planoDaApi(p.tipo, config);
    const resultado: Passo = { id: p.id, tipo: p.tipo, config: plano };
    if (p.tipo === 'condicao') {
      return {
        ...resultado,
        ramos: RAMOS_CONDICAO.map((r) => ({
          rotulo: r.rotulo,
          passos: passosDaApi(p.ramos?.find((x) => x.id === r.id)?.passos ?? [], bruto),
        })),
      };
    }
    return resultado;
  });
}

/** Passos da tela → API. Ids repetidos (passo novo com o mesmo número de um carregado) são trocados. */
export function passosParaApi(
  passos: readonly Passo[],
  bruto: Bruto,
  funilDaEtapa: (etapaId: string) => string | undefined,
): PassoApi[] {
  const usados = new Set<string>();
  const unico = (id: string): string => {
    let novo = id;
    let n = 2;
    while (usados.has(novo)) {
      novo = `${id}-${n++}`;
    }
    usados.add(novo);
    return novo;
  };
  const converter = (lista: readonly Passo[]): PassoApi[] =>
    lista.map((p) => {
      const guardado = bruto.get(p.id);
      const id = unico(p.id);
      const saida: PassoApi = {
        id,
        tipo: p.tipo,
        ...(guardado?.rotulo ? { rotulo: guardado.rotulo } : {}),
        config: configParaApi(p.tipo, p.config, guardado?.config ?? {}, funilDaEtapa),
      };
      if (p.tipo === 'condicao') {
        saida.ramos = (p.ramos ?? []).map((r, i) => ({
          id: RAMOS_CONDICAO[i]?.id ?? `ramo-${i + 1}`,
          rotulo: RAMOS_CONDICAO[i]?.rotulo ?? r.rotulo,
          passos: converter(r.passos),
        }));
      }
      return saida;
    });
  return converter(passos);
}
