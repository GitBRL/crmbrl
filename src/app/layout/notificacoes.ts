import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, type UrlTree } from '@angular/router';
import {
  LucideBell,
  LucideCalendarCheck,
  LucideContact,
  LucideDynamicIcon,
  LucideHandshake,
  LucideMegaphone,
  LucideMessageCircle,
  LucideMessagesSquare,
  LucideRefreshCw,
  LucideSparkles,
  LucideTriangleAlert,
  LucideUserMinus,
  LucideWebhook,
  LucideWorkflow,
  type LucideIcon,
} from '@lucide/angular';

import { AvisosService } from '../nucleo/avisos.service';
import { formatarTempoRelativo } from '../nucleo/formatos';
import {
  type Notificacao,
  NotificacoesService,
  rotaDaNotificacao,
} from '../nucleo/notificacoes.service';
import { Botao } from '../ui/botao/botao';
import { BotaoIcone } from '../ui/botao-icone/botao-icone';
import { gerarId } from '../ui/tipos';
import { EstadoCasca } from './estado-casca';
import { fecharAoTocarFora, focoSaiuDe } from './suspenso';

/** Ícone de cada tipo de notificação (os mesmos dos módulos, para reconhecer de relance). */
const ICONE_DO_TIPO: Readonly<Record<string, LucideIcon>> = {
  'negocio.atribuido': LucideHandshake,
  'contato.atribuido': LucideContact,
  'empresa.atribuida': LucideContact,
  'passagem.recebida': LucideWorkflow,
  'desligamento.itens_recebidos': LucideUserMinus,
  'atividade.vencendo': LucideCalendarCheck,
  'atividade.atrasada': LucideTriangleAlert,
  'webhook_saida.falhou': LucideWebhook,
  'webhook_saida.desativado': LucideWebhook,
  'equipe.sem_lider': LucideUserMinus,
};

/**
 * Tipos novos pelo começo do nome (Onda A: conversas do Atendimento, menções no Chat da equipe,
 * avisos dos canais), para um tipo que a API acrescentar já ter o ícone do módulo.
 */
const ICONE_DO_PREFIXO: readonly (readonly [string, LucideIcon])[] = [
  ['conversa.', LucideMessagesSquare],
  ['atendimento.', LucideMessagesSquare],
  ['chat.', LucideMessageCircle],
  ['whatsapp.', LucideWebhook],
  ['canal.', LucideWebhook],
  ['campanha.', LucideMegaphone],
  ['automacao.', LucideWorkflow],
  ['importacao.', LucideContact],
  ['assistente.', LucideSparkles],
];

export function iconeDaNotificacao(tipo: string): LucideIcon {
  return (
    ICONE_DO_TIPO[tipo] ??
    ICONE_DO_PREFIXO.find(([prefixo]) => tipo.startsWith(prefixo))?.[1] ??
    LucideBell
  );
}

interface ItemNotificacao {
  readonly notificacao: Notificacao;
  readonly icone: LucideIcon;
  /** `UrlTree` (e não texto): o `routerLink` com texto codificaria a query (`?` → `%3F`). */
  readonly rota: UrlTree | null;
  readonly relativo: string;
  readonly lida: boolean;
}

/**
 * Sino da barra superior (TELAS-FASE1 §2): botão-ícone com a contagem de não lidas e um
 * painel suspenso com as notificações — não lidas primeiro, ícone por tipo, tempo relativo,
 * link para o item e "Marcar todas como lidas". Os dados vêm do `NotificacoesService`: as novas
 * chegam ao vivo (tempo real), com uma busca de reserva a cada 60 s e quando a aba volta a ficar
 * visível; abrir o painel atualiza na hora.
 * Esc ou clique fora fecham. Notificações novas são anunciadas aos leitores de tela.
 */
@Component({
  selector: 'app-notificacoes',
  imports: [RouterLink, BotaoIcone, Botao, LucideDynamicIcon],
  templateUrl: './notificacoes.html',
  styleUrl: './notificacoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'notificacoes',
    '(focusout)': 'aoPerderFoco($event)',
  },
})
export class Notificacoes {
  protected readonly servico = inject(NotificacoesService);
  private readonly avisos = inject(AvisosService);
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly router = inject(Router);
  private readonly estadoCasca = inject(EstadoCasca, { optional: true });

  protected readonly icones = { sino: LucideBell, recarregar: LucideRefreshCw };
  protected readonly aberto = signal(false);
  protected readonly marcandoTodas = signal(false);
  protected readonly idPainel = gerarId('notificacoes');
  protected readonly idTitulo = gerarId('notificacoes-titulo');
  protected readonly naoLidas = this.servico.naoLidas;
  protected readonly rotulo = computed(() => {
    const total = this.naoLidas();
    if (total <= 0) {
      return 'Notificações';
    }
    return total === 1 ? 'Notificações, 1 não lida' : `Notificações, ${total} não lidas`;
  });
  /** Recalculado a cada abertura e atualização, para os tempos relativos andarem. */
  private readonly agora = signal(new Date());
  protected readonly itens = computed<readonly ItemNotificacao[]>(() => {
    const agora = this.agora();
    return this.servico.itens().map((notificacao) => ({
      notificacao,
      icone: iconeDaNotificacao(notificacao.tipo),
      rota: this.rotaDe(notificacao.link),
      relativo: formatarTempoRelativo(notificacao.criadoEm, agora),
      lida: notificacao.lidaEm !== null,
    }));
  });

  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly botao = viewChild.required('botao', { read: ElementRef<HTMLButtonElement> });
  private pararDeOuvir: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());

    // A navegação inferior (celular) pede para abrir o painel.
    let pedidoVisto = this.estadoCasca?.pedidoNotificacoes() ?? 0;
    effect(() => {
      const pedido = this.estadoCasca?.pedidoNotificacoes() ?? 0;
      untracked(() => {
        if (pedido !== pedidoVisto && !this.aberto()) {
          this.alternar();
        }
        pedidoVisto = pedido;
      });
    });

    // Chegaram notificações novas (a contagem subiu numa atualização): avisa o leitor de tela.
    let anterior: number | null = null;
    effect(() => {
      const total = this.naoLidas();
      const atualizado = this.servico.atualizadoEm();
      untracked(() => {
        this.agora.set(new Date());
        if (atualizado && anterior !== null && total > anterior) {
          const novas = total - anterior;
          void this.anunciador.announce(
            novas === 1 ? 'Você tem 1 notificação nova.' : `Você tem ${novas} notificações novas.`,
            'polite',
          );
        }
        anterior = atualizado ? total : null;
      });
    });
  }

  protected alternar(): void {
    if (this.aberto()) {
      this.fechar(false);
      return;
    }
    this.agora.set(new Date());
    this.aberto.set(true);
    void this.servico.atualizar();
    this.pararDeOuvir = fecharAoTocarFora(this.documento, this.host, () => this.fechar(false));
  }

  protected fechar(devolverFoco: boolean): void {
    if (!this.aberto()) {
      return;
    }
    this.aberto.set(false);
    this.estadoCasca?.notificacoesFecharam();
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
    if (devolverFoco) {
      this.botao().nativeElement.focus();
    }
  }

  /** Clique no item com link: marca como lida (sem esperar) e o link segue para a tela. */
  protected abrir(item: ItemNotificacao): void {
    this.marcar(item);
    this.fechar(false);
  }

  protected marcar(item: ItemNotificacao): void {
    if (item.lida) {
      return;
    }
    this.servico.marcarComoLida(item.notificacao.id).catch((falha: unknown) => {
      this.avisos.erro(falha);
    });
  }

  protected async marcarTodas(): Promise<void> {
    if (this.marcandoTodas() || this.naoLidas() === 0) {
      return;
    }
    this.marcandoTodas.set(true);
    try {
      await this.servico.marcarTodasComoLidas();
      this.avisos.sucesso('Todas as notificações foram marcadas como lidas.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.marcandoTodas.set(false);
    }
  }

  protected tentarDeNovo(): void {
    void this.servico.atualizar();
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

  private rotaDe(link: string | null): UrlTree | null {
    const rota = rotaDaNotificacao(link);
    if (!rota) {
      return null;
    }
    try {
      return this.router.parseUrl(rota);
    } catch {
      return null;
    }
  }
}
