import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
// Só ícones que o app já usa em outras telas: o @lucide/angular é um arquivo único e todo
// ícone usado em qualquer tela vai para o chunk inicial (DESIGN-SYSTEM.md §4, "Ícones e o
// bundle inicial"). Um ícone só do catálogo pesaria ~3 kB no carregamento de todo mundo.
import {
  LucideArrowLeft,
  LucideBell,
  LucideChevronsRight,
  LucideEye,
  LucideLayoutDashboard,
  LucideMegaphone,
  LucideMessageCircle,
  LucideMessagesSquare,
  LucidePlus,
  LucideRefreshCw,
  LucideSend,
  LucideSettings,
  LucideShare2,
  LucideSparkles,
  LucideWandSparkles,
  LucideWebhook,
} from '@lucide/angular';

import { TemaService, type Tema } from '../../nucleo/tema.service';
import { Abas, type ItemAba } from '../../ui/abas/abas';
import { AlternadorTema } from '../../ui/alternador-tema/alternador-tema';
import { Avatar } from '../../ui/avatar/avatar';
import { BarraFunil, type SerieFunil } from '../../ui/barra-funil/barra-funil';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { CampoBusca } from '../../ui/campo-busca/campo-busca';
import { Cartao } from '../../ui/cartao/cartao';
import { Chip, type TipoChip } from '../../ui/chip/chip';
import { Dica } from '../../ui/dica/dica';
import { Indicador } from '../../ui/indicador/indicador';
import { Legenda } from '../../ui/legenda/legenda';
import { Logo } from '../../ui/logo/logo';
import { Modal } from '../../ui/modal/modal';
import { PilhaAvatares, type PessoaAvatar } from '../../ui/pilha-avatares/pilha-avatares';
import { Selo } from '../../ui/selo/selo';
import { ZonaSoltar } from '../../ui/zona-soltar/zona-soltar';
import { Exemplo } from './exemplo';
import { Fundamentos, lerCorDoToken } from './fundamentos';
import { Secao } from './secao';

interface EtapaExemplo {
  readonly etapa: string;
  readonly total: number;
  readonly series: readonly SerieFunil[];
  readonly queda: number | null;
  readonly dias: number;
}

interface CampoExemplo {
  readonly rotulo: string;
  readonly tipo: TipoChip;
}

const ORIGENS = ['Site e webhooks', 'WhatsApp', 'Indicação e outros'] as const;

function series(...valores: number[]): readonly SerieFunil[] {
  return valores.map((valor, indice) => ({ rotulo: ORIGENS[indice], valor }));
}

/**
 * Catálogo vivo do design system (`/design-system`): tokens e cada componente de `ui/` em
 * todas as variantes e estados, com uma linha de "quando usar". Segue o tema da página e,
 * no fim, mostra uma composição nos dois temas lado a lado (`data-tema` num contêiner).
 */
@Component({
  selector: 'app-design-system',
  imports: [
    RouterLink,
    Exemplo,
    Fundamentos,
    Secao,
    Abas,
    AlternadorTema,
    Avatar,
    BarraFunil,
    Botao,
    BotaoIcone,
    CampoBusca,
    Cartao,
    Chip,
    Dica,
    Indicador,
    Legenda,
    Logo,
    Modal,
    PilhaAvatares,
    Selo,
    ZonaSoltar,
  ],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystem {
  protected readonly tema = inject(TemaService);

  /** Índice do topo: id da seção (âncora), rótulo e número ("01"). */
  protected readonly indice = [
    ['cores', 'Cores'],
    ['tipografia', 'Tipografia'],
    ['forma', 'Espaço e forma'],
    ['icones', 'Ícones'],
    ['botoes', 'Botões'],
    ['abas', 'Abas'],
    ['cartoes', 'Cartões'],
    ['dados', 'Dados'],
    ['pessoas', 'Pessoas'],
    ['campos', 'Campos e arrastar'],
    ['ajuda', 'Dica e modal'],
    ['marca', 'Tema e marca'],
    ['dois-temas', 'Dois temas'],
  ].map(([id, rotulo], i) => ({ id, rotulo, numero: String(i + 1).padStart(2, '0') }));

  protected readonly icones = {
    voltar: LucideArrowLeft,
    sino: LucideBell,
    avancar: LucideChevronsRight,
    ver: LucideEye,
    layout: LucideLayoutDashboard,
    relatorio: LucideMegaphone,
    mais: LucidePlus,
    atualizar: LucideRefreshCw,
    enviar: LucideSend,
    compartilhar: LucideShare2,
    personalizar: LucideSettings,
    ia: LucideSparkles,
    varinha: LucideWandSparkles,
  };

  // Botões
  protected readonly salvando = signal(false);
  protected readonly canais = [
    { id: 'whatsapp', rotulo: 'WhatsApp', icone: LucideMessageCircle },
    { id: 'chat', rotulo: 'Chat', icone: LucideMessagesSquare },
    { id: 'disparos', rotulo: 'Disparos', icone: LucideSend },
    { id: 'webhook', rotulo: 'Webhook', icone: LucideWebhook },
  ] as const;
  protected readonly canal = signal<string>('whatsapp');

  // Abas
  protected readonly abasPilulas: readonly ItemAba[] = [
    { id: 'funil', rotulo: 'Funil' },
    { id: 'atendimento', rotulo: 'Atendimento' },
    { id: 'equipe', rotulo: 'Equipe' },
  ];
  protected readonly abaPilulas = signal<string | null>('funil');
  protected readonly abasEntalhe: readonly ItemAba[] = [
    { id: 'jornada', rotulo: 'Jornada do cliente' },
    { id: 'atendimento', rotulo: 'Atendimento' },
    { id: 'equipe', rotulo: 'Equipe' },
  ];
  protected readonly abaEntalhe = signal<string | null>('jornada');
  protected readonly periodos: readonly ItemAba[] = [
    { id: '7d', rotulo: '7 dias' },
    { id: '30d', rotulo: '30 dias' },
    { id: 'trimestre', rotulo: 'Trimestre' },
  ];
  protected readonly periodo = signal<string | null>('30d');

  // Cartões
  protected readonly atividades = [
    {
      pessoa: 'Rafael Souto',
      texto: 'Webhook "Site" criou o lead Maria Souza',
      quando: 'há 5 min',
    },
    {
      pessoa: 'João Batista',
      texto: 'Moveu "Escola Horizonte" para Proposta',
      quando: 'há 18 min',
    },
    {
      pessoa: 'Lucas Prado',
      texto: 'Recebeu "Colégio Atlas" no pipeline de CS',
      quando: 'há 47 min',
    },
  ] as const;

  // Dados
  protected readonly origens: readonly string[] = ORIGENS;
  protected readonly etapas: readonly EtapaExemplo[] = [
    { etapa: 'Leads', total: 1600, series: series(700, 300, 600), queda: null, dias: 4 },
    {
      etapa: 'Leads qualificados',
      total: 1410,
      series: series(600, 500, 310),
      queda: 11.9,
      dias: 8,
    },
    { etapa: 'Oportunidades', total: 1208, series: series(404, 484, 320), queda: 14.3, dias: 22 },
  ];

  // Pessoas
  protected readonly equipe: readonly PessoaAvatar[] = [
    { nome: 'Ana Ribeiro' },
    { nome: 'Carla Nogueira' },
    { nome: 'João Batista' },
    { nome: 'Beatriz Lima' },
    { nome: 'Lucas Prado' },
    { nome: 'Fernanda Rocha' },
  ];

  // Campos e arrastar
  protected readonly campos: readonly CampoExemplo[] = [
    { rotulo: 'Nome da empresa', tipo: 'texto' },
    { rotulo: 'Origem do lead', tipo: 'texto' },
    { rotulo: 'Valor', tipo: 'numero' },
    { rotulo: 'Data de fechamento', tipo: 'data' },
  ];
  protected readonly camposSoltos = signal<readonly string[]>([]);
  protected readonly emArraste = signal<string | null>(null);
  protected readonly busca = signal('');
  protected readonly ultimaBusca = signal<string | null>(null);

  // Modal
  protected readonly modalAberto = signal(false);

  // Tema e marca: o logo nos dois temas, com o valor de --cor-logo lido do CSS de cada painel
  // depois de renderizar (assim a regra mostrada nunca diverge do token).
  protected readonly temasMarca: readonly Tema[] = ['claro', 'escuro'];
  protected readonly paineisMarca = signal(this.temasMarca.map((tema) => ({ tema, cor: '' })));
  private readonly elementosMarca = viewChildren<ElementRef<HTMLElement>>('painelMarca');

  // Dois temas
  protected readonly temas: readonly Tema[] = ['escuro', 'claro'];

  private esperaSalvar: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.esperaSalvar));
    afterNextRender(() => {
      const elementos = this.elementosMarca();
      this.paineisMarca.update((paineis) =>
        paineis.map((painel, i) => ({
          ...painel,
          cor: elementos[i] ? lerCorDoToken(elementos[i].nativeElement, '--cor-logo') : '',
        })),
      );
    });
  }

  /** Simula um salvamento de 1,5 s para mostrar o estado "carregando". */
  protected salvar(): void {
    this.salvando.set(true);
    clearTimeout(this.esperaSalvar);
    this.esperaSalvar = setTimeout(() => this.salvando.set(false), 1500);
  }

  protected iniciarArraste(evento: DragEvent, campo: string): void {
    evento.dataTransfer?.setData('text/plain', campo);
    if (evento.dataTransfer) {
      evento.dataTransfer.effectAllowed = 'move';
    }
    this.emArraste.set(campo);
  }

  protected terminarArraste(): void {
    this.emArraste.set(null);
  }

  protected receberCampo(campo: string): void {
    const rotulo = campo.trim();
    if (rotulo && !this.camposSoltos().includes(rotulo)) {
      this.camposSoltos.update((lista) => [...lista, rotulo]);
    }
  }

  /** Alternativa por teclado/toque ao arrastar: adiciona o próximo campo que falta. */
  protected adicionarProximo(): void {
    const proximo = this.campos.find((campo) => !this.camposSoltos().includes(campo.rotulo));
    if (proximo) {
      this.receberCampo(proximo.rotulo);
    }
  }

  protected limparCampos(): void {
    this.camposSoltos.set([]);
  }

  protected tipoDoCampo(rotulo: string): TipoChip {
    return this.campos.find((campo) => campo.rotulo === rotulo)?.tipo ?? 'texto';
  }
}
