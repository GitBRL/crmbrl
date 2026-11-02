import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from '../../../nucleo/api/api';
import type {
  AtualizacaoConfiguracao,
  ChamadoAdmin,
  ChamadoDto,
  ConfiguracaoAssistente,
  FiltrosHistoricoDuvidas,
  PerguntaDoHistorico,
  StatusChamado,
  TemaSemResposta,
} from '../../../layout/ajuda/ajuda.tipos';
import type { ArquivoExportado, FormatoExportacao } from '../../bi/bi.tipos';

/** Filtros do histórico → consulta (sem os vazios). */
export function consultaDoHistorico(
  f: Omit<FiltrosHistoricoDuvidas, 'pagina' | 'porPagina'>,
): Record<string, string | boolean | null> {
  return {
    de: f.de,
    ate: f.ate,
    categoria: f.categoria,
    area: f.area,
    usuarioId: f.usuarioId,
    modulo: f.modulo?.trim() || null,
    resolvido: f.resolvido,
    avaliacao: f.avaliacao,
    comChamado: f.comChamado,
    busca: f.busca.trim() || null,
  };
}

@Injectable({ providedIn: 'root' })
export class DuvidasApi {
  private readonly http = inject(HttpClient);

  historico(filtros: FiltrosHistoricoDuvidas): Promise<Pagina<PerguntaDoHistorico>> {
    const { pagina, porPagina, ...resto } = filtros;
    return firstValueFrom(
      this.http.get<Pagina<PerguntaDoHistorico>>(urlApi('assistente', 'admin', 'historico'), {
        params: parametros({ pagina, porPagina, ...consultaDoHistorico(resto) }),
      }),
    );
  }

  /** Gera o arquivo; baixe-o com `arquivo.url` (a sessão vai no cookie). */
  exportar(
    filtros: Omit<FiltrosHistoricoDuvidas, 'pagina' | 'porPagina'>,
    formato: FormatoExportacao,
  ): Promise<ArquivoExportado> {
    return firstValueFrom(
      this.http.post<ArquivoExportado>(
        urlApi('assistente', 'admin', 'historico', 'exportar'),
        null,
        {
          params: parametros({ formato, ...consultaDoHistorico(filtros) }),
        },
      ),
    );
  }

  temas(de: string | null, ate: string | null): Promise<readonly TemaSemResposta[]> {
    return firstValueFrom(
      this.http.get<readonly TemaSemResposta[]>(urlApi('assistente', 'admin', 'temas'), {
        params: parametros({ de, ate }),
      }),
    );
  }

  chamados(filtros: {
    status: StatusChamado | null;
    de: string | null;
    ate: string | null;
    pagina: number;
  }): Promise<Pagina<ChamadoAdmin>> {
    return firstValueFrom(
      this.http.get<Pagina<ChamadoAdmin>>(urlApi('assistente', 'admin', 'chamados'), {
        params: parametros(filtros),
      }),
    );
  }

  reenviar(id: string): Promise<ChamadoDto> {
    return firstValueFrom(
      this.http.post<ChamadoDto>(urlApi('assistente', 'admin', 'chamados', id, 'reenviar'), null),
    );
  }

  configuracao(): Promise<ConfiguracaoAssistente> {
    return firstValueFrom(
      this.http.get<ConfiguracaoAssistente>(urlApi('assistente', 'admin', 'configuracao')),
    );
  }

  salvarConfiguracao(corpo: AtualizacaoConfiguracao): Promise<ConfiguracaoAssistente> {
    return firstValueFrom(
      this.http.put<ConfiguracaoAssistente>(urlApi('assistente', 'admin', 'configuracao'), corpo),
    );
  }

  testar(): Promise<{ ok: boolean; mensagem: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; mensagem: string }>(
        urlApi('assistente', 'admin', 'configuracao', 'testar'),
        null,
      ),
    );
  }
}
