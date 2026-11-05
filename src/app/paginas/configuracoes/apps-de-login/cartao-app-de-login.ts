import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';

import { erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../../nucleo/confirmacao.service';
import { formatarData } from '../../../nucleo/formatos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { CampoSenha } from '../../../ui/campo-senha/campo-senha';
import { CampoTexto, type ValorCampoTexto } from '../../../ui/campo-texto/campo-texto';
import { Selo } from '../../../ui/selo/selo';
import { LogotipoAplicativo } from '../../integracoes/comum/logotipo-aplicativo';
import { ValorUnico } from '../../integracoes/comum/valor-unico';
import { AppsDeLoginApi } from './apps-de-login.api';
import {
  type AppDeLogin,
  haUso,
  LOGOTIPO_DO_APP,
  resumoDoUso,
  TEXTOS_DOS_APPS,
  type UsoDoApp,
} from './apps-de-login.tipos';

const NOMES_DAS_PERMISSOES: Readonly<Record<string, string>> = {
  leads_retrieval: 'Ler os leads dos formulários',
  pages_show_list: 'Listar as páginas que a pessoa administra',
  pages_read_engagement: 'Ler os dados das páginas',
  pages_manage_metadata: 'Assinar o webhook da página',
  pages_manage_ads: 'Ler os formulários de anúncio',
  ads_management: 'Ler os anúncios',
  business_management: 'Ler as páginas do Business Manager',
};

/**
 * Cartão de um app de login (R32.22): o logotipo, a situação, o ID e o segredo do app, o endereço
 * de retorno a cadastrar no serviço, o passo a passo e quanto está em uso. No app da Meta ainda
 * mostra o webhook de páginas, as permissões e o aviso do App Review.
 */
@Component({
  selector: 'app-cartao-app-de-login',
  imports: [
    Botao,
    Cartao,
    CampoSenha,
    CampoTexto,
    LogotipoAplicativo,
    Selo,
    ValorUnico,
    LucideTriangleAlert,
  ],
  template: `
    <app-cartao>
      <article
        class="app"
        [attr.aria-labelledby]="idTitulo()"
        [attr.data-teste]="'app-' + app().aplicativo"
      >
        <header class="app__cabecalho">
          <app-logotipo-aplicativo [aplicativo]="logotipo()" tamanho="md" />
          <div class="app__titulo">
            <h3 class="app__nome" [id]="idTitulo()">{{ app().nome }}</h3>
            <p class="app__uso" data-teste="uso">{{ uso() }}</p>
          </div>
          <app-selo [variante]="app().configurado ? 'menta' : 'neutro'" ponto>{{
            app().configurado ? 'Configurado' : 'Não configurado'
          }}</app-selo>
        </header>

        <form class="app__form" novalidate (submit)="$event.preventDefault(); salvar()">
          <div class="app__dupla">
            <app-campo-texto
              [rotulo]="textos().rotuloDoId"
              obrigatorio
              autocomplete="off"
              [teclado]="meta() ? 'numeric' : null"
              [dica]="textos().ondeFica"
              [erro]="erroDoId()"
              [valor]="clientId()"
              (valorChange)="aoMudarId($event)"
            />
            <app-campo-senha
              [rotulo]="textos().rotuloDoSegredo"
              segredo
              [obrigatorio]="exigeSegredo()"
              [dica]="dicaDoSegredo()"
              [erro]="erroDoSegredo()"
              [valor]="segredo()"
              (valorChange)="aoMudarSegredo($event)"
            />
          </div>
          @if (erroGeral(); as mensagem) {
            <p class="app__erro" role="alert">{{ mensagem }}</p>
          }
          <div class="app__acoes">
            <button appBotao type="submit" variante="invertido" [carregando]="salvando()">
              {{ app().configurado ? 'Salvar alterações' : 'Cadastrar o app' }}
            </button>
            @if (app().configurado) {
              <button
                appBotao
                type="button"
                variante="neutro"
                [carregando]="removendo()"
                (click)="remover()"
              >
                Remover o app
              </button>
            }
            @if (app().atualizadoPor; as quem) {
              <span class="app__quando"
                >Atualizado por {{ quem.nome }}
                @if (app().atualizadoEm; as quando) {
                  em {{ data(quando) }}
                }
              </span>
            }
          </div>
        </form>

        <section class="app__bloco" [attr.aria-labelledby]="idTitulo() + '-retorno'">
          <h4 class="app__subtitulo" [id]="idTitulo() + '-retorno'">Endereço de retorno</h4>
          <p class="app__nota">
            Cadastre este endereço em <strong>{{ textos().ondeCadastrarRetorno }}</strong> Sem ele o
            login volta com erro.
          </p>
          <app-valor-unico
            rotulo="Endereço de retorno"
            oQue="Endereço de retorno"
            [valor]="app().enderecoDeRetorno"
            [aviso]="null"
          />
        </section>

        @if (meta()) {
          <section
            class="app__bloco"
            [attr.aria-labelledby]="idTitulo() + '-webhook'"
            data-teste="webhook-meta"
          >
            <h4 class="app__subtitulo" [id]="idTitulo() + '-webhook'">Webhook de páginas</h4>
            @if (app().webhook; as webhook) {
              <p class="app__nota">
                No app da Meta, vá em <strong>Webhooks</strong> → <strong>Page</strong>, cole o
                endereço e o token abaixo e assine o campo
                @for (campo of webhook.campos; track campo) {
                  <code>{{ campo }}</code>
                }
                . Sem isso a Meta não avisa o CRM e os leads só chegam pela conferência de 15 em 15
                minutos.
              </p>
              <app-valor-unico
                rotulo="Endereço do webhook"
                oQue="Endereço do webhook"
                [valor]="webhook.url"
                [aviso]="null"
              />
              <app-valor-unico
                rotulo="Token de verificação"
                oQue="Token de verificação"
                [valor]="webhook.tokenVerificacao"
                [aviso]="null"
              />
            } @else {
              <p class="app__nota">
                O endereço do webhook e o token de verificação aparecem aqui assim que o app for
                cadastrado.
              </p>
            }
          </section>

          <section class="app__bloco" [attr.aria-labelledby]="idTitulo() + '-permissoes'">
            <h4 class="app__subtitulo" [id]="idTitulo() + '-permissoes'">Permissões pedidas</h4>
            <ul class="app__permissoes">
              @for (permissao of app().escopos; track permissao) {
                <li>
                  <code>{{ permissao }}</code>
                  @if (nomeDaPermissao(permissao); as nome) {
                    <span class="app__nota">{{ nome }}</span>
                  }
                </li>
              }
            </ul>
            <div class="app__aviso" role="note" data-teste="aviso-app-review">
              <svg lucideTriangleAlert [size]="18" aria-hidden="true" />
              <p>
                <strong>App Review e Leads Access:</strong> a permissão
                <code>leads_retrieval</code> precisa ser aprovada na Análise de apps da Meta, e o
                CRM precisa ser liberado em Leads Access (Central de Leads) para cada página.
                Enquanto o app está em modo de desenvolvimento, só chegam leads de quem tem função
                no app.
              </p>
            </div>
          </section>
        }

        <details class="app__como">
          <summary>Como criar o app</summary>
          <ol class="app__passos">
            @for (passo of textos().passos; track $index) {
              <li>{{ passo }}</li>
            }
          </ol>
          <p class="app__nota">
            Ficou com dúvida? Pergunte ao assistente de ajuda: “como criar o app de login”.
          </p>
        </details>
      </article>
    </app-cartao>
  `,
  styleUrl: './cartao-app-de-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartaoAppDeLogin {
  private readonly api = inject(AppsDeLoginApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  readonly app = input.required<AppDeLogin>();
  /** O app depois de salvo ou removido (a lista da tela é atualizada pelo pai). */
  readonly atualizado = output<AppDeLogin>();

  protected readonly clientId = signal('');
  protected readonly segredo = signal('');
  protected readonly salvando = signal(false);
  protected readonly removendo = signal(false);
  protected readonly tocou = signal(false);
  protected readonly erroDoServidorNoId = signal<string | null>(null);
  protected readonly erroDoServidorNoSegredo = signal<string | null>(null);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly data = formatarData;

  protected readonly meta = computed(() => this.app().aplicativo === 'META');
  protected readonly textos = computed(() => TEXTOS_DOS_APPS[this.app().aplicativo]);
  protected readonly logotipo = computed(() => LOGOTIPO_DO_APP[this.app().aplicativo]);
  protected readonly idTitulo = computed(() => `app-login-${this.app().aplicativo}`);
  protected readonly uso = computed(() => resumoDoUso(this.app().emUso));
  /** O segredo é obrigatório no primeiro cadastro e quando o ID muda. */
  protected readonly idMudou = computed(
    () => this.app().configurado && this.clientId().trim() !== (this.app().clientId ?? ''),
  );
  protected readonly exigeSegredo = computed(() => !this.app().configurado || this.idMudou());
  protected readonly dicaDoSegredo = computed(() => {
    const app = this.app();
    if (!app.configurado) {
      return 'Fica cifrado no CRM e nunca é mostrado de novo.';
    }
    return this.idMudou()
      ? 'Informe o segredo do app novo.'
      : `Salvo: ${app.segredoMascarado ?? '••••'}. Deixe em branco para manter.`;
  });
  protected readonly erroDoId = computed(() => {
    const id = this.clientId().trim();
    if (this.erroDoServidorNoId()) {
      return this.erroDoServidorNoId();
    }
    if (!this.tocou()) {
      return null;
    }
    if (!id) {
      return `Informe o ${this.textos().rotuloDoId}.`;
    }
    if (this.meta() && !/^\d{1,40}$/.test(id)) {
      return 'O ID do app da Meta tem só números.';
    }
    return null;
  });
  protected readonly erroDoSegredo = computed(() => {
    if (this.erroDoServidorNoSegredo()) {
      return this.erroDoServidorNoSegredo();
    }
    return this.tocou() && this.exigeSegredo() && !this.segredo().trim()
      ? `Informe o ${this.textos().rotuloDoSegredo.toLowerCase()}.`
      : null;
  });

  constructor() {
    // Mostra o ID salvo; ao salvar ou recarregar, o segredo digitado some.
    effect(() => {
      const app = this.app();
      untracked(() => {
        this.clientId.set(app.clientId ?? '');
        this.segredo.set('');
        this.tocou.set(false);
      });
    });
  }

  protected nomeDaPermissao(permissao: string): string | null {
    return NOMES_DAS_PERMISSOES[permissao] ?? null;
  }

  protected aoMudarId(valor: ValorCampoTexto): void {
    this.clientId.set(String(valor ?? ''));
    this.erroDoServidorNoId.set(null);
    this.erroGeral.set(null);
  }

  protected aoMudarSegredo(valor: ValorCampoTexto): void {
    this.segredo.set(String(valor ?? ''));
    this.erroDoServidorNoSegredo.set(null);
    this.erroGeral.set(null);
  }

  protected async salvar(): Promise<void> {
    this.tocou.set(true);
    if (this.erroDoId() || this.erroDoSegredo()) {
      return;
    }
    const dados = {
      clientId: this.clientId().trim(),
      ...(this.segredo().trim() ? { segredo: this.segredo().trim() } : {}),
    };
    this.salvando.set(true);
    this.erroGeral.set(null);
    try {
      const salvo = await this.api.salvar(this.app().aplicativo, dados);
      this.atualizado.emit(salvo);
      this.avisos.sucesso(`App de login do ${this.app().nome} salvo.`);
    } catch (falha) {
      const erro = erroDaApi(falha);
      const emUso = erro.ehConflito
        ? (erro.detalhes?.['emUso'] as UsoDoApp | undefined)
        : undefined;
      if (emUso) {
        await this.confirmarTroca(dados, emUso);
      } else if (erro.status === 422 || erro.mensagemDoCampo('segredo')) {
        this.erroDoServidorNoSegredo.set(erro.mensagemDoCampo('segredo') ?? erro.resumo);
      } else if (erro.mensagemDoCampo('clientId')) {
        this.erroDoServidorNoId.set(erro.mensagemDoCampo('clientId'));
      } else {
        this.erroGeral.set(erro.resumo);
      }
    } finally {
      this.salvando.set(false);
    }
  }

  /** Trocar o ID de um app em uso: mostra o que será afetado e pede a confirmação. */
  private async confirmarTroca(
    dados: { clientId: string; segredo?: string },
    emUso: UsoDoApp,
  ): Promise<void> {
    const caixa: { app?: AppDeLogin } = {};
    const ok = await this.confirmacao.confirmar({
      titulo: `Trocar o app de login do ${this.app().nome}?`,
      mensagem:
        'As conexões, os canais e as integrações abaixo deixam de funcionar até alguém entrar de novo com o app novo. Os dados já recebidos não se perdem.',
      detalhes: [resumoDoUso(emUso)],
      confirmar: 'Trocar o app',
      perigo: true,
      executar: async () => {
        caixa.app = await this.api.salvar(this.app().aplicativo, {
          ...dados,
          confirmarTroca: true,
        });
      },
    });
    if (ok && caixa.app) {
      this.atualizado.emit(caixa.app);
      this.avisos.sucesso(
        `App de login do ${this.app().nome} trocado. Peça para conectar de novo onde aparecer o aviso.`,
      );
    }
  }

  protected async remover(): Promise<void> {
    const app = this.app();
    this.erroGeral.set(null);
    if (haUso(app.emUso)) {
      this.erroGeral.set(
        `Não dá para remover: ${resumoDoUso(app.emUso)} usam este app. Remova ou troque o que usa e tente de novo.`,
      );
      return;
    }
    const caixa: { app?: AppDeLogin } = {};
    this.removendo.set(true);
    try {
      const ok = await this.confirmacao.confirmar({
        titulo: `Remover o app de login do ${app.nome}?`,
        mensagem:
          'Ninguém mais poderá entrar com este serviço pelos assistentes até o app ser cadastrado de novo.',
        confirmar: 'Remover o app',
        perigo: true,
        executar: async () => {
          await this.api.remover(app.aplicativo);
          caixa.app = (await this.api.listar()).find((a) => a.aplicativo === app.aplicativo);
        },
      });
      if (ok && caixa.app) {
        this.atualizado.emit(caixa.app);
        this.avisos.sucesso(`App de login do ${app.nome} removido.`);
      }
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.removendo.set(false);
    }
  }
}
