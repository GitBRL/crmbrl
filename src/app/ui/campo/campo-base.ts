import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  type AfterViewInit,
  type ModelSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroupDirective,
  NgControl,
  NgForm,
  Validators,
  type ControlValueAccessor,
} from '@angular/forms';

import { gerarId } from '../tipos';
import { mensagemDoErro, type MensagensErro } from './mensagens-erro';

type ElementoNativo = HTMLInputElement | HTMLTextAreaElement;

/**
 * Base dos campos de formulário de `ui/` (DESIGN-SYSTEM.md §4.2). Cuida do que todos têm em
 * comum: rótulo, dica, ajuda, erro, ids para `aria-describedby` e a ligação com os
 * formulários reativos do Angular.
 *
 * O campo funciona de dois jeitos:
 * - **com formulário** (`formControlName`, `[formControl]`, `ngModel`): ele mesmo é o
 *   `ControlValueAccessor` (pega o `NgControl` do próprio elemento, sem provider). O erro do
 *   controle aparece quando ele foi tocado ou o formulário foi enviado;
 * - **sem formulário**: `[(valor)]`, com `erro` vindo da tela.
 *
 * `erro` (texto) sempre vence: é como a tela mostra a mensagem da API junto do campo certo
 * (`regra_violada`). Um erro do controle cujo valor é texto também vira a mensagem:
 * `controle.setErrors({ api: 'Este e-mail já está em uso.' })`.
 *
 * Subclasses declaram `valor = model(...)`, implementam `normalizar` e não sobrescrevem
 * `ngAfterViewInit`.
 */
@Directive()
export abstract class CampoBase<T> implements ControlValueAccessor, AfterViewInit {
  /** Rótulo visível (sempre há um; `rotuloOculto` o deixa só para leitores de tela). */
  readonly rotulo = input.required<string>();
  /** Texto de ajuda abaixo do campo ("Mínimo de 8 caracteres"). */
  readonly dica = input<string | null>(null);
  /** Explicação em balão (`app-dica`) ao lado do rótulo, para o que não se explica sozinho. */
  readonly ajuda = input<string | null>(null);
  /** Erro vindo da tela (ex.: mensagem da API). Vence o erro do controle. */
  readonly erro = input<string | null>(null);
  /** Mensagens próprias por chave de erro (`{ minlength: 'Use 8 caracteres ou mais.' }`). */
  readonly mensagens = input<MensagensErro>({});
  /** Mostra "(opcional)" depois do rótulo. */
  readonly opcional = input(false, { transform: booleanAttribute });
  /** Marca o campo como obrigatório sem formulário (com formulário, vem do `Validators.required`). */
  readonly obrigatorio = input(false, { transform: booleanAttribute });
  /** Sem formulário. Com formulário, use `controle.disable()`. */
  readonly desabilitado = input(false, { transform: booleanAttribute });
  /** Rótulo só para leitores de tela (filtros numa barra, células de tabela). */
  readonly rotuloOculto = input(false, { transform: booleanAttribute });

  /** Valor atual: `[(valor)]` sem formulário. */
  abstract readonly valor: ModelSignal<T>;

  protected readonly id = gerarId('campo');
  protected readonly idDica = `${this.id}-dica`;
  protected readonly idErro = `${this.id}-erro`;

  /** Mensagens padrão do tipo de campo (o seletor diz "Escolha uma opção."). */
  protected readonly mensagensPadrao: MensagensErro = {};

  protected readonly controle = inject(NgControl, { self: true, optional: true });
  private readonly formulario =
    inject(FormGroupDirective, { optional: true }) ?? inject(NgForm, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  /** Muda a cada evento do controle (valor, status, tocado): os computed abaixo o leem. */
  private readonly versaoControle = signal(0);
  private readonly desabilitadoPeloFormulario = signal(false);
  private aoAlterar: (valor: T) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  /** Elemento nativo `#campo` (para `sincronizarTexto` e `focar`). */
  protected readonly campo = viewChild<ElementRef<HTMLElement>>('campo');

  protected readonly estaDesabilitado = computed(
    () => this.desabilitado() || this.desabilitadoPeloFormulario(),
  );

  protected readonly requerido = computed(() => {
    this.versaoControle();
    const controle = this.controle?.control;
    return (
      this.obrigatorio() ||
      !!controle?.hasValidator(Validators.required) ||
      !!controle?.hasValidator(Validators.requiredTrue)
    );
  });

  /** Mensagem mostrada: a da tela ou a do controle (tocado ou formulário enviado). */
  protected readonly mensagemErro = computed(() => {
    const daTela = this.erro()?.trim();
    if (daTela) {
      return daTela;
    }
    this.versaoControle();
    const controle = this.controle?.control;
    if (!controle?.invalid || !(controle.touched || this.formulario?.submitted)) {
      return null;
    }
    return mensagemDoErro(controle.errors, { ...this.mensagensPadrao, ...this.mensagens() });
  });

  /** `aria-describedby` do controle: o erro primeiro (é o que importa agora), depois a dica. */
  protected readonly descricao = computed(() => {
    const ids = [
      this.mensagemErro() ? this.idErro : null,
      this.dica() ? this.idDica : null,
      ...this.idsDescricaoExtra(),
    ].filter((id): id is string => !!id);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    if (this.controle) {
      this.controle.valueAccessor = this;
    }
  }

  /** Põe o foco no controle (ex.: no primeiro campo com erro depois de enviar). */
  focar(): void {
    this.campo()?.nativeElement.focus();
  }

  ngAfterViewInit(): void {
    // Com `formControlName`, o controle só existe depois do ngOnChanges da diretiva, que roda
    // depois do ngOnInit deste componente; aqui ele já está pronto.
    const controle = this.controle?.control;
    if (controle) {
      controle.events
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.versaoControle.update((versao) => versao + 1));
      this.versaoControle.update((versao) => versao + 1);
    }
    this.formulario?.ngSubmit
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.versaoControle.update((versao) => versao + 1));
  }

  writeValue(valor: unknown): void {
    this.valor.set(this.normalizar(valor));
  }

  registerOnChange(funcao: (valor: T) => void): void {
    this.aoAlterar = funcao;
  }

  registerOnTouched(funcao: () => void): void {
    this.aoTocar = funcao;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitadoPeloFormulario.set(desabilitado);
  }

  /** Converte o valor recebido do formulário (pode vir `null`/`undefined`). */
  protected abstract normalizar(valor: unknown): T;

  /** Ids extras para `aria-describedby` (prefixo e sufixo do campo de texto). */
  protected idsDescricaoExtra(): readonly string[] {
    return [];
  }

  /** O usuário mudou o valor: atualiza `[(valor)]` e avisa o formulário. */
  protected definirValor(valor: T): void {
    this.valor.set(valor);
    this.aoAlterar(valor);
  }

  /** O usuário saiu do campo: o formulário marca como tocado (e o erro pode aparecer). */
  protected tocar(): void {
    this.aoTocar();
  }

  /**
   * Para `<input>`/`<textarea>`: escreve o valor no elemento só quando ele **não** veio do
   * próprio campo. Uma ligação `[value]` reescreveria o texto a cada tecla e apagaria o que
   * ainda não é um valor (um número pela metade, uma data com um pedaço apagado). Chame no
   * construtor e, no `(input)`, use `lerDoCampo`.
   */
  protected sincronizarTexto(paraTexto: (valor: T) => string): void {
    effect(() => {
      const valor = this.valor();
      const elemento = this.campo()?.nativeElement as ElementoNativo | undefined;
      if (!elemento) {
        return;
      }
      if (this.lido && Object.is(this.lido.valor, valor)) {
        return;
      }
      this.lido = null;
      const texto = paraTexto(valor);
      if (elemento.value !== texto) {
        elemento.value = texto;
      }
    });
  }

  /** Lê o valor digitado (com `sincronizarTexto`), sem reescrever o elemento. */
  protected lerDoCampo(valor: T): void {
    this.lido = { valor };
    this.definirValor(valor);
  }

  private lido: { readonly valor: T } | null = null;
}
