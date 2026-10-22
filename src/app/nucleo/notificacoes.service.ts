import { HttpClient } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from './api/api';
import { erroDaApi } from './api/erro-api';
import { SessaoService } from './sessao/sessao.service';

/** Notificação interna (R10.2): crmbrl-api, notificacoes/notificacoes.dto.ts. */
export interface Notificacao {
  readonly id: string;
  /** `negocio.atribuido`, `atividade.atrasada`… (ver `TipoNotificacao`). */
  readonly tipo: string;
  readonly titulo: string;
  readonly texto: string | null;
  /** Rota do front; use `rotaDaNotificacao()` para abrir. */
  readonly link: string | null;
  readonly dados: unknown;
  readonly lidaEm: string | null;
  readonly criadoEm: string;
}

export interface PaginaNotificacoes extends Pagina<Notificacao> {
  /** Não lidas no total (não só desta página). */
  readonly naoLidas: number;
}

/** Tipos da Fase 1 (crmbrl-api, notificacoes/tipos-notificacao.ts). */
export type TipoNotificacao =
  | 'negocio.atribuido'
  | 'contato.atribuido'
  | 'empresa.atribuida'
  | 'passagem.recebida'
  | 'desligamento.itens_recebidos'
  | 'atividade.vencendo'
  | 'atividade.atrasada'
  | 'webhook_saida.falhou'
  | 'webhook_saida.desativado'
  | 'equipe.sem_lider';

/** Intervalo da atualização (o tempo real chega na Fase 2). */
export const INTERVALO_NOTIFICACOES_MS = 30_000;
/** Quantas notificações o painel mostra. */
export const NOTIFICACOES_POR_PAGINA = 20;

/**
 * Links que a API grava apontando para telas com outro endereço no front: a gestão de
 * usuários fica em Configurações. Links externos não são seguidos.
 */
export function rotaDaNotificacao(link: string | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) {
    return null;
  }
  if (link === '/administracao/usuarios' || link.startsWith('/administracao/usuarios?')) {
    return link.replace('/administracao/usuarios', '/configuracoes/usuarios');
  }
  return link;
}

/** Não lidas primeiro; dentro de cada grupo, as mais novas primeiro. */
export function ordenarNotificacoes(itens: readonly Notificacao[]): readonly Notificacao[] {
  return [...itens].sort((a, b) => {
    const lidaA = a.lidaEm ? 1 : 0;
    const lidaB = b.lidaEm ? 1 : 0;
    return lidaA - lidaB || Date.parse(b.criadoEm) - Date.parse(a.criadoEm);
  });
}

/**
 * Notificações do usuário logado, para o sino da barra superior. Começa sozinho quando há
 * sessão (sem troca de senha pendente), atualiza a cada 30 s e quando a aba volta a ficar
 * visível, e para quando a sessão acaba. Com a aba escondida, não consulta.
 */
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly http = inject(HttpClient);
  private readonly sessao = inject(SessaoService);
  private readonly documento = inject(DOCUMENT);

  private readonly _itens = signal<readonly Notificacao[]>([]);
  private readonly _naoLidas = signal(0);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<string | null>(null);
  private readonly _atualizadoEm = signal<Date | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private ativo = false;
  /** Cada consulta ganha um número; resposta de consulta velha é descartada. */
  private consulta = 0;

  /** Não lidas primeiro, depois as mais novas. */
  readonly itens = computed(() => ordenarNotificacoes(this._itens()));
  readonly naoLidas = this._naoLidas.asReadonly();
  /** `true` na primeira carga (as atualizações seguintes não piscam a lista). */
  readonly carregando = this._carregando.asReadonly();
  /** Mensagem quando a última consulta falhou; `null` se deu certo. */
  readonly erro = this._erro.asReadonly();
  readonly atualizadoEm = this._atualizadoEm.asReadonly();

  constructor() {
    effect(() => {
      const ligar = this.sessao.autenticado() && !this.sessao.deveTrocarSenha();
      untracked(() => (ligar ? this.iniciar() : this.parar()));
    });

    const aoMudarVisibilidade = () => {
      if (!this.ativo) {
        return;
      }
      if (this.documento.visibilityState === 'hidden') {
        clearTimeout(this.temporizador);
      } else {
        void this.atualizar();
      }
    };
    this.documento.addEventListener('visibilitychange', aoMudarVisibilidade);
    inject(DestroyRef).onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', aoMudarVisibilidade);
      this.parar();
    });
  }

  /** Consulta agora (e reagenda a próxima). Falha vira `erro()`, sem lançar. */
  async atualizar(): Promise<void> {
    if (!this.ativo) {
      return;
    }
    clearTimeout(this.temporizador);
    const numero = ++this.consulta;
    if (!this._atualizadoEm()) {
      this._carregando.set(true);
    }
    try {
      const pagina = await firstValueFrom(
        this.http.get<PaginaNotificacoes>(urlApi('notificacoes'), {
          params: parametros({ pagina: 1, porPagina: NOTIFICACOES_POR_PAGINA }),
        }),
      );
      if (numero !== this.consulta || !this.ativo) {
        return;
      }
      this._itens.set(pagina.itens);
      this._naoLidas.set(pagina.naoLidas);
      this._erro.set(null);
      this._atualizadoEm.set(new Date());
    } catch (falha) {
      if (numero === this.consulta && this.ativo) {
        this._erro.set(erroDaApi(falha).mensagem);
      }
    } finally {
      this._carregando.set(false);
      this.agendar();
    }
  }

  /** Marca uma como lida (otimista: volta atrás e lança `ErroApi` se a API recusar). */
  async marcarComoLida(id: string): Promise<void> {
    const alvo = this._itens().find((item) => item.id === id);
    if (!alvo || alvo.lidaEm) {
      return;
    }
    const antes = { itens: this._itens(), naoLidas: this._naoLidas() };
    const agora = new Date().toISOString();
    this.consulta++; // uma consulta em andamento não desfaz a marcação
    this._itens.update((itens) =>
      itens.map((item) => (item.id === id ? { ...item, lidaEm: agora } : item)),
    );
    this._naoLidas.update((total) => Math.max(0, total - 1));
    try {
      const atualizada = await firstValueFrom(
        this.http.post<Notificacao>(urlApi('notificacoes', id, 'marcar-lida'), null),
      );
      this._itens.update((itens) => itens.map((item) => (item.id === id ? atualizada : item)));
    } catch (falha) {
      this._itens.set(antes.itens);
      this._naoLidas.set(antes.naoLidas);
      throw erroDaApi(falha);
    }
  }

  /** Marca todas como lidas (otimista, como acima). Devolve quantas a API marcou. */
  async marcarTodasComoLidas(): Promise<number> {
    const antes = { itens: this._itens(), naoLidas: this._naoLidas() };
    const agora = new Date().toISOString();
    this.consulta++;
    this._itens.update((itens) =>
      itens.map((item) => (item.lidaEm ? item : { ...item, lidaEm: agora })),
    );
    this._naoLidas.set(0);
    try {
      const { marcadas } = await firstValueFrom(
        this.http.post<{ marcadas: number }>(urlApi('notificacoes', 'marcar-todas-lidas'), null),
      );
      return marcadas;
    } catch (falha) {
      this._itens.set(antes.itens);
      this._naoLidas.set(antes.naoLidas);
      throw erroDaApi(falha);
    }
  }

  private iniciar(): void {
    if (this.ativo) {
      return;
    }
    this.ativo = true;
    void this.atualizar();
  }

  private parar(): void {
    this.ativo = false;
    this.consulta++;
    clearTimeout(this.temporizador);
    this._itens.set([]);
    this._naoLidas.set(0);
    this._erro.set(null);
    this._carregando.set(false);
    this._atualizadoEm.set(null);
  }

  private agendar(): void {
    clearTimeout(this.temporizador);
    if (!this.ativo || this.documento.visibilityState === 'hidden') {
      return;
    }
    this.temporizador = setTimeout(() => void this.atualizar(), INTERVALO_NOTIFICACOES_MS);
  }
}
