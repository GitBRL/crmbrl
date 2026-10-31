import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from '../../nucleo/api/api';
import type {
  Automacao,
  Catalogo,
  CorpoAutomacao,
  Execucao,
  ExecucaoDetalhe,
  ModeloPronto,
  ResultadoTeste,
  ResultadoValidacao,
} from './automacoes.tipos';

export interface FiltroAutomacoes {
  readonly busca?: string;
  readonly ativa?: boolean;
  readonly pagina?: number;
  readonly porPagina?: number;
}

export interface FiltroExecucoes {
  readonly automacaoId?: string;
  readonly status?: string;
  readonly teste?: boolean;
  readonly pagina?: number;
  readonly porPagina?: number;
}

export interface OpcaoCarregada {
  readonly id: string;
  readonly rotulo: string;
}

/** Chamadas de `/automacoes` (todas exigem sessão; membro recebe 403). */
@Injectable({ providedIn: 'root' })
export class AutomacoesApi {
  private readonly http = inject(HttpClient);

  listar(filtro: FiltroAutomacoes = {}): Promise<Pagina<Automacao>> {
    return firstValueFrom(
      this.http.get<Pagina<Automacao>>(urlApi('automacoes'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  obter(id: string): Promise<Automacao> {
    return firstValueFrom(this.http.get<Automacao>(urlApi('automacoes', id)));
  }

  criar(corpo: CorpoAutomacao): Promise<Automacao> {
    return firstValueFrom(this.http.post<Automacao>(urlApi('automacoes'), corpo));
  }

  atualizar(id: string, corpo: CorpoAutomacao): Promise<Automacao> {
    return firstValueFrom(this.http.patch<Automacao>(urlApi('automacoes', id), corpo));
  }

  validar(corpo: CorpoAutomacao): Promise<ResultadoValidacao> {
    return firstValueFrom(
      this.http.post<ResultadoValidacao>(urlApi('automacoes', 'validar'), corpo),
    );
  }

  ativar(id: string): Promise<Automacao> {
    return firstValueFrom(this.http.post<Automacao>(urlApi('automacoes', id, 'ativar'), {}));
  }

  pausar(id: string, cancelarExecucoes = false): Promise<Automacao> {
    return firstValueFrom(
      this.http.post<Automacao>(urlApi('automacoes', id, 'pausar'), { cancelarExecucoes }),
    );
  }

  duplicar(id: string): Promise<Automacao> {
    return firstValueFrom(this.http.post<Automacao>(urlApi('automacoes', id, 'duplicar'), {}));
  }

  excluir(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('automacoes', id)));
  }

  testar(id: string, entidadeId: string): Promise<ResultadoTeste> {
    return firstValueFrom(
      this.http.post<ResultadoTeste>(urlApi('automacoes', id, 'testar'), { entidadeId }),
    );
  }

  catalogo(): Promise<Catalogo> {
    return firstValueFrom(this.http.get<Catalogo>(urlApi('automacoes', 'catalogo')));
  }

  modelosProntos(): Promise<readonly ModeloPronto[]> {
    return firstValueFrom(
      this.http.get<readonly ModeloPronto[]>(urlApi('automacoes', 'modelos-prontos')),
    );
  }

  usarModeloPronto(
    chave: string,
    corpo: { nome?: string; area?: string | null; gatilhoConfig?: Record<string, unknown> },
  ): Promise<Automacao> {
    return firstValueFrom(
      this.http.post<Automacao>(urlApi('automacoes', 'modelos-prontos', chave), corpo),
    );
  }

  execucoes(filtro: FiltroExecucoes = {}): Promise<Pagina<Execucao>> {
    return firstValueFrom(
      this.http.get<Pagina<Execucao>>(urlApi('automacoes', 'execucoes'), {
        params: parametros({ ...filtro }),
      }),
    );
  }

  execucao(id: string): Promise<ExecucaoDetalhe> {
    return firstValueFrom(this.http.get<ExecucaoDetalhe>(urlApi('automacoes', 'execucoes', id)));
  }

  reexecutar(id: string): Promise<ExecucaoDetalhe> {
    return firstValueFrom(
      this.http.post<ExecucaoDetalhe>(urlApi('automacoes', 'execucoes', id, 'reexecutar'), {}),
    );
  }

  cancelarExecucao(id: string): Promise<ExecucaoDetalhe> {
    return firstValueFrom(
      this.http.post<ExecucaoDetalhe>(urlApi('automacoes', 'execucoes', id, 'cancelar'), {}),
    );
  }

  /** Quantos contatos atendem ao segmento (a mesma contagem do construtor de segmentos). */
  async contarSegmento(segmento: unknown, excluirOptOut: boolean): Promise<number> {
    const r = await firstValueFrom(
      this.http.post<{ total: number }>(urlApi('segmentos', 'previa'), {
        segmento,
        excluirOptOut,
        amostra: 0,
      }),
    );
    return r.total;
  }

  // --- listas de apoio (melhor esforço: sem permissão ou sem dados, a lista fica vazia) ---

  private async lista<T>(rota: readonly string[], consulta: Record<string, string | number> = {}) {
    try {
      const r = await firstValueFrom(
        this.http.get<{ itens?: readonly T[] } | readonly T[]>(urlApi(...rota), {
          params: parametros(consulta),
        }),
      );
      return (Array.isArray(r) ? r : ((r as { itens?: readonly T[] }).itens ?? [])) as readonly T[];
    } catch {
      return [] as readonly T[];
    }
  }

  async funis(): Promise<
    readonly { id: string; nome: string; etapas: readonly { id: string; nome: string }[] }[]
  > {
    return this.lista(['funis']);
  }

  async etiquetas(): Promise<readonly string[]> {
    const r = await this.lista<{ etiqueta: string }>(['contatos', 'etiquetas']);
    return r.map((e) => e.etiqueta);
  }

  async usuarios(): Promise<readonly OpcaoCarregada[]> {
    const r = await this.lista<{ id: string; nome: string; ativo?: boolean }>(['usuarios'], {
      porPagina: 100,
    });
    return r.filter((u) => u.ativo !== false).map((u) => ({ id: u.id, rotulo: u.nome }));
  }

  async fluxosChatbot(): Promise<readonly OpcaoCarregada[]> {
    const r = await this.lista<{ id: string; nome: string }>(['chatbot', 'fluxos'], {
      porPagina: 100,
    });
    return r.map((f) => ({ id: f.id, rotulo: f.nome }));
  }

  async modelosMensagem(): Promise<readonly { id: string; nome: string; canal: string | null }[]> {
    return this.lista(['modelos-mensagem'], { porPagina: 100 });
  }

  async webhooksSaida(): Promise<readonly OpcaoCarregada[]> {
    const r = await this.lista<{ id: string; nome: string }>(['webhooks', 'saidas'], {
      porPagina: 100,
    });
    return r.map((w) => ({ id: w.id, rotulo: w.nome }));
  }

  async campanhas(): Promise<readonly OpcaoCarregada[]> {
    const r = await this.lista<{ id: string; nome: string }>(['disparos', 'campanhas'], {
      porPagina: 100,
    });
    return r.map((c) => ({ id: c.id, rotulo: c.nome }));
  }

  async canais(): Promise<readonly OpcaoCarregada[]> {
    const r = await this.lista<{ id: string; nome: string }>(['atendimento', 'canais']);
    return r.map((c) => ({ id: c.id, rotulo: c.nome }));
  }

  async camposPersonalizados(): Promise<readonly string[]> {
    try {
      const r = await firstValueFrom(
        this.http.get<{ camposPersonalizados?: { chaves?: readonly string[] } }>(
          urlApi('segmentos', 'campos'),
        ),
      );
      return r.camposPersonalizados?.chaves ?? [];
    } catch {
      return [];
    }
  }

  /** Registros para escolher no modo teste, de acordo com a entidade da automação. */
  async candidatosDeTeste(entidade: string): Promise<readonly OpcaoCarregada[]> {
    const consulta = { porPagina: 30 };
    switch (entidade) {
      case 'contato': {
        const r = await this.lista<{ id: string; nome: string }>(['contatos'], consulta);
        return r.map((x) => ({ id: x.id, rotulo: x.nome }));
      }
      case 'negocio': {
        const r = await this.lista<{ id: string; titulo: string }>(['negocios'], consulta);
        return r.map((x) => ({ id: x.id, rotulo: x.titulo }));
      }
      case 'conversa': {
        const r = await this.lista<{ id: string; contato?: { nome: string } | null }>(
          ['atendimento', 'conversas'],
          consulta,
        );
        return r.map((x) => ({ id: x.id, rotulo: x.contato?.nome ?? 'Conversa' }));
      }
      default: {
        const r = await this.lista<{ id: string; titulo: string }>(['atividades'], consulta);
        return r.map((x) => ({ id: x.id, rotulo: x.titulo }));
      }
    }
  }
}
