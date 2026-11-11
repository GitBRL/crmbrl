import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  LucideBell,
  LucideDynamicIcon,
  LucidePlus,
  LucideX,
  type LucideIcon,
} from '@lucide/angular';
import { filter, map } from 'rxjs';

import { moduloPorId, modulosDaNavegacao, type Modulo } from '../nucleo/navegacao';
import { NotificacoesService } from '../nucleo/notificacoes.service';
import { SessaoService } from '../nucleo/sessao/sessao.service';
import { TempoRealService } from '../nucleo/tempo-real/tempo-real.service';
import { descreverNaoLidas } from './menu-lateral';
import { EstadoCasca } from './estado-casca';
import { fecharAoTocarFora } from './suspenso';

interface ItemInferior {
  readonly id: string;
  readonly rotulo: string;
  readonly rota: string;
  /** Prefixo da URL em que o item fica marcado (`/funis` vale para todos os funis). */
  readonly prefixo: string;
  readonly icone: LucideIcon;
  readonly contagem: number;
}

interface AcaoRapida {
  readonly id: 'responder' | 'atividade' | 'negocio';
  readonly rotulo: string;
  readonly dica: string;
  readonly rota: string;
  readonly icone: LucideIcon;
}

/**
 * Preferência do destino do item "Funis": o primeiro destes que a pessoa acessa; sem nenhum, o
 * primeiro funil de setor que ela acessa (um setor criado depois, por exemplo).
 */
const FUNIS_PREFERIDOS = ['funil-comercial', 'funil-marketing', 'funil-cs'] as const;

/**
 * Navegação inferior do celular (< 900 px, DESIGN-SYSTEM.md §5): Início, Atendimento,
 * Atividades, Funis e Notificações, só com o que o papel acessa (R12: Marketing não vê o
 * Atendimento). Alvos de 44 px ou mais. Acima dela, o botão "Ações rápidas" abre um menu com
 * os atalhos de campo: responder uma conversa, registrar uma atividade e mover um negócio.
 * "Notificações" abre o painel do sino da barra superior.
 */
@Component({
  selector: 'app-navegacao-inferior',
  imports: [RouterLink, LucideDynamicIcon],
  templateUrl: './navegacao-inferior.html',
  styleUrl: './navegacao-inferior.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavegacaoInferior {
  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly estado = inject(EstadoCasca);
  private readonly tempoReal = inject(TempoRealService);
  private readonly notificacoes = inject(NotificacoesService);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private pararDeOuvir: (() => void) | null = null;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly icones = { sino: LucideBell, mais: LucidePlus, fechar: LucideX };
  protected readonly menuAberto = signal(false);

  /** O funil que o item "Funis" abre (`null` se a pessoa não acessa nenhum). */
  private readonly funil = computed<Modulo | null>(() => {
    const funis = modulosDaNavegacao(this.sessao.permissoes()?.areasVisiveis ?? []).filter(
      (modulo) => modulo.grupo === 'funis' && this.sessao.pode(modulo),
    );
    return (
      FUNIS_PREFERIDOS.map((id) => funis.find((modulo) => modulo.id === id)).find(Boolean) ??
      funis[0] ??
      null
    );
  });

  protected readonly itens = computed<readonly ItemInferior[]>(() => {
    const itens: ItemInferior[] = [];
    const naoLidasAtendimento = this.tempoReal.naoLidas().atendimento;
    const incluir = (
      id: string,
      rotulo: string,
      rota: string | null,
      prefixo: string,
      contagem = 0,
    ) => {
      const modulo = moduloPorId(id);
      if (modulo && rota) {
        itens.push({ id, rotulo, rota, prefixo, icone: modulo.icone, contagem });
      }
    };
    incluir('inicio', 'Início', '/inicio', '/inicio');
    if (this.sessao.pode('atendimento')) {
      incluir('atendimento', 'Atendimento', '/atendimento', '/atendimento', naoLidasAtendimento);
    }
    if (this.sessao.pode('atividades')) {
      incluir('atividades', 'Atividades', '/atividades', '/atividades');
    }
    const funil = this.funil();
    if (funil) {
      itens.push({
        id: funil.id,
        rotulo: 'Funis',
        rota: funil.rota,
        prefixo: '/funis',
        icone: funil.icone,
        contagem: 0,
      });
    }
    return itens;
  });

  /** Em Atendimento e Chat o campo de mensagem fica no rodapé: o botão sairia por cima dele. */
  protected readonly mostrarAcoes = computed(() => {
    const url = this.url();
    return !/^\/(atendimento|chat)(\/|\?|#|$)/.test(url);
  });

  protected readonly naoLidas = this.notificacoes.naoLidas;
  protected readonly rotuloNotificacoes = computed(() => {
    const total = this.naoLidas();
    return total > 0 ? `Notificações, ${descreverNaoLidas(total)}` : 'Notificações';
  });

  protected readonly acoes = computed<readonly AcaoRapida[]>(() => {
    const acoes: AcaoRapida[] = [];
    const icone = (id: string) => moduloPorId(id)!.icone;
    if (this.sessao.pode('atendimento')) {
      acoes.push({
        id: 'responder',
        rotulo: 'Responder conversa',
        dica: 'Abre o Atendimento.',
        rota: '/atendimento',
        icone: icone('atendimento'),
      });
    }
    if (this.sessao.pode('atividades')) {
      acoes.push({
        id: 'atividade',
        rotulo: 'Registrar atividade',
        dica: 'Abre as Atividades com o campo de criação pronto.',
        rota: '/atividades',
        icone: icone('atividades'),
      });
    }
    const funil = this.funil();
    if (funil) {
      acoes.push({
        id: 'negocio',
        rotulo: 'Mover negócio',
        dica: 'No cartão, use o menu «⋯» e escolha “Mover para…”.',
        rota: funil.rota,
        icone: funil.icone,
      });
    }
    return acoes;
  });

  protected ativo(item: ItemInferior): boolean {
    const url = this.url().split(/[?#]/)[0];
    return url === item.prefixo || url.startsWith(`${item.prefixo}/`);
  }

  protected alternarMenu(): void {
    if (this.menuAberto()) {
      this.fecharMenu();
      return;
    }
    this.menuAberto.set(true);
    this.pararDeOuvir = fecharAoTocarFora(this.documento, this.host, () => this.fecharMenu());
  }

  protected fecharMenu(devolverFoco = false): void {
    this.menuAberto.set(false);
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
    if (devolverFoco) {
      this.host.querySelector<HTMLElement>('.nav-inf__mais')?.focus();
    }
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape' && this.menuAberto()) {
      evento.stopPropagation();
      this.fecharMenu(true);
    }
  }

  protected abrirNotificacoes(): void {
    // O toque fora fecha o painel antes deste clique: não reabre o que o mesmo toque fechou.
    if (this.estado.fechouNotificacoesAgora()) {
      return;
    }
    this.fecharMenu();
    this.estado.pedirNotificacoes();
  }

  protected async executar(acao: AcaoRapida): Promise<void> {
    this.fecharMenu();
    if (!(await this.router.navigateByUrl(acao.rota))) {
      return;
    }
    if (acao.id === 'atividade') {
      this.focarCriacaoDeAtividade();
    }
  }

  /** A página de Atividades carrega em seguida: espera o campo de criação aparecer. */
  private focarCriacaoDeAtividade(tentativa = 0): void {
    const campo = this.documento.querySelector<HTMLElement>(
      'app-criacao-rapida input, app-criacao-rapida textarea',
    );
    if (campo) {
      campo.focus();
    } else if (tentativa < 20) {
      setTimeout(() => this.focarCriacaoDeAtividade(tentativa + 1), 100);
    }
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararDeOuvir?.());
    // Trocar de página fecha o menu.
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd))
      .subscribe(() => this.menuAberto() && this.fecharMenu());
  }
}
