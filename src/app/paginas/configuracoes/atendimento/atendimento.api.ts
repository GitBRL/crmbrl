import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi } from '../../../nucleo/api/api';
import type {
  CanalDoAtendimento,
  DadosAtendimentoDoCanal,
  DadosFila,
  DadosRespostaRapida,
  Fila,
  FiltroRespostas,
  RespostaRapida,
  Variavel,
} from './atendimento.modelos';

/**
 * Configuração do Atendimento (R12): filas (`/atendimento/filas`), horário e satisfação dos
 * canais (`/atendimento/canais`) e respostas rápidas (`/atendimento/respostas-rapidas`). Toda
 * falha chega como `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class AtendimentoConfigApi {
  private readonly http = inject(HttpClient);

  // Filas ---------------------------------------------------------------------------------------

  listarFilas(incluirInativas = true): Promise<readonly Fila[]> {
    return firstValueFrom(
      this.http.get<readonly Fila[]>(urlApi('atendimento', 'filas'), {
        params: parametros({ incluirInativas }),
      }),
    );
  }

  criarFila(dados: DadosFila): Promise<Fila> {
    return firstValueFrom(this.http.post<Fila>(urlApi('atendimento', 'filas'), dados));
  }

  atualizarFila(id: string, dados: DadosFila): Promise<Fila> {
    return firstValueFrom(this.http.patch<Fila>(urlApi('atendimento', 'filas', id), dados));
  }

  excluirFila(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('atendimento', 'filas', id)));
  }

  /** Põe (`true`) ou tira (`false`) a pessoa da distribuição da fila. */
  definirParticipacao(filaId: string, usuarioId: string, participa: boolean): Promise<Fila> {
    return firstValueFrom(
      this.http.put<Fila>(urlApi('atendimento', 'filas', filaId, 'participantes', usuarioId), {
        participa,
      }),
    );
  }

  /** Desfaz o ajuste manual da pessoa (volta à regra da fila). */
  removerAjuste(filaId: string, usuarioId: string): Promise<Fila> {
    return firstValueFrom(
      this.http.delete<Fila>(urlApi('atendimento', 'filas', filaId, 'participantes', usuarioId)),
    );
  }

  // Canais --------------------------------------------------------------------------------------

  listarCanais(): Promise<readonly CanalDoAtendimento[]> {
    return firstValueFrom(
      this.http.get<readonly CanalDoAtendimento[]>(urlApi('atendimento', 'canais')),
    );
  }

  atualizarCanal(id: string, dados: DadosAtendimentoDoCanal): Promise<CanalDoAtendimento> {
    return firstValueFrom(
      this.http.patch<CanalDoAtendimento>(urlApi('atendimento', 'canais', id), dados),
    );
  }

  // Respostas rápidas ----------------------------------------------------------------------------

  listarRespostas(filtro: FiltroRespostas = {}): Promise<readonly RespostaRapida[]> {
    return firstValueFrom(
      this.http.get<readonly RespostaRapida[]>(urlApi('atendimento', 'respostas-rapidas'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  variaveis(): Promise<readonly Variavel[]> {
    return firstValueFrom(
      this.http.get<readonly Variavel[]>(urlApi('atendimento', 'respostas-rapidas', 'variaveis')),
    );
  }

  criarResposta(dados: DadosRespostaRapida): Promise<RespostaRapida> {
    return firstValueFrom(
      this.http.post<RespostaRapida>(urlApi('atendimento', 'respostas-rapidas'), dados),
    );
  }

  atualizarResposta(id: string, dados: DadosRespostaRapida): Promise<RespostaRapida> {
    return firstValueFrom(
      this.http.patch<RespostaRapida>(urlApi('atendimento', 'respostas-rapidas', id), dados),
    );
  }

  excluirResposta(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('atendimento', 'respostas-rapidas', id)));
  }
}
