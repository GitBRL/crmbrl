import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, POR_PAGINA_MAXIMO, parametros, urlApi } from '../../nucleo/api/api';
import type {
  AplicativoIntegracao,
  CampoDeIntegracao,
  CamposRecebidos,
  CatalogoDeAplicativos,
  DadosWebhookEntrada,
  DadosWebhookSaida,
  Entrega,
  EntregaDetalhe,
  EventoDisponivel,
  FormatoClint,
  FormularioDoTypeform,
  FunilDoDestino,
  Mapeamento,
  ModeloMapeamento,
  ModelosDeMapeamento,
  ModoIntegracao,
  Recebimento,
  RecebimentoDetalhe,
  ResultadoDaCredencial,
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
  readonly aplicativo?: readonly AplicativoIntegracao[];
  readonly funilId?: string;
  readonly precisaAtencao?: boolean;
}

/** Histórico de recebimentos (global; `integracaoId` restringe a uma integração). */
export interface FiltroRecebimentos {
  readonly pagina?: number;
  readonly porPagina?: number;
  readonly status?: readonly StatusRecebimento[];
  readonly aplicativo?: readonly AplicativoIntegracao[];
  readonly integracaoId?: string;
  /** Datas `AAAA-MM-DD` (inclusivas). */
  readonly de?: string;
  readonly ate?: string;
}

export interface FiltroEntregas {
  readonly pagina?: number;
  readonly porPagina?: number;
  readonly status?: readonly StatusEntrega[];
}

export interface PedidoDePrevia {
  readonly aplicativo?: AplicativoIntegracao;
  readonly modo?: ModoIntegracao;
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
        params: parametros({ ...filtro, aplicativo: filtro.aplicativo?.join(',') }),
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

  /** Histórico global (R32): filtros de data, status, aplicativo e integração. */
  listarRecebimentos(filtro: FiltroRecebimentos = {}): Promise<Pagina<Recebimento>> {
    return firstValueFrom(
      this.http.get<Pagina<Recebimento>>(urlApi('webhooks', 'recebimentos'), {
        params: parametros({
          ...filtro,
          status: filtro.status?.join(','),
          aplicativo: filtro.aplicativo?.join(','),
        }),
      }),
    );
  }

  /** Com cabeçalhos e corpo (para copiar o JSON). */
  obterRecebimento(recebimentoId: string): Promise<RecebimentoDetalhe> {
    return firstValueFrom(
      this.http.get<RecebimentoDetalhe>(urlApi('webhooks', 'recebimentos', recebimentoId)),
    );
  }

  reprocessar(recebimentoId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(urlApi('webhooks', 'recebimentos', recebimentoId, 'reprocessar'), {}),
    );
  }

  // --- Aplicativos e assistente ----------------------------------------------------------------

  catalogo(): Promise<CatalogoDeAplicativos> {
    return firstValueFrom(this.http.get<CatalogoDeAplicativos>(urlApi('webhooks', 'aplicativos')));
  }

  /** O endereço completo (422 em integração antiga: a saída é regenerar o token). */
  async endereco(id: string): Promise<string> {
    const resposta = await firstValueFrom(
      this.http.get<{ url: string }>(urlApi('webhooks', 'entradas', id, 'endereco')),
    );
    return resposta.url;
  }

  /** Confere a credencial antes de gravar (nada é salvo). */
  testarCredencialNova(
    aplicativo: AplicativoIntegracao,
    credencial: Readonly<Record<string, string>>,
  ): Promise<ResultadoDaCredencial> {
    return firstValueFrom(
      this.http.post<ResultadoDaCredencial>(urlApi('webhooks', 'entradas', 'testar-credencial'), {
        aplicativo,
        credencial,
      }),
    );
  }

  /** Confere a credencial salva; se recusada, a integração passa a "precisa de atenção". */
  testarCredencial(id: string): Promise<ResultadoDaCredencial> {
    return firstValueFrom(
      this.http.post<ResultadoDaCredencial>(
        urlApi('webhooks', 'entradas', id, 'testar-credencial'),
        {},
      ),
    );
  }

  buscarCampos(id: string): Promise<{ campos: readonly CampoDeIntegracao[]; buscadosEm: string }> {
    return firstValueFrom(
      this.http.post<{ campos: readonly CampoDeIntegracao[]; buscadosEm: string }>(
        urlApi('webhooks', 'entradas', id, 'buscar-campos'),
        {},
      ),
    );
  }

  camposRecebidos(id: string, limite = 20): Promise<CamposRecebidos> {
    return firstValueFrom(
      this.http.get<CamposRecebidos>(urlApi('webhooks', 'entradas', id, 'campos-recebidos'), {
        params: parametros({ limite }),
      }),
    );
  }

  formularios(id: string, busca?: string): Promise<readonly FormularioDoTypeform[]> {
    return firstValueFrom(
      this.http.get<readonly FormularioDoTypeform[]>(
        urlApi('webhooks', 'entradas', id, 'formularios'),
        { params: parametros({ busca }) },
      ),
    );
  }

  camposDoFormulario(id: string, formularioId: string): Promise<readonly CampoDeIntegracao[]> {
    return firstValueFrom(
      this.http.get<readonly CampoDeIntegracao[]>(
        urlApi('webhooks', 'entradas', id, 'formularios', formularioId, 'campos'),
      ),
    );
  }

  sincronizar(id: string): Promise<{ registrado: boolean; erro: string | null }> {
    return firstValueFrom(
      this.http.post<{ registrado: boolean; erro: string | null }>(
        urlApi('webhooks', 'entradas', id, 'sincronizar'),
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

  formatoClint(): Promise<FormatoClint> {
    return firstValueFrom(
      this.http.get<FormatoClint>(urlApi('webhooks', 'saidas', 'formato-clint')),
    );
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
