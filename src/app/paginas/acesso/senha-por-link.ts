import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  effect,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideTriangleAlert } from '@lucide/angular';
import { startWith } from 'rxjs';

import { erroDaApi, type ErroApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { formatarDataHora } from '../../nucleo/formatos';
import type { ConsultaToken } from '../../nucleo/sessao/perfil';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { AvisoAcesso } from './aviso-acesso';
import { EstadoAcesso } from './estado-acesso';
import { MolduraAcesso } from './moldura-acesso';
import { RegrasSenha } from './regras-senha';
import {
  confirmaNovaSenha,
  MENSAGENS_CONFIRMACAO,
  MENSAGENS_NOVA_SENHA,
  revalidarJunto,
  VALIDADORES_NOVA_SENHA,
} from './senha';

/** Convite (`/definir-senha`) ou redefinição pelo "esqueci" (`/redefinir-senha`). */
export type ModoSenhaPorLink = 'convite' | 'redefinicao';

type Situacao = 'carregando' | 'formulario' | 'invalido' | 'erro';

/**
 * Definir a senha pelo link do e-mail (R2.8): o convite (`/definir-senha?token=`) e a
 * redefinição (`/redefinir-senha?token=`) são a mesma operação na API, só muda o texto.
 *
 * 1. Confere o link (`auth/senha/token`) enquanto mostra o esqueleto do formulário.
 * 2. Link válido: "Olá, <nome>", a conta (e-mail), até quando o link vale, nova senha e
 *    confirmação com a regra visível. Link vencido, já usado ou trocado por um mais novo: diz
 *    isso e o que fazer (pedir outro link; no convite, falar com o administrador).
 * 3. Senha definida: entra direto com ela (a API encerrou as sessões antigas) e segue para o
 *    início — ou para "Entrar", com o e-mail preenchido, se o login automático não der.
 *
 * O texto segue o tipo que a API devolve para o token (um link de convite aberto em
 * `/redefinir-senha` continua sendo convite).
 */
@Component({
  selector: 'app-senha-por-link',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MolduraAcesso,
    CampoSenha,
    Botao,
    Esqueleto,
    AvisoAcesso,
    RegrasSenha,
  ],
  templateUrl: './senha-por-link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SenhaPorLink {
  readonly token = input<string | null>(null);
  readonly modo = input.required<ModoSenhaPorLink>();

  private readonly sessao = inject(SessaoService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly estado = inject(EstadoAcesso);
  private readonly injector = inject(Injector);

  private readonly tokenLimpo = computed(() => this.token()?.trim() || undefined);

  /**
   * Consulta do link na API, refeita quando o token muda e em "Tentar de novo". (Não é um
   * `resource()`: ele seguraria a estabilidade do app enquanto a consulta não volta.)
   */
  private readonly consulta = signal<{
    readonly carregando: boolean;
    readonly dados?: ConsultaToken;
    readonly erro?: ErroApi;
  }>({ carregando: true });
  private consultaAtual = 0;
  private readonly dados = computed(() => this.consulta().dados);
  /** Falha ao consultar o link (rede, servidor). */
  protected readonly erroConsulta = computed(() => this.consulta().erro ?? null);

  /** O envio falhou porque o link deixou de valer entre a consulta e o envio (422 R2.8). */
  private readonly invalidadoNoEnvio = signal<string | null>(null);

  protected readonly situacao = computed<Situacao>(() => {
    if (!this.tokenLimpo() || this.invalidadoNoEnvio()) {
      return 'invalido';
    }
    const { carregando, dados, erro } = this.consulta();
    if (erro) {
      return 'erro';
    }
    if (carregando || !dados) {
      return 'carregando';
    }
    return dados.valido ? 'formulario' : 'invalido';
  });

  /** O tipo do link segundo a API (ou o da rota, enquanto não se sabe). */
  protected readonly convite = computed(() => {
    const tipo = this.dados()?.tipo;
    return tipo ? tipo === 'CONVITE' : this.modo() === 'convite';
  });

  protected readonly email = computed(() => this.dados()?.email ?? '');
  protected readonly validoAte = computed(() => {
    const expira = this.dados()?.expiraEm;
    return expira ? formatarDataHora(expira) : null;
  });

  protected readonly cabecalho = computed(() => {
    const convite = this.convite();
    const primeiroNome = (this.dados()?.nome ?? '').split(/\s+/)[0];
    const ola = primeiroNome ? `Olá, ${primeiroNome}! ` : '';
    switch (this.situacao()) {
      case 'invalido':
        return {
          titulo: convite ? 'Este convite não vale mais' : 'Este link não vale mais',
          frase: !this.tokenLimpo()
            ? 'O endereço está incompleto. Abra o link direto do e-mail, sem cortar nenhuma parte.'
            : (this.invalidadoNoEnvio() ??
              (convite
                ? 'Convites valem por 24 horas e só podem ser usados uma vez.'
                : 'Links para redefinir a senha valem por 24 horas, só podem ser usados uma vez e deixam de valer quando você pede outro.')),
          icone: LucideTriangleAlert,
          tom: 'atencao' as const,
        };
      case 'formulario':
        return {
          titulo: convite ? 'Crie a sua senha' : 'Redefinir senha',
          frase: convite
            ? `${ola}Você foi convidado para o BRL CRM. Crie uma senha para começar.`
            : `${ola}Escolha uma senha nova para a sua conta.`,
          icone: null,
          tom: 'neutro' as const,
        };
      default:
        return {
          titulo: convite ? 'Crie a sua senha' : 'Redefinir senha',
          frase: 'Conferindo o link do e-mail…',
          icone: null,
          tom: 'neutro' as const,
        };
    }
  });

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nova: ['', [...VALIDADORES_NOVA_SENHA]],
    confirmacao: ['', confirmaNovaSenha],
  });
  private readonly valores = toSignal(
    this.formulario.valueChanges.pipe(startWith(this.formulario.getRawValue())),
    { requireSync: true },
  );
  protected readonly nova = computed(() => this.valores().nova ?? '');
  protected readonly confirmacao = computed(() => this.valores().confirmacao ?? '');

  private readonly moldura = viewChild.required(MolduraAcesso);
  private readonly campoNova = viewChild<CampoSenha>('campoNova');
  private readonly campoConfirmacao = viewChild<CampoSenha>('campoConfirmacao');

  protected readonly enviando = signal(false);
  protected readonly falha = signal<{ mensagem: string; codigo: string | null } | null>(null);

  protected readonly mensagensNova = MENSAGENS_NOVA_SENHA;
  protected readonly mensagensConfirmacao = MENSAGENS_CONFIRMACAO;

  constructor() {
    const { nova, confirmacao } = this.formulario.controls;
    revalidarJunto(nova, confirmacao, inject(DestroyRef));
    effect(() => {
      const token = this.tokenLimpo();
      untracked(() => void this.consultar(token));
    });
  }

  protected tentarDeNovo(): void {
    void this.consultar(this.tokenLimpo());
  }

  private async consultar(token: string | undefined): Promise<void> {
    const numero = ++this.consultaAtual;
    if (!token) {
      this.consulta.set({ carregando: false });
      return;
    }
    this.consulta.set({ carregando: true });
    try {
      const dados = await this.sessao.consultarToken(token);
      if (numero === this.consultaAtual) {
        this.consulta.set({ carregando: false, dados });
      }
    } catch (falha) {
      if (numero === this.consultaAtual) {
        this.consulta.set({ carregando: false, erro: erroDaApi(falha) });
      }
    }
  }

  protected async definir(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    const { nova } = this.formulario.controls;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      (nova.invalid ? this.campoNova() : this.campoConfirmacao())?.focar();
      return;
    }
    const token = this.tokenLimpo();
    if (!token) {
      return;
    }
    this.enviando.set(true);
    this.falha.set(null);
    try {
      await this.sessao.definirSenhaComToken(token, nova.value);
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.regra === 'R2.8') {
        this.invalidadoNoEnvio.set(erro.resumo);
        afterNextRender(() => this.moldura().focarTitulo(), { injector: this.injector });
      } else if (erro.ehDadosInvalidos && erro.campos.length) {
        nova.setErrors({ api: erro.mensagemDoCampo('novaSenha') ?? erro.resumo });
        nova.markAsTouched();
        this.campoNova()?.focar();
      } else {
        this.falha.set({ mensagem: erro.resumo, codigo: erro.requisicaoId });
      }
      this.enviando.set(false);
      return;
    }
    await this.entrarComASenhaNova(nova.value);
  }

  /** A senha já vale: entra direto, sem pedir o que a pessoa acabou de digitar. */
  private async entrarComASenhaNova(senha: string): Promise<void> {
    const convite = this.convite();
    const email = this.email();
    try {
      await this.sessao.entrar(email, senha);
      this.avisos.sucesso(
        convite
          ? 'Senha criada. Boas-vindas ao BRL CRM!'
          : 'Senha redefinida. Você já entrou no CRM.',
      );
      await this.router.navigateByUrl(this.sessao.rotaAposEntrar(null));
    } catch {
      this.estado.email.set(email);
      this.avisos.info(
        convite
          ? 'Senha criada. Entre com o seu e-mail e a senha nova.'
          : 'Senha redefinida. Entre com a senha nova.',
      );
      await this.router.navigateByUrl('/entrar');
    } finally {
      this.enviando.set(false);
    }
  }
}
