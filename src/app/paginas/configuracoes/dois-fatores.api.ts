import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../nucleo/api/api';

/** `POST /auth/dois-fatores/ativar`. */
export interface AtivacaoDoisFatores {
  /** Chave em base32, para digitar no aplicativo. */
  readonly chave: string;
  /** QR code como data URL (PNG). */
  readonly qrCode: string;
  readonly urlOtpauth: string;
}

/** `GET /auth/dois-fatores`. */
export interface SituacaoDoisFatores {
  readonly ativo: boolean;
  readonly ativadoEm: string | null;
  /** Códigos de recuperação ainda não usados. */
  readonly codigosRestantes: number;
}

/** Verificação em duas etapas da própria conta (R2.11). */
@Injectable({ providedIn: 'root' })
export class DoisFatoresApi {
  private readonly http = inject(HttpClient);

  situacao(): Promise<SituacaoDoisFatores> {
    return firstValueFrom(this.http.get<SituacaoDoisFatores>(urlApi('auth', 'dois-fatores')));
  }

  ativar(): Promise<AtivacaoDoisFatores> {
    return firstValueFrom(
      this.http.post<AtivacaoDoisFatores>(urlApi('auth', 'dois-fatores', 'ativar'), {}),
    );
  }

  /** Confirma com um código e devolve os 10 códigos de recuperação (só desta vez). */
  async confirmar(codigo: string): Promise<readonly string[]> {
    const resposta = await firstValueFrom(
      this.http.post<{ readonly codigos: readonly string[] }>(
        urlApi('auth', 'dois-fatores', 'confirmar'),
        { codigo },
      ),
    );
    return resposta.codigos;
  }

  async novosCodigos(codigo: string): Promise<readonly string[]> {
    const resposta = await firstValueFrom(
      this.http.post<{ readonly codigos: readonly string[] }>(
        urlApi('auth', 'dois-fatores', 'codigos'),
        { codigo },
      ),
    );
    return resposta.codigos;
  }

  desativar(senha: string, codigo: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(urlApi('auth', 'dois-fatores', 'desativar'), { senha, codigo }),
    );
  }
}
