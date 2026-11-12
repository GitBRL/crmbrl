import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TimeoutError, timeout, type Subscription } from 'rxjs';

import { ehRespostaSaude, type RespostaSaude, type SituacaoSaude } from './saude';

export const URL_SAUDE = '/api/saude';
const LIMITE_MS = 8000;

/**
 * Saúde da API (`GET /api/saude`), com estado em signals. A primeira consulta sai quando o
 * serviço é injetado pela primeira vez; `recarregar()` consulta de novo (cancelando uma
 * consulta em andamento).
 */
@Injectable({ providedIn: 'root' })
export class SaudeService {
  private readonly http = inject(HttpClient);

  private readonly _dados = signal<RespostaSaude | null>(null);
  private readonly _carregando = signal(false);
  private readonly _erro = signal<string | null>(null);
  private readonly _atualizadoEm = signal<Date | null>(null);
  private assinatura: Subscription | null = null;

  /** Última resposta recebida (inclusive a de 503, com o banco em erro). */
  readonly dados = this._dados.asReadonly();
  /** `true` enquanto uma consulta está em andamento. */
  readonly carregando = this._carregando.asReadonly();
  /** Mensagem amigável, sem jargão, quando a API não respondeu; `null` se respondeu. */
  readonly erro = this._erro.asReadonly();
  /** Quando a última consulta terminou (com sucesso ou erro). */
  readonly atualizadoEm = this._atualizadoEm.asReadonly();

  readonly situacao = computed<SituacaoSaude>(() => {
    if (this._erro()) {
      return 'indisponivel';
    }
    const dados = this._dados();
    if (!dados) {
      return 'carregando';
    }
    return dados.status === 'ok' && dados.banco?.status !== 'erro' ? 'ok' : 'degradado';
  });

  constructor() {
    this.recarregar();
  }

  recarregar(): void {
    this.assinatura?.unsubscribe();
    this._carregando.set(true);
    this.assinatura = this.http
      .get<RespostaSaude>(URL_SAUDE)
      .pipe(timeout(LIMITE_MS))
      .subscribe({
        next: (resposta) => this.concluir(resposta, null),
        error: (falha: unknown) => {
          // 503 com o corpo da saúde = API no ar com o banco fora: é um resultado, não erro.
          if (falha instanceof HttpErrorResponse && ehRespostaSaude(falha.error)) {
            this.concluir(falha.error, null);
          } else {
            this.concluir(null, mensagemDeErro(falha));
          }
        },
      });
  }

  private concluir(resposta: RespostaSaude | null, erro: string | null): void {
    if (resposta) {
      this._dados.set(resposta);
    }
    this._erro.set(erro);
    this._carregando.set(false);
    this._atualizadoEm.set(new Date());
  }
}

export const MENSAGENS_SAUDE = {
  semResposta: 'O servidor do CRM não respondeu.',
  demorou: 'O servidor demorou demais para responder.',
  comErro: 'O servidor do CRM respondeu com erro.',
} as const;

/**
 * Mensagem para a tela, sem jargão (quem lê pode ser do Comercial, não da TI). O detalhe
 * técnico (status HTTP, rota, mensagem original) vai para o console, para quem investiga.
 */
function mensagemDeErro(falha: unknown): string {
  if (falha instanceof TimeoutError) {
    console.warn(`[saúde] ${URL_SAUDE} sem resposta em ${LIMITE_MS / 1000} s.`);
    return MENSAGENS_SAUDE.demorou;
  }
  if (falha instanceof HttpErrorResponse) {
    console.warn(`[saúde] ${URL_SAUDE} falhou: HTTP ${falha.status}. ${falha.message}`);
    if (
      falha.status === 0 ||
      falha.status === 502 ||
      falha.status === 503 ||
      falha.status === 504
    ) {
      return MENSAGENS_SAUDE.semResposta;
    }
    return MENSAGENS_SAUDE.comErro;
  }
  console.warn(`[saúde] ${URL_SAUDE} falhou:`, falha);
  return MENSAGENS_SAUDE.semResposta;
}
