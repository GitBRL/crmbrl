import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { AreaTexto } from '../../../ui/area-texto/area-texto';
import { Botao } from '../../../ui/botao/botao';
import { CaixaSelecao } from '../../../ui/caixa-selecao/caixa-selecao';
import { CampoTexto } from '../../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../../ui/modal/modal';
import { gerarId } from '../../../ui/tipos';
import {
  aplicarExemplos,
  FORMATO_DO_ATALHO,
  normalizarAtalho,
  rotuloDaArea,
  variaveisDesconhecidas,
} from './apresentacao';
import { AtendimentoConfigApi } from './atendimento.api';
import {
  type AreaDoAtendimento,
  type DadosRespostaRapida,
  type RespostaRapida,
  TAMANHO_MAXIMO_TEXTO_RESPOSTA,
  type Variavel,
} from './atendimento.modelos';

export type PedidoFormularioResposta =
  { readonly modo: 'criar' } | { readonly modo: 'editar'; readonly resposta: RespostaRapida };

type AreaEscolhida = AreaDoAtendimento | 'TODAS';

function validarAtalho(controle: AbstractControl<string>): ValidationErrors | null {
  const valor = controle.value ?? '';
  if (!valor.trim()) {
    return null;
  }
  return FORMATO_DO_ATALHO.test(normalizarAtalho(valor)) ? null : { atalho: true };
}

/**
 * Criar e editar uma resposta rápida (R12): atalho ("/boas-vindas" no compositor), título, área
 * (todas — só Admin e C-level — ou a do líder), o texto com as variáveis (cada uma entra no
 * cursor com um clique) e a prévia com dados de exemplo.
 */
@Component({
  selector: 'app-formulario-resposta',
  imports: [ReactiveFormsModule, AreaTexto, Botao, CaixaSelecao, CampoTexto, GrupoOpcoes, Modal],
  template: `
    <app-modal
      [titulo]="editando() ? 'Editar resposta rápida' : 'Nova resposta rápida'"
      [complemento]="editando() ? '· /' + editando()!.atalho : null"
      largura="lg"
      [aberto]="pedido() !== null"
      (fechado)="fechado.emit()"
    >
      <form
        class="formulario"
        novalidate
        [id]="idFormulario"
        [formGroup]="formulario"
        (ngSubmit)="salvar()"
      >
        <div class="formulario__par">
          <app-campo-texto
            #campoAtalho
            rotulo="Atalho"
            prefixo="/"
            placeholder="boas-vindas"
            autocomplete="off"
            dica="No Atendimento, digite / e o atalho para usar."
            [mensagens]="{ atalho: 'Sem espaços nem barras, até 40 caracteres.' }"
            [maximoCaracteres]="41"
            formControlName="atalho"
          />
          <app-campo-texto
            #campoTitulo
            rotulo="Título"
            placeholder="Boas-vindas"
            autocomplete="off"
            [maximoCaracteres]="100"
            formControlName="titulo"
          />
        </div>
        @if (opcoesArea().length > 1) {
          <app-grupo-opcoes
            rotulo="Quem usa"
            disposicao="pilulas"
            ajuda="“Todas as áreas” aparece para Comercial e CS. Só Admin e C-level criam essas; o líder cria as da área dele."
            [opcoes]="opcoesArea()"
            formControlName="area"
          />
        } @else {
          <p class="formulario__nota">Vale para {{ rotuloAreaFixa() }}.</p>
        }

        <div class="texto">
          <app-area-texto
            #campoTexto
            rotulo="Texto"
            [placeholder]="exemploTexto"
            [linhas]="5"
            [maximoCaracteres]="tamanhoTexto"
            [mensagens]="{ variaveis: mensagemVariaveis() }"
            formControlName="texto"
          />
          @if (variaveis().length) {
            <div class="variaveis">
              <span class="variaveis__rotulo" [id]="idVariaveis">Inserir no texto:</span>
              <ul class="variaveis__lista" [attr.aria-labelledby]="idVariaveis">
                @for (variavel of variaveis(); track variavel.nome) {
                  <li>
                    <button
                      type="button"
                      class="variavel"
                      [title]="variavel.descricao + ' · ex.: ' + variavel.exemplo"
                      [attr.aria-label]="'Inserir ' + variavel.descricao"
                      (mousedown)="$event.preventDefault()"
                      (click)="inserir(variavel)"
                    >
                      {{ variavel.descricao }}
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        @if (previa(); as previa) {
          <div class="previa">
            <span class="previa__rotulo">Como o cliente vê (com dados de exemplo)</span>
            <p class="previa__bolha">{{ previa }}</p>
          </div>
        }

        <app-caixa-selecao
          rotulo="Ativa"
          dica="Desativada, some da lista do “/” no Atendimento, mas continua guardada aqui."
          formControlName="ativa"
        />
        @if (erro(); as erro) {
          <p class="formulario__erro" role="alert">{{ erro.mensagem }}</p>
        }
      </form>
      <ng-container modal-rodape>
        <button
          appBotao
          type="submit"
          variante="invertido"
          [carregando]="enviando()"
          [attr.form]="idFormulario"
        >
          {{ editando() ? 'Salvar' : 'Criar resposta' }}
        </button>
        <button appBotao type="button" variante="contorno" (click)="fechado.emit()">
          Cancelar
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    @use '../canais/comum/tela-canal' as t;

    @include t.formulario;

    .texto {
      display: grid;
      gap: var(--esp-3);
    }

    .variaveis {
      display: grid;
      gap: var(--esp-2);
      padding-inline-start: var(--esp-4);
    }

    .variaveis__rotulo {
      color: var(--cor-texto-suave);
      font: var(--fonte-legenda-lg);
    }

    .variaveis__lista {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .variavel {
      position: relative;
      min-height: 32px;
      padding: 0 var(--esp-3);
      border: 1px dashed var(--cor-borda-forte);
      border-radius: var(--raio-pilula);
      background: transparent;
      color: var(--cor-texto);
      font: var(--fonte-legenda-lg);
      cursor: pointer;

      &::after {
        content: '';
        position: absolute;
        inset: -6px 0;
      }

      &:hover {
        border-style: solid;
        background: var(--cor-superficie-2);
      }

      &:focus-visible {
        outline: 2px solid var(--cor-foco);
        outline-offset: 2px;
      }
    }

    .previa {
      display: grid;
      gap: var(--esp-2);
      padding: var(--esp-4);
      border-radius: var(--raio-lg);
      background: var(--cor-superficie-2);
    }

    .previa__rotulo {
      color: var(--cor-texto-fraco);
      font: var(--fonte-legenda);
    }

    // A bolha de saída do Atendimento (menta a 14% sobre a superfície).
    .previa__bolha {
      justify-self: end;
      max-width: 86%;
      padding: var(--esp-3) var(--esp-4);
      border-radius: 20px 6px 20px 20px;
      background: color-mix(in srgb, var(--dado-2) 14%, var(--cor-superficie));
      font: var(--fonte-corpo);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioResposta {
  readonly pedido = input<PedidoFormularioResposta | null>(null);
  /** Áreas que a pessoa gerencia; `TODAS` só para Admin e C-level. */
  readonly areasPermitidas = input<readonly AreaEscolhida[]>(['TODAS', 'COMERCIAL', 'CS']);
  readonly variaveis = input<readonly Variavel[]>([]);
  readonly salva = output<RespostaRapida>();
  readonly fechado = output<void>();

  private readonly api = inject(AtendimentoConfigApi);
  private readonly avisos = inject(AvisosService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly idFormulario = gerarId('formulario-resposta');
  protected readonly idVariaveis = gerarId('variaveis');
  protected readonly tamanhoTexto = TAMANHO_MAXIMO_TEXTO_RESPOSTA;
  protected readonly exemploTexto =
    '{{saudacao}}, {{contato.primeiroNome}}! Sou {{usuario.primeiroNome}}, da BRL. Como posso ajudar?';
  protected readonly enviando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  private readonly texto = signal('');

  private readonly campoAtalho = viewChild<CampoTexto>('campoAtalho');
  private readonly campoTitulo = viewChild<CampoTexto>('campoTitulo');
  private readonly campoTexto = viewChild<AreaTexto>('campoTexto');

  protected readonly formulario = new FormGroup({
    atalho: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validarAtalho],
    }),
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    area: new FormControl<AreaEscolhida>('TODAS', { nonNullable: true }),
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(TAMANHO_MAXIMO_TEXTO_RESPOSTA)],
    }),
    ativa: new FormControl(true, { nonNullable: true }),
  });

  protected readonly editando = computed(() => {
    const pedido = this.pedido();
    return pedido?.modo === 'editar' ? pedido.resposta : null;
  });

  protected readonly opcoesArea = computed<readonly OpcaoGrupo<AreaEscolhida>[]>(() => {
    const areas = new Set<AreaEscolhida>(this.areasPermitidas());
    const atual = this.editando()?.area;
    if (this.editando()) {
      areas.add(atual === 'COMERCIAL' || atual === 'CS' ? atual : 'TODAS');
    }
    return (['TODAS', 'COMERCIAL', 'CS'] as const)
      .filter((area) => areas.has(area))
      .map((area) => ({
        valor: area,
        rotulo: area === 'TODAS' ? 'Todas as áreas' : rotuloDaArea(area),
      }));
  });

  protected readonly rotuloAreaFixa = computed(() => {
    const opcao = this.opcoesArea()[0];
    return opcao ? opcao.rotulo : '';
  });

  protected readonly previa = computed(() => {
    const texto = this.texto().trim();
    return texto ? aplicarExemplos(texto, this.variaveis()) : null;
  });

  protected readonly mensagemVariaveis = computed(() => {
    const desconhecidas = variaveisDesconhecidas(this.texto(), this.variaveis());
    return desconhecidas.length
      ? `Variável que não existe: ${desconhecidas.map((nome) => `{{${nome}}}`).join(', ')}. Use os botões abaixo.`
      : '';
  });

  constructor() {
    this.formulario.controls.texto.valueChanges.pipe(takeUntilDestroyed()).subscribe((texto) => {
      this.texto.set(texto);
      this.conferirVariaveis();
    });
    effect(() => {
      const pedido = this.pedido();
      if (pedido) {
        untracked(() => this.preencher(pedido));
      }
    });
  }

  private preencher(pedido: PedidoFormularioResposta): void {
    this.erro.set(null);
    const resposta = pedido.modo === 'editar' ? pedido.resposta : null;
    const area: AreaEscolhida = resposta
      ? resposta.area === 'COMERCIAL' || resposta.area === 'CS'
        ? resposta.area
        : 'TODAS'
      : (this.areasPermitidas()[0] ?? 'TODAS');
    this.formulario.reset({
      atalho: resposta?.atalho ?? '',
      titulo: resposta?.titulo ?? '',
      area,
      texto: resposta?.texto ?? '',
      ativa: resposta?.ativa ?? true,
    });
    this.texto.set(resposta?.texto ?? '');
  }

  /** Variável que não existe vira erro do campo (só quando há a lista para conferir). */
  private conferirVariaveis(): void {
    const controle = this.formulario.controls.texto;
    const desconhecidas =
      this.variaveis().length > 0 ? variaveisDesconhecidas(controle.value, this.variaveis()) : [];
    const erros = { ...(controle.errors ?? {}) };
    if (desconhecidas.length) {
      controle.setErrors({ ...erros, variaveis: true });
    } else if (erros['variaveis']) {
      delete erros['variaveis'];
      controle.setErrors(Object.keys(erros).length ? erros : null);
    }
  }

  /** Põe `{{variavel}}` no cursor do texto (ou no fim) e devolve o foco ao campo. */
  protected inserir(variavel: Variavel): void {
    const campo = this.host.nativeElement.querySelector<HTMLTextAreaElement>('textarea');
    const controle = this.formulario.controls.texto;
    const atual = controle.value;
    const trecho = `{{${variavel.nome}}}`;
    const inicio = campo?.selectionStart ?? atual.length;
    const fim = campo?.selectionEnd ?? atual.length;
    const novo = atual.slice(0, inicio) + trecho + atual.slice(fim);
    controle.setValue(novo);
    controle.markAsDirty();
    if (campo) {
      campo.value = novo;
      campo.focus();
      const cursor = inicio + trecho.length;
      campo.setSelectionRange(cursor, cursor);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.erro.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      const c = this.formulario.controls;
      if (c.atalho.invalid) {
        this.campoAtalho()?.focar();
      } else if (c.titulo.invalid) {
        this.campoTitulo()?.focar();
      } else {
        this.campoTexto()?.focar();
      }
      return;
    }
    const v = this.formulario.getRawValue();
    const resposta = this.editando();
    const completo: DadosRespostaRapida = {
      atalho: normalizarAtalho(v.atalho),
      titulo: v.titulo.trim(),
      texto: v.texto.trim(),
      area: v.area === 'TODAS' ? null : v.area,
      ativa: v.ativa,
    };
    const dados: DadosRespostaRapida = resposta
      ? Object.fromEntries(
          Object.entries(completo).filter(
            ([chave, valor]) => (resposta as unknown as Record<string, unknown>)[chave] !== valor,
          ),
        )
      : completo;
    if (resposta && Object.keys(dados).length === 0) {
      this.avisos.info('Nada mudou: não havia o que salvar.');
      this.fechado.emit();
      return;
    }
    this.enviando.set(true);
    try {
      const salva = resposta
        ? await this.api.atualizarResposta(resposta.id, dados)
        : await this.api.criarResposta(dados);
      this.avisos.sucesso(
        resposta ? `Resposta “/${salva.atalho}” salva.` : `Resposta “/${salva.atalho}” criada.`,
      );
      this.salva.emit(salva);
      this.fechado.emit();
    } catch (falha) {
      this.mostrarErro(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private mostrarErro(erro: ErroApi): void {
    const c = this.formulario.controls;
    const doAtalho = erro.mensagemDoCampo('atalho') ?? (erro.ehConflito ? erro.mensagem : null);
    if (doAtalho) {
      c.atalho.setErrors({ api: doAtalho });
      this.campoAtalho()?.focar();
      return;
    }
    for (const campo of ['titulo', 'texto'] as const) {
      const mensagem = erro.mensagemDoCampo(campo);
      if (mensagem) {
        c[campo].setErrors({ api: mensagem });
        c[campo].markAsTouched();
        return;
      }
    }
    this.erro.set(erro);
  }
}
