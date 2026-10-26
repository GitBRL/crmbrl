import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LucideMessageCirclePlus, LucideUsersRound } from '@lucide/angular';

import { Botao } from '../../ui/botao/botao';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { ChatEstado } from './chat-estado';
import type { ChatCanal } from './chat.tipos';
import { focoPerdido } from './foco';
import { ListaCanais } from './lista-canais';
import { NovaDireta } from './nova-direta';
import { NovoGrupo } from './novo-grupo';

/**
 * Chat da equipe (`/chat`, §7 do contrato da Onda A, R15): a lista de canais da pessoa (Geral,
 * áreas, grupos e conversas diretas, com não lidas e menções) e o canal aberto na rota filha
 * (`/chat/:canalId`). No desktop as duas colunas ficam lado a lado, da altura da tela; no
 * celular, uma por vez (o canal tem o "voltar"). Tudo ao vivo pelo tempo real
 * (`chat.atualizado`, `chat.mensagem`, `digitando`).
 */
@Component({
  selector: 'app-chat',
  imports: [RouterOutlet, Botao, EstadoVazio, ListaCanais, NovaDireta, NovoGrupo],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChatEstado],
  host: { '[class.chat--canal-aberto]': 'aberto()' },
})
export class Chat {
  protected readonly estado = inject(ChatEstado);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly icones = { direta: LucideMessageCirclePlus, grupo: LucideUsersRound };
  /** Há um canal aberto na rota filha (`/chat/:canalId`). */
  protected readonly aberto = signal(false);
  protected readonly novoGrupoAberto = signal(false);
  protected readonly novaDiretaAberta = signal(false);

  constructor() {
    void this.estado.carregar();
  }

  protected aoAbrirCanal(): void {
    this.aberto.set(true);
  }

  protected aoFecharCanal(): void {
    this.aberto.set(false);
    // Voltar no celular: o canal some com o foco; ele vai para o título da lista.
    afterNextRender(
      () => {
        if (focoPerdido(this.documento)) {
          this.host.querySelector<HTMLElement>('.lista__titulo')?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  /** Grupo criado ou conversa direta aberta: entra na lista (se ainda não chegou) e abre. */
  protected irPara(canal: ChatCanal): void {
    this.estado.guardar(canal);
    void this.router.navigate(['/chat', canal.id]);
  }
}
