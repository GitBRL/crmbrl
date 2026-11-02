import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from '../../nucleo/api/api';
import { fusoDoNavegador } from '../../nucleo/formatos';

/**
 * Contrato das atividades com a API (crmbrl-api, `AtividadesController`; ARQUITETURA.md
 * "Atividades" e REGRAS-DE-NEGOCIO.md §6). A API calcula `atrasada` (R6.3) e o `grupo` da
 * agenda no fuso pedido; a tela só mostra.
 */

export type TipoAtividade = 'TAREFA' | 'LIGACAO' | 'REUNIAO' | 'EMAIL' | 'WHATSAPP' | 'NOTA';
export type StatusAtividade = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA';
export type PrioridadeAtividade = 'BAIXA' | 'MEDIA' | 'ALTA';
export type GrupoAtividade =
  'ATRASADAS' | 'HOJE' | 'PROXIMOS_7_DIAS' | 'MAIS_TARDE' | 'SEM_DATA' | 'CONCLUIDAS';
/** `MINHAS` (sou o responsável) · `EQUIPE` (dos meus liderados) · `TODAS` (tudo o que vejo, R6.4). */
export type EscopoAtividades = 'MINHAS' | 'EQUIPE' | 'TODAS';

export interface PessoaDaAtividade {
  readonly id: string;
  readonly nome: string;
  readonly avatarUrl?: string | null;
}

export interface Atividade {
  readonly id: string;
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly status: StatusAtividade;
  readonly prioridade: PrioridadeAtividade;
  /** Vencimento; na reunião, igual ao início. */
  readonly venceEm: string | null;
  readonly inicioEm: string | null;
  readonly fimEm: string | null;
  /** R6.3 — pendente com o prazo no passado (calculado pela API). */
  readonly atrasada: boolean;
  /** Agrupamento da agenda (nulo para nota e cancelada). */
  readonly grupo: GrupoAtividade | null;
  readonly responsavel: PessoaDaAtividade;
  readonly criadoPor: PessoaDaAtividade | null;
  readonly concluidaEm: string | null;
  readonly concluidaPor: PessoaDaAtividade | null;
  readonly canceladaEm: string | null;
  readonly contato: { readonly id: string; readonly nome: string } | null;
  readonly empresa: { readonly id: string; readonly nome: string } | null;
  readonly negocio: {
    readonly id: string;
    readonly titulo: string;
    readonly funilId: string;
  } | null;
  /** De quem veio, quando foi encaminhada por desligamento (R7.3). */
  readonly encaminhadaDe: PessoaDaAtividade | null;
  readonly encaminhadaEm: string | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface GrupoDeAtividades {
  readonly grupo: GrupoAtividade;
  readonly rotulo: string;
  /** Quantas o grupo tem (todas, não só as listadas). */
  readonly total: number;
  readonly itens: readonly Atividade[];
}

export interface AtividadesAgrupadas {
  readonly referencia: {
    readonly agora: string;
    readonly fusoHorario: string;
    readonly inicioDeHoje: string;
    readonly inicioDeAmanha: string;
    readonly fimDosProximos7Dias: string;
  };
  /** Sempre os seis grupos, na ordem da agenda. */
  readonly grupos: readonly GrupoDeAtividades[];
}

/** Filtros da tela (os mesmos para a agenda e para a lista). */
export interface FiltrosAtividades {
  readonly escopo: EscopoAtividades;
  /** Vazio = todos os tipos (menos a nota, que só aparece na linha do tempo, R6.2). */
  readonly tipos: readonly TipoAtividade[];
}

export interface NovaAtividade {
  readonly tipo: TipoAtividade;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly prioridade?: PrioridadeAtividade;
  readonly venceEm?: string | null;
  readonly inicioEm?: string | null;
  readonly fimEm?: string | null;
  readonly responsavelId?: string;
  readonly contatoId?: string | null;
  readonly empresaId?: string | null;
  readonly negocioId?: string | null;
}

/** `PATCH /atividades/:id`: só os campos enviados mudam; `null` limpa. */
export type AlteracaoAtividade = Partial<NovaAtividade>;

/**
 * Ligação de uma atividade com contato, empresa ou negócio (R6.1). Guarda também os ids que
 * vêm junto (o contato e a empresa de um negócio), porque a alteração grava os três como
 * vierem.
 */
export interface Vinculo {
  readonly tipo: 'contato' | 'empresa' | 'negocio';
  readonly id: string;
  /** Nome do contato ou da empresa; título do negócio. */
  readonly nome: string;
  /** "Comercial · Proposta", a empresa do contato… */
  readonly detalhe: string | null;
  readonly contatoId: string | null;
  readonly empresaId: string | null;
  readonly negocioId: string | null;
}

/** Quem pode ser responsável (usuários ativos que a pessoa vê). */
export interface Responsavel {
  readonly id: string;
  readonly nome: string;
  readonly rotuloPapel: string;
}

interface ContatoDaBusca {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  readonly empresa: { readonly id: string; readonly nome: string } | null;
}

interface EmpresaDaBusca {
  readonly id: string;
  readonly nome: string;
  readonly cidade: string | null;
  readonly uf: string | null;
}

interface NegocioDaBusca {
  readonly id: string;
  readonly titulo: string;
  readonly funil: { readonly nome: string };
  readonly etapa: { readonly nome: string };
  readonly contato: { readonly id: string } | null;
  readonly empresa: { readonly id: string } | null;
}

/** Quantas atividades cada grupo da agenda traz de início. */
export const LIMITE_POR_GRUPO = 10;
/** Quantos resultados de cada tipo a busca de vínculo mostra. */
export const RESULTADOS_POR_TIPO = 4;

/** Atividades e o que a tela precisa em volta delas (busca de vínculo, responsáveis). */
@Injectable({ providedIn: 'root' })
export class AtividadesApi {
  private readonly http = inject(HttpClient);

  /** A agenda: os seis grupos com o total e as primeiras de cada um. */
  agrupadas(filtros: FiltrosAtividades, limitePorGrupo = LIMITE_POR_GRUPO) {
    return firstValueFrom(
      this.http.get<AtividadesAgrupadas>(urlApi('atividades', 'agrupadas'), {
        params: parametros({
          escopo: filtros.escopo,
          tipo: filtros.tipos,
          limitePorGrupo,
          fusoHorario: fusoDoNavegador(),
        }),
      }),
    );
  }

  /** Uma página de um grupo ("Mostrar mais") ou da lista com outros filtros. */
  listar(
    filtros: FiltrosAtividades,
    extras: {
      readonly grupo?: GrupoAtividade;
      readonly status?: readonly StatusAtividade[];
      readonly encaminhadas?: boolean;
      readonly pagina?: number;
      readonly porPagina?: number;
    } = {},
  ) {
    return firstValueFrom(
      this.http.get<Pagina<Atividade>>(urlApi('atividades'), {
        params: parametros({
          escopo: filtros.escopo,
          tipo: filtros.tipos,
          grupo: extras.grupo,
          status: extras.status ?? [],
          encaminhadas: extras.encaminhadas,
          pagina: extras.pagina,
          porPagina: extras.porPagina,
          fusoHorario: fusoDoNavegador(),
        }),
      }),
    );
  }

  obter(id: string) {
    return firstValueFrom(
      this.http.get<Atividade>(urlApi('atividades', id), {
        params: parametros({ fusoHorario: fusoDoNavegador() }),
      }),
    );
  }

  criar(nova: NovaAtividade) {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades'), nova));
  }

  atualizar(id: string, alteracao: AlteracaoAtividade) {
    return firstValueFrom(this.http.patch<Atividade>(urlApi('atividades', id), alteracao));
  }

  concluir(id: string) {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades', id, 'concluir'), {}));
  }

  reabrir(id: string) {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades', id, 'reabrir'), {}));
  }

  cancelar(id: string) {
    return firstValueFrom(this.http.post<Atividade>(urlApi('atividades', id, 'cancelar'), {}));
  }

  /** Contatos, empresas e negócios que batem com o texto (os que a pessoa vê). */
  async buscarVinculos(texto: string): Promise<readonly Vinculo[]> {
    const params = parametros({ busca: texto, porPagina: RESULTADOS_POR_TIPO });
    const [contatos, empresas, negocios] = await Promise.all([
      firstValueFrom(this.http.get<Pagina<ContatoDaBusca>>(urlApi('contatos'), { params })),
      firstValueFrom(this.http.get<Pagina<EmpresaDaBusca>>(urlApi('empresas'), { params })),
      firstValueFrom(this.http.get<Pagina<NegocioDaBusca>>(urlApi('negocios'), { params })),
    ]);
    return [
      ...contatos.itens.map((contato) => vinculoDoContato(contato)),
      ...empresas.itens.map<Vinculo>((empresa) => ({
        tipo: 'empresa',
        id: empresa.id,
        nome: empresa.nome,
        detalhe: [empresa.cidade, empresa.uf].filter(Boolean).join(' · ') || null,
        contatoId: null,
        empresaId: empresa.id,
        negocioId: null,
      })),
      ...negocios.itens.map<Vinculo>((negocio) => ({
        tipo: 'negocio',
        id: negocio.id,
        nome: negocio.titulo,
        detalhe: `${negocio.funil.nome} · ${negocio.etapa.nome}`,
        contatoId: negocio.contato?.id ?? null,
        empresaId: negocio.empresa?.id ?? null,
        negocioId: negocio.id,
      })),
    ];
  }

  /** Usuários ativos que podem receber a atividade (C-level vê todos; líder, a equipe). */
  async responsaveis(): Promise<readonly Responsavel[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<Responsavel>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: 100 }),
      }),
    );
    return pagina.itens.map(({ id, nome, rotuloPapel }) => ({ id, nome, rotuloPapel }));
  }
}

function vinculoDoContato(contato: ContatoDaBusca): Vinculo {
  return {
    tipo: 'contato',
    id: contato.id,
    nome: contato.nome,
    detalhe: contato.empresa?.nome ?? contato.email ?? null,
    contatoId: contato.id,
    empresaId: contato.empresa?.id ?? null,
    negocioId: null,
  };
}

/** O vínculo principal de uma atividade: o negócio, senão o contato, senão a empresa. */
export function vinculoDaAtividade(atividade: Atividade): Vinculo | null {
  const ids = {
    contatoId: atividade.contato?.id ?? null,
    empresaId: atividade.empresa?.id ?? null,
    negocioId: atividade.negocio?.id ?? null,
  };
  if (atividade.negocio) {
    return {
      tipo: 'negocio',
      id: atividade.negocio.id,
      nome: atividade.negocio.titulo,
      detalhe: atividade.contato?.nome ?? null,
      ...ids,
    };
  }
  if (atividade.contato) {
    return {
      tipo: 'contato',
      id: atividade.contato.id,
      nome: atividade.contato.nome,
      detalhe: atividade.empresa?.nome ?? null,
      ...ids,
    };
  }
  if (atividade.empresa) {
    return {
      tipo: 'empresa',
      id: atividade.empresa.id,
      nome: atividade.empresa.nome,
      detalhe: null,
      ...ids,
    };
  }
  return null;
}

/**
 * Os campos de vínculo de uma criação: só o principal (a API completa o contato e a empresa
 * a partir do negócio ou do contato).
 */
export function vinculoParaCriar(
  vinculo: Vinculo | null,
): Pick<NovaAtividade, 'contatoId' | 'empresaId' | 'negocioId'> {
  if (!vinculo) {
    return {};
  }
  switch (vinculo.tipo) {
    case 'negocio':
      return { negocioId: vinculo.id };
    case 'contato':
      return { contatoId: vinculo.id };
    case 'empresa':
      return { empresaId: vinculo.id };
  }
}

/**
 * Os campos de vínculo de uma alteração: a API grava os três como vierem, então vão os do
 * vínculo novo (ou `null` em todos, quando a pessoa tira o vínculo).
 */
export function vinculoParaAlterar(
  vinculo: Vinculo | null,
): Required<Pick<NovaAtividade, 'contatoId' | 'empresaId' | 'negocioId'>> {
  return {
    contatoId: vinculo?.contatoId ?? null,
    empresaId: vinculo?.empresaId ?? null,
    negocioId: vinculo?.negocioId ?? null,
  };
}
