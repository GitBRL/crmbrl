import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideQrCode } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../../nucleo/api/erro-api';
import { Botao } from '../../../../ui/botao/botao';
import { CampoTexto } from '../../../../ui/campo-texto/campo-texto';
import { Modal } from '../../../../ui/modal/modal';
import { Seletor } from '../../../../ui/seletor/seletor';
import { gerarId } from '../../../../ui/tipos';
import { CanaisApi } from '../canais.api';
import { type NumeroWhatsapp, TAMANHO_MAXIMO_NOME_NUMERO } from '../canais.modelos';
import { AJUDA_FILA_PADRAO, FilasDisponiveis } from '../comum/filas';

/**
 * "Novo número" de WhatsApp: só o nome e a fila. O resto (limites, aquecimento, proteções) tem
 * padrões seguros e fica na tela do número, que abre em seguida já mostrando o QR.
 */
@Component({
  selector: 'app-novo-numero',
  imports: [ReactiveFormsModule, Botao, CampoTexto, Modal, Seletor],
  template: `
    <app-modal
      titulo="Novo número"
      complemento="· WhatsApp"
      [aberto]="aberto()"
      (fechado)="fechar()"
    >
      <form
        class="novo"
        novalidate
        [id]="idFormulario"
        [formGroup]="formulario"
        (ngSubmit)="criar()"
      >
        <p class="novo__frase">
          Dê um nome para reconhecer o número no CRM. Em seguida aparece um QR: é só ler com o
          WhatsApp do celular desse número.
        </p>
        <app-campo-texto
          #campoNome
          rotulo="Nome"
          placeholder="Ex.: Comercial — principal"
          dica="Aparece no Atendimento junto de cada conversa. O telefone é lido do QR."
          autocomplete="off"
          [maximoCaracteres]="tamanhoNome"
          formControlName="nome"
        />
        <app-seletor
          rotulo="Fila das conversas novas"
          placeholder="Sem fila"
          permitirVazio
          [ajuda]="ajudaFila"
          [dica]="
            filas.erro() ? 'Não conseguimos carregar as filas: dá para escolher depois.' : null
          "
          [opcoes]="filas.opcoes()"
          formControlName="filaPadraoId"
        />
        @if (erro(); as erro) {
          <p class="novo__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>
      <ng-container modal-rodape>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [icone]="iconeQr"
          [carregando]="enviando()"
          [attr.form]="idFormulario"
        >
          Criar e mostrar o QR
        </button>
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .novo {
      display: grid;
      gap: var(--esp-5);
    }

    .novo__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .novo__erro {
      color: var(--cor-erro);
      font: var(--fonte-legenda-lg);
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoNumero {
  readonly aberto = model(false);
  /** O número criado (a tela abre a página dele). */
  readonly criado = output<NumeroWhatsapp>();

  private readonly api = inject(CanaisApi);

  protected readonly iconeQr = LucideQrCode;
  protected readonly ajudaFila = AJUDA_FILA_PADRAO;
  protected readonly tamanhoNome = TAMANHO_MAXIMO_NOME_NUMERO;
  protected readonly idFormulario = gerarId('novo-numero');
  protected readonly filas = new FilasDisponiveis(this.api);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(TAMANHO_MAXIMO_NOME_NUMERO)],
    }),
    filaPadraoId: new FormControl<string | null>(null),
  });

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  constructor() {
    effect(() => {
      if (this.aberto()) {
        untracked(() => {
          this.formulario.reset({ nome: '', filaPadraoId: null });
          this.erro.set(null);
          void this.filas.carregar();
        });
      }
    });
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected async criar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erro.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.campoNome()?.focar();
      return;
    }
    const { nome, filaPadraoId } = this.formulario.getRawValue();
    this.enviando.set(true);
    try {
      const numero = await this.api.criarNumero({ nome: nome.trim(), filaPadraoId });
      this.aberto.set(false);
      this.criado.emit(numero);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doNome = erro.mensagemDoCampo('nome') ?? (erro.ehConflito ? erro.mensagem : null);
      if (doNome) {
        this.formulario.controls.nome.setErrors({ api: doNome });
        this.campoNome()?.focar();
      } else {
        this.erro.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
