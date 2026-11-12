import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import {
  computed,
  DOCUMENT,
  inject,
  Injectable,
  Injector,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { erroDaApi } from '../api/erro-api';
import { urlApi } from '../api/api';
import { moduloBasePorId, moduloBasePorRota, MODULOS_BASE, type ModuloBase } from '../modulos';
import { PushService } from '../pwa/push.service';
import { ehDiretoria, ehLider, rotuloDe, type Papel } from '../papeis';
import type { ConsultaToken, Perfil, Permissoes, UsuarioDoPerfil } from './perfil';

/**
 * Requisição que trata o 401/403 por conta própria: o interceptor não leva para `/entrar`
 * nem para `/trocar-senha` (login, `auth/eu`, `auth/sair`).
 */
export const SEM_REDIRECIONAR = new HttpContextToken<boolean>(() => false);

/**
 * Carregamento completo de uma URL (sair recarrega a página: nada do usuário anterior fica na
 * memória). Nos testes, troque por um `vi.fn()`.
 */
export const RECARREGAR_EM = new InjectionToken<(url: string) => void>('RECARREGAR_EM', {
  providedIn: 'root',
  factory: () => {
    const janela = inject(DOCUMENT).defaultView;
    return (url: string) => janela?.location.assign(url);
  },
});

/**
 * - `desconhecida`: ainda não perguntou à API;
 * - `carregando`: `GET /auth/eu` em andamento;
 * - `ativa`: há sessão (o `perfil` está preenchido);
 * - `ausente`: sem sessão (401);
 * - `erro`: a API não respondeu; não dá para saber.
 */
export type EstadoSessao = 'desconhecida' | 'carregando' | 'ativa' | 'ausente' | 'erro';

/** Rotas de acesso que não servem como "voltar para" depois do login. */
const ROTAS_DE_ACESSO = [
  '/entrar',
  '/trocar-senha',
  '/esqueci-senha',
  '/redefinir-senha',
  '/definir-senha',
  '/retorno-login',
];

/**
 * Sessão do usuário (convenções §2 do contrato do front): o perfil vem de
 * `GET /api/v1/auth/eu` e fica num signal; o cookie `crmbrl_sessao` é HttpOnly e o front
 * nunca o lê. Tudo o que a tela precisa saber sobre quem está logado sai daqui.
 *
 * ```ts
 * protected readonly sessao = inject(SessaoService);
 * // template: {{ sessao.usuario()?.nome }} · @if (sessao.permissoes()?.gerenciarUsuarios) {…}
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SessaoService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly injetor = inject(Injector);
  private readonly recarregarEm = inject(RECARREGAR_EM);

  private readonly _perfil = signal<Perfil | null>(null);
  private readonly _estado = signal<EstadoSessao>('desconhecida');
  private carregamento: Promise<Perfil | null> | null = null;

  /** Perfil atual; `null` sem sessão (ou antes de carregar). */
  readonly perfil = this._perfil.asReadonly();
  readonly estado = this._estado.asReadonly();
  readonly autenticado = computed(() => this._perfil() !== null);
  readonly usuario: Signal<UsuarioDoPerfil | null> = computed(
    () => this._perfil()?.usuario ?? null,
  );
  readonly papel: Signal<Papel | null> = computed(() => this.usuario()?.papel ?? null);
  /** "Líder Comercial" (vazio sem sessão). */
  readonly rotuloPapel = computed(() => {
    const usuario = this.usuario();
    return usuario ? rotuloDe(usuario) : '';
  });
  readonly permissoes: Signal<Permissoes | null> = computed(
    () => this._perfil()?.permissoes ?? null,
  );
  /** Troca de senha obrigatória pendente (R2.7). */
  readonly deveTrocarSenha = computed(() => this._perfil()?.deveTrocarSenha ?? false);
  readonly ehAdmin = computed(() => this.papel() === 'ADMIN');
  /** Admin ou C-level. */
  readonly ehDiretoria = computed(() => ehDiretoria(this.usuario()));
  /** Líder de um setor. */
  readonly ehLider = computed(() => ehLider(this.usuario()));
  /** Chave do setor da pessoa (`null` para Admin e C-level). */
  readonly area = computed(() => this.usuario()?.area ?? null);
  /** Nome do setor da pessoa. */
  readonly nomeSetor = computed(() => this.usuario()?.nomeSetor ?? null);
  /**
   * Módulos que o usuário enxerga, na ordem do menu (vazio sem sessão). Sem ícones: para
   * desenhar, use `MODULOS` de `nucleo/navegacao.ts` com `sessao.pode(modulo)`.
   */
  readonly modulosVisiveis = computed(() =>
    MODULOS_BASE.filter((modulo) => this.podeModulo(modulo)),
  );

  /**
   * Pergunta à API quem está logado (`GET /auth/eu`). Chamadas simultâneas compartilham a
   * mesma requisição; depois da primeira resposta, devolve o que já sabe (use `forcar` para
   * perguntar de novo). Sem sessão → `null`. Se a API não responder, rejeita com `ErroApi`.
   */
  carregar(forcar = false): Promise<Perfil | null> {
    if (this.carregamento) {
      return this.carregamento;
    }
    const estado = this._estado();
    if (!forcar && (estado === 'ativa' || estado === 'ausente')) {
      return Promise.resolve(this._perfil());
    }
    this._estado.set('carregando');
    this.carregamento = firstValueFrom(
      this.http.get<Perfil>(urlApi('auth', 'eu'), { context: semRedirecionar() }),
    )
      .then((perfil) => this.definirPerfil(perfil))
      .catch((falha: unknown) => {
        const erro = erroDaApi(falha);
        if (erro.ehSemSessao) {
          this.limpar();
          return null;
        }
        this._estado.set(this._perfil() ? 'ativa' : 'erro');
        throw erro;
      })
      .finally(() => {
        this.carregamento = null;
      });
    return this.carregamento;
  }

  /**
   * `POST /auth/entrar`. Devolve o perfil (e passa a valer como sessão atual). Erros: 401
   * credenciais (mensagem genérica, R2.3), 403 conta desativada, 429 bloqueio (R2.5) — todos
   * como `ErroApi`, com a `mensagem` pronta.
   */
  async entrar(email: string, senha: string): Promise<Perfil> {
    try {
      const perfil = await firstValueFrom(
        this.http.post<Perfil>(
          urlApi('auth', 'entrar'),
          { email: email.trim(), senha },
          { context: semRedirecionar() },
        ),
      );
      return this.definirPerfil(perfil);
    } catch (falha) {
      throw erroDaApi(falha);
    }
  }

  /**
   * Encerra a sessão (`POST /auth/sair`) e recarrega em `/entrar`: o carregamento completo
   * descarta tudo o que estava na memória do usuário anterior. Sessão já vencida também sai.
   */
  async sair(): Promise<void> {
    try {
      // Remove a inscrição de push deste aparelho enquanto a sessão ainda vale (R26.1): quem
      // usar o aparelho depois não recebe as notificações de quem saiu.
      await this.injetor.get(PushService).desativar();
    } catch {
      // Sem push neste aparelho (ou API fora): sai do mesmo jeito.
    }
    try {
      await firstValueFrom(
        this.http.post<void>(urlApi('auth', 'sair'), null, { context: semRedirecionar() }),
      );
    } catch {
      // Sessão já encerrada (401) ou API fora: sai do mesmo jeito.
    }
    this.limpar();
    this.recarregarEm('/entrar');
  }

  /**
   * Troca a própria senha (`POST /auth/senha`), inclusive a obrigatória do primeiro acesso.
   * A API encerra as outras sessões e devolve o perfil, já sem `deveTrocarSenha`.
   * 400 com `campos` (`senhaAtual` incorreta, `novaSenha` inválida); 429 tentativas.
   */
  async trocarSenha(senhaAtual: string, novaSenha: string): Promise<Perfil> {
    try {
      const perfil = await firstValueFrom(
        this.http.post<Perfil>(urlApi('auth', 'senha'), { senhaAtual, novaSenha }),
      );
      return this.definirPerfil(perfil);
    } catch (falha) {
      throw erroDaApi(falha);
    }
  }

  /**
   * Pede o link de redefinição (`POST /auth/senha/esqueci`). A resposta é a mesma exista o
   * e-mail ou não (devolve a mensagem da API). 422 `R2.8` quando o envio de e-mail não está
   * configurado.
   */
  async pedirRedefinicao(email: string): Promise<string> {
    try {
      const resposta = await firstValueFrom(
        this.http.post<{ mensagem: string }>(urlApi('auth', 'senha', 'esqueci'), {
          email: email.trim(),
        }),
      );
      return resposta.mensagem;
    } catch (falha) {
      throw erroDaApi(falha);
    }
  }

  /** O link do convite ou da redefinição ainda vale? (`POST /auth/senha/token`). */
  async consultarToken(token: string): Promise<ConsultaToken> {
    try {
      return await firstValueFrom(
        this.http.post<ConsultaToken>(urlApi('auth', 'senha', 'token'), { token }),
      );
    } catch (falha) {
      throw erroDaApi(falha);
    }
  }

  /**
   * Define a senha pelo link (convite em `/definir-senha` ou redefinição em
   * `/redefinir-senha`): `POST /auth/senha/redefinir`. O token é de uso único (24 h) e a API
   * encerra todas as sessões do usuário; depois, a pessoa entra com a senha nova.
   */
  async definirSenhaComToken(token: string, novaSenha: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(urlApi('auth', 'senha', 'redefinir'), { token, novaSenha }),
      );
      this.limpar();
    } catch (falha) {
      throw erroDaApi(falha);
    }
  }

  /**
   * O usuário acessa o módulo? Aceita o módulo, o id ("funil-comercial") ou uma rota
   * ("/funis/cs/123"). Confere o papel e as permissões reais. Sem sessão ou módulo
   * desconhecido → `false`. Lê signals: é reativo em templates e `computed`.
   */
  pode(modulo: ModuloBase | string): boolean {
    const alvo =
      typeof modulo === 'string' ? (moduloBasePorId(modulo) ?? moduloBasePorRota(modulo)) : modulo;
    return alvo ? this.podeModulo(alvo) : false;
  }

  /**
   * Confere uma permissão do perfil: `sessao.permite((p) => p.gerenciarUsuarios)` ou
   * `sessao.permite((p) => p.configurarRodizio !== 'NENHUM')`. Sem sessão → `false`.
   */
  permite(teste: (permissoes: Permissoes, perfil: Perfil) => boolean): boolean {
    const perfil = this._perfil();
    return perfil ? teste(perfil.permissoes, perfil) : false;
  }

  /** O papel atual é um destes? */
  temPapel(...papeis: readonly Papel[]): boolean {
    const papel = this.papel();
    return papel !== null && papeis.includes(papel);
  }

  /**
   * Para onde ir depois de entrar: `/trocar-senha` com a troca pendente; senão, a rota que o
   * usuário tentou abrir (`voltar`, só caminhos internos) ou `/inicio`.
   */
  rotaAposEntrar(voltar?: string | null): UrlTree {
    const destino = voltarSeguro(voltar);
    if (this.deveTrocarSenha()) {
      return this.router.createUrlTree(['/trocar-senha'], {
        queryParams: destino === '/inicio' ? {} : { voltar: destino },
      });
    }
    return this.router.parseUrl(destino);
  }

  /** Substitui o perfil atual (respostas que devolvem `Perfil`). */
  definirPerfil(perfil: Perfil): Perfil {
    this._perfil.set(perfil);
    this._estado.set('ativa');
    return perfil;
  }

  /**
   * A sessão acabou do lado da API (401 no meio do uso): esquece o perfil. Quem chama decide
   * para onde ir (o interceptor leva para `/entrar` guardando a rota).
   */
  encerrarLocalmente(): void {
    this.limpar();
  }

  private limpar(): void {
    this._perfil.set(null);
    this._estado.set('ausente');
  }

  private podeModulo(modulo: ModuloBase): boolean {
    const perfil = this._perfil();
    if (!perfil || !modulo.papeis.includes(perfil.usuario.papel)) {
      return false;
    }
    return modulo.acesso ? modulo.acesso(perfil.permissoes, perfil.usuario) : true;
  }
}

function semRedirecionar(): HttpContext {
  return new HttpContext().set(SEM_REDIRECIONAR, true);
}

/**
 * Só caminhos internos ("/funis/cs?x=1"): nada de "//outro-site" nem URL absoluta (redirect
 * aberto), e as próprias telas de acesso viram `/inicio`.
 */
export function voltarSeguro(voltar: string | null | undefined): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.includes('\\')) {
    return '/inicio';
  }
  const caminho = voltar.split(/[?#]/)[0];
  if (caminho === '/' || ROTAS_DE_ACESSO.some((rota) => caminho === rota)) {
    return '/inicio';
  }
  return voltar;
}
