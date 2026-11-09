import { inject, Injectable, InjectionToken, signal } from '@angular/core';

import { type ContextoDoLogin, guardarContextoDoLogin } from '../facebook.tipos';
import {
  lerRetornoDoLogin,
  type LoginIniciado,
  type ModoDeLogin,
  type RetornoDoLogin,
  type ServicoDeLogin,
  type SituacaoDaConexao,
} from './login.tipos';

/** Leva o navegador a outra página. Um token para os testes trocarem por um espião. */
export const IR_PARA_ENDERECO = new InjectionToken<(endereco: string) => void>('IR_PARA_ENDERECO', {
  providedIn: 'root',
  factory: () => (endereco) => globalThis.location.assign(endereco),
});

/** Abre uma janela (`window.open`). Um token para os testes trocarem por um espião. */
export const ABRIR_JANELA = new InjectionToken<
  (endereco: string, nome: string, recursos: string) => Window | null
>('ABRIR_JANELA', {
  providedIn: 'root',
  factory: () => (endereco, nome, recursos) => globalThis.open(endereco, nome, recursos),
});

/** Canal por onde a página de retorno avisa a janela do assistente. */
export const CANAL_DO_LOGIN = 'crmbrl-login';
/** Reserva do canal: a página de retorno grava aqui e o evento `storage` chega às outras abas. */
export const CHAVE_DO_RETORNO = 'crmbrl.login.retorno';

/** Erros do `state` do login: a página de retorno não sabe de qual conexão eram. */
const MOTIVOS_SEM_CONEXAO: ReadonlySet<string> = new Set([
  'state_invalido',
  'state_vencido',
  'state_usado',
]);

const NOME_DA_JANELA = 'crmbrl-login';
const RECURSOS_DA_JANELA = 'popup,width=600,height=720';
/** A consulta da situação, enquanto a janela está aberta. */
export const INTERVALO_DA_CONSULTA_MS = 3000;
/** A validade do `state` do login (R32.23). */
export const LIMITE_DA_ESPERA_MS = 10 * 60 * 1000;

/** O que o assistente pede ao serviço para fazer o login de um serviço. */
export interface PedidoDeJanela {
  readonly app: ServicoDeLogin;
  /** Chama o `…/oauth/iniciar` com o modo escolhido pelo serviço. */
  readonly iniciar: (modo: ModoDeLogin) => Promise<LoginIniciado>;
  /** Lê a situação da conexão na API (a reserva da mensagem da janela). */
  readonly situacao: (conexaoId: string) => Promise<SituacaoDaConexao>;
  /** Reconexão: como a conexão estava antes, para reconhecer que o login novo terminou. */
  readonly antes?: { readonly conectadaEm: string | null; readonly precisaAtencao: boolean } | null;
  /** O que o assistente guarda se o login cair na mesma aba (pop-up bloqueado). */
  readonly contexto: ContextoDoLogin;
}

export type ResultadoDaJanela =
  | { readonly tipo: 'concluido'; readonly retorno: RetornoDoLogin }
  /** O usuário clicou em "Cancelar" na espera (ou começou outro login). */
  | { readonly tipo: 'desistiu' }
  | { readonly tipo: 'expirou' }
  /** O pop-up foi bloqueado: o navegador foi levado ao diálogo, na mesma aba. */
  | { readonly tipo: 'pagina' };

/** A espera que a tela mostra ("Aguardando o login na outra janela…"). */
export interface EsperaDoLogin {
  readonly app: ServicoDeLogin;
  readonly conexaoId: string;
  /** "Abrir de novo" não conseguiu abrir a janela (pop-up bloqueado). */
  readonly bloqueada: boolean;
}

function enderecoValido(endereco: string): boolean {
  return /^https?:\/\//i.test(endereco);
}

/**
 * Login em outra janela (R32.23), um serviço só para o Facebook, o Typeform e o RD Station.
 *
 * - O clique abre a janela **na hora** (`window.open('')`, para o bloqueador de pop-ups deixar) e só
 *   depois da resposta do `…/oauth/iniciar` ela navega ao diálogo. Se o início falha, a janela fecha.
 *   Se o navegador bloqueia o pop-up, o login segue na mesma aba (o assistente reabre no passo).
 * - A janela termina na página `/retorno-login`, que avisa por `BroadcastChannel` (reserva:
 *   `localStorage` + evento `storage`). Só vale a mensagem da conexão que este login iniciou (ou um erro de `state`, sem conexão).
 * - Reserva: consulta a situação da conexão a cada 3 s (no máximo 10 min) e ao recuperar o foco.
 * - Não usa `window.opener` nem trata `popup.closed` como cancelamento: o Facebook usa
 *   Cross-Origin-Opener-Policy, que corta o `opener` e faz `closed` ficar verdadeiro antes da hora.
 */
@Injectable({ providedIn: 'root' })
export class LoginJanela {
  private readonly irPara = inject(IR_PARA_ENDERECO);
  private readonly abrir = inject(ABRIR_JANELA);

  private readonly _espera = signal<EsperaDoLogin | null>(null);
  /** Há um login em andamento numa janela? */
  readonly espera = this._espera.asReadonly();

  private ativa: {
    readonly encerrar: (resultado: ResultadoDaJanela) => void;
    readonly reabrir: () => boolean;
  } | null = null;

  /**
   * Faz o login. **Chame direto do clique**, antes de qualquer `await`: a janela só abre sem ser
   * barrada se ainda estiver dentro do gesto do usuário.
   */
  async entrar(pedido: PedidoDeJanela): Promise<ResultadoDaJanela> {
    this.ativa?.encerrar({ tipo: 'desistiu' });
    const janela = this.abrir('', NOME_DA_JANELA, RECURSOS_DA_JANELA);
    if (!janela) {
      return this.entrarNaMesmaAba(pedido);
    }
    this.escrever(janela, 'Abrindo o login…');
    let login: LoginIniciado;
    try {
      login = await pedido.iniciar('janela');
      if (!enderecoValido(login.urlDialogo)) {
        throw new Error('O endereço do login não é válido.');
      }
      janela.location.href = login.urlDialogo;
    } catch (falha) {
      this.fechar(janela);
      throw falha;
    }
    return this.esperar(pedido, login, janela);
  }

  /** "Abrir de novo": traz a janela do login de volta (ou cria outra, se foi fechada). */
  abrirDeNovo(): void {
    if (this.ativa && !this.ativa.reabrir()) {
      this._espera.update((espera) => (espera ? { ...espera, bloqueada: true } : espera));
    }
  }

  /** "Cancelar": para de esperar. Nada é desfeito na API (a conexão pendente expira sozinha). */
  cancelar(): void {
    this.ativa?.encerrar({ tipo: 'desistiu' });
  }

  private async entrarNaMesmaAba(pedido: PedidoDeJanela): Promise<ResultadoDaJanela> {
    const login = await pedido.iniciar('pagina');
    if (!enderecoValido(login.urlDialogo)) {
      throw new Error('O endereço do login não é válido.');
    }
    guardarContextoDoLogin(pedido.contexto);
    this.irPara(login.urlDialogo);
    return { tipo: 'pagina' };
  }

  private esperar(
    pedido: PedidoDeJanela,
    login: LoginIniciado,
    primeira: Window,
  ): Promise<ResultadoDaJanela> {
    const { conexaoId, urlDialogo } = login;
    return new Promise<ResultadoDaJanela>((resolver) => {
      let janela: Window | null = primeira;
      let consultando = false;
      let terminou = false;

      const canal =
        typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL_DO_LOGIN) : null;

      const aoReceber = (dado: unknown): void => {
        if (!dado || typeof dado !== 'object') {
          return;
        }
        const retorno = lerRetornoDoLogin(dado as Record<string, unknown>);
        if (!retorno || retorno.app !== pedido.app) {
          return;
        }
        // Vale o retorno da conexão que este login iniciou. Um erro de `state` não traz conexão
        // (o `state` nem foi reconhecido), mas o canal e o `localStorage` são desta origem: só
        // pode ter vindo deste navegador, então encerra a espera com a mensagem de erro.
        if (
          retorno.conexaoId === conexaoId ||
          (retorno.conexaoId === null &&
            retorno.resultado === 'erro' &&
            MOTIVOS_SEM_CONEXAO.has(retorno.motivo ?? ''))
        ) {
          encerrar({ tipo: 'concluido', retorno });
        }
      };
      const aoMensagem = (evento: MessageEvent): void => aoReceber(evento.data);
      const aoArmazenar = (evento: StorageEvent): void => {
        if (evento.key !== CHAVE_DO_RETORNO || !evento.newValue) {
          return;
        }
        try {
          aoReceber(JSON.parse(evento.newValue));
        } catch {
          // Valor ilegível: ignora.
        }
      };

      const consultar = async (): Promise<void> => {
        if (consultando || terminou) {
          return;
        }
        consultando = true;
        try {
          const situacao = await pedido.situacao(conexaoId);
          const antes = pedido.antes;
          const novo =
            !antes ||
            situacao.conectadaEm !== antes.conectadaEm ||
            (antes.precisaAtencao && !situacao.precisaAtencao);
          if (situacao.conectada && novo) {
            encerrar({
              tipo: 'concluido',
              retorno: {
                app: pedido.app,
                resultado: 'conectado',
                conexaoId,
                motivo: null,
                mensagem: null,
              },
            });
          }
        } catch {
          // A reserva só tenta de novo na próxima volta.
        } finally {
          consultando = false;
        }
      };
      const aoVoltarOFoco = (): void => {
        if (globalThis.document?.visibilityState !== 'hidden') {
          void consultar();
        }
      };

      const intervalo = setInterval(() => void consultar(), INTERVALO_DA_CONSULTA_MS);
      const prazo = setTimeout(() => encerrar({ tipo: 'expirou' }), LIMITE_DA_ESPERA_MS);
      canal?.addEventListener('message', aoMensagem);
      globalThis.addEventListener('storage', aoArmazenar);
      globalThis.addEventListener('focus', aoVoltarOFoco);
      globalThis.document?.addEventListener('visibilitychange', aoVoltarOFoco);

      const encerrar = (resultado: ResultadoDaJanela): void => {
        if (terminou) {
          return;
        }
        terminou = true;
        clearInterval(intervalo);
        clearTimeout(prazo);
        canal?.removeEventListener('message', aoMensagem);
        canal?.close();
        globalThis.removeEventListener('storage', aoArmazenar);
        globalThis.removeEventListener('focus', aoVoltarOFoco);
        globalThis.document?.removeEventListener('visibilitychange', aoVoltarOFoco);
        if (this.ativa?.encerrar === encerrar) {
          this.ativa = null;
          this._espera.set(null);
        }
        this.fechar(janela);
        resolver(resultado);
      };

      const reabrir = (): boolean => {
        const aberta = this.abrir(urlDialogo, NOME_DA_JANELA, RECURSOS_DA_JANELA);
        if (!aberta) {
          return false;
        }
        janela = aberta;
        this._espera.update((espera) => (espera ? { ...espera, bloqueada: false } : espera));
        return true;
      };

      this.ativa = { encerrar, reabrir };
      this._espera.set({ app: pedido.app, conexaoId, bloqueada: false });
    });
  }

  private escrever(janela: Window, texto: string): void {
    try {
      janela.document.title = 'BRL CRM';
      janela.document.body.textContent = texto;
    } catch {
      // Janela de outra origem ou já navegando: sem o texto, e tudo bem.
    }
  }

  private fechar(janela: Window | null): void {
    try {
      janela?.close();
    } catch {
      // Sem o `opener` (COOP) o navegador pode recusar: a página de retorno tenta se fechar.
    }
  }
}
