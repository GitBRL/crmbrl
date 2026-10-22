import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideCopy, LucideMail, LucideMessageCircle, LucidePhone } from '@lucide/angular';

import { AvisosService } from '../../nucleo/avisos.service';
import { copiarTexto } from '../../nucleo/copiar';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { formatarTelefone, linkTelefone } from './contatos.tipos';

/**
 * E-mail e telefone do cabeçalho do detalhe, cada um com as ações: abrir (e-mail / ligar) e
 * copiar. O WhatsApp integrado chega na Fase 2: o botão fica visível e diz isso.
 */
@Component({
  selector: 'app-meios-de-contato',
  imports: [BotaoIcone, LucideMail, LucidePhone],
  template: `
    @if (email(); as endereco) {
      <div class="meio">
        <svg lucideMail class="meio__icone" [size]="18" />
        <a class="meio__valor" [href]="'mailto:' + endereco">{{ endereco }}</a>
        <button
          appBotaoIcone
          type="button"
          tamanho="sm"
          variante="contorno"
          [icone]="icones.copiar"
          rotulo="Copiar e-mail"
          (click)="copiar(endereco, 'E-mail copiado.')"
        ></button>
      </div>
    }
    @if (telefone(); as numero) {
      <div class="meio">
        <svg lucidePhone class="meio__icone" [size]="18" />
        <a class="meio__valor numeros" [href]="linkTelefone(numero)">{{ telefoneFormatado() }}</a>
        <button
          appBotaoIcone
          type="button"
          tamanho="sm"
          variante="contorno"
          [icone]="icones.copiar"
          rotulo="Copiar telefone"
          (click)="copiar(telefoneFormatado(), 'Telefone copiado.')"
        ></button>
        <button
          appBotaoIcone
          type="button"
          tamanho="sm"
          variante="contorno"
          class="meio__em-breve"
          aria-disabled="true"
          [icone]="icones.whatsapp"
          rotulo="WhatsApp (chega na Fase 2)"
          (click)="avisarWhatsapp()"
        ></button>
      </div>
    }
    @if (!email() && !telefone()) {
      <p class="meio__vazio">Sem e-mail nem telefone.</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--esp-2);
      min-width: 0;
    }

    .meio {
      display: flex;
      align-items: center;
      gap: var(--esp-2);
      min-width: 0;
    }

    .meio__icone {
      flex: none;
      color: var(--cor-texto-suave);
    }

    .meio__valor {
      overflow: hidden;
      color: var(--cor-texto);
      font: var(--fonte-corpo);
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }

    .meio__em-breve {
      opacity: 0.55;
    }

    .meio__vazio {
      color: var(--cor-texto-fraco);
      font: var(--fonte-corpo-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeiosDeContato {
  readonly email = input<string | null>(null);
  /** E.164 só com dígitos. */
  readonly telefone = input<string | null>(null);

  private readonly avisos = inject(AvisosService);

  protected readonly icones = { copiar: LucideCopy, whatsapp: LucideMessageCircle };
  protected readonly linkTelefone = linkTelefone;
  protected readonly telefoneFormatado = computed(() => formatarTelefone(this.telefone()));

  protected async copiar(texto: string, mensagem: string): Promise<void> {
    if (await copiarTexto(texto)) {
      this.avisos.sucesso(mensagem, { chave: 'copiar' });
    } else {
      this.avisos.erro('Não deu para copiar: selecione o texto e copie à mão.');
    }
  }

  protected avisarWhatsapp(): void {
    this.avisos.info('Conversar pelo WhatsApp sem sair do CRM chega na Fase 2.', {
      chave: 'whatsapp',
    });
  }
}
