import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map, type Observable } from 'rxjs';

import { type Pagina, parametros, POR_PAGINA_MAXIMO, urlApi } from '../../nucleo/api/api';
import type {
  AlteracaoContato,
  AlteracaoEmpresa,
  AtividadeRelacionada,
  ConteudoDaLinhaDoTempo,
  Contato,
  Empresa,
  EtiquetaEmUso,
  FiltrosContatos,
  FiltrosEmpresas,
  NegocioRelacionado,
  NovaAtividade,
  NovaEmpresa,
  NovoContato,
  RegistroDaLinhaDoTempo,
  ResultadoCriacaoContato,
  UsuarioResumo,
} from './contatos.tipos';

/** De quem é a linha do tempo, os negócios ou as atividades. */
export type DonoDoHistorico = 'contato' | 'empresa';

const ROTA_DO_DONO: Readonly<Record<DonoDoHistorico, string>> = {
  contato: 'contatos',
  empresa: 'empresas',
};

const FILTRO_DO_DONO: Readonly<Record<DonoDoHistorico, 'contatoId' | 'empresaId'>> = {
  contato: 'contatoId',
  empresa: 'empresaId',
};

/**
 * Dados da tela de contatos e empresas (TELAS-FASE1 §4) — `crmbrl-api`, ContatosController e
 * EmpresasController, mais as leituras de negócios, atividades e usuários que a tela mostra.
 * Leituras devolvem `Observable` (para `rxResource`, que cancela a anterior); gravações
 * devolvem `Promise`. As falhas chegam como `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class ContatosApi {
  private readonly http = inject(HttpClient);

  // ----- Contatos -----------------------------------------------------------------------------

  listarContatos(filtros: FiltrosContatos): Observable<Pagina<Contato>> {
    return this.http.get<Pagina<Contato>>(urlApi('contatos'), {
      params: parametros({ ...filtros }),
    });
  }

  etiquetasDeContatos(): Observable<readonly EtiquetaEmUso[]> {
    return this.http.get<EtiquetaEmUso[]>(urlApi('contatos', 'etiquetas'), {
      params: parametros({ limite: 200 }),
    });
  }

  contato(id: string): Observable<Contato> {
    return this.http.get<Contato>(urlApi('contatos', id));
  }

  criarContato(dados: NovoContato): Promise<ResultadoCriacaoContato> {
    return firstValueFrom(this.http.post<ResultadoCriacaoContato>(urlApi('contatos'), dados));
  }

  atualizarContato(id: string, dados: AlteracaoContato): Promise<Contato> {
    return firstValueFrom(this.http.patch<Contato>(urlApi('contatos', id), dados));
  }

  /** Exclusão com anonimização (R4.6, só Admin). O motivo fica na auditoria. */
  anonimizarContato(id: string, motivo: string | null): Promise<void> {
    const corpo = motivo?.trim() ? { motivo: motivo.trim() } : {};
    return firstValueFrom(
      this.http.post<void>(urlApi('contatos', id, 'anonimizar'), corpo).pipe(map(() => undefined)),
    );
  }

  /** Exportação dos dados do titular (LGPD art. 18, só Admin; a API audita a consulta). */
  dadosPessoais(id: string): Promise<Record<string, unknown>> {
    return firstValueFrom(
      this.http.get<Record<string, unknown>>(urlApi('contatos', id, 'dados-pessoais')),
    );
  }

  // ----- Empresas -----------------------------------------------------------------------------

  listarEmpresas(filtros: FiltrosEmpresas): Observable<Pagina<Empresa>> {
    return this.http.get<Pagina<Empresa>>(urlApi('empresas'), {
      params: parametros({ ...filtros }),
    });
  }

  etiquetasDeEmpresas(): Observable<readonly EtiquetaEmUso[]> {
    return this.http.get<EtiquetaEmUso[]>(urlApi('empresas', 'etiquetas'), {
      params: parametros({ limite: 200 }),
    });
  }

  empresa(id: string): Observable<Empresa> {
    return this.http.get<Empresa>(urlApi('empresas', id));
  }

  criarEmpresa(dados: NovaEmpresa): Promise<Empresa> {
    return firstValueFrom(this.http.post<Empresa>(urlApi('empresas'), dados));
  }

  atualizarEmpresa(id: string, dados: AlteracaoEmpresa): Promise<Empresa> {
    return firstValueFrom(this.http.patch<Empresa>(urlApi('empresas', id), dados));
  }

  // ----- Histórico, negócios e atividades -----------------------------------------------------

  linhaDoTempo(
    dono: DonoDoHistorico,
    id: string,
    incluir: ConteudoDaLinhaDoTempo,
    pagina: number,
    porPagina: number,
  ): Observable<Pagina<RegistroDaLinhaDoTempo>> {
    return this.http.get<Pagina<RegistroDaLinhaDoTempo>>(
      urlApi(ROTA_DO_DONO[dono], id, 'linha-do-tempo'),
      { params: parametros({ incluir, pagina, porPagina }) },
    );
  }

  /** Negócios de todos os funis que quem pede vê (R5.9). */
  negocios(dono: DonoDoHistorico, id: string): Observable<Pagina<NegocioRelacionado>> {
    return this.http.get<Pagina<NegocioRelacionado>>(urlApi('negocios'), {
      params: parametros({
        [FILTRO_DO_DONO[dono]]: id,
        visao: 'TODOS',
        ordenarPor: 'criadoEm',
        direcao: 'asc',
        porPagina: POR_PAGINA_MAXIMO,
      }),
    });
  }

  /** Atividades (sem as notas, que ficam na linha do tempo) que quem pede vê (R6.4). */
  atividades(
    dono: DonoDoHistorico,
    id: string,
    concluidas: boolean,
    pagina: number,
    porPagina: number,
  ): Observable<Pagina<AtividadeRelacionada>> {
    return this.http.get<Pagina<AtividadeRelacionada>>(urlApi('atividades'), {
      params: parametros({
        [FILTRO_DO_DONO[dono]]: id,
        escopo: 'TODAS',
        status: concluidas ? ['CONCLUIDA', 'CANCELADA'] : ['PENDENTE'],
        ordem: concluidas ? 'CONCLUSAO_DESC' : 'DATA',
        pagina,
        porPagina,
      }),
    });
  }

  criarAtividade(dados: NovaAtividade): Promise<AtividadeRelacionada> {
    return firstValueFrom(this.http.post<AtividadeRelacionada>(urlApi('atividades'), dados));
  }

  /** R6.6: a reunião só conclui com `resultadoReuniao` (e `novaData` se remarcada). */
  concluirAtividade(
    id: string,
    conclusao: { readonly resultadoReuniao?: string; readonly novaData?: string } = {},
  ): Promise<AtividadeRelacionada> {
    return firstValueFrom(
      this.http.post<AtividadeRelacionada>(urlApi('atividades', id, 'concluir'), conclusao),
    );
  }

  reabrirAtividade(id: string): Promise<AtividadeRelacionada> {
    return firstValueFrom(
      this.http.post<AtividadeRelacionada>(urlApi('atividades', id, 'reabrir'), {}),
    );
  }

  // ----- Usuários -----------------------------------------------------------------------------

  /** Usuários ativos que quem pede vê (Admin e C-level: todos; líder: a equipe; membro: ele). */
  usuariosAtivos(): Observable<readonly UsuarioResumo[]> {
    return this.http
      .get<Pagina<UsuarioResumo>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: POR_PAGINA_MAXIMO }),
      })
      .pipe(map((pagina) => pagina.itens));
  }
}
