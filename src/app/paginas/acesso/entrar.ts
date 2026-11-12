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
import {
  FormControl,
  FormGroup,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { formatarEspera, formatarHora } from '../../nucleo/formatos';
import { ehDesafioDoisFatores } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { AvisoAcesso, type TipoAvisoAcesso } from './aviso-acesso';
import { EstadoAcesso, normalizarEmail } from './estado-acesso';
import { MolduraAcesso } from './moldura-acesso';

/** Proteção contra força bruta (R2.5): 5 falhas para o mesmo e-mail bloqueiam por 15 min. */
export const LIMITE_DE_TENTATIVAS = 5;
export const MINUTOS_DE_BLOQUEIO = 15;

/** Bloqueio por tentativas (429): do e-mail (`email` preenchido) ou da rede inteira (IP). */
interface Bloqueio {
  readonly email: string | null;
  readonly ate: number;
}

interface Falha {
  readonly tipo: TipoAvisoAcesso;
  readonly titulo?: string;
  readonly mensagem: string;
  readonly detalhe?: string;
  readonly codigo?: string | null;
}

/**
 * Entrar (`/entrar`, pública) — TELAS-FASE1 §1.1. Palco da marca à esquerda e o cartão com
 * e-mail, senha (com "mostrar senha"), "Entrar" e "Esqueci minha senha".
 *
 * Erros no lugar certo, sem nunca limpar o e-mail: credenciais (mensagem genérica da API,
 * R2.3, com o aviso do limite de tentativas), conta desativada (403) e bloqueio por tentativas
 * (429, R2.5), dizendo em quantos minutos e a que horas tentar de novo — enquanto o bloqueio
 * vale para o e-mail digitado, o botão fica desabilitado e a contagem anda sozinha.
 *
 * Depois do login: com troca de senha pendente, `/trocar-senha`; senão, a rota que a pessoa
 * tentou abrir (`voltar`) ou `/inicio` (`SessaoService.rotaAposEntrar`).
 */
@Component({
  selector: 'app-entrar',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MolduraAcesso,
    CampoTexto,
    CampoSenha,
    Botao,
    AvisoAcesso,
  ],
  templateUrl: './entrar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Entrar {
  /** Rota que a pessoa tentou abrir (query `voltar`); use `sessao.rotaAposEntrar(voltar)`. */
  readonly voltar = input<string | null>(null);

  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly estado = inject(EstadoAcesso);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    email: [this.estado.email(), [Validators.required, Validators.email]],
    senha: ['', Validators.required],
  });

  private readonly diretiva = viewChild.required(FormGroupDirective);
  private readonly campoEmail = viewChild.required<CampoTexto>('campoEmail');
  private readonly campoSenha = viewChild.required<CampoSenha>('campoSenha');

  /** Segunda etapa (R2.11): o desafio recebido depois da senha certa; `null` na primeira etapa. */
  protected readonly desafio = signal<string | null>(null);
  protected readonly usarRecuperacao = signal(false);
  protected readonly codigo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly formularioCodigo = new FormGroup({ codigo: this.codigo });
  private readonly campoCodigo = viewChild<CampoTexto>('campoCodigo');

  protected readonly enviando = signal(false);
  protected readonly falha = signal<Falha | null>(null);

  private readonly bloqueio = signal<Bloqueio | null>(null);
  private readonly agora = signal(Date.now());
  private relogio: ReturnType<typeof setInterval> | null = null;
  private readonly emailDigitado = toSignal(this.formulario.controls.email.valueChanges, {
    initialValue: this.formulario.controls.email.value,
  });

  /** O bloqueio em vigor para o e-mail digitado agora (o do IP vale para qualquer e-mail). */
  protected readonly bloqueioAtivo = computed(() => {
    const bloqueio = this.bloqueio();
    if (!bloqueio || bloqueio.ate <= this.agora()) {
      return null;
    }
    if (bloqueio.email !== null && bloqueio.email !== normalizarEmail(this.emailDigitado())) {
      return null;
    }
    return bloqueio;
  });

  /** "14 minutos" / "40 segundos". */
  protected readonly esperaRestante = computed(() => {
    const bloqueio = this.bloqueioAtivo();
    return bloqueio ? formatarEspera((bloqueio.ate - this.agora()) / 1000) : '';
  });

  protected readonly horaDeLiberar = computed(() => {
    const bloqueio = this.bloqueioAtivo();
    return bloqueio ? formatarHora(new Date(bloqueio.ate)) : '';
  });

  /** Bloqueio pelo e-mail (e não pela rede inteira). */
  protected readonly bloqueioDoEmail = computed(() => this.bloqueioAtivo()?.email != null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararRelogio());
  }

  protected async entrar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const { email, senha } = this.formulario.controls;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      (email.invalid ? this.campoEmail() : this.campoSenha()).focar();
      return;
    }
    if (this.bloqueioAtivo()) {
      return;
    }
    this.enviando.set(true);
    this.falha.set(null);
    try {
      const resposta = await this.sessao.entrar(email.value, senha.value);
      if (ehDesafioDoisFatores(resposta)) {
        // R2.11: a senha está certa, falta o código. A sessão só nasce depois dele.
        this.desafio.set(resposta.desafio);
        this.codigo.reset('');
        this.usarRecuperacao.set(false);
        afterNextRender(() => this.campoCodigo()?.focar(), { injector: this.injector });
        return;
      }
      this.estado.email.set('');
      if (resposta.deveTrocarSenha) {
        this.estado.guardarSenhaTemporaria(resposta.usuario.email, senha.value);
      }
      await this.router.navigateByUrl(this.sessao.rotaAposEntrar(this.voltar()));
    } catch (falha) {
      this.tratarFalha(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  /** Segunda etapa do login (R2.11): código do aplicativo ou de recuperação. */
  protected async verificar(): Promise<void> {
    const desafio = this.desafio();
    if (this.enviando() || !desafio) {
      return;
    }
    if (this.codigo.invalid) {
      this.codigo.markAsTouched();
      this.campoCodigo()?.focar();
      return;
    }
    this.enviando.set(true);
    this.falha.set(null);
    try {
      const perfil = await this.sessao.concluirEntrada(desafio, this.codigo.value);
      this.estado.email.set('');
      if (perfil.deveTrocarSenha) {
        const senha = this.formulario.controls.senha.value;
        this.estado.guardarSenhaTemporaria(perfil.usuario.email, senha);
      }
      await this.router.navigateByUrl(this.sessao.rotaAposEntrar(this.voltar()));
    } catch (falha) {
      this.tratarFalhaDoCodigo(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  protected alternarRecuperacao(): void {
    this.usarRecuperacao.update((valor) => !valor);
    this.codigo.reset('');
    this.falha.set(null);
    afterNextRender(() => this.campoCodigo()?.focar(), { injector: this.injector });
  }

  /** Volta à senha (o desafio é descartado). */
  protected voltarParaSenha(aviso?: string): void {
    this.desafio.set(null);
    this.codigo.reset('');
    this.formulario.controls.senha.reset('');
    this.falha.set(aviso ? { tipo: 'info', mensagem: aviso } : null);
    afterNextRender(() => this.campoSenha().focar(), { injector: this.injector });
  }

  private tratarFalhaDoCodigo(erro: ErroApi): void {
    if (erro.ehMuitasTentativas) {
      this.voltarParaSenha();
      this.bloquear(erro);
      return;
    }
    if (erro.status === 401) {
      // Desafio vencido (5 minutos) ou sem tentativas: recomeça pela senha.
      this.voltarParaSenha(erro.resumo);
      return;
    }
    if (erro.status === 403) {
      this.voltarParaSenha();
      this.falha.set({ tipo: 'bloqueio', mensagem: erro.resumo });
      return;
    }
    if (erro.ehDadosInvalidos) {
      const restantes = erro.detalhes?.['tentativasRestantes'];
      this.codigo.reset('');
      this.falha.set({
        tipo: 'erro',
        mensagem: this.usarRecuperacao()
          ? 'Código de recuperação incorreto ou já usado.'
          : 'Código incorreto. Confira o aplicativo: ele muda a cada 30 segundos.',
        detalhe:
          typeof restantes === 'number'
            ? `Você ainda tem ${restantes} ${restantes === 1 ? 'tentativa' : 'tentativas'}.`
            : undefined,
      });
      afterNextRender(() => this.campoCodigo()?.focar(), { injector: this.injector });
      return;
    }
    this.falha.set({ tipo: 'erro', mensagem: erro.resumo, codigo: erro.requisicaoId });
  }

  /** Leva o e-mail digitado para "Esqueci minha senha". */
  protected lembrarEmail(): void {
    this.estado.email.set(this.formulario.controls.email.value.trim());
  }

  private tratarFalha(erro: ErroApi): void {
    const { email } = this.formulario.controls;
    if (erro.ehMuitasTentativas) {
      this.bloquear(erro);
      return;
    }
    if (erro.status === 401) {
      // Credenciais (R2.3): mensagem única. O e-mail fica; a senha volta vazia e com o foco,
      // sem o "Preencha este campo" de um formulário já enviado.
      this.diretiva().resetForm({ email: email.value, senha: '' });
      this.falha.set({
        tipo: 'erro',
        mensagem: erro.resumo,
        detalhe: `Confira o e-mail e a senha. Depois de ${LIMITE_DE_TENTATIVAS} tentativas erradas, o acesso a este e-mail fica bloqueado por ${MINUTOS_DE_BLOQUEIO} minutos.`,
      });
      afterNextRender(() => this.campoSenha().focar(), { injector: this.injector });
      return;
    }
    if (erro.status === 403) {
      // "Acesso desativado. Fale com o administrador." (R2.3): a mensagem já diz tudo.
      this.falha.set({ tipo: 'bloqueio', mensagem: erro.resumo });
      return;
    }
    if (erro.ehDadosInvalidos && erro.campos.length) {
      const doEmail = erro.mensagemDoCampo('email');
      const daSenha = erro.mensagemDoCampo('senha');
      if (doEmail) {
        email.setErrors({ api: doEmail });
      }
      if (daSenha) {
        this.formulario.controls.senha.setErrors({ api: daSenha });
      }
      (doEmail ? this.campoEmail() : this.campoSenha()).focar();
      return;
    }
    this.falha.set({ tipo: 'erro', mensagem: erro.resumo, codigo: erro.requisicaoId });
  }

  private bloquear(erro: ErroApi): void {
    const segundos = erro.tentarDeNovoEmSegundos ?? MINUTOS_DE_BLOQUEIO * 60;
    const peloIp = erro.detalhes?.['motivo'] === 'BLOQUEADO_IP';
    this.agora.set(Date.now());
    this.bloqueio.set({
      email: peloIp ? null : normalizarEmail(this.formulario.controls.email.value),
      ate: Date.now() + segundos * 1000,
    });
    this.falha.set(null);
    this.pararRelogio();
    this.relogio = setInterval(() => this.tique(), 1000);
  }

  /** A cada segundo durante o bloqueio; quando ele acaba, avisa que já dá para tentar. */
  private tique(): void {
    this.agora.set(Date.now());
    const bloqueio = this.bloqueio();
    if (!bloqueio || bloqueio.ate <= this.agora()) {
      this.pararRelogio();
      this.bloqueio.set(null);
      this.falha.set({ tipo: 'info', mensagem: 'Pronto: você já pode tentar entrar de novo.' });
    }
  }

  private pararRelogio(): void {
    if (this.relogio !== null) {
      clearInterval(this.relogio);
      this.relogio = null;
    }
  }
}
