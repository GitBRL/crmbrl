import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { IntegracoesApi } from './integracoes.api';
import type { WebhookEntrada } from './tipos';

type Origem = 'GERAR' | 'INFORMAR';

const OPCOES: readonly OpcaoGrupo<Origem>[] = [
  {
    valor: 'GERAR',
    rotulo: 'Gerar um segredo',
    dica: 'O CRM cria um segredo forte e o mostra uma única vez.',
  },
  {
    valor: 'INFORMAR',
    rotulo: 'Usar um segredo já combinado',
    dica: 'Cole o segredo que o sistema que envia já usa (16 a 200 caracteres).',
  },
];

/**
 * Exige assinatura num webhook de entrada (R8.3): gera um segredo ou usa um já combinado. Com
 * ele, toda chamada precisa de `X-Assinatura`. Emite `definido` com o segredo gerado (só nessa
 * resposta) para a tela mostrá-lo uma vez.
 */
@Component({
  selector: 'app-modal-segredo-entrada',
  imports: [ReactiveFormsModule, Modal, Botao, GrupoOpcoes, CampoSenha],
  template: `
    <app-modal
      largura="md"
      [aberto]="!!webhook()"
      [titulo]="titulo()"
      (fechado)="webhook.set(null)"
    >
      @if (webhook(); as w) {
        <form class="segredo" novalidate [formGroup]="form" (ngSubmit)="salvar()">
          <p class="segredo__texto">
            @if (w.exigeAssinatura) {
              O segredo atual para de valer na hora: atualize o sistema que envia logo depois.
            } @else {
              Depois disto, toda chamada a “{{ w.nome }}” precisa do cabeçalho
              <code>X-Assinatura: sha256=&lt;HMAC-SHA256 do corpo&gt;</code>. Chamadas sem
              assinatura válida são recusadas (401).
            }
          </p>
          <app-grupo-opcoes rotulo="Segredo" [opcoes]="opcoes" formControlName="origem" />
          @if (form.controls.origem.value === 'INFORMAR') {
            <app-campo-senha
              rotulo="Segredo combinado"
              segredo
              dica="De 16 a 200 caracteres."
              formControlName="segredo"
            />
          }
        </form>
      }
      <div modal-rodape>
        <button appBotao type="button" variante="contorno" (click)="webhook.set(null)">
          Cancelar
        </button>
        <button
          appBotao
          type="button"
          variante="invertido"
          [carregando]="salvando()"
          (click)="salvar()"
        >
          {{ webhook()?.exigeAssinatura ? 'Trocar segredo' : 'Exigir assinatura' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    :host {
      display: contents;
    }

    .segredo {
      display: grid;
      gap: var(--esp-5);
    }

    /* Os botões viram filhos diretos do rodapé do modal (que dá o espaçamento). */
    [modal-rodape] {
      display: contents;
    }

    .segredo__texto {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);

      code {
        font-family: var(--familia-mono);
        font-size: 0.9em;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalSegredoEntrada {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Webhook alvo; o modal fica aberto enquanto não é nulo. */
  readonly webhook = model<WebhookEntrada | null>(null);
  readonly definido = output<{ webhook: WebhookEntrada; segredo?: string }>();

  protected readonly opcoes = OPCOES;
  protected readonly salvando = signal(false);
  protected readonly form = this.fb.group({
    origem: this.fb.control<Origem>('GERAR'),
    segredo: ['', [Validators.required, Validators.minLength(16), Validators.maxLength(200)]],
  });

  protected readonly titulo = computed(() =>
    this.webhook()?.exigeAssinatura ? 'Trocar o segredo' : 'Exigir assinatura',
  );

  constructor() {
    effect(() => {
      if (this.webhook()) {
        untracked(() => this.form.reset({ origem: 'GERAR', segredo: '' }));
      }
    });
  }

  protected async salvar(): Promise<void> {
    const webhook = this.webhook();
    if (!webhook) {
      return;
    }
    const informar = this.form.controls.origem.value === 'INFORMAR';
    if (informar && this.form.controls.segredo.invalid) {
      this.form.controls.segredo.markAsTouched();
      return;
    }
    this.salvando.set(true);
    try {
      const resposta = await this.api.definirSegredo(
        webhook.id,
        informar ? this.form.controls.segredo.value.trim() : undefined,
      );
      this.definido.emit(resposta);
      this.avisos.sucesso(
        webhook.exigeAssinatura
          ? `Segredo de “${webhook.nome}” trocado.`
          : `“${webhook.nome}” agora exige assinatura.`,
      );
      this.webhook.set(null);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doCampo = erro.mensagemDoCampo('segredo');
      if (informar && doCampo) {
        this.form.controls.segredo.setErrors({ api: doCampo });
        this.form.controls.segredo.markAsTouched();
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.salvando.set(false);
    }
  }
}
