import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../api/api';
import type { AudioDeAviso, RespostaDeSugestao, TranscricaoCompleta } from './gravacao.tipos';

/**
 * Rotas da gravação das ligações (`crmbrl-api/src/ligacoes/gravacao`). **Todas as URLs ficam
 * aqui**: se a API mudar um nome, só este arquivo muda.
 */
export const ROTAS_GRAVACAO = {
  parte: (ligacaoId: string, sequencia: number) =>
    urlApi('ligacoes', ligacaoId, 'gravacao', 'partes', sequencia),
  finalizar: (ligacaoId: string) => urlApi('ligacoes', ligacaoId, 'gravacao', 'finalizar'),
  transcricao: (ligacaoId: string) => urlApi('ligacoes', ligacaoId, 'transcricao'),
  audio: (ligacaoId: string) => urlApi('ligacoes', ligacaoId, 'audio'),
  baixar: (ligacaoId: string) => urlApi('ligacoes', ligacaoId, 'audio', 'baixar'),
  reprocessar: (ligacaoId: string) => urlApi('ligacoes', ligacaoId, 'reprocessar'),
  sugestao: (ligacaoId: string, sugestaoId: string, acao: 'confirmar' | 'descartar') =>
    urlApi('ligacoes', ligacaoId, 'resumo', 'sugestoes', sugestaoId, acao),
  avisoDoCanal: (canalId: string) => urlApi('ligacoes', 'canais', canalId, 'aviso'),
  configuracaoDoCanal: (canalId: string) =>
    urlApi('whatsapp-oficial', 'canais', canalId, 'ligacoes'),
  arquivos: () => urlApi('arquivos'),
} as const;

/** Primeira sequência de parte aceita pela API. */
export const PRIMEIRA_SEQUENCIA = 0;

/** Corpo do "finalizar" (também usado pelo `sendBeacon`). */
export interface CorpoFinalizar {
  readonly totalPartes: number;
}

export function corpoFinalizar(totalPartes: number): CorpoFinalizar {
  return { totalPartes };
}

/** O que o gravador precisa para falar com a API (trocado nos testes). */
export interface EnvioDeGravacao {
  enviarParte(ligacaoId: string, sequencia: number, parte: Blob): Promise<void>;
  finalizar(ligacaoId: string, totalPartes: number): Promise<void>;
  /** Finalização na saída da página (`sendBeacon`); devolve se o navegador aceitou. */
  finalizarNaSaida(ligacaoId: string, totalPartes: number): boolean;
  /** Áudio de aviso do canal (nulo: não há). */
  audioDeAviso(canalId: string): Promise<ArrayBuffer | null>;
}

@Injectable({ providedIn: 'root' })
export class GravacaoApi implements EnvioDeGravacao {
  private readonly http = inject(HttpClient);

  enviarParte(ligacaoId: string, sequencia: number, parte: Blob): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(ROTAS_GRAVACAO.parte(ligacaoId, sequencia), parte, {
        headers: { 'Content-Type': parte.type || 'audio/webm' },
      }),
    );
  }

  finalizar(ligacaoId: string, totalPartes: number): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(ROTAS_GRAVACAO.finalizar(ligacaoId), corpoFinalizar(totalPartes)),
    );
  }

  finalizarNaSaida(ligacaoId: string, totalPartes: number): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false;
    }
    const corpo = new Blob([JSON.stringify(corpoFinalizar(totalPartes))], {
      type: 'application/json',
    });
    return navigator.sendBeacon(ROTAS_GRAVACAO.finalizar(ligacaoId), corpo);
  }

  async audioDeAviso(canalId: string): Promise<ArrayBuffer | null> {
    try {
      const dados = await firstValueFrom(
        this.http.get(ROTAS_GRAVACAO.avisoDoCanal(canalId), { responseType: 'arraybuffer' }),
      );
      return dados.byteLength > 0 ? dados : null;
    } catch {
      return null;
    }
  }

  /** `GET /ligacoes/:id/transcricao`: os trechos "Atendente"/"Cliente" com o tempo de cada um. */
  transcricao(ligacaoId: string): Promise<TranscricaoCompleta> {
    return firstValueFrom(
      this.http.get<TranscricaoCompleta>(ROTAS_GRAVACAO.transcricao(ligacaoId)),
    );
  }

  /** Manda a transcrição e o resumo (ou só o resumo) de novo para a fila. */
  async reprocessar(ligacaoId: string, etapa: 'completo' | 'resumo' = 'completo'): Promise<void> {
    await firstValueFrom(this.http.post<unknown>(ROTAS_GRAVACAO.reprocessar(ligacaoId), { etapa }));
  }

  /** Cria a atividade da sugestão (os campos são ajustes opcionais). */
  confirmarSugestao(
    ligacaoId: string,
    sugestaoId: string,
    ajustes: Record<string, unknown> = {},
  ): Promise<RespostaDeSugestao> {
    return firstValueFrom(
      this.http.post<RespostaDeSugestao>(
        ROTAS_GRAVACAO.sugestao(ligacaoId, sugestaoId, 'confirmar'),
        ajustes,
      ),
    );
  }

  descartarSugestao(ligacaoId: string, sugestaoId: string): Promise<RespostaDeSugestao> {
    return firstValueFrom(
      this.http.post<RespostaDeSugestao>(
        ROTAS_GRAVACAO.sugestao(ligacaoId, sugestaoId, 'descartar'),
        {},
      ),
    );
  }

  // ----- Áudio de aviso do canal (só Admin) ----------------------------------------------------

  /** Envia o arquivo (`POST /arquivos?contexto=LIGACAO`) e o liga ao canal. */
  async enviarAudioDeAviso(canalId: string, arquivo: File): Promise<AudioDeAviso> {
    const dados = new FormData();
    dados.append('arquivo', arquivo, arquivo.name);
    const enviado = await firstValueFrom(
      this.http.post<{ id: string; nome: string; tamanho: number }>(
        ROTAS_GRAVACAO.arquivos(),
        dados,
        {
          params: { contexto: 'LIGACAO' },
        },
      ),
    );
    await firstValueFrom(
      this.http.patch<unknown>(ROTAS_GRAVACAO.configuracaoDoCanal(canalId), {
        avisoArquivoId: enviado.id,
      }),
    );
    return { id: enviado.id, nome: enviado.nome, tamanhoBytes: enviado.tamanho };
  }

  async removerAudioDeAviso(canalId: string): Promise<void> {
    await firstValueFrom(
      this.http.patch<unknown>(ROTAS_GRAVACAO.configuracaoDoCanal(canalId), {
        avisoArquivoId: null,
      }),
    );
  }

  /** Baixa o áudio de aviso para a pessoa ouvir na tela de configuração. */
  async baixarAudioDeAviso(canalId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(ROTAS_GRAVACAO.avisoDoCanal(canalId), { responseType: 'blob' }),
    );
  }
}
