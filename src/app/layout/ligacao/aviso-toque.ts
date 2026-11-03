import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  LucideDynamicIcon,
  LucidePhone,
  LucidePhoneIncoming,
  LucideVolumeX,
} from '@lucide/angular';
import { filter } from 'rxjs';

import { atalhoAria, atalhoFalado, ehAtalho, rotuloDoAtalho } from '../../nucleo/atalhos/atalhos';
import { LigacaoService, type Toque } from '../../nucleo/ligacoes/ligacao.service';
import { formatarTelefone } from '../../nucleo/ligacoes/ligacoes.textos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';

/** Atualização da barra de tempo do toque (ms). */
const PASSO_DA_BARRA_MS = 250;

/**
 * Aviso de ligação recebida, em qualquer tela (Onda E, E2): nome, número, canal, **Atender** e
 * **Recusar**. O toque sonoro vem do `LigacaoService` (Web Audio). Para o leitor de tela o aviso é
 * anunciado de forma assertiva, sem roubar o foco de quem está digitando; os atalhos
 * **Alt+A** (atender) e **Alt+R** (recusar) funcionam de qualquer lugar. Quando a ligação chega
 * pelo clique na notificação push (`?ligacao=<id>`), o botão Atender recebe o foco.
 *
 * "Recusar" usa a rota de recusa da API (`POST /ligacoes/:id/recusar`): o toque some para quem
 * recusou, os outros seguem sendo chamados e, se todos recusarem, a ligação vira perdida.
 * Os atalhos mudam por sistema (Alt no Windows e no Linux, Control+Shift no Mac).
 */
@Component({
  selector: 'app-aviso-toque',
  imports: [LucideDynamicIcon, Avatar, Botao],
  host: { '(document:keydown)': 'aoTeclar($event)' },
  template: `
    @if (toques().length > 0) {
      <section class="toques" aria-label="Ligações recebidas">
        @for (toque of toques(); track toque.ligacaoId; let primeiro = $first) {
          <article
            class="toque"
            [class.toque--destaque]="destaque() === toque.ligacaoId"
            [attr.aria-labelledby]="'toque-nome-' + toque.ligacaoId"
            [attr.aria-describedby]="'toque-info-' + toque.ligacaoId"
          >
            <p class="toque__etiqueta">
              <svg
                class="toque__icone"
                [lucideIcon]="icones.entrando"
                [size]="16"
                aria-hidden="true"
              />
              Ligação recebida
              <span class="toque__canal">· {{ toque.canal.nome }}</span>
            </p>
            <div class="toque__quem">
              <app-avatar [nome]="toque.contato.nome" tamanho="lg" decorativo />
              <div class="toque__textos">
                <h2 class="toque__nome" [id]="'toque-nome-' + toque.ligacaoId">
                  {{ toque.contato.nome }}
                </h2>
                <p class="toque__info" [id]="'toque-info-' + toque.ligacaoId">
                  {{ telefone(toque) }}
                  @if (toque.contato.empresa) {
                    <span class="toque__empresa">· {{ toque.contato.empresa }}</span>
                  }
                </p>
              </div>
            </div>
            @if (primeiro && somDesligado()) {
              <p class="toque__nota" role="note">
                <svg [lucideIcon]="icones.semSom" [size]="14" aria-hidden="true" />
                O toque está sem som. Clique em qualquer lugar da página para ativar.
              </p>
            }
            <div class="toque__tempo" aria-hidden="true">
              <span [style.width.%]="restante(toque)"></span>
            </div>
            <div class="toque__acoes">
              <button
                appBotao
                type="button"
                variante="marca"
                [icone]="icones.telefone"
                [id]="'toque-atender-' + toque.ligacaoId"
                [attr.aria-keyshortcuts]="primeiro ? ariaAtender : null"
                (click)="atender(toque)"
              >
                Atender
                @if (primeiro) {
                  <kbd class="toque__tecla" aria-hidden="true">{{ teclaAtender }}</kbd>
                }
              </button>
              <button
                appBotao
                type="button"
                variante="contorno"
                [attr.aria-keyshortcuts]="primeiro ? ariaRecusar : null"
                [attr.aria-describedby]="'toque-recusar-dica'"
                (click)="recusar(toque)"
              >
                Recusar
                @if (primeiro) {
                  <kbd class="toque__tecla" aria-hidden="true">{{ teclaRecusar }}</kbd>
                }
              </button>
            </div>
          </article>
        }
        <p id="toque-recusar-dica" class="visualmente-oculto">
          Recusar tira a ligação de você. Os outros atendentes continuam sendo chamados.
        </p>
      </section>
    }
  `,
  styleUrl: './aviso-toque.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoToque {
  private readonly ligacoes = inject(LigacaoService);
  private readonly anunciador = inject(LiveAnnouncer);
  private readonly roteador = inject(Router);
  private readonly sessao = inject(SessaoService);

  protected readonly icones = {
    entrando: LucidePhoneIncoming,
    telefone: LucidePhone,
    semSom: LucideVolumeX,
  };
  protected readonly teclaAtender = rotuloDoAtalho('A');
  protected readonly teclaRecusar = rotuloDoAtalho('R');
  protected readonly ariaAtender = atalhoAria('A');
  protected readonly ariaRecusar = atalhoAria('R');
  protected readonly toques = this.ligacoes.toques;
  protected readonly destaque = this.ligacoes.destaque;
  protected readonly somDesligado = this.ligacoes.somDesligado;
  private readonly agora = signal(Date.now());
  private readonly jaAnunciados = new Set<string>();
  /** Duração total de cada toque (do primeiro instante em que o aviso apareceu até `expiraEm`). */
  private readonly totais = new Map<string, number>();
  protected readonly precisaDeRelogio = computed(() => this.toques().length > 0);

  constructor() {
    // Barra de tempo: só corre enquanto há toque.
    effect((aoLimpar) => {
      if (this.precisaDeRelogio()) {
        const passo = setInterval(() => this.agora.set(Date.now()), PASSO_DA_BARRA_MS);
        aoLimpar(() => clearInterval(passo));
      }
    });
    // Anuncia cada toque novo ao leitor de tela.
    effect(() => {
      const atuais = this.toques();
      untracked(() => {
        for (const toque of atuais) {
          if (!this.jaAnunciados.has(toque.ligacaoId)) {
            this.jaAnunciados.add(toque.ligacaoId);
            this.totais.set(
              toque.ligacaoId,
              Math.max(1000, Date.parse(toque.expiraEm) - Date.now()),
            );
            this.anunciador.announce(
              `Ligação recebida de ${toque.contato.nome}, ${this.telefone(toque)}, pelo canal ${toque.canal.nome}. ${atalhoFalado('A')} atende, ${atalhoFalado('R')} recusa.`,
              'assertive',
            );
          }
        }
        for (const id of Array.from(this.jaAnunciados)) {
          if (!atuais.some((toque) => toque.ligacaoId === id)) {
            this.jaAnunciados.delete(id);
            this.totais.delete(id);
          }
        }
      });
    });
    // Clique na notificação push: o foco vai para o botão Atender.
    effect(() => {
      const id = this.destaque();
      if (id) {
        setTimeout(() => {
          document.getElementById(`toque-atender-${id}`)?.focus();
          this.ligacoes.limparDestaque();
        }, 50);
      }
    });
    // `/atendimento?ligacao=<id>` (link do push).
    const abrirLink = () => {
      const id = this.roteador.parseUrl(this.roteador.url).queryParams['ligacao'];
      if (typeof id === 'string' && id && this.sessao.autenticado()) {
        void this.ligacoes.abrirPorLink(id);
        void this.roteador.navigate([], {
          queryParams: { ligacao: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    };
    this.roteador.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(abrirLink);
    abrirLink();
  }

  protected telefone(toque: Toque): string {
    return formatarTelefone(toque.contato.telefone);
  }

  /** Quanto do tempo de toque ainda resta, em % (a barra esvazia até a ligação sumir). */
  protected restante(toque: Toque): number {
    const total = this.totais.get(toque.ligacaoId) ?? 10_000;
    const falta = Date.parse(toque.expiraEm) - this.agora();
    return Math.max(0, Math.min(100, (falta / total) * 100));
  }

  protected atender(toque: Toque): void {
    void this.ligacoes.atender(toque.ligacaoId);
  }

  protected recusar(toque: Toque): void {
    void this.ligacoes.recusar(toque.ligacaoId);
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    const primeiro = this.toques()[0];
    if (!primeiro) {
      return;
    }
    if (ehAtalho(evento, 'A')) {
      evento.preventDefault();
      this.atender(primeiro);
    } else if (ehAtalho(evento, 'R')) {
      evento.preventDefault();
      this.recusar(primeiro);
    }
  }
}
