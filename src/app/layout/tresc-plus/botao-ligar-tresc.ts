import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { LucidePhoneCall } from '@lucide/angular';

import { TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { Botao, type VarianteBotao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import type { TamanhoControle } from '../../ui/tipos';

/**
 * Botão **Ligar pelo 3C+** (R34.8): ao lado dos telefones do contato, do negócio e da conversa.
 * Aparece quando a empresa tem o 3C+ configurado (ou a pessoa já é vinculada). Sem vínculo, o
 * clique leva a "Conectar ao 3C+" no Meu perfil. Com o vendedor fora da campanha, a API entra
 * sozinha e a barra mostra "Entrando na campanha…".
 */
@Component({
  selector: 'app-botao-ligar-tresc',
  imports: [Botao, BotaoIcone],
  template: `
    @if (tresc.disponivel()) {
      @if (somenteIcone()) {
        <button
          appBotaoIcone
          type="button"
          [variante]="variante()"
          [tamanho]="tamanho()"
          [icone]="icone"
          [rotulo]="rotuloAcessivel()"
          [disabled]="desabilitado()"
          (click)="ligar()"
        ></button>
      } @else {
        <button
          appBotao
          type="button"
          [variante]="variante()"
          [tamanho]="tamanho()"
          [icone]="icone"
          [carregando]="tresc.ligando()"
          [disabled]="desabilitado()"
          [attr.aria-label]="rotuloAcessivel()"
          [attr.title]="dica()"
          (click)="ligar()"
        >
          {{ rotulo() }}
        </button>
      }
    }
  `,
  host: { '[style.display]': "tresc.disponivel() ? 'inline-flex' : 'none'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoLigarTresc {
  readonly contatoId = input<string | null>(null);
  readonly negocioId = input<string | null>(null);
  /** Telefone a discar; sem ele, a API usa o do contato. */
  readonly telefone = input<string | null>(null);
  readonly nome = input<string | null>(null);
  readonly rotulo = input('Ligar pelo 3C+');
  readonly variante = input<VarianteBotao>('contorno');
  readonly tamanho = input<TamanhoControle>('sm');
  readonly somenteIcone = input(false, { transform: booleanAttribute });

  protected readonly tresc = inject(TrescPlusService);
  protected readonly icone = LucidePhoneCall;

  protected readonly desabilitado = computed(
    () =>
      this.tresc.vinculado() &&
      (this.tresc.ocupado() || (!this.contatoId() && !this.negocioId() && !this.telefone())),
  );
  protected readonly dica = computed(() =>
    this.tresc.vinculado()
      ? this.tresc.ocupado()
        ? 'Você já está numa ligação.'
        : 'Liga pelo discador da empresa (3C+).'
      : 'Conecte o seu usuário ao 3C+ para ligar daqui.',
  );
  protected readonly rotuloAcessivel = computed(() => {
    const nome = this.nome();
    const base = this.tresc.vinculado() ? this.rotulo() : `${this.rotulo()} (conectar ao 3C+)`;
    return nome ? `${base}: ${nome}` : base;
  });

  protected ligar(): void {
    void this.tresc.ligar(
      {
        ...(this.contatoId() ? { contatoId: this.contatoId()! } : {}),
        ...(this.negocioId() ? { negocioId: this.negocioId()! } : {}),
        ...(this.telefone() ? { telefone: this.telefone()! } : {}),
      },
      this.nome(),
    );
  }
}
