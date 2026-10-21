import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideBell,
  LucideCalendarCheck,
  LucideDynamicIcon,
  LucideHandshake,
  LucideWebhook,
  type LucideIcon,
} from '@lucide/angular';

import { formatarTempoRelativo } from '../nucleo/formatos';
import { BotaoIcone } from '../ui/botao-icone/botao-icone';
import { Selo } from '../ui/selo/selo';
import { gerarId } from '../ui/tipos';
import { fecharAoTocarFora, focoSaiuDe } from './suspenso';

interface NotificacaoExemplo {
  readonly id: string;
  readonly icone: LucideIcon;
  readonly texto: string;
  /** Minutos antes da abertura do app. */
  readonly minutos: number;
}

const MINUTO = 60_000;

/**
 * Notificações fictícias que ilustram as regras do produto (dados de exemplo). Contam os
 * mesmos fatos das "Atividades recentes" da visão geral, com os mesmos horários.
 */
const EXEMPLOS: readonly NotificacaoExemplo[] = [
  {
    id: 'lead',
    icone: LucideWebhook,
    texto: 'O webhook “Site” criou o lead Maria Souza; o rodízio entregou para Rafael Souto.',
    minutos: 4,
  },
  {
    id: 'ganho',
    icone: LucideHandshake,
    texto: 'Negócio “Colégio Atlas” ganho: o cliente entrou no pipeline de CS.',
    minutos: 47,
  },
  {
    id: 'lembrete',
    icone: LucideCalendarCheck,
    texto: 'Lembrete: retornar a ligação para a Escola Horizonte.',
    minutos: 26 * 60,
  },
];

/**
 * Sino da barra superior: botão-ícone com ponto de notificação e um painel suspenso com as
 * notificações. Nesta etapa o conteúdo é de exemplo (as notificações reais chegam na
 * Fase 1): os exemplos aconteceram "N minutos" antes de o app abrir, e os tempos relativos
 * são recalculados a cada abertura do painel. Abrir marca tudo como lido; Esc ou clique fora
 * fecham.
 */
@Component({
  selector: 'app-notificacoes',
  imports: [BotaoIcone, Selo, LucideDynamicIcon],
  templateUrl: './notificacoes.html',
  styleUrl: './notificacoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'notificacoes',
    '(focusout)': 'aoPerderFoco($event)',
  },
})
export class Notificacoes {
  protected readonly iconeSino = LucideBell;
  protected readonly aberto = signal(false);
  protected readonly naoLidas = signal(EXEMPLOS.length);
  protected readonly idPainel = gerarId('notificacoes');
  protected readonly idTitulo = gerarId('notificacoes-titulo');
  protected readonly rotulo = computed(() => {
    const novas = this.naoLidas();
    return novas > 0 ? `Notificações, ${novas} novas` : 'Notificações';
  });
  /** Momento em que o app abriu (a casca é criada uma vez): a âncora dos exemplos. */
  private readonly abertura = Date.now();
  /** Atualizado a cada abertura do painel. */
  private readonly agora = signal(new Date(this.abertura));
  protected readonly itens = computed(() => {
    const agora = this.agora();
    return EXEMPLOS.map((exemplo) => {
      const quando = new Date(this.abertura - exemplo.minutos * MINUTO);
      return {
        ...exemplo,
        iso: quando.toISOString(),
        relativo: formatarTempoRelativo(quando, agora),
      };
    });
  });

  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly botao = viewChild.required('botao', { read: ElementRef<HTMLButtonElement> });
  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
  }

  protected alternar(): void {
    if (this.aberto()) {
      this.fechar(false);
      return;
    }
    this.agora.set(new Date());
    this.aberto.set(true);
    this.naoLidas.set(0);
    this.pararDeOuvir = fecharAoTocarFora(this.documento, this.host, () => this.fechar(false));
  }

  protected fechar(devolverFoco: boolean): void {
    if (!this.aberto()) {
      return;
    }
    this.aberto.set(false);
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
    if (devolverFoco) {
      this.botao().nativeElement.focus();
    }
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape' && this.aberto()) {
      evento.stopPropagation();
      this.fechar(true);
    }
  }

  protected aoPerderFoco(evento: FocusEvent): void {
    if (this.aberto() && focoSaiuDe(this.host, evento)) {
      this.fechar(false);
    }
  }
}
