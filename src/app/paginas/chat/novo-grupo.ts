import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideUsersRound } from '@lucide/angular';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';
import { ChatApi } from './chat.api';
import { type ChatCanal, type ChatPessoa, LIMITES_CHAT } from './chat.tipos';
import { SeletorPessoas } from './seletor-pessoas';

/**
 * "Novo grupo": nome, descrição opcional e quem participa. Quem cria entra como administrador
 * (renomeia, adiciona e tira pessoas, arquiva). O grupo criado abre em seguida.
 */
@Component({
  selector: 'app-chat-novo-grupo',
  imports: [ReactiveFormsModule, AreaTexto, Botao, CampoTexto, Modal, SeletorPessoas],
  template: `
    <app-modal titulo="Novo grupo" [aberto]="aberto()" (fechado)="fechar()">
      @if (aberto()) {
        <form
          class="grupo"
          novalidate
          [id]="idFormulario"
          [formGroup]="formulario"
          (ngSubmit)="criar()"
        >
          <p class="grupo__frase">
            Junte as pessoas de um assunto (um lançamento, um cliente grande) numa conversa só. Você
            entra como administrador e pode mudar quem participa depois.
          </p>
          <app-campo-texto
            #campoNome
            rotulo="Nome do grupo"
            placeholder="Ex.: Lançamento de novembro"
            autocomplete="off"
            [maximoCaracteres]="limites.nome"
            formControlName="nome"
          />
          <app-area-texto
            rotulo="Descrição"
            opcional
            placeholder="Para que serve o grupo"
            [linhas]="2"
            [maximoLinhas]="5"
            [maximoCaracteres]="limites.descricao"
            formControlName="descricao"
          />
          <fieldset class="grupo__pessoas">
            <legend class="grupo__legenda">
              Quem participa
              <span class="grupo__contagem">{{ resumoPessoas() }}</span>
            </legend>
            <app-chat-seletor-pessoas
              multipla
              rotulo="Buscar pessoas para o grupo"
              [excluir]="excluir()"
              [(selecionados)]="pessoas"
            />
            @if (erroPessoas()) {
              <p class="grupo__erro" role="alert">{{ erroPessoas() }}</p>
            }
          </fieldset>
          @if (erro(); as erro) {
            <p class="grupo__erro" role="alert">{{ erro.mensagem }}</p>
          }
        </form>
      }
      <ng-container modal-rodape>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [icone]="iconeGrupo"
          [carregando]="enviando()"
          [attr.form]="idFormulario"
        >
          Criar grupo
        </button>
        <button appBotao type="button" variante="contorno" (click)="fechar()">Cancelar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .grupo {
      display: grid;
      gap: var(--esp-5);
    }

    .grupo__frase {
      color: var(--cor-texto-suave);
      font: var(--fonte-corpo);
    }

    .grupo__pessoas {
      display: grid;
      gap: var(--esp-3);
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .grupo__legenda {
      padding: 0 0 var(--esp-2) var(--esp-4);
      font: var(--fonte-rotulo);
    }

    .grupo__contagem {
      margin-left: var(--esp-2);
      color: var(--cor-texto-suave);
      font-weight: 400;
    }

    .grupo__erro {
      padding-inline: var(--esp-4);
      color: var(--cor-erro);
      font: var(--fonte-legenda-lg);
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoGrupo {
  readonly aberto = model(false);
  /** O grupo criado (a página abre ele). */
  readonly criado = output<ChatCanal>();

  private readonly api = inject(ChatApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);

  protected readonly iconeGrupo = LucideUsersRound;
  protected readonly limites = LIMITES_CHAT;
  protected readonly idFormulario = gerarId('novo-grupo');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  protected readonly erroPessoas = signal<string | null>(null);
  protected readonly pessoas = signal<readonly ChatPessoa[]>([]);
  protected readonly excluir = computed(() => {
    const eu = this.sessao.usuario()?.id;
    return eu ? [eu] : [];
  });
  protected readonly resumoPessoas = computed(() => {
    const total = this.pessoas().length;
    if (!total) {
      return 'só você, por enquanto';
    }
    return `você e mais ${total === 1 ? '1 pessoa' : `${total} pessoas`}`;
  });

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_CHAT.nome)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_CHAT.descricao)],
    }),
  });

  private readonly campoNome = viewChild<CampoTexto>('campoNome');

  protected fechar(): void {
    this.aberto.set(false);
    this.formulario.reset({ nome: '', descricao: '' });
    this.pessoas.set([]);
    this.erro.set(null);
    this.erroPessoas.set(null);
  }

  protected async criar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erro.set(null);
    this.erroPessoas.set(null);
    this.formulario.markAllAsTouched();
    const nome = this.formulario.controls.nome.value.trim();
    if (!nome) {
      this.formulario.controls.nome.setErrors({ required: true });
    }
    if (this.formulario.invalid) {
      this.campoNome()?.focar();
      return;
    }
    if (!this.pessoas().length) {
      this.erroPessoas.set('Escolha pelo menos uma pessoa para conversar no grupo.');
      return;
    }
    this.enviando.set(true);
    try {
      const canal = await this.api.criarGrupo({
        nome,
        descricao: this.formulario.controls.descricao.value.trim() || null,
        membrosIds: this.pessoas().map((pessoa) => pessoa.id),
      });
      this.avisos.sucesso(`Grupo “${canal.nome}” criado.`);
      this.criado.emit(canal);
      this.fechar();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const doNome = erro.mensagemDoCampo('nome');
      if (doNome) {
        this.formulario.controls.nome.setErrors({ api: doNome });
        this.campoNome()?.focar();
      } else if (erro.ehConflito || erro.mensagemDoCampo('membrosIds')) {
        this.erroPessoas.set(erro.mensagemDoCampo('membrosIds') ?? erro.mensagem);
      } else {
        this.erro.set(erro);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
