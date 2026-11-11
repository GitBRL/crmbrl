import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../../nucleo/api/api';
import type { Funil } from '../../funis/funis.tipos';
import type {
  AlteracaoImportacao,
  CampoImportavel,
  Importacao,
  ImportacaoCriada,
  LeituraArquivo,
  FiltroDaPlanilha,
  FunisDaPlanilha,
  TraducaoEtapas,
  TraducaoFunis,
  LinhaImportada,
  ModeloMapeamento,
  NegocioParaTodos,
  Mapeamento,
  PoliticaDuplicados,
  Previa,
  ResultadoLinha,
  StatusImportacao,
  TipoImportacao,
} from './importar.tipos';

export interface UsuarioResponsavel {
  readonly id: string;
  readonly nome: string;
}

/** Dados do assistente de importação (`/importacoes`, `/importacoes/modelos`, `/arquivos`). */
@Injectable({ providedIn: 'root' })
export class ImportarApi {
  private readonly http = inject(HttpClient);

  /** Envia a planilha (contexto IMPORTACAO). */
  async enviarArquivo(arquivo: File): Promise<{ readonly id: string }> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    return firstValueFrom(
      this.http.post<{ id: string }>(urlApi('arquivos'), corpo, {
        params: parametros({ contexto: 'IMPORTACAO' }),
      }),
    );
  }

  criar(
    tipo: TipoImportacao,
    arquivoId: string,
    leitura?: LeituraArquivo,
  ): Promise<ImportacaoCriada> {
    return firstValueFrom(
      this.http.post<ImportacaoCriada>(urlApi('importacoes'), { tipo, arquivoId, leitura }),
    );
  }

  listar(
    filtros: { status?: StatusImportacao; pagina?: number; porPagina?: number } = {},
  ): Promise<Pagina<Importacao>> {
    return firstValueFrom(
      this.http.get<Pagina<Importacao>>(urlApi('importacoes'), {
        params: parametros({ ...filtros }),
      }),
    );
  }

  obter(id: string): Promise<Importacao> {
    return firstValueFrom(this.http.get<Importacao>(urlApi('importacoes', id)));
  }

  previa(id: string, linhas = 5): Promise<Previa> {
    return firstValueFrom(
      this.http.get<Previa>(urlApi('importacoes', id, 'previa'), {
        params: parametros({ linhas }),
      }),
    );
  }

  /** Funis e etapas que a planilha cita, com o destino de cada um no CRM (usa o que está salvo). */
  funisDaPlanilha(id: string): Promise<FunisDaPlanilha> {
    return firstValueFrom(
      this.http.get<FunisDaPlanilha>(urlApi('importacoes', id, 'funis-da-planilha')),
    );
  }

  /** Cria um funil já com as etapas (ao menos uma aberta, um ganho e uma perda). */
  criarFunil(dados: {
    nome: string;
    area: string;
    etapas: readonly { nome: string; tipo: 'ABERTA' | 'GANHO' | 'PERDIDO' }[];
  }): Promise<Funil> {
    return firstValueFrom(this.http.post<Funil>(urlApi('funis'), dados));
  }

  criarEtapa(funilId: string, nome: string): Promise<Funil> {
    return firstValueFrom(this.http.post<Funil>(urlApi('funis', funilId, 'etapas'), { nome }));
  }

  alterar(id: string, alteracao: AlteracaoImportacao): Promise<Importacao> {
    return firstValueFrom(this.http.patch<Importacao>(urlApi('importacoes', id), alteracao));
  }

  iniciar(id: string): Promise<Importacao> {
    return firstValueFrom(this.http.post<Importacao>(urlApi('importacoes', id, 'iniciar'), {}));
  }

  retomar(id: string): Promise<Importacao> {
    return firstValueFrom(this.http.post<Importacao>(urlApi('importacoes', id, 'retomar'), {}));
  }

  cancelar(id: string): Promise<Importacao> {
    return firstValueFrom(this.http.post<Importacao>(urlApi('importacoes', id, 'cancelar'), {}));
  }

  async excluir(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(urlApi('importacoes', id)));
  }

  linhas(
    id: string,
    filtros: { resultado?: ResultadoLinha | null; pagina?: number; porPagina?: number },
  ): Promise<Pagina<LinhaImportada>> {
    return firstValueFrom(
      this.http.get<Pagina<LinhaImportada>>(urlApi('importacoes', id, 'linhas'), {
        params: parametros({ ...filtros }),
      }),
    );
  }

  relatorio(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(urlApi('importacoes', id, 'relatorio'), { responseType: 'blob' }),
    );
  }

  planilhaModelo(tipo: TipoImportacao): Promise<Blob> {
    return firstValueFrom(
      this.http.get(urlApi('importacoes', 'planilha-modelo'), {
        params: parametros({ tipo }),
        responseType: 'blob',
      }),
    );
  }

  campos(tipo: TipoImportacao): Promise<readonly CampoImportavel[]> {
    return firstValueFrom(
      this.http.get<CampoImportavel[]>(urlApi('importacoes', 'campos'), {
        params: parametros({ tipo }),
      }),
    );
  }

  // ----- Modelos de mapeamento ----------------------------------------------------------------

  modelos(tipo: TipoImportacao): Promise<readonly ModeloMapeamento[]> {
    return firstValueFrom(
      this.http.get<ModeloMapeamento[]>(urlApi('importacoes', 'modelos'), {
        params: parametros({ tipo }),
      }),
    );
  }

  criarModelo(dados: {
    nome: string;
    tipo: TipoImportacao;
    mapeamento: Mapeamento;
    opcoes?: {
      duplicados?: PoliticaDuplicados;
      etiquetas?: readonly string[];
      filtro?: FiltroDaPlanilha | null;
      negocio?: NegocioParaTodos | null;
      ddiPadrao?: string;
      traducaoFunis?: TraducaoFunis;
      traducaoEtapas?: TraducaoEtapas;
    };
  }): Promise<ModeloMapeamento> {
    return firstValueFrom(
      this.http.post<ModeloMapeamento>(urlApi('importacoes', 'modelos'), dados),
    );
  }

  async excluirModelo(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(urlApi('importacoes', 'modelos', id)));
  }

  /** Funis visíveis para quem importa, com as etapas em ordem (para o negócio para todos). */
  funis(): Promise<readonly Funil[]> {
    return firstValueFrom(this.http.get<Funil[]>(urlApi('funis')));
  }

  /** Pessoas que podem ser responsáveis (as que a pessoa logada enxerga). */
  async responsaveis(): Promise<readonly UsuarioResponsavel[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<UsuarioResponsavel>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: 100 }),
      }),
    );
    return pagina.itens;
  }
}
