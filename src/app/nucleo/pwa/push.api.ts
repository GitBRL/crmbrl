import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../api/api';

/** Tipos de aviso por push (API: /push/preferencias). */
export const TIPOS_PUSH = [
  'conversa_atribuida',
  'mencao',
  'atividade_vencendo',
  'sla_estourado',
  'negocio_atribuido',
  'parcela_atrasada',
  'ligacao_recebida',
] as const;
export type TipoPush = (typeof TIPOS_PUSH)[number];
export type PreferenciasPush = Readonly<Record<TipoPush, boolean>>;

export interface InscricaoPush {
  readonly id: string;
  readonly endpoint: string;
  readonly aparelho?: string | null;
  readonly criadaEm?: string;
}

export interface CorpoInscricao {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
  readonly aparelho: string;
}

/** Rotas de push da API (`/api/v1/push/*`). */
@Injectable({ providedIn: 'root' })
export class PushApi {
  private readonly http = inject(HttpClient);

  async chavePublica(): Promise<string> {
    const r = await firstValueFrom(
      this.http.get<{ chavePublica: string }>(urlApi('push', 'chave-publica')),
    );
    return r.chavePublica;
  }

  inscrever(corpo: CorpoInscricao): Promise<{ id: string }> {
    return firstValueFrom(this.http.post<{ id: string }>(urlApi('push', 'inscricoes'), corpo));
  }

  async minhasInscricoes(): Promise<readonly InscricaoPush[]> {
    const r = await firstValueFrom(
      this.http.get<readonly InscricaoPush[] | { itens: readonly InscricaoPush[] }>(
        urlApi('push', 'inscricoes'),
      ),
    );
    return Array.isArray(r) ? r : ((r as { itens: readonly InscricaoPush[] }).itens ?? []);
  }

  async remover(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(urlApi('push', 'inscricoes', id)));
  }

  preferencias(): Promise<{ tipos: PreferenciasPush }> {
    return firstValueFrom(
      this.http.get<{ tipos: PreferenciasPush }>(urlApi('push', 'preferencias')),
    );
  }

  salvarPreferencias(tipos: PreferenciasPush): Promise<{ tipos: PreferenciasPush }> {
    return firstValueFrom(
      this.http.put<{ tipos: PreferenciasPush }>(urlApi('push', 'preferencias'), { tipos }),
    );
  }

  testar(): Promise<unknown> {
    return firstValueFrom(this.http.post(urlApi('push', 'teste'), {}));
  }
}
