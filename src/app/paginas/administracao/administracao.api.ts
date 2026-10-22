import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  type Pagina,
  type PaginaCursor,
  POR_PAGINA_MAXIMO,
  parametros,
  urlApi,
} from '../../nucleo/api/api';
import type {
  EventoAuditoria,
  EventoAuditoriaDetalhe,
  FiltrosDaAuditoria,
  LogTecnico,
  LogTecnicoDetalhe,
  NivelLog,
  PessoaDoFiltro,
  TipoAtor,
} from './tipos';

/** Itens por "Carregar mais" (a API aceita até 100). */
export const LIMITE_POR_LOTE = 50;

interface FiltroComum {
  readonly cursor?: string | null;
  readonly limite?: number;
  /** Início (inclusive), ISO com fuso. */
  readonly de?: string | null;
  /** Fim (exclusivo), ISO com fuso. */
  readonly ate?: string | null;
  readonly usuarioId?: string | null;
  readonly requisicaoId?: string | null;
  readonly texto?: string | null;
}

export interface FiltroAuditoria extends FiltroComum {
  readonly acao?: readonly string[];
  readonly entidade?: string | null;
  readonly tipoAtor?: readonly TipoAtor[];
}

export interface FiltroLogs extends FiltroComum {
  readonly nivel?: readonly NivelLog[];
  /** Origem pelo começo do nome: `HTTP`, `Fila`, `Webhooks`… */
  readonly contexto?: string | null;
}

/**
 * Dados da Administração: auditoria (Admin e C-level, R3.4) e logs técnicos (Admin, R3.6),
 * ambos por cursor, mais as pessoas para o filtro de usuário. Erros chegam como `ErroApi`.
 */
@Injectable({ providedIn: 'root' })
export class AdministracaoApi {
  private readonly http = inject(HttpClient);

  auditoria(filtro: FiltroAuditoria): Promise<PaginaCursor<EventoAuditoria>> {
    return firstValueFrom(
      this.http.get<PaginaCursor<EventoAuditoria>>(urlApi('auditoria'), {
        params: parametros({ limite: LIMITE_POR_LOTE, ...filtro }),
      }),
    );
  }

  filtrosDaAuditoria(): Promise<FiltrosDaAuditoria> {
    return firstValueFrom(this.http.get<FiltrosDaAuditoria>(urlApi('auditoria', 'filtros')));
  }

  eventoDaAuditoria(id: string): Promise<EventoAuditoriaDetalhe> {
    return firstValueFrom(this.http.get<EventoAuditoriaDetalhe>(urlApi('auditoria', id)));
  }

  logs(filtro: FiltroLogs): Promise<PaginaCursor<LogTecnico>> {
    return firstValueFrom(
      this.http.get<PaginaCursor<LogTecnico>>(urlApi('administracao', 'logs-tecnicos'), {
        params: parametros({ limite: LIMITE_POR_LOTE, ...filtro }),
      }),
    );
  }

  log(id: string): Promise<LogTecnicoDetalhe> {
    return firstValueFrom(
      this.http.get<LogTecnicoDetalhe>(urlApi('administracao', 'logs-tecnicos', id)),
    );
  }

  /** Todas as pessoas (inclusive as desligadas), para filtrar e dar nome aos ids. */
  async pessoas(): Promise<readonly PessoaDoFiltro[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<PessoaDoFiltro>>(urlApi('usuarios'), {
        params: parametros({ porPagina: POR_PAGINA_MAXIMO }),
      }),
    );
    return pagina.itens;
  }
}
