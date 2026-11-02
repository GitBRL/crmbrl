import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { erroDaApi, ErroApi } from '../../../nucleo/api/erro-api';
import { parametros, urlApi, type Pagina } from '../../../nucleo/api/api';
import { consultaDosFiltros } from '../bi.api';
import type { FiltrosBi, IdPainel } from '../bi.tipos';
import { lerEventosSse, type BlocoSse } from './analise.sse';
import type {
  CodigoErroAnalise,
  ConteudoAnalise,
  DetalheAnalise,
  EstadoAnalise,
  EventoAnalise,
  FiltrosHistorico,
  ItemHistorico,
  PerguntaSalva,
} from './analise.tipos';

const registro = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' ? valor : undefined;

/** `{resumo|resposta, destaques, riscos, acoes}` (inteiro ou parcial) → o que a tela mostra. */
export function normalizarConteudo(bruto: unknown): ConteudoAnalise {
  if (typeof bruto === 'string') {
    return { texto: bruto };
  }
  const o = registro(bruto);
  if (!o) {
    return {};
  }
  const lista = <T>(valor: unknown): readonly T[] | undefined =>
    Array.isArray(valor) ? (valor.filter((item) => registro(item)) as T[]) : undefined;
  return {
    texto: texto(o['resumo']) ?? texto(o['resposta']),
    destaques: lista(o['destaques']),
    riscos: lista(o['riscos']),
    acoes: lista(o['acoes']),
  };
}

/** Um bloco SSE → evento tipado (`null` para eventos desconhecidos). */
export function interpretarEvento(bloco: BlocoSse): EventoAnalise | null {
  const d = registro(bloco.dados);
  if (!d) {
    return null;
  }
  const tipo = d['tipo'] === 'pergunta' ? 'pergunta' : 'analise';
  switch (bloco.evento) {
    case 'inicio':
      return {
        evento: 'inicio',
        tipo,
        analiseId: String(d['analiseId'] ?? ''),
        perguntaId: texto(d['perguntaId']) ?? null,
      };
    case 'fase':
      return { evento: 'fase', fase: d['fase'] === 'escrevendo' ? 'escrevendo' : 'pensando' };
    case 'parcial':
      return { evento: 'parcial', conteudo: normalizarConteudo(d) };
    case 'nova_tentativa':
      return {
        evento: 'nova_tentativa',
        tentativa: typeof d['tentativa'] === 'number' ? d['tentativa'] : 2,
        motivo: texto(d['motivo']) ?? '',
      };
    case 'concluido':
      return {
        evento: 'concluido',
        tipo,
        analiseId: String(d['analiseId'] ?? ''),
        perguntaId: texto(d['perguntaId']) ?? null,
        conteudo: normalizarConteudo(d['resultado'] ?? d['resposta']),
        restantesHoje: typeof d['restantesHoje'] === 'number' ? d['restantesHoje'] : null,
      };
    case 'erro':
      return {
        evento: 'erro',
        codigo: (texto(d['codigo']) ?? 'erro') as CodigoErroAnalise,
        mensagem: texto(d['mensagem']) ?? 'A análise não pôde ser concluída. Tente de novo.',
        analiseId: texto(d['analiseId']) ?? null,
        perguntaId: texto(d['perguntaId']) ?? null,
      };
    default:
      return null;
  }
}

/** Resposta de erro (antes do streaming) → `ErroApi`, igual às demais chamadas da API. */
export async function erroDaResposta(resposta: Response): Promise<ErroApi> {
  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }
  const cabecalhos: Record<string, string> = {};
  for (const nome of ['Retry-After', 'X-Request-Id']) {
    const valor = resposta.headers.get(nome);
    if (valor) {
      cabecalhos[nome] = valor;
    }
  }
  return erroDaApi(
    new HttpErrorResponse({
      status: resposta.status,
      error: corpo,
      headers: new HttpHeaders(cabecalhos),
      url: resposta.url || undefined,
    }),
  );
}

/** O corpo de `POST /bi/analise` para o painel e os filtros da tela (sem os vazios). */
export function corpoDaAnalise(painel: IdPainel, filtros: FiltrosBi): Record<string, unknown> {
  const corpo: Record<string, unknown> = { painel };
  for (const [chave, valor] of Object.entries(consultaDosFiltros(painel, filtros))) {
    if (valor !== null && valor !== '') {
      corpo[chave] = valor;
    }
  }
  return corpo;
}

@Injectable({ providedIn: 'root' })
export class AnaliseApi {
  private readonly http = inject(HttpClient);

  estado(): Promise<EstadoAnalise> {
    return firstValueFrom(this.http.get<EstadoAnalise>(urlApi('bi', 'analise', 'estado')));
  }

  configurar(limiteDiario: number): Promise<EstadoAnalise> {
    return firstValueFrom(
      this.http.put<EstadoAnalise>(urlApi('bi', 'analise', 'configuracao'), { limiteDiario }),
    );
  }

  historico(filtros: FiltrosHistorico): Promise<Pagina<ItemHistorico>> {
    return firstValueFrom(
      this.http.get<Pagina<ItemHistorico>>(urlApi('bi', 'analise', 'historico'), {
        params: parametros({
          pagina: filtros.pagina,
          porPagina: filtros.porPagina,
          usuarioId: filtros.usuarioId,
          painel: filtros.painel,
        }),
      }),
    );
  }

  async detalhe(id: string): Promise<DetalheAnalise> {
    const bruto = await firstValueFrom(
      this.http.get<
        Omit<DetalheAnalise, 'resultado' | 'perguntas'> & {
          resultado: unknown;
          perguntas: readonly (Omit<PerguntaSalva, 'resposta'> & { resposta: unknown })[];
        }
      >(urlApi('bi', 'analise', id)),
    );
    return {
      ...bruto,
      resultado: bruto.resultado ? normalizarConteudo(bruto.resultado) : null,
      perguntas: (bruto.perguntas ?? []).map((p) => ({
        ...p,
        resposta: p.resposta ? normalizarConteudo(p.resposta) : null,
      })),
    };
  }

  /** Pede uma análise nova e devolve os eventos do streaming. Abortar o `signal` cancela no servidor. */
  analisar(
    painel: IdPainel,
    filtros: FiltrosBi,
    signal: AbortSignal,
  ): AsyncGenerator<EventoAnalise, void, undefined> {
    return this.transmitir(urlApi('bi', 'analise'), corpoDaAnalise(painel, filtros), signal);
  }

  perguntar(
    analiseId: string,
    pergunta: string,
    signal: AbortSignal,
  ): AsyncGenerator<EventoAnalise, void, undefined> {
    return this.transmitir(urlApi('bi', 'analise', analiseId, 'perguntas'), { pergunta }, signal);
  }

  private async *transmitir(
    url: string,
    corpo: unknown,
    signal: AbortSignal,
  ): AsyncGenerator<EventoAnalise, void, undefined> {
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(corpo),
        signal,
      });
    } catch (falha) {
      if (signal.aborted) {
        return;
      }
      throw erroDaApi(falha);
    }
    if (!resposta.ok) {
      throw await erroDaResposta(resposta);
    }
    if (!resposta.body) {
      throw new ErroApi({ status: 0, codigo: 'desconhecido' });
    }
    try {
      for await (const bloco of lerEventosSse(resposta.body)) {
        const evento = interpretarEvento(bloco);
        if (evento) {
          yield evento;
        }
      }
    } catch (falha) {
      if (signal.aborted) {
        return;
      }
      throw erroDaApi(falha);
    }
  }
}
