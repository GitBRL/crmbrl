import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { baixarArquivo } from '../../nucleo/baixar-arquivo';
import { copiarTexto } from '../../nucleo/copiar';
import { formatarDataHora } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { Selo } from '../../ui/selo/selo';
import { type AtivacaoDoisFatores, DoisFatoresApi } from './dois-fatores.api';

/** Em que parte do caminho o cartão está. */
export type ModoDoisFatores =
  | 'carregando'
  | 'erro'
  | 'inativo'
  | 'configurando'
  | 'codigos'
  | 'ativo'
  | 'novos-codigos'
  | 'desativando';

/** O texto do arquivo .txt com os códigos de recuperação. */
export function textoDosCodigos(codigos: readonly string[], email: string): string {
  return [
    'BRL CRM - códigos de recuperação da verificação em duas etapas',
    `Conta: ${email}`,
    '',
    'Cada código vale uma vez só. Guarde este arquivo em lugar seguro.',
    '',
    ...codigos,
    '',
  ].join('\n');
}

/**
 * Cartão "Verificação em duas etapas" do Meu perfil (R2.11): ativar (QR + chave, confirmar com
 * um código), guardar os 10 códigos de recuperação (copiar e baixar .txt; aparecem só uma vez),
 * gerar novos e desativar (senha atual + código).
 */
@Component({
  selector: 'app-cartao-dois-fatores',
  imports: [
    ReactiveFormsModule,
    Botao,
    CaixaSelecao,
    CampoSenha,
    CampoTexto,
    Cartao,
    Esqueleto,
    Selo,
  ],
  template: `
    <app-cartao
      class="df"
      regiao
      [nivel]="3"
      titulo="Verificação em duas etapas"
      dica="Além da senha, você digita um código do aplicativo autenticador no celular. Opcional, e deixa a conta bem mais segura."
    >
      <div class="df__corpo">
        @switch (modo()) {
          @case ('carregando') {
            <div aria-busy="true">
              <p class="visualmente-oculto" role="status">
                Carregando a verificação em duas etapas…
              </p>
              <app-esqueleto forma="bloco" altura="5rem" />
            </div>
          }
          @case ('erro') {
            <p class="df__erro" role="alert">{{ erro() }}</p>
            <div class="df__acoes">
              <button appBotao type="button" variante="contorno" (click)="carregar()">
                Tentar de novo
              </button>
            </div>
          }
          @case ('inativo') {
            <div class="df__status">
              <app-selo variante="neutro">Desativada</app-selo>
            </div>
            <p class="df__texto">
              Você vai precisar de um aplicativo autenticador (Google Authenticator, Microsoft
              Authenticator, Authy, 1Password…) instalado no celular.
            </p>
            @if (erro(); as falha) {
              <p class="df__erro" role="alert">{{ falha }}</p>
            }
            <div class="df__acoes">
              <button
                appBotao
                type="button"
                variante="invertido"
                [carregando]="ocupado()"
                (click)="ativar()"
              >
                Ativar
              </button>
            </div>
          }
          @case ('configurando') {
            @let a = ativacao()!;
            <ol class="df__passos">
              <li>
                <strong>Leia o QR code</strong> no aplicativo autenticador.
                <img
                  class="df__qr"
                  [src]="a.qrCode"
                  alt="QR code para configurar o aplicativo autenticador"
                  width="200"
                  height="200"
                />
              </li>
              <li>
                <strong>Ou digite a chave</strong> no aplicativo, se não puder ler o QR:
                <code class="df__chave numeros" aria-label="Chave para digitar no aplicativo">{{
                  a.chave
                }}</code>
                <button
                  appBotao
                  type="button"
                  variante="contorno"
                  tamanho="sm"
                  (click)="copiar(a.chave, 'Chave copiada.')"
                >
                  Copiar chave
                </button>
              </li>
              <li><strong>Digite o código de 6 dígitos</strong> que o aplicativo mostra:</li>
            </ol>
            <form
              class="df__form"
              novalidate
              [formGroup]="formularioCodigo"
              (ngSubmit)="confirmar()"
            >
              <app-campo-texto
                #campoCodigo
                rotulo="Código do aplicativo"
                nome="codigo"
                autocomplete="one-time-code"
                teclado="numeric"
                placeholder="000000"
                [maximoCaracteres]="7"
                formControlName="codigo"
                [mensagens]="{ required: 'Digite o código do aplicativo.' }"
              />
              <div class="df__acoes">
                <button appBotao type="submit" variante="invertido" [carregando]="ocupado()">
                  Confirmar
                </button>
                <button appBotao type="button" variante="contorno" (click)="cancelar()">
                  Cancelar
                </button>
              </div>
            </form>
          }
          @case ('codigos') {
            <p class="df__texto" role="status">
              <strong>Verificação ativada.</strong> Guarde estes 10 códigos de recuperação: eles
              aparecem <strong>só agora</strong>. Se perder o celular, cada código entra uma vez no
              lugar do código do aplicativo.
            </p>
            <ul class="df__codigos numeros" aria-label="Códigos de recuperação">
              @for (c of codigos(); track c) {
                <li>{{ c }}</li>
              }
            </ul>
            <div class="df__acoes">
              <button
                appBotao
                type="button"
                variante="contorno"
                (click)="copiar(codigos().join('\\n'), 'Códigos copiados.')"
              >
                Copiar
              </button>
              <button appBotao type="button" variante="contorno" (click)="baixar()">
                Baixar .txt
              </button>
            </div>
            <app-caixa-selecao rotulo="Guardei os códigos em um lugar seguro" [(valor)]="guardou" />
            <div class="df__acoes">
              <button
                appBotao
                type="button"
                variante="invertido"
                [disabled]="!guardou()"
                (click)="concluir()"
              >
                Concluir
              </button>
            </div>
          }
          @case ('ativo') {
            <div class="df__status">
              <app-selo variante="menta" ponto>Ativada</app-selo>
              @if (ativadoEm(); as quando) {
                <span class="df__quando">desde {{ quando }}</span>
              }
            </div>
            <p class="df__texto">
              Códigos de recuperação restantes:
              <strong class="numeros">{{ restantes() }}</strong
              >.
              @if (restantes() <= 2) {
                Restam poucos: gere novos.
              }
            </p>
            <div class="df__acoes">
              <button appBotao type="button" variante="contorno" (click)="abrirNovosCodigos()">
                Gerar novos códigos
              </button>
              <button appBotao type="button" variante="contorno" (click)="abrirDesativar()">
                Desativar
              </button>
            </div>
          }
          @case ('novos-codigos') {
            <p class="df__texto">
              Digite um código do aplicativo para gerar 10 códigos novos. Os antigos deixam de
              valer.
            </p>
            <form
              class="df__form"
              novalidate
              [formGroup]="formularioCodigo"
              (ngSubmit)="gerarNovos()"
            >
              <app-campo-texto
                #campoCodigo
                rotulo="Código do aplicativo"
                nome="codigo"
                autocomplete="one-time-code"
                teclado="numeric"
                placeholder="000000"
                [maximoCaracteres]="7"
                formControlName="codigo"
                [mensagens]="{ required: 'Digite o código do aplicativo.' }"
              />
              <div class="df__acoes">
                <button appBotao type="submit" variante="invertido" [carregando]="ocupado()">
                  Gerar novos códigos
                </button>
                <button appBotao type="button" variante="contorno" (click)="voltar()">
                  Cancelar
                </button>
              </div>
            </form>
          }
          @case ('desativando') {
            <p class="df__texto">
              Para desativar, confirme a sua senha atual e um código (do aplicativo ou de
              recuperação).
            </p>
            <form class="df__form" novalidate [formGroup]="desativacao" (ngSubmit)="desativar()">
              <app-campo-senha
                #campoSenha
                rotulo="Senha atual"
                autocomplete="current-password"
                formControlName="senha"
                [mensagens]="{ required: 'Digite a sua senha atual.' }"
              />
              <app-campo-texto
                #campoCodigoDesativar
                rotulo="Código"
                nome="codigo"
                autocomplete="one-time-code"
                dica="6 dígitos do aplicativo ou um código de recuperação."
                [maximoCaracteres]="16"
                formControlName="codigo"
                [mensagens]="{ required: 'Digite um código.' }"
              />
              <div class="df__acoes">
                <button appBotao type="submit" variante="invertido" [carregando]="ocupado()">
                  Desativar verificação
                </button>
                <button appBotao type="button" variante="contorno" (click)="voltar()">
                  Cancelar
                </button>
              </div>
            </form>
          }
        }
      </div>
    </app-cartao>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .df__corpo,
    .df__form {
      display: grid;
      gap: var(--esp-4);
      min-width: 0;
    }
    .df__status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--esp-2);
    }
    .df__quando {
      color: var(--cor-texto-suave);
    }
    .df__texto {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .df__passos {
      display: grid;
      gap: var(--esp-4);
      margin: 0;
      padding-left: var(--esp-5);
      li {
        display: grid;
        justify-items: start;
        gap: var(--esp-2);
        min-width: 0;
      }
    }
    .df__qr {
      max-width: 100%;
      height: auto;
      background: #fff;
      padding: var(--esp-2);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
    }
    .df__chave {
      max-width: 100%;
      padding: var(--esp-2) var(--esp-3);
      background: var(--cor-superficie-2, var(--cor-fundo));
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-sm);
      font-size: 1rem;
      letter-spacing: 0.08em;
      overflow-wrap: anywhere;
      user-select: all;
    }
    .df__codigos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: var(--esp-2);
      margin: 0;
      padding: var(--esp-3);
      list-style: none;
      background: var(--cor-superficie-2, var(--cor-fundo));
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
      font-size: 1rem;
      letter-spacing: 0.06em;
    }
    .df__erro {
      margin: 0;
      color: var(--cor-erro, var(--cor-texto));
    }
    .df__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--esp-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoDoisFatores {
  private readonly api = inject(DoisFatoresApi);
  private readonly avisos = inject(AvisosService);
  private readonly sessao = inject(SessaoService);
  private readonly injetor = inject(Injector);

  protected readonly modo = signal<ModoDoisFatores>('carregando');
  protected readonly ocupado = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly ativacao = signal<AtivacaoDoisFatores | null>(null);
  protected readonly codigos = signal<readonly string[]>([]);
  protected readonly guardou = signal(false);
  protected readonly ativadoEm = signal<string | null>(null);
  protected readonly restantes = signal(0);

  protected readonly codigo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly formularioCodigo = new FormGroup({ codigo: this.codigo });
  protected readonly desativacao = new FormGroup({
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly campoCodigo = viewChild<CampoTexto>('campoCodigo');
  private readonly campoSenha = viewChild<CampoSenha>('campoSenha');
  private readonly campoCodigoDesativar = viewChild<CampoTexto>('campoCodigoDesativar');

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.modo.set('carregando');
    this.erro.set(null);
    try {
      this.aplicarSituacao(await this.api.situacao());
    } catch (falha) {
      this.erro.set(erroDaApi(falha).mensagem);
      this.modo.set('erro');
    }
  }

  protected async ativar(): Promise<void> {
    if (this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    this.erro.set(null);
    try {
      this.ativacao.set(await this.api.ativar());
      this.codigo.reset('');
      this.modo.set('configurando');
      this.focarDepois(() => this.campoCodigo());
    } catch (falha) {
      this.erro.set(erroDaApi(falha).mensagem);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async confirmar(): Promise<void> {
    if (!(await this.enviarCodigo((codigo) => this.api.confirmar(codigo)))) {
      return;
    }
    this.ativacao.set(null);
    this.guardou.set(false);
    this.modo.set('codigos');
    await this.sessao.carregar(true);
    this.avisos.sucesso('Verificação em duas etapas ativada.');
  }

  protected abrirNovosCodigos(): void {
    this.codigo.reset('');
    this.modo.set('novos-codigos');
    this.focarDepois(() => this.campoCodigo());
  }

  protected async gerarNovos(): Promise<void> {
    if (!(await this.enviarCodigo((codigo) => this.api.novosCodigos(codigo)))) {
      return;
    }
    this.guardou.set(false);
    this.modo.set('codigos');
    this.avisos.sucesso('Novos códigos gerados. Os antigos não valem mais.');
  }

  protected abrirDesativar(): void {
    this.desativacao.reset();
    this.modo.set('desativando');
    this.focarDepois(() => this.campoSenha());
  }

  protected async desativar(): Promise<void> {
    if (this.ocupado()) {
      return;
    }
    this.desativacao.markAllAsTouched();
    if (this.desativacao.invalid) {
      (this.desativacao.controls.senha.invalid
        ? this.campoSenha()
        : this.campoCodigoDesativar()
      )?.focar();
      return;
    }
    const { senha, codigo } = this.desativacao.getRawValue();
    this.ocupado.set(true);
    try {
      await this.api.desativar(senha, codigo.trim());
      await this.sessao.carregar(true);
      this.avisos.sucesso('Verificação em duas etapas desativada.');
      await this.carregar();
    } catch (falha) {
      const erro = erroDaApi(falha);
      const daSenha = erro.mensagemDoCampo('senha');
      if (daSenha) {
        this.desativacao.controls.senha.setErrors({ api: 'A senha atual está incorreta.' });
        this.campoSenha()?.focar();
      } else if (erro.ehDadosInvalidos) {
        this.desativacao.controls.codigo.setErrors({
          api: 'Código incorreto. Confira o aplicativo ou use um código de recuperação.',
        });
        this.campoCodigoDesativar()?.focar();
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  protected cancelar(): void {
    this.ativacao.set(null);
    this.modo.set('inativo');
  }

  protected voltar(): void {
    this.modo.set('ativo');
  }

  protected async concluir(): Promise<void> {
    this.codigos.set([]);
    await this.carregar();
  }

  protected async copiar(texto: string, aviso: string): Promise<void> {
    if (await copiarTexto(texto)) {
      this.avisos.sucesso(aviso);
    } else {
      this.avisos.info('Não foi possível copiar. Selecione o texto e copie com Ctrl+C.');
    }
  }

  protected baixar(): void {
    const email = this.sessao.usuario()?.email ?? '';
    baixarArquivo(
      new Blob([textoDosCodigos(this.codigos(), email)], { type: 'text/plain;charset=utf-8' }),
      'brl-crm-codigos-de-recuperacao.txt',
    );
  }

  /** Envia `codigo` (confirmar ou novos códigos); em caso de sucesso guarda os códigos recebidos. */
  private async enviarCodigo(
    enviar: (codigo: string) => Promise<readonly string[]>,
  ): Promise<boolean> {
    if (this.ocupado()) {
      return false;
    }
    this.codigo.markAsTouched();
    if (this.codigo.invalid) {
      this.campoCodigo()?.focar();
      return false;
    }
    this.ocupado.set(true);
    try {
      this.codigos.set(await enviar(this.codigo.value.trim()));
      this.codigo.reset('');
      return true;
    } catch (falha) {
      const erro = erroDaApi(falha);
      if (erro.ehDadosInvalidos) {
        this.codigo.setErrors({
          api: 'Código incorreto. Confira o aplicativo: ele muda a cada 30 segundos.',
        });
        this.campoCodigo()?.focar();
      } else {
        this.avisos.erro(erro);
      }
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }

  private aplicarSituacao(situacao: {
    readonly ativo: boolean;
    readonly ativadoEm: string | null;
    readonly codigosRestantes: number;
  }): void {
    this.ativadoEm.set(situacao.ativadoEm ? formatarDataHora(situacao.ativadoEm) : null);
    this.restantes.set(situacao.codigosRestantes);
    this.modo.set(situacao.ativo ? 'ativo' : 'inativo');
  }

  private focarDepois(campo: () => { focar(): void } | undefined): void {
    afterNextRender(() => campo()?.focar(), { injector: this.injetor });
  }
}
