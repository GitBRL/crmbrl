import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  output,
  signal,
} from '@angular/core';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { Modal } from '../../ui/modal/modal';
import { ChatApi } from './chat.api';
import type { ChatCanal, ChatPessoa } from './chat.tipos';
import { SeletorPessoas } from './seletor-pessoas';

/**
 * "Conversa direta": escolher uma pessoa abre a conversa com ela (a API cria se ainda não
 * existe — uma por par de pessoas). Só as duas leem: nem o Admin tem acesso.
 */
@Component({
  selector: 'app-chat-nova-direta',
  imports: [Botao, Modal, SeletorPessoas],
  template: `
    <app-modal titulo="Conversa direta" largura="sm" [aberto]="aberto()" (fechado)="fechar()">
      @if (aberto()) {
        <div class="direta" [attr.aria-busy]="abrindo() || null">
          <p class="direta__frase">Escolha com quem conversar. Só vocês dois leem as mensagens.</p>
          <app-chat-seletor-pessoas
            rotulo="Com quem conversar"
            [excluir]="excluir()"
            (escolher)="abrir($event)"
          />
          @if (abrindo(); as nome) {
            <p class="direta__status" role="status">Abrindo a conversa com {{ nome }}…</p>
          }
          @if (erro(); as mensagem) {
            <p class="direta__erro" role="alert">{{ mensagem }}</p>
          }
        </div>
      }
      <ng-container modal-rodape>
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .direta {
      display: grid;
      gap: var(--esp-4);
    }

    .direta__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .direta__status {
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .direta__erro {
      color: var(--cor-erro);
      font: var(--fonte-legenda-lg);
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovaDireta {
  readonly aberto = model(false);
  /** A conversa aberta (a página vai para ela). */
  readonly aberta = output<ChatCanal>();

  private readonly api = inject(ChatApi);
  private readonly sessao = inject(SessaoService);

  /** Nome de quem está sendo aberto (ocupado). */
  protected readonly abrindo = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly excluir = computed(() => {
    const eu = this.sessao.usuario()?.id;
    return eu ? [eu] : [];
  });

  protected fechar(): void {
    this.aberto.set(false);
    this.erro.set(null);
  }

  protected async abrir(pessoa: ChatPessoa): Promise<void> {
    if (this.abrindo()) {
      return;
    }
    this.abrindo.set(pessoa.nome);
    this.erro.set(null);
    try {
      const { canal } = await this.api.iniciarDireta(pessoa.id);
      this.aberta.emit(canal);
      this.fechar();
    } catch (falha) {
      this.erro.set(erroDaApi(falha).mensagem);
    } finally {
      this.abrindo.set(null);
    }
  }
}
