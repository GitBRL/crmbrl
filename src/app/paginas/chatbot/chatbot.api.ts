import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../nucleo/api/api';
import type {
  AlteracaoFluxo,
  DefinicaoFluxo,
  EstadoSimulacao,
  ExecucaoDetalhe,
  ExecucaoResumo,
  FluxoDetalhe,
  FluxoResumo,
  GatilhoFluxo,
  InicioSimulacao,
  NovoFluxo,
  ResultadoValidacao,
  TipoDePasso,
  VersaoCompleta,
  VersaoDoFluxo,
} from './chatbot.tipos';

export interface FiltrosFluxos {
  readonly busca?: string;
  readonly ativo?: boolean | null;
  readonly gatilho?: GatilhoFluxo | null;
  readonly pagina?: number;
  readonly porPagina?: number;
}

/** Chamadas de `/chatbot/**` e dos cadastros que o editor consulta (filas, funis, pessoas, canais). */
@Injectable({ providedIn: 'root' })
export class ChatbotApi {
  private readonly http = inject(HttpClient);

  catalogo(): Promise<readonly TipoDePasso[]> {
    return firstValueFrom(this.http.get<readonly TipoDePasso[]>(urlApi('chatbot', 'passos')));
  }

  listar(filtros: FiltrosFluxos): Promise<Pagina<FluxoResumo>> {
    return firstValueFrom(
      this.http.get<Pagina<FluxoResumo>>(urlApi('chatbot', 'fluxos'), {
        params: parametros({ ...filtros }),
      }),
    );
  }

  obter(id: string): Promise<FluxoDetalhe> {
    return firstValueFrom(this.http.get<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id)));
  }

  criar(dados: NovoFluxo): Promise<FluxoDetalhe> {
    return firstValueFrom(this.http.post<FluxoDetalhe>(urlApi('chatbot', 'fluxos'), dados));
  }

  alterar(id: string, dados: AlteracaoFluxo): Promise<FluxoDetalhe> {
    return firstValueFrom(this.http.patch<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id), dados));
  }

  salvarRascunho(id: string, definicao: DefinicaoFluxo): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.put<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id, 'rascunho'), { definicao }),
    );
  }

  validar(id: string): Promise<ResultadoValidacao> {
    return firstValueFrom(
      this.http.post<ResultadoValidacao>(urlApi('chatbot', 'fluxos', id, 'validar'), {}),
    );
  }

  publicar(id: string, ativar: boolean): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.post<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id, 'publicar'), { ativar }),
    );
  }

  ativar(id: string): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.post<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id, 'ativar'), {}),
    );
  }

  desativar(id: string): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.post<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id, 'desativar'), {}),
    );
  }

  duplicar(id: string): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.post<FluxoDetalhe>(urlApi('chatbot', 'fluxos', id, 'duplicar'), {}),
    );
  }

  excluir(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('chatbot', 'fluxos', id)));
  }

  versoes(id: string): Promise<readonly VersaoDoFluxo[]> {
    return firstValueFrom(
      this.http.get<readonly VersaoDoFluxo[]>(urlApi('chatbot', 'fluxos', id, 'versoes')),
    );
  }

  versao(id: string, numero: number): Promise<VersaoCompleta> {
    return firstValueFrom(
      this.http.get<VersaoCompleta>(urlApi('chatbot', 'fluxos', id, 'versoes', numero)),
    );
  }

  restaurarVersao(id: string, numero: number): Promise<FluxoDetalhe> {
    return firstValueFrom(
      this.http.post<FluxoDetalhe>(
        urlApi('chatbot', 'fluxos', id, 'versoes', numero, 'restaurar'),
        {},
      ),
    );
  }

  execucoes(
    id: string,
    filtros: { status?: string | null; pagina?: number },
  ): Promise<Pagina<ExecucaoResumo>> {
    return firstValueFrom(
      this.http.get<Pagina<ExecucaoResumo>>(urlApi('chatbot', 'fluxos', id, 'execucoes'), {
        params: parametros({ ...filtros }),
      }),
    );
  }

  execucao(id: string, execucaoId: string): Promise<ExecucaoDetalhe> {
    return firstValueFrom(
      this.http.get<ExecucaoDetalhe>(urlApi('chatbot', 'fluxos', id, 'execucoes', execucaoId)),
    );
  }

  iniciarSimulacao(id: string, dados: InicioSimulacao): Promise<EstadoSimulacao> {
    return firstValueFrom(
      this.http.post<EstadoSimulacao>(urlApi('chatbot', 'fluxos', id, 'simulador'), dados),
    );
  }

  responderSimulacao(id: string, execucaoId: string, texto: string): Promise<EstadoSimulacao> {
    return firstValueFrom(
      this.http.post<EstadoSimulacao>(
        urlApi('chatbot', 'fluxos', id, 'simulador', execucaoId, 'mensagens'),
        { texto },
      ),
    );
  }

  silencioNaSimulacao(id: string, execucaoId: string): Promise<EstadoSimulacao> {
    return firstValueFrom(
      this.http.post<EstadoSimulacao>(
        urlApi('chatbot', 'fluxos', id, 'simulador', execucaoId, 'silencio'),
        {},
      ),
    );
  }

  encerrarSimulacao(id: string, execucaoId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(urlApi('chatbot', 'fluxos', id, 'simulador', execucaoId)),
    );
  }
}
