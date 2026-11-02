import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  LucideCircleCheck,
  LucideFlag,
  LucideHourglass,
  LucideListTodo,
  LucideMessageSquareText,
  LucideSend,
  LucideTag,
  LucideUserPlus,
  LucideWebhook,
} from '@lucide/angular';

import {
  ConstrutorSegmento,
  type ContagemSegmento,
} from '../../ui/construtor-segmento/construtor-segmento';
import {
  type CampoSegmento,
  SEGMENTO_VAZIO,
  type Segmento,
} from '../../ui/construtor-segmento/segmento';
import { EditorModelo } from '../../ui/editor-modelo/editor-modelo';
import { EditorPassos } from '../../ui/editor-passos/editor-passos';
import { DEFINICAO_AGUARDAR, type DefinicaoPasso, type Passo } from '../../ui/editor-passos/passos';
import { type Agenda, agendaPadrao } from '../../ui/seletor-agenda/agenda';
import { SeletorAgenda } from '../../ui/seletor-agenda/seletor-agenda';
import { JANELA_COMERCIAL, type JanelaEnvio } from '../../ui/seletor-janela-envio/janela-envio';
import { SeletorJanelaEnvio } from '../../ui/seletor-janela-envio/seletor-janela-envio';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

const ETIQUETAS: CampoSegmento['opcoes'] = [
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'lead-quente', rotulo: 'Lead quente' },
  { valor: 'renovacao', rotulo: 'Renovação' },
];

/** Campos de exemplo: os mesmos tipos que o segmento real da API terá. */
const CAMPOS: readonly CampoSegmento[] = [
  { id: 'etiqueta', rotulo: 'Etiqueta', tipo: 'opcao', grupo: 'Contato', opcoes: ETIQUETAS },
  {
    id: 'origem',
    rotulo: 'Origem',
    tipo: 'opcao',
    grupo: 'Contato',
    opcoes: [
      { valor: 'site', rotulo: 'Site' },
      { valor: 'indicacao', rotulo: 'Indicação' },
      { valor: 'anuncio', rotulo: 'Anúncio' },
    ],
  },
  { id: 'cidade', rotulo: 'Cidade', tipo: 'texto', grupo: 'Contato' },
  { id: 'criado_em', rotulo: 'Data de criação', tipo: 'data', grupo: 'Contato' },
  { id: 'ultima_interacao', rotulo: 'Última interação', tipo: 'data', grupo: 'Contato' },
  { id: 'alunos', rotulo: 'Número de alunos', tipo: 'numero', grupo: 'Empresa' },
];

const CAMPOS_DATA: readonly OpcaoSeletor<string>[] = [
  { valor: 'contato.campos.renovacao', rotulo: 'Vencimento da renovação' },
  { valor: 'contato.campos.aniversario', rotulo: 'Aniversário' },
  { valor: 'negocio.previsao_fechamento', rotulo: 'Previsão de fechamento' },
];

const DEFINICOES: readonly DefinicaoPasso[] = [
  {
    tipo: 'negocio-ganho',
    fase: 'quando',
    rotulo: 'Um negócio é ganho',
    descricao: 'Dispara quando um negócio vai para “Ganho”.',
    icone: LucideCircleCheck,
    campos: [],
  },
  {
    tipo: 'mensagem-recebida',
    fase: 'quando',
    rotulo: 'Chega uma mensagem com uma palavra',
    descricao: 'Dispara quando o contato escreve a palavra combinada.',
    icone: LucideMessageSquareText,
    campos: [{ id: 'palavra', rotulo: 'Palavra', tipo: 'texto', obrigatorio: true }],
  },
  {
    tipo: 'tem-etiqueta',
    fase: 'se',
    rotulo: 'O contato tem a etiqueta',
    descricao: 'Segue por um caminho se tiver e por outro se não tiver.',
    icone: LucideTag,
    ramos: ['Se tiver', 'Se não tiver'],
    campos: [
      {
        id: 'etiqueta',
        rotulo: 'Etiqueta',
        tipo: 'opcao',
        opcoes: ETIQUETAS ?? [],
        obrigatorio: true,
      },
    ],
  },
  {
    tipo: 'enviar-whatsapp',
    fase: 'entao',
    rotulo: 'Enviar WhatsApp',
    descricao: 'Manda uma mensagem de WhatsApp para o contato.',
    icone: LucideSend,
    campos: [
      {
        id: 'texto',
        rotulo: 'Mensagem',
        tipo: 'texto-longo',
        obrigatorio: true,
        dica: 'Pode usar {{contato.primeiro_nome}} e variações {oi|olá}.',
      },
    ],
  },
  {
    tipo: 'criar-tarefa',
    fase: 'entao',
    rotulo: 'Criar tarefa',
    descricao: 'Cria uma atividade para o responsável.',
    icone: LucideListTodo,
    campos: [
      { id: 'titulo', rotulo: 'Título da tarefa', tipo: 'texto', obrigatorio: true },
      { id: 'prazo', rotulo: 'Prazo (dias)', tipo: 'numero', padrao: 2 },
    ],
    resumo: (config) =>
      config['titulo'] ? `${config['titulo']}, em ${config['prazo'] ?? 2} dias` : null,
  },
  {
    tipo: 'atribuir',
    fase: 'entao',
    rotulo: 'Atribuir ao rodízio',
    descricao: 'Passa o contato para o próximo vendedor do rodízio.',
    icone: LucideUserPlus,
    campos: [],
  },
  {
    tipo: 'webhook',
    fase: 'entao',
    rotulo: 'Chamar webhook',
    descricao: 'Avisa outro sistema.',
    icone: LucideWebhook,
    campos: [
      { id: 'url', rotulo: 'Endereço', tipo: 'texto', placeholder: 'https://', obrigatorio: true },
    ],
  },
  { ...DEFINICAO_AGUARDAR, icone: LucideHourglass },
  {
    tipo: 'marcar',
    fase: 'entao',
    rotulo: 'Marcar para acompanhamento',
    descricao: 'Sinaliza o contato na lista do responsável.',
    icone: LucideFlag,
    campos: [],
  },
];

const PASSOS_EXEMPLO: readonly Passo[] = [
  {
    id: 'ex-1',
    tipo: 'enviar-whatsapp',
    config: { texto: 'Oi, {{contato.primeiro_nome}}! Obrigado por escolher a BRL.' },
  },
  { id: 'ex-2', tipo: 'aguardar', config: { quantidade: 2, unidade: 'dias' } },
  {
    id: 'ex-3',
    tipo: 'tem-etiqueta',
    config: { etiqueta: 'cliente' },
    ramos: [
      {
        rotulo: 'Se tiver',
        passos: [
          {
            id: 'ex-4',
            tipo: 'criar-tarefa',
            config: { titulo: 'Ligar para agradecer', prazo: 2 },
          },
        ],
      },
      { rotulo: 'Se não tiver', passos: [{ id: 'ex-5', tipo: 'atribuir', config: {} }] },
    ],
  },
];

/**
 * Seção 16 do catálogo: os componentes das campanhas, do chatbot e das automações (Onda B).
 * Cada um com um exemplo que funciona; a contagem do segmento é simulada.
 */
@Component({
  selector: 'app-ds-automacao',
  imports: [
    Secao,
    Exemplo,
    ConstrutorSegmento,
    EditorModelo,
    EditorPassos,
    SeletorJanelaEnvio,
    SeletorAgenda,
  ],
  templateUrl: './automacao.html',
  styleUrl: './automacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Automacao {
  protected readonly campos = CAMPOS;
  protected readonly definicoes = DEFINICOES;
  protected readonly camposData = CAMPOS_DATA;

  protected readonly segmento = signal<Segmento>({
    combinacao: 'todos',
    condicoes: [
      { id: 'ex-a', campo: 'etiqueta', operador: 'e', valor: 'lead-quente' },
      { id: 'ex-b', campo: 'ultima_interacao', operador: 'ha-mais-de-dias', valor: 30 },
    ],
  });
  protected readonly segmentoVazio = signal<Segmento>(SEGMENTO_VAZIO);

  /** Simulação: cada condição completa reduz o total; "qualquer uma" soma em vez de reduzir. */
  protected readonly contar: ContagemSegmento = (segmento) =>
    new Promise((resolver) =>
      setTimeout(() => {
        const n = segmento.condicoes.length;
        const base = 5240;
        resolver(
          n === 0
            ? base
            : segmento.combinacao === 'todos'
              ? Math.round(base / 2 ** (n + 1))
              : Math.min(base, 640 * n),
        );
      }, 500),
    );

  protected readonly modelo = signal(
    'Oi, {{contato.primeiro_nome}}! {Tudo bem|Como vai}? Aqui é {{responsavel.nome}}, da BRL. Vi que a {{empresa.nome|sua escola}} ainda não renovou o plano. Posso ajudar?',
  );

  protected readonly gatilho = signal<Passo | null>({
    id: 'ex-g',
    tipo: 'negocio-ganho',
    config: {},
  });
  protected readonly passos = signal<readonly Passo[]>(PASSOS_EXEMPLO);

  protected readonly janela = signal<JanelaEnvio>(JANELA_COMERCIAL);
  protected readonly agendaCampanha = signal<Agenda>(agendaPadrao('agora'));
  protected readonly agendaAutomacao = signal<Agenda>({
    ...agendaPadrao('relativa'),
    campo: 'contato.campos.renovacao',
    quantidade: 7,
  });
}
