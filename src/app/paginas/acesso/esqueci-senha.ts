import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideKeyRound, LucideSend } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { AvisoAcesso } from './aviso-acesso';
import { EstadoAcesso } from './estado-acesso';
import { MolduraAcesso } from './moldura-acesso';

/** A API manda no máximo um link a cada 2 minutos para o mesmo usuário (pedidos a mais somem). */
export const INTERVALO_DE_REENVIO_SEGUNDOS = 120;

type Etapa = 'formulario' | 'enviado' | 'indisponivel';

/**
 * Esqueci minha senha (`/esqueci-senha`, pública) — TELAS-FASE1 §1.3 e R2.8.
 *
 * A resposta é sempre a mesma, exista o e-mail ou não ("Confira o seu e-mail", com o que fazer
 * se não chegar e "Enviar de novo" depois de 2 minutos, o intervalo da API). Sem envio de
 * e-mails configurado (422 `R2.8`), a tela explica que é preciso pedir ao administrador uma
 * senha temporária — e "Entrar" passa a dizer isso no lugar do link (`EstadoAcesso`).
 */
@Component({
  selector: 'app-esqueci-senha',
  imports: [ReactiveFormsModule, RouterLink, MolduraAcesso, CampoTexto, Botao, AvisoAcesso],
  templateUrl: './esqueci-senha.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsqueciSenha {
  private readonly sessao = inject(SessaoService);
  private readonly estado = inject(EstadoAcesso);
  private readonly avisos = inject(AvisosService);
  private readonly injector = inject(Injector);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    email: [this.estado.email(), [Validators.required, Validators.email]],
  });

  private readonly moldura = viewChild.required(MolduraAcesso);
  private readonly campoEmail = viewChild<CampoTexto>('campoEmail');

  protected readonly etapa = signal<Etapa>(
    this.estado.envioPorEmail() === 'indisponivel' ? 'indisponivel' : 'formulario',
  );
  protected readonly enviando = signal(false);
  protected readonly falha = signal<{ mensagem: string; codigo: string | null } | null>(null);
  /** O e-mail do último pedido aceito. */
  protected readonly emailPedido = signal('');

  private readonly reenvioLiberadoEm = signal(0);
  private readonly agora = signal(Date.now());
  private relogio: ReturnType<typeof setInterval> | null = null;

  /** Segundos até poder pedir de novo (0 = já pode). */
  protected readonly esperaReenvio = computed(() =>
    Math.max(0, Math.ceil((this.reenvioLiberadoEm() - this.agora()) / 1000)),
  );
  /** "1:45". */
  protected readonly esperaReenvioTexto = computed(() => {
    const segundos = this.esperaReenvio();
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });

  /** Título, frase e ícone do cartão em cada etapa. */
  protected readonly cabecalho = computed(() => {
    switch (this.etapa()) {
      case 'enviado':
        return {
          titulo: 'Confira o seu e-mail',
          frase:
            'Se este e-mail estiver cadastrado e ativo no CRM, você vai receber um link para criar uma senha nova.',
          icone: LucideSend,
          tom: 'sucesso' as const,
        };
      case 'indisponivel':
        return {
          titulo: 'Peça uma senha temporária',
          frase:
            'O envio de e-mails não está configurado neste CRM, então não dá para mandar o link.',
          icone: LucideKeyRound,
          tom: 'atencao' as const,
        };
      default:
        return {
          titulo: 'Esqueci minha senha',
          frase:
            'Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.',
          icone: null,
          tom: 'neutro' as const,
        };
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararRelogio());
  }

  protected async enviar(): Promise<void> {
    const { email } = this.formulario.controls;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.campoEmail()?.focar();
      return;
    }
    await this.pedir(email.value.trim(), false);
  }

  protected async enviarDeNovo(): Promise<void> {
    if (this.esperaReenvio() === 0) {
      await this.pedir(this.emailPedido(), true);
    }
  }

  protected usarOutroEmail(): void {
    this.falha.set(null);
    this.etapa.set('formulario');
    afterNextRender(() => this.campoEmail()?.focar(), { injector: this.injector });
  }

  private async pedir(email: string, deNovo: boolean): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.falha.set(null);
    try {
      await this.sessao.pedirRedefinicao(email);
      this.estado.envioPorEmail.set('disponivel');
      this.estado.email.set(email);
      this.emailPedido.set(email);
      this.contarReenvio();
      if (deNovo) {
        this.avisos.sucesso('Pedimos um novo link. Confira o seu e-mail.');
      } else {
        this.irPara('enviado');
      }
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.regra === 'R2.8') {
        this.estado.envioPorEmail.set('indisponivel');
        this.irPara('indisponivel');
      } else if (erro.ehDadosInvalidos && erro.mensagemDoCampo('email')) {
        this.etapa.set('formulario');
        this.formulario.controls.email.setErrors({ api: erro.mensagemDoCampo('email') });
        this.campoEmail()?.focar();
      } else if (deNovo) {
        this.avisos.erro(erro);
      } else {
        this.falha.set({ mensagem: erro.resumo, codigo: erro.requisicaoId });
      }
    } finally {
      this.enviando.set(false);
    }
  }

  /** Troca o conteúdo do cartão e leva o foco ao novo título (o leitor de tela anuncia). */
  private irPara(etapa: Etapa): void {
    this.etapa.set(etapa);
    afterNextRender(() => this.moldura().focarTitulo(), { injector: this.injector });
  }

  private contarReenvio(): void {
    this.agora.set(Date.now());
    this.reenvioLiberadoEm.set(Date.now() + INTERVALO_DE_REENVIO_SEGUNDOS * 1000);
    this.pararRelogio();
    this.relogio = setInterval(() => {
      this.agora.set(Date.now());
      if (this.esperaReenvio() === 0) {
        this.pararRelogio();
      }
    }, 1000);
  }

  private pararRelogio(): void {
    if (this.relogio !== null) {
      clearInterval(this.relogio);
      this.relogio = null;
    }
  }
}
