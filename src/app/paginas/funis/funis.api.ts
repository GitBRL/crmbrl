import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, POR_PAGINA_MAXIMO, urlApi } from '../../nucleo/api/api';
import { fusoDoNavegador } from '../../nucleo/formatos';
import type { Area } from '../../nucleo/sessao/perfil';
import type {
  AlteracaoEtapa,
  AlteracaoNegocio,
  Atividade,
  Contato,
  Empresa,
  Etapa,
  EtiquetaEmUso,
  FiltrosQuadro,
  Funil,
  Negocio,
  NegocioDetalhe,
  NovaAtividade,
  NovaEtapa,
  NovoContato,
  NovoNegocio,
  PassagemDoFunil,
  PedidoMover,
  Quadro,
  RegraDoRodizio,
  RegistroLinhaDoTempo,
  ResultadoCriacaoContato,
  ResultadoMovimentacao,
  Usuario,
} from './funis.tipos';

/**
 * Dados das telas de funis (TELAS-FASE1 §3) — crmbrl-api, `FunisController`,
 * `NegociosController` e o que o quadro e o detalhe consultam de contatos, empresas, usuários
 * e atividades. Toda falha chega como `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class FunisApi {
  private readonly http = inject(HttpClient);

  // Funis e etapas -------------------------------------------------------------------------

  /** Funis visíveis da área, com as etapas em ordem. */
  funisDaArea(area: Area): Promise<readonly Funil[]> {
    return firstValueFrom(
      this.http.get<Funil[]>(urlApi('funis'), { params: parametros({ area }) }),
    );
  }

  funil(id: string): Promise<Funil> {
    return firstValueFrom(this.http.get<Funil>(urlApi('funis', id)));
  }

  /** Passagens entre funis (Admin e C-level), para a dica "Passagens" do quadro. */
  passagens(): Promise<readonly PassagemDoFunil[]> {
    return firstValueFrom(this.http.get<readonly PassagemDoFunil[]>(urlApi('passagens')));
  }

  /** Regras do rodízio que o papel configura (Admin, C-level, liderança da área). */
  regrasDistribuicao(): Promise<readonly RegraDoRodizio[]> {
    return firstValueFrom(this.http.get<readonly RegraDoRodizio[]>(urlApi('regras-distribuicao')));
  }

  quadro(funilId: string, filtros: FiltrosQuadro, limitePorEtapa?: number): Promise<Quadro> {
    return firstValueFrom(
      this.http.get<Quadro>(urlApi('funis', funilId, 'quadro'), {
        params: parametros({
          visao: filtros.visao,
          busca: filtros.busca,
          etiqueta: filtros.etiqueta,
          limitePorEtapa,
        }),
      }),
    );
  }

  /** Mais cartões de uma etapa (depois dos que o quadro trouxe), na ordem do kanban. */
  negociosDaEtapa(
    funilId: string,
    etapaId: string,
    filtros: FiltrosQuadro,
    pagina: number,
    porPagina: number,
  ): Promise<Pagina<Negocio>> {
    return firstValueFrom(
      this.http.get<Pagina<Negocio>>(urlApi('negocios'), {
        params: parametros({
          funilId,
          etapaId,
          visao: filtros.visao,
          busca: filtros.busca,
          etiqueta: filtros.etiqueta,
          ordenarPor: 'posicao',
          direcao: 'asc',
          pagina,
          porPagina,
        }),
      }),
    );
  }

  criarEtapa(funilId: string, etapa: NovaEtapa): Promise<Funil> {
    return firstValueFrom(this.http.post<Funil>(urlApi('funis', funilId, 'etapas'), etapa));
  }

  alterarEtapa(funilId: string, etapaId: string, alteracao: AlteracaoEtapa): Promise<Etapa> {
    return firstValueFrom(
      this.http.patch<Etapa>(urlApi('funis', funilId, 'etapas', etapaId), alteracao),
    );
  }

  removerEtapa(funilId: string, etapaId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('funis', funilId, 'etapas', etapaId)));
  }

  /** `etapaIds`: todas as etapas do funil, na nova ordem. */
  reordenarEtapas(funilId: string, etapaIds: readonly string[]): Promise<Funil> {
    return firstValueFrom(
      this.http.post<Funil>(urlApi('funis', funilId, 'etapas', 'reordenar'), { etapaIds }),
    );
  }

  // Negócios ------------------------------------------------------------------------------

  /** O negócio com a jornada (de onde veio e o que gerou, com a área de cada lado). */
  negocio(id: string): Promise<NegocioDetalhe> {
    return firstValueFrom(this.http.get<NegocioDetalhe>(urlApi('negocios', id)));
  }

  /** Negócios de um contato em todos os funis visíveis (para a jornada: veio de / gerou). */
  negociosDoContato(contatoId: string): Promise<Pagina<Negocio>> {
    return firstValueFrom(
      this.http.get<Pagina<Negocio>>(urlApi('negocios'), {
        params: parametros({ contatoId, porPagina: POR_PAGINA_MAXIMO }),
      }),
    );
  }

  criarNegocio(negocio: NovoNegocio): Promise<Negocio> {
    return firstValueFrom(this.http.post<Negocio>(urlApi('negocios'), negocio));
  }

  alterarNegocio(id: string, alteracao: AlteracaoNegocio): Promise<Negocio> {
    return firstValueFrom(this.http.patch<Negocio>(urlApi('negocios', id), alteracao));
  }

  mover(id: string, pedido: PedidoMover): Promise<ResultadoMovimentacao> {
    return firstValueFrom(
      this.http.post<ResultadoMovimentacao>(urlApi('negocios', id, 'mover'), pedido),
    );
  }

  /** Reabre um ganho ou perdido (R5.5) numa etapa aberta (padrão: a de antes de fechar). */
  reabrir(id: string, etapaId?: string): Promise<ResultadoMovimentacao> {
    return firstValueFrom(
      this.http.post<ResultadoMovimentacao>(
        urlApi('negocios', id, 'reabrir'),
        etapaId ? { etapaId } : {},
      ),
    );
  }

  assumir(id: string): Promise<Negocio> {
    return firstValueFrom(this.http.post<Negocio>(urlApi('negocios', id, 'assumir'), {}));
  }

  /** `incluir`: tudo, só as alterações (`eventos`) ou só as atividades. */
  linhaDoTempo(
    id: string,
    pagina: number,
    porPagina = 20,
    incluir: 'tudo' | 'eventos' | 'atividades' = 'tudo',
  ): Promise<Pagina<RegistroLinhaDoTempo>> {
    return firstValueFrom(
      this.http.get<Pagina<RegistroLinhaDoTempo>>(urlApi('negocios', id, 'linha-do-tempo'), {
        params: parametros({
          incluir: incluir === 'tudo' ? undefined : incluir,
          pagina,
          porPagina,
        }),
      }),
    );
  }

  // Atividades ----------------------------------------------------------------------------

  atividadesDoNegocio(negocioId: string): Promise<Pagina<Atividade>> {
    return firstValueFrom(
      this.http.get<Pagina<Atividade>>(urlApi('atividades'), {
        params: parametros({
          escopo: 'TODAS',
          negocioId,
          porPagina: 50,
          fusoHorario: fusoDoNavegador(),
        }),
      }),
    );
  }

  /**
   * Pendentes que a pessoa vê, das mais próximas às mais distantes (atrasadas primeiro): de
   * onde sai a "próxima atividade" de cada cartão do quadro.
   */
  atividadesPendentes(): Promise<Pagina<Atividade>> {
    return firstValueFrom(
      this.http.get<Pagina<Atividade>>(urlApi('atividades'), {
        params: parametros({
          escopo: 'TODAS',
          status: 'PENDENTE',
          ordem: 'DATA',
          porPagina: POR_PAGINA_MAXIMO,
          fusoHorario: fusoDoNavegador(),
        }),
      }),
    );
  }

  criarAtividade(atividade: NovaAtividade): Promise<Atividade> {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades'), atividade));
  }

  concluirAtividade(id: string): Promise<Atividade> {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades', id, 'concluir'), {}));
  }

  reabrirAtividade(id: string): Promise<Atividade> {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades', id, 'reabrir'), {}));
  }

  // Contatos, empresas, usuários e etiquetas ---------------------------------------------

  buscarContatos(busca: string, porPagina = 8): Promise<Pagina<Contato>> {
    return firstValueFrom(
      this.http.get<Pagina<Contato>>(urlApi('contatos'), {
        params: parametros({ busca, porPagina }),
      }),
    );
  }

  /** Cria o contato — ou devolve o existente com o mesmo e-mail/telefone (R4.2). */
  criarContato(contato: NovoContato): Promise<ResultadoCriacaoContato> {
    return firstValueFrom(
      this.http.post<ResultadoCriacaoContato>(urlApi('contatos'), {
        ...contato,
        origem: 'MANUAL',
      }),
    );
  }

  buscarEmpresas(busca: string, porPagina = 8): Promise<Pagina<Empresa>> {
    return firstValueFrom(
      this.http.get<Pagina<Empresa>>(urlApi('empresas'), {
        params: parametros({ busca, porPagina }),
      }),
    );
  }

  /** Empresa nova só com o nome (o resto se completa no cadastro de empresas). */
  criarEmpresa(nome: string): Promise<Empresa> {
    return firstValueFrom(this.http.post<Empresa>(urlApi('empresas'), { nome }));
  }

  /** Usuários ativos que a pessoa pode ver (C-level: todos; líder: a equipe; membro: ela). */
  usuariosAtivos(): Promise<Pagina<Usuario>> {
    return firstValueFrom(
      this.http.get<Pagina<Usuario>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: POR_PAGINA_MAXIMO }),
      }),
    );
  }

  /** Etiquetas em uso nos contatos e nas empresas (o filtro do quadro olha as duas). */
  async etiquetas(): Promise<readonly string[]> {
    const params = parametros({ limite: 50 });
    const [contatos, empresas] = await Promise.all([
      firstValueFrom(this.http.get<EtiquetaEmUso[]>(urlApi('contatos', 'etiquetas'), { params })),
      firstValueFrom(this.http.get<EtiquetaEmUso[]>(urlApi('empresas', 'etiquetas'), { params })),
    ]);
    const porChave = new Map<string, string>();
    for (const { etiqueta } of [...contatos, ...empresas]) {
      const chave = etiqueta.toLocaleLowerCase('pt-BR');
      if (!porChave.has(chave)) {
        porChave.set(chave, etiqueta);
      }
    }
    return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
}
