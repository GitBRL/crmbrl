import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  InjectionToken,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideInfo, LucideX, type LucideIconInput } from '@lucide/angular';

import { Botao } from '../../ui/botao/botao';
import { AvisoAcesso } from '../acesso/aviso-acesso';
import { MolduraAcesso, type TomIconeAcesso } from '../acesso/moldura-acesso';
import { CANAL_DO_LOGIN, CHAVE_DO_RETORNO } from '../integracoes/login/login-janela';
import {
  lerRetornoDoLogin,
  motivoDoLogin,
  NOME_DO_SERVICO,
  type RetornoDoLogin,
} from '../integracoes/login/login.tipos';

/** Tenta fechar esta janela. Um token para os testes trocarem por um espião. */
export const FECHAR_ESTA_JANELA = new InjectionToken<() => void>('FECHAR_ESTA_JANELA', {
  providedIn: 'root',
  factory: () => () => globalThis.close(),
});

/**
 * Fim do login em outra janela (`/retorno-login`; R32.23). Fica **fora da casca autenticada e sem
 * chamar a API**: só lê o que a API deixou na URL, avisa a janela do assistente (`BroadcastChannel`,
 * com `localStorage` e o evento `storage` como reserva) e tenta fechar a própria janela. Se o
 * navegador não deixar, mostra "Pronto! Pode fechar esta janela" e "Voltar ao CRM".
 *
 * Tudo que vem da URL é só texto: nada é interpretado como HTML.
 */
@Component({
  selector: 'app-retorno-login',
  imports: [RouterLink, MolduraAcesso, AvisoAcesso, Botao],
  template: `
    <app-moldura-acesso
      [titulo]="cabecalho().titulo"
      [frase]="cabecalho().frase"
      [icone]="cabecalho().icone"
      [tomIcone]="cabecalho().tom"
    >
      <div class="acesso-bloco" data-teste="retorno-login">
        @if (retorno(); as r) {
          @if (r.resultado === 'erro') {
            <app-aviso-acesso tipo="erro" [titulo]="'Não foi possível entrar'">
              <p>{{ motivo() }}</p>
              @if (r.mensagem) {
                <p data-teste="mensagem-do-servico">Mensagem do serviço: {{ r.mensagem }}</p>
              }
            </app-aviso-acesso>
          }
          <p class="acesso-nota" role="status" data-teste="pode-fechar">
            @if (r.resultado === 'conectado') {
              Pronto! Pode fechar esta janela.
            } @else {
              Pode fechar esta janela e tentar de novo no CRM.
            }
          </p>
        }
        <div class="acesso-acoes">
          <a appBotao routerLink="/integracoes" variante="invertido" tamanho="lg">Voltar ao CRM</a>
        </div>
      </div>
    </app-moldura-acesso>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetornoLogin {
  private readonly fecharEstaJanela = inject(FECHAR_ESTA_JANELA);

  readonly app = input<string | null>(null);
  readonly resultado = input<string | null>(null);
  readonly conexao = input<string | null>(null);
  readonly motivoDaUrl = input<string | null>(null, { alias: 'motivo' });
  readonly mensagemDaUrl = input<string | null>(null, { alias: 'mensagem' });

  /** O retorno lido da URL; `null` se a página foi aberta sem um login por trás. */
  protected readonly retorno = computed<RetornoDoLogin | null>(() =>
    lerRetornoDoLogin({
      app: this.app(),
      resultado: this.resultado(),
      conexao: this.conexao(),
      motivo: this.motivoDaUrl(),
      mensagem: this.mensagemDaUrl(),
    }),
  );
  protected readonly motivo = computed(() => {
    const r = this.retorno();
    return r ? motivoDoLogin(r.motivo, r.app) : '';
  });
  protected readonly cabecalho = computed<{
    titulo: string;
    frase: string | null;
    icone: LucideIconInput;
    tom: TomIconeAcesso;
  }>(() => {
    const r = this.retorno();
    if (!r) {
      return {
        titulo: 'Nada por aqui',
        frase: 'Esta página abre sozinha quando um login em outra janela termina.',
        icone: LucideInfo,
        tom: 'neutro',
      };
    }
    const servico = NOME_DO_SERVICO[r.app];
    switch (r.resultado) {
      case 'conectado':
        return {
          titulo: `${servico} conectado`,
          frase: 'O CRM já recebeu o acesso. A outra janela segue sozinha.',
          icone: LucideCheck,
          tom: 'sucesso',
        };
      case 'cancelado':
        return {
          titulo: 'Login cancelado',
          frase: `Você não autorizou o acesso ao ${servico}. Nada foi conectado.`,
          icone: LucideInfo,
          tom: 'atencao',
        };
      default:
        return {
          titulo: 'Login não concluído',
          frase: `Não conseguimos conectar o ${servico}.`,
          icone: LucideX,
          tom: 'erro',
        };
    }
  });

  private avisado = false;

  constructor() {
    // Uma vez só, quando as entradas da rota chegam.
    effect(() => {
      const r = this.retorno();
      if (r && !this.avisado) {
        this.avisado = true;
        untracked(() => this.avisarETentarFechar(r));
      }
    });
  }

  private avisarETentarFechar(r: RetornoDoLogin): void {
    const mensagem = { ...r, conexao: r.conexaoId, em: Date.now() };
    try {
      const canal = new BroadcastChannel(CANAL_DO_LOGIN);
      canal.postMessage(mensagem);
      canal.close();
    } catch {
      // Sem BroadcastChannel: a reserva abaixo avisa.
    }
    try {
      globalThis.localStorage?.setItem(CHAVE_DO_RETORNO, JSON.stringify(mensagem));
    } catch {
      // Sem armazenamento: a janela do assistente ainda consulta a API a cada 3 s.
    }
    try {
      this.fecharEstaJanela();
    } catch {
      // O navegador não deixou: a tela segue com "Pode fechar esta janela".
    }
  }
}
