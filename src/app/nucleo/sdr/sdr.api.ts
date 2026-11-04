import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map, type Observable } from 'rxjs';

import { urlApi } from '../api/api';
import type { EstadoDoSdr, QualificacaoDoSdr, RespostaQualificacao } from './sdr.tipos';

/**
 * O SDR com IA nas conversas, nos contatos e nos negócios (`SdrConversasController`, R31).
 * Leituras devolvem `Observable`; ações, `Promise`. Falhas chegam como `ErroApi` (interceptor).
 */
@Injectable({ providedIn: 'root' })
export class SdrAtendimentoApi {
  private readonly http = inject(HttpClient);

  estado(conversaId: string): Observable<EstadoDoSdr> {
    return this.http.get<EstadoDoSdr>(urlApi('sdr', 'conversas', conversaId));
  }

  /** "Assumir": a pessoa fica com a conversa e a IA para. */
  assumir(conversaId: string): Promise<EstadoDoSdr> {
    return firstValueFrom(
      this.http.post<EstadoDoSdr>(urlApi('sdr', 'conversas', conversaId, 'assumir'), {}),
    );
  }

  /** "Devolver para a IA": a IA retoma a conversa. */
  devolver(conversaId: string): Promise<EstadoDoSdr> {
    return firstValueFrom(
      this.http.post<EstadoDoSdr>(urlApi('sdr', 'conversas', conversaId, 'devolver'), {}),
    );
  }

  /** Envia a sugestão ao lead como a pessoa; com `texto`, a versão editada. */
  aprovarSugestao(sugestaoId: string, texto?: string): Promise<EstadoDoSdr> {
    return firstValueFrom(
      this.http.post<EstadoDoSdr>(
        urlApi('sdr', 'sugestoes', sugestaoId, 'aprovar'),
        texto === undefined ? {} : { texto },
      ),
    );
  }

  descartarSugestao(sugestaoId: string): Promise<EstadoDoSdr> {
    return firstValueFrom(
      this.http.post<EstadoDoSdr>(urlApi('sdr', 'sugestoes', sugestaoId, 'descartar'), {}),
    );
  }

  qualificacaoDoContato(contatoId: string): Observable<QualificacaoDoSdr | null> {
    return this.http
      .get<RespostaQualificacao>(urlApi('sdr', 'contatos', contatoId, 'qualificacao'))
      .pipe(map((resposta) => resposta.qualificacao));
  }

  qualificacaoDoNegocio(negocioId: string): Observable<QualificacaoDoSdr | null> {
    return this.http
      .get<RespostaQualificacao>(urlApi('sdr', 'negocios', negocioId, 'qualificacao'))
      .pipe(map((resposta) => resposta.qualificacao));
  }
}
