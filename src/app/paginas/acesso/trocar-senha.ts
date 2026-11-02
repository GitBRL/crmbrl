import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService, voltarSeguro } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { AvisoAcesso, type TipoAvisoAcesso } from './aviso-acesso';
import { EstadoAcesso } from './estado-acesso';
import { MolduraAcesso } from './moldura-acesso';
import { RegrasSenha } from './regras-senha';
import {
  confirmaNovaSenha,
  diferenteDaAtual,
  MENSAGENS_CONFIRMACAO,
  MENSAGENS_NOVA_SENHA,
  revalidarJunto,
  VALIDADORES_NOVA_SENHA,
} from './senha';

interface Falha {
  readonly tipo: TipoAvisoAcesso;
  readonly titulo?: string;
  readonly mensagem: string;
  readonly codigo?: string | null;
}

/**
 * Trocar senha (`/trocar-senha`, com sessão) — TELAS-FASE1 §1.2.
 *
 * - **Obrigatória** (R2.7: senha temporária do Admin ou primeiro acesso): explica por que, não
 *   pede de novo a senha temporária que a pessoa acabou de digitar em "Entrar" (quando a
 *   página foi recarregada, pede) e oferece "Sair" — a casca fica fechada até a troca.
 * - **Voluntária** (menu da conta): senha atual, nova e confirmação, com "Cancelar" de volta
 *   para onde a pessoa estava; avisa que as outras sessões serão encerradas.
 *
 * A regra fica visível e é conferida enquanto a pessoa digita (`app-regras-senha`); a API
 * continua conferindo (senha atual incorreta conta como tentativa para o bloqueio, R2.5).
 * Depois da troca: aviso e a rota `voltar` (ou a anterior, ou `/inicio`).
 */
@Component({
  selector: 'app-trocar-senha',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MolduraAcesso,
    CampoSenha,
    Botao,
    AvisoAcesso,
    RegrasSenha,
  ],
  templateUrl: './trocar-senha.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocarSenha {
  /** Para onde seguir depois da troca (query `voltar`). */
  readonly voltar = input<string | null>(null);

  protected readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly estado = inject(EstadoAcesso);
  private readonly injector = inject(Injector);

  /** Lido na entrada: depois da troca o perfil já não pede troca, mas a tela não muda. */
  protected readonly obrigatoria = this.sessao.deveTrocarSenha();
  protected readonly email = this.sessao.usuario()?.email ?? '';
  protected readonly primeiroNome = (this.sessao.usuario()?.nome ?? '').split(/\s+/)[0];
  protected readonly frase = this.obrigatoria
    ? `Olá, ${this.primeiroNome}! Antes de começar, troque a senha temporária por uma senha só sua.`
    : 'Escolha uma senha nova para entrar no BRL CRM.';

  /** A senha temporária com que a pessoa acabou de entrar (só na troca obrigatória). */
  private readonly senhaLembrada = signal(
    this.obrigatoria ? this.estado.tomarSenhaTemporaria(this.email) : null,
  );
  protected readonly pedirSenhaAtual = computed(() => this.senhaLembrada() === null);

  /**
   * Página de onde a pessoa veio (menu da conta), quando não há `voltar`. Vindo da casca, esta
   * tela nasce depois do fim da navegação (a moldura de acesso desenha a saída dela depois):
   * aí a navegação até aqui já é a última concluída.
   */
  private readonly paginaAnterior = (() => {
    const navegacao = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const anterior = navegacao?.previousNavigation?.finalUrl;
    return anterior ? this.router.serializeUrl(anterior) : null;
  })();
  protected readonly destino = computed(() =>
    this.router.parseUrl(voltarSeguro(this.voltar() ?? this.paginaAnterior)),
  );

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    atual: ['', this.pedirSenhaAtual() ? Validators.required : []],
    nova: ['', [...VALIDADORES_NOVA_SENHA, diferenteDaAtual(() => this.senhaAtual())]],
    confirmacao: ['', confirmaNovaSenha],
  });

  private readonly campoAtual = viewChild<CampoSenha>('campoAtual');
  private readonly campoNova = viewChild.required<CampoSenha>('campoNova');
  private readonly campoConfirmacao = viewChild.required<CampoSenha>('campoConfirmacao');

  private readonly valores = toSignal(
    this.formulario.valueChanges.pipe(startWith(this.formulario.getRawValue())),
    { requireSync: true },
  );
  protected readonly nova = computed(() => this.valores().nova ?? '');
  protected readonly confirmacao = computed(() => this.valores().confirmacao ?? '');
  /** Para a regra "Diferente da senha atual": `null` enquanto a atual não foi digitada. */
  protected readonly atualParaRegras = computed(
    () => this.senhaLembrada() ?? (this.valores().atual || null),
  );

  protected readonly enviando = signal(false);
  protected readonly falha = signal<Falha | null>(null);

  protected readonly mensagensNova = MENSAGENS_NOVA_SENHA;
  protected readonly mensagensConfirmacao = MENSAGENS_CONFIRMACAO;
  protected readonly mensagensAtual = {
    required: this.obrigatoria ? 'Digite a senha temporária.' : 'Digite a sua senha atual.',
  };

  constructor() {
    const { atual, nova, confirmacao } = this.formulario.controls;
    const destroyRef = inject(DestroyRef);
    revalidarJunto(nova, confirmacao, destroyRef);
    revalidarJunto(atual, nova, destroyRef);
  }

  protected async trocar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const { nova } = this.formulario.controls;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.focarPrimeiroInvalido();
      return;
    }
    this.enviando.set(true);
    this.falha.set(null);
    try {
      await this.sessao.trocarSenha(this.senhaAtual() ?? '', nova.value);
      this.avisos.sucesso(
        this.obrigatoria
          ? 'Senha criada. Boas-vindas ao BRL CRM!'
          : 'Senha trocada. As suas outras sessões foram encerradas.',
      );
      this.senhaLembrada.set(null);
      await this.router.navigateByUrl(this.destino());
    } catch (falha) {
      this.tratarFalha(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  protected sair(): void {
    void this.sessao.sair();
  }

  private senhaAtual(): string | null {
    return this.senhaLembrada() ?? (this.formulario?.controls.atual.value || null);
  }

  private tratarFalha(erro: ErroApi): void {
    const { atual, nova } = this.formulario.controls;
    if (erro.ehMuitasTentativas) {
      this.falha.set({ tipo: 'bloqueio', titulo: 'Muitas tentativas', mensagem: erro.resumo });
      return;
    }
    if (erro.ehDadosInvalidos && erro.campos.length) {
      // Com um só campo, a mensagem geral da API já é a frase certa ("A senha atual está
      // incorreta."); com vários, a de cada campo.
      const mensagem = (campo: string) =>
        erro.mensagemDoCampo(campo) &&
        (erro.campos.length === 1 ? erro.resumo : erro.mensagemDoCampo(campo));
      const doAtual = mensagem('senhaAtual');
      const daNova = mensagem('novaSenha');
      if (doAtual && this.senhaLembrada() !== null) {
        // A senha lembrada não serviu: a pessoa digita a temporária.
        this.senhaLembrada.set(null);
        atual.setValidators(Validators.required);
      }
      // Depois de desenhar: o campo da senha atual pode ter acabado de aparecer (e, ao se
      // ligar ao formulário, o controle é validado de novo, o que apagaria o erro da API).
      afterNextRender(
        () => {
          if (doAtual) {
            atual.setErrors({ api: doAtual });
            atual.markAsTouched();
          }
          if (daNova) {
            nova.setErrors({ api: daNova });
            nova.markAsTouched();
          }
          this.focarPrimeiroInvalido();
        },
        { injector: this.injector },
      );
      return;
    }
    this.falha.set({ tipo: 'erro', mensagem: erro.resumo, codigo: erro.requisicaoId });
  }

  private focarPrimeiroInvalido(): void {
    const { atual, nova } = this.formulario.controls;
    if (atual.invalid && this.campoAtual()) {
      this.campoAtual()?.focar();
    } else if (nova.invalid) {
      this.campoNova().focar();
    } else {
      this.campoConfirmacao().focar();
    }
  }
}
