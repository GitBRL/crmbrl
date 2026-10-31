import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../nucleo/api/api';
import { erroDaApi, ErroApi } from '../../nucleo/api/erro-api';
import { erroDaResposta } from '../../paginas/bi/analise/analise.api';
import { lerEventosSse, type BlocoSse } from '../../paginas/bi/analise/analise.sse';
import type {
  Avaliacao,
  CategoriaAssistente,
  ChamadoDto,
  CodigoErroPergunta,
  DetalheConversa,
  EstadoAssistente,
  EventoPergunta,
  PerguntaDto,
  ResumoConversa,
} from './ajuda.tipos';

const registro = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
const texto = (valor: unknown): string | null => (typeof valor === 'string' ? valor : null);
const booleano = (valor: unknown): boolean | null => (typeof valor === 'boolean' ? valor : null);

/** Um bloco SSE → evento tipado (`null` para eventos desconhecidos). */
export function interpretarEventoPergunta(bloco: BlocoSse): EventoPergunta | null {
  const d = registro(bloco.dados);
  if (!d) {
    return null;
  }
  switch (bloco.evento) {
    case 'inicio':
      return {
        evento: 'inicio',
        conversaId: String(d['conversaId'] ?? ''),
        perguntaId: String(d['perguntaId'] ?? ''),
        conversaNova: d['conversaNova'] === true,
        modelo: texto(d['modelo']),
      };
    case 'fase':
      return { evento: 'fase', fase: d['fase'] === 'escrevendo' ? 'escrevendo' : 'pensando' };
    case 'parcial':
      return { evento: 'parcial', resposta: texto(d['resposta']) ?? '' };
    case 'nova_tentativa':
      return {
        evento: 'nova_tentativa',
        tentativa: typeof d['tentativa'] === 'number' ? d['tentativa'] : 2,
        motivo: texto(d['motivo']) ?? '',
      };
    case 'concluido':
      return {
        evento: 'concluido',
        conversaId: String(d['conversaId'] ?? ''),
        perguntaId: String(d['perguntaId'] ?? ''),
        resposta: texto(d['resposta']) ?? '',
        resolvido: booleano(d['resolvido']),
        categoria: texto(d['categoria']) as CategoriaAssistente | null,
        resumoDoPedido: texto(d['resumoDoPedido']),
        podeAbrirChamado: d['podeAbrirChamado'] === true,
        restantesHoje: typeof d['restantesHoje'] === 'number' ? d['restantesHoje'] : null,
      };
    case 'erro':
      return {
        evento: 'erro',
        codigo: (texto(d['codigo']) ?? 'erro') as CodigoErroPergunta,
        mensagem: texto(d['mensagem']) ?? 'Não consegui responder agora. Tente de novo.',
        conversaId: texto(d['conversaId']),
        perguntaId: texto(d['perguntaId']),
      };
    default:
      return null;
  }
}

export interface CorpoChamado {
  readonly titulo?: string;
  readonly descricao?: string;
}

@Injectable({ providedIn: 'root' })
export class AjudaApi {
  private readonly http = inject(HttpClient);

  estado(): Promise<EstadoAssistente> {
    return firstValueFrom(this.http.get<EstadoAssistente>(urlApi('assistente', 'estado')));
  }

  conversas(): Promise<readonly ResumoConversa[]> {
    return firstValueFrom(
      this.http.get<readonly ResumoConversa[]>(urlApi('assistente', 'conversas')),
    );
  }

  conversa(id: string): Promise<DetalheConversa> {
    return firstValueFrom(this.http.get<DetalheConversa>(urlApi('assistente', 'conversas', id)));
  }

  avaliar(perguntaId: string, avaliacao: Avaliacao | null): Promise<PerguntaDto> {
    return firstValueFrom(
      this.http.put<PerguntaDto>(urlApi('assistente', 'perguntas', perguntaId, 'avaliacao'), {
        avaliacao,
      }),
    );
  }

  abrirChamado(perguntaId: string, corpo: CorpoChamado): Promise<ChamadoDto> {
    return firstValueFrom(
      this.http.post<ChamadoDto>(urlApi('assistente', 'perguntas', perguntaId, 'chamado'), {
        confirmar: true,
        ...corpo,
      }),
    );
  }

  chamado(id: string): Promise<ChamadoDto> {
    return firstValueFrom(this.http.get<ChamadoDto>(urlApi('assistente', 'chamados', id)));
  }

  /** Envia a pergunta e devolve os eventos do streaming. Abortar o `signal` cancela no servidor. */
  async *perguntar(
    pergunta: string,
    tela: string,
    conversaId: string | null,
    signal: AbortSignal,
  ): AsyncGenerator<EventoPergunta, void, undefined> {
    const corpo: Record<string, unknown> = { pergunta, tela };
    if (conversaId) {
      corpo['conversaId'] = conversaId;
    }
    let resposta: Response;
    try {
      resposta = await fetch(urlApi('assistente', 'perguntas'), {
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
        const evento = interpretarEventoPergunta(bloco);
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
