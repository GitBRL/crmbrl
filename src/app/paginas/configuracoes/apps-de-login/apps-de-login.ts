import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { Botao } from '../../../ui/botao/botao';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { AppsDeLoginApi } from './apps-de-login.api';
import { type AppDeLogin, ORDEM_DOS_APPS } from './apps-de-login.tipos';
import { CartaoAppDeLogin } from './cartao-app-de-login';

/**
 * Apps de login (Configurações, só Admin; R32.22): cadastra uma vez o app da Meta, do Typeform e do
 * RD Station. Depois disso ninguém digita ID nem segredo de app nos assistentes: as conexões do
 * Facebook Lead Ads, do Typeform e do RD Station e os canais Messenger e Instagram usam estes.
 */
@Component({
  selector: 'app-apps-de-login',
  imports: [Botao, CartaoAppDeLogin, EstadoVazio, Esqueleto],
  template: `
    <section class="secao" aria-labelledby="apps-de-login-titulo">
      <header class="secao__cabecalho">
        <div class="secao__textos">
          <h2 class="secao__titulo" id="apps-de-login-titulo">Apps de login</h2>
          <p class="secao__frase">
            Cadastre aqui, uma vez, o app de cada serviço. Os assistentes de integração e os canais
            passam a oferecer “Entrar com…” sem pedir ID nem segredo de novo.
          </p>
        </div>
      </header>

      @if (carregando()) {
        <div class="secao__lista" aria-busy="true">
          <p class="visualmente-oculto" role="status">Carregando os apps de login…</p>
          <app-esqueleto forma="bloco" altura="16rem" />
          <app-esqueleto forma="bloco" altura="16rem" />
        </div>
      } @else if (erro(); as falha) {
        <app-estado-vazio
          variante="erro"
          titulo="Não conseguimos carregar os apps de login"
          [falha]="falha"
          [texto]="falha.resumo"
          [codigo]="falha.ehFalhaDoServidor ? falha.requisicaoId : null"
        >
          <button appBotao type="button" variante="invertido" (click)="carregar()">
            Tentar de novo
          </button>
        </app-estado-vazio>
      } @else {
        <div class="secao__lista">
          @for (app of apps(); track app.aplicativo) {
            <app-cartao-app-de-login [app]="app" (atualizado)="aoAtualizar($event)" />
          }
        </div>
      }
    </section>
  `,
  styleUrl: './apps-de-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppsDeLogin {
  private readonly api = inject(AppsDeLoginApi);

  protected readonly apps = signal<readonly AppDeLogin[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<ErroApi | null>(null);

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.listar();
      this.apps.set(ordenar(lista));
    } catch (falha) {
      this.erro.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  protected aoAtualizar(app: AppDeLogin): void {
    this.apps.update((lista) =>
      lista.map((item) => (item.aplicativo === app.aplicativo ? app : item)),
    );
  }
}

function ordenar(lista: readonly AppDeLogin[]): readonly AppDeLogin[] {
  return [...lista].sort(
    (a, b) => ORDEM_DOS_APPS.indexOf(a.aplicativo) - ORDEM_DOS_APPS.indexOf(b.aplicativo),
  );
}
