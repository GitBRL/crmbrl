import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, POR_PAGINA_MAXIMO, parametros, urlApi } from '../../nucleo/api/api';
import type {
  DadosWebhookEntrada,
  DadosWebhookSaida,
  Entrega,
  EntregaDetalhe,
  EventoDisponivel,
  FunilDoDestino,
  Mapeamento,
  ModeloMapeamento,
  ModelosDeMapeamento,
  Recebimento,
  RecebimentoDetalhe,
  ResultadoDaPrevia,
  StatusEntrega,
  StatusRecebimento,
  UsuarioDoDestino,
  WebhookEntrada,
  WebhookEntradaCriado,
  WebhookSaida,
  WebhookSaidaComSegredo,
} from './tipos';

export interface FiltroLista {
  readonly pagina?: number;
  readonly porPagina?: number;
  readonly busca?: string;
  /** Só os ativos (`true`) ou só os desativados (`false`). */
  readonly ativo?: boolean;
}

export interface FiltroRecebimentos {
  readonly pagina?: number;
  readonly porPagina?: number;
  readonly status?: readonly StatusRecebimento[];
}

export interface FiltroEntregas {
  readonly pagina?: number;
  readonly porPagina?: number;
  readonly status?: readonly StatusEntrega[];
}

export interface PedidoDePrevia {
  readonly modeloMapeamento: ModeloMapeamento;
  readonly mapeamento?: Mapeamento;
  readonly etiquetasFixas?: readonly string[];
  readonly exemplo: unknown;
}

/**
 * Dados das telas de Integrações (Admin): webhooks de entrada (R8) e de saída (R9), mais os
 * funis e usuários que o destino de um webhook de entrada oferece. Erros chegam como
 * `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class IntegracoesApi {
  private readonly http = inject(HttpClient);

  // --- Entrada -------------------------------------------------------------------------------

  listarEntradas(filtro: FiltroLista = {}): Promise<Pagina<WebhookEntrada>> {
    return firstValueFrom(
      this.http.get<Pagina<WebhookEntrada>>(urlApi('webhooks', 'entradas'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  obterEntrada(id: string): Promise<WebhookEntrada> {
    return firstValueFrom(this.http.get<WebhookEntrada>(urlApi('webhooks', 'entradas', id)));
  }

  criarEntrada(dados: DadosWebhookEntrada): Promise<WebhookEntradaCriado> {
    return firstValueFrom(
      this.http.post<WebhookEntradaCriado>(urlApi('webhooks', 'entradas'), dados),
    );
  }

  atualizarEntrada(id: string, dados: Partial<DadosWebhookEntrada>): Promise<WebhookEntrada> {
    return firstValueFrom(
      this.http.patch<WebhookEntrada>(urlApi('webhooks', 'entradas', id), dados),
    );
  }

  excluirEntrada(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('webhooks', 'entradas', id)));
  }

  regenerarToken(id: string): Promise<{ webhook: WebhookEntrada; url: string }> {
    return firstValueFrom(
      this.http.post<{ webhook: WebhookEntrada; url: string }>(
        urlApi('webhooks', 'entradas', id, 'regenerar-token'),
        {},
      ),
    );
  }

  /** Sem `segredo`, a API gera um e o devolve só nesta resposta. */
  definirSegredo(
    id: string,
    segredo?: string,
  ): Promise<{ webhook: WebhookEntrada; segredo?: string }> {
    return firstValueFrom(
      this.http.post<{ webhook: WebhookEntrada; segredo?: string }>(
        urlApi('webhooks', 'entradas', id, 'segredo'),
        segredo ? { segredo } : {},
      ),
    );
  }

  removerSegredo(id: string): Promise<WebhookEntrada> {
    return firstValueFrom(
      this.http.delete<WebhookEntrada>(urlApi('webhooks', 'entradas', id, 'segredo')),
    );
  }

  modelos(): Promise<ModelosDeMapeamento> {
    return firstValueFrom(
      this.http.get<ModelosDeMapeamento>(urlApi('webhooks', 'entradas', 'modelos')),
    );
  }

  previa(pedido: PedidoDePrevia): Promise<ResultadoDaPrevia> {
    return firstValueFrom(
      this.http.post<ResultadoDaPrevia>(urlApi('webhooks', 'entradas', 'previa'), pedido),
    );
  }

  /** Prévia com a configuração salva, sobre um recebimento guardado. */
  previaDoRecebimento(webhookId: string, recebimentoId: string): Promise<ResultadoDaPrevia> {
    return firstValueFrom(
      this.http.post<ResultadoDaPrevia>(urlApi('webhooks', 'entradas', webhookId, 'previa'), {
        recebimentoId,
      }),
    );
  }

  listarRecebimentos(
    webhookId: string,
    filtro: FiltroRecebimentos = {},
  ): Promise<Pagina<Recebimento>> {
    return firstValueFrom(
      this.http.get<Pagina<Recebimento>>(
        urlApi('webhooks', 'entradas', webhookId, 'recebimentos'),
        { params: parametros({ ...filtro }) },
      ),
    );
  }

  obterRecebimento(webhookId: string, recebimentoId: string): Promise<RecebimentoDetalhe> {
    return firstValueFrom(
      this.http.get<RecebimentoDetalhe>(
        urlApi('webhooks', 'entradas', webhookId, 'recebimentos', recebimentoId),
      ),
    );
  }

  reprocessar(webhookId: string, recebimentoId: string): Promise<Recebimento> {
    return firstValueFrom(
      this.http.post<Recebimento>(
        urlApi('webhooks', 'entradas', webhookId, 'recebimentos', recebimentoId, 'reprocessar'),
        {},
      ),
    );
  }

  // --- Saída ---------------------------------------------------------------------------------

  listarSaidas(filtro: FiltroLista = {}): Promise<Pagina<WebhookSaida>> {
    return firstValueFrom(
      this.http.get<Pagina<WebhookSaida>>(urlApi('webhooks', 'saidas'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  obterSaida(id: string): Promise<WebhookSaida> {
    return firstValueFrom(this.http.get<WebhookSaida>(urlApi('webhooks', 'saidas', id)));
  }

  eventos(): Promise<readonly EventoDisponivel[]> {
    return firstValueFrom(
      this.http.get<readonly EventoDisponivel[]>(urlApi('webhooks', 'saidas', 'eventos')),
    );
  }

  criarSaida(dados: DadosWebhookSaida): Promise<WebhookSaidaComSegredo> {
    return firstValueFrom(
      this.http.post<WebhookSaidaComSegredo>(urlApi('webhooks', 'saidas'), dados),
    );
  }

  atualizarSaida(id: string, dados: DadosWebhookSaida): Promise<WebhookSaida> {
    return firstValueFrom(this.http.patch<WebhookSaida>(urlApi('webhooks', 'saidas', id), dados));
  }

  excluirSaida(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('webhooks', 'saidas', id)));
  }

  regenerarSegredo(id: string): Promise<WebhookSaidaComSegredo> {
    return firstValueFrom(
      this.http.post<WebhookSaidaComSegredo>(
        urlApi('webhooks', 'saidas', id, 'regenerar-segredo'),
        {},
      ),
    );
  }

  /** Envia `webhook.teste` agora e devolve a entrega com o resultado. */
  testar(id: string): Promise<EntregaDetalhe> {
    return firstValueFrom(
      this.http.post<EntregaDetalhe>(urlApi('webhooks', 'saidas', id, 'testar'), {}),
    );
  }

  listarEntregas(webhookId: string, filtro: FiltroEntregas = {}): Promise<Pagina<Entrega>> {
    return firstValueFrom(
      this.http.get<Pagina<Entrega>>(urlApi('webhooks', 'saidas', webhookId, 'entregas'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  obterEntrega(webhookId: string, entregaId: string): Promise<EntregaDetalhe> {
    return firstValueFrom(
      this.http.get<EntregaDetalhe>(urlApi('webhooks', 'saidas', webhookId, 'entregas', entregaId)),
    );
  }

  reenviar(webhookId: string, entregaId: string): Promise<EntregaDetalhe> {
    return firstValueFrom(
      this.http.post<EntregaDetalhe>(
        urlApi('webhooks', 'saidas', webhookId, 'entregas', entregaId, 'reenviar'),
        {},
      ),
    );
  }

  // --- Apoio ---------------------------------------------------------------------------------

  funis(): Promise<readonly FunilDoDestino[]> {
    return firstValueFrom(this.http.get<readonly FunilDoDestino[]>(urlApi('funis')));
  }

  /** Usuários ativos (para o responsável fixo). */
  async usuariosAtivos(): Promise<readonly UsuarioDoDestino[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<UsuarioDoDestino>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: POR_PAGINA_MAXIMO }),
      }),
    );
    return pagina.itens;
  }
}
