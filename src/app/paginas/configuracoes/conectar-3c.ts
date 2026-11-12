import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import { ANCORA_CONECTAR, TrescPlusService } from '../../nucleo/tresc-plus/tresc-plus.service';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo } from '../../ui/selo/selo';

/**
 * Cartão "Conectar ao 3C+" do Meu perfil (R34.2): usuário (e-mail ou ramal) e senha do 3C+.
 * A senha vai uma única vez ao 3C+ e nunca é guardada; o CRM fica só com o token do agente.
 * Conectado, mostra o ramal e o botão Desconectar.
 */
@Component({
  selector: 'app-conectar-3c',
  imports: [
    ReactiveFormsModule,
    Botao,
    CampoSenha,
    CampoTexto,
    Cartao,
    Esqueleto,
    EstadoVazio,
    Selo,
  ],
  template: `
    <app-cartao
      class="c3c"
      regiao
      [nivel]="3"
      titulo="Conectar ao 3C+"
      dica="Ligue para os seus contatos pelo discador da empresa, sem sair do CRM. Você precisa de uma conta de agente no 3C+."
    >
      <div class="c3c__corpo" [id]="ancora">
        @if (tresc.erro() && !tresc.vinculo()) {
          <app-estado-vazio
            compacto
            variante="erro"
            titulo="Não conseguimos consultar o 3C+"
            [texto]="tresc.erro()"
          >
            <button appBotao type="button" variante="invertido" (click)="tresc.carregar()">
              Tentar de novo
            </button>
          </app-estado-vazio>
        } @else if (!tresc.vinculo()) {
          <div aria-busy="true">
            <p class="visualmente-oculto" role="status">Carregando o seu vínculo com o 3C+…</p>
            <app-esqueleto forma="bloco" altura="7rem" />
          </div>
        } @else if (tresc.vinculado()) {
          @let v = tresc.vinculo()!;
          <div class="c3c__status">
            <app-selo variante="menta" ponto>Conectado</app-selo>
            <span class="c3c__quem">{{ v.nome3c ?? 'Agente do 3C+' }}</span>
          </div>
          <dl class="c3c__dados">
            @if (v.ramal) {
              <div>
                <dt>Ramal</dt>
                <dd class="numeros">{{ v.ramal }}</dd>
              </div>
            }
            @if (v.token) {
              <div>
                <dt>Token do agente</dt>
                <dd class="numeros">{{ v.token }}</dd>
              </div>
            }
            @if (v.vinculadoEm) {
              <div>
                <dt>Conectado em</dt>
                <dd>{{ dataHora(v.vinculadoEm) }}</dd>
              </div>
            }
          </dl>
          @if (erro(); as falha) {
            <p class="c3c__erro" role="alert">{{ falha.mensagem }}</p>
          }
          <div class="c3c__acoes">
            <button
              appBotao
              type="button"
              variante="contorno"
              [carregando]="desconectando()"
              (click)="desconectar()"
            >
              Desconectar do 3C+
            </button>
          </div>
        } @else {
          <form class="c3c__form" novalidate [formGroup]="form" (ngSubmit)="conectar()">
            <app-campo-texto
              #campoUsuario
              rotulo="Usuário do 3C+"
              autocomplete="username"
              dica="O e-mail ou o ramal que você usa para entrar no 3C+."
              formControlName="usuario"
            />
            <app-campo-senha #campoSenha rotulo="Senha do 3C+" segredo formControlName="senha" />
            <p class="c3c__aviso">
              A senha é usada uma única vez para entrar no 3C+ e <strong>não é guardada</strong> no
              CRM. Só fica o token do agente, cifrado.
            </p>
            @if (erro(); as falha) {
              <p class="c3c__erro" role="alert">{{ falha.mensagem }}</p>
            }
            <div class="c3c__acoes">
              <button appBotao type="submit" variante="invertido" [carregando]="conectando()">
                Conectar ao 3C+
              </button>
            </div>
          </form>
        }
      </div>
    </app-cartao>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .c3c__corpo,
    .c3c__form {
      display: grid;
      gap: var(--esp-4);
    }
    .c3c__status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
    }
    .c3c__quem {
      font-weight: 600;
    }
    .c3c__dados {
      display: grid;
      gap: var(--esp-2);
      margin: 0;
      div {
        display: flex;
        flex-wrap: wrap;
        gap: var(--esp-2);
        justify-content: space-between;
      }
      dt {
        color: var(--cor-texto-suave);
      }
      dd {
        margin: 0;
      }
    }
    .c3c__aviso {
      margin: 0;
      color: var(--cor-texto-suave);
      font-size: 0.875rem;
    }
    .c3c__erro {
      margin: 0;
      color: var(--cor-erro, var(--cor-texto));
    }
    .c3c__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConectarAo3c {
  protected readonly tresc = inject(TrescPlusService);
  private readonly api = inject(TrescPlusApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly rota = inject(ActivatedRoute, { optional: true });
  private readonly injetor = inject(Injector);

  protected readonly ancora = ANCORA_CONECTAR;
  protected readonly dataHora = formatarDataHora;
  protected readonly form = new FormGroup({
    usuario: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly conectando = signal(false);
  protected readonly desconectando = signal(false);
  protected readonly erro = signal<ErroApi | null>(null);
  private readonly campoUsuario = viewChild<CampoTexto>('campoUsuario');
  private readonly campoSenha = viewChild<CampoSenha>('campoSenha');

  constructor() {
    if (this.rota?.snapshot.fragment === ANCORA_CONECTAR) {
      afterNextRender(
        () => {
          document.getElementById(ANCORA_CONECTAR)?.scrollIntoView({ block: 'center' });
          this.campoUsuario()?.focar();
        },
        { injector: this.injetor },
      );
    }
  }

  protected async conectar(): Promise<void> {
    if (this.conectando()) {
      return;
    }
    this.erro.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      (this.form.controls.usuario.invalid ? this.campoUsuario() : this.campoSenha())?.focar();
      return;
    }
    const { usuario, senha } = this.form.getRawValue();
    this.conectando.set(true);
    try {
      await this.api.vincular(usuario.trim(), senha);
      this.form.reset();
      await this.tresc.aposMudarVinculo();
      this.avisos.sucesso('Conectado ao 3C+. Agora você pode ligar pelos contatos e negócios.');
    } catch (falha) {
      this.form.controls.senha.reset();
      this.erro.set(erroDaApi(falha));
      this.campoSenha()?.focar();
    } finally {
      this.conectando.set(false);
    }
  }

  protected async desconectar(): Promise<void> {
    const ok = await this.confirmacao.confirmar({
      titulo: 'Desconectar do 3C+?',
      mensagem:
        'Você deixa de ligar pelo 3C+ no CRM e sai da campanha. Para voltar, conecte de novo com o seu usuário e senha do 3C+.',
      confirmar: 'Desconectar',
      perigo: true,
    });
    if (!ok) {
      return;
    }
    this.erro.set(null);
    this.desconectando.set(true);
    try {
      await this.api.desconectar();
      await this.tresc.aposMudarVinculo();
      this.avisos.sucesso('Desconectado do 3C+.');
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.desconectando.set(false);
    }
  }
}
