import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi, type Pagina } from '../../nucleo/api/api';
import { LIDERES, type Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';
import {
  ehPainel,
  type ArquivoExportado,
  type FiltrosBi,
  type FormatoExportacao,
  type IdPainel,
  type RespostaPainel,
} from './bi.tipos';

/** Quais filtros cada painel aceita (o resto a API recusaria ou ignoraria). */
export const FILTROS_DO_PAINEL: Readonly<
  Record<IdPainel, readonly (keyof Omit<FiltrosBi, 'de' | 'ate' | 'comparar'>)[]>
> = {
  marketing: ['area', 'equipeId', 'pessoaId', 'funilId', 'canalId'],
  comercial: ['equipeId', 'pessoaId', 'funilId'],
  cs: ['equipeId', 'pessoaId', 'funilId'],
  atendimento: ['area', 'equipeId', 'pessoaId', 'canalId', 'filaId'],
  sdr: ['area', 'equipeId', 'pessoaId', 'canalId', 'filaId'],
  financeiro: ['equipeId', 'pessoaId'],
};

/** AAAA-MM-DD (dia local) → meia-noite local desse dia, em ISO UTC. */
export function inicioDoDia(dia: string, somarDias = 0): string {
  const [ano, mes, dd] = dia.split('-').map(Number);
  return new Date(ano, mes - 1, dd + somarDias).toISOString();
}

/** O corpo/consulta da API para os filtros da tela. `ate` na tela é inclusivo: soma um dia. */
export function consultaDosFiltros(
  painel: IdPainel,
  filtros: FiltrosBi,
): Record<string, string | boolean | null> {
  const consulta: Record<string, string | boolean | null> = {
    de: filtros.de ? inicioDoDia(filtros.de) : null,
    ate: filtros.ate ? inicioDoDia(filtros.ate, 1) : null,
    comparar: filtros.comparar,
  };
  for (const chave of FILTROS_DO_PAINEL[painel]) {
    consulta[chave] = filtros[chave];
  }
  return consulta;
}

/** Itens dos seletores de filtro; cada lista falha em silêncio (o filtro some). */
export interface PessoaDoFiltro {
  readonly id: string;
  readonly nome: string;
  readonly area: Area | null;
}
export interface LiderDoFiltro {
  readonly id: string;
  readonly nome: string;
  readonly area: Area | null;
}
export interface FunilDoFiltro {
  readonly id: string;
  readonly nome: string;
  readonly area: Area;
  readonly ativo: boolean;
}
export interface CanalDoFiltro {
  readonly id: string;
  readonly nome: string;
}
export interface FilaDoFiltro {
  readonly id: string;
  readonly nome: string;
  readonly area: Area | null;
}

@Injectable({ providedIn: 'root' })
export class BiApi {
  private readonly http = inject(HttpClient);

  async paineis(): Promise<readonly IdPainel[]> {
    const resposta = await firstValueFrom(
      this.http.get<{ readonly paineis: readonly string[] }>(urlApi('bi', 'paineis')),
    );
    return resposta.paineis.filter(ehPainel);
  }

  painel(id: IdPainel, filtros: FiltrosBi, semCache = false): Promise<RespostaPainel> {
    return firstValueFrom(
      this.http.get<RespostaPainel>(urlApi('bi', id), {
        params: parametros(consultaDosFiltros(id, filtros)),
        headers: semCache ? new HttpHeaders({ 'Cache-Control': 'no-cache' }) : undefined,
      }),
    );
  }

  /** Gera o arquivo; baixe-o com `arquivo.url` (a sessão vai no cookie). */
  exportar(
    id: IdPainel,
    filtros: FiltrosBi,
    formato: FormatoExportacao,
    tabela?: string,
  ): Promise<ArquivoExportado> {
    const corpo: Record<string, unknown> = { ...consultaDosFiltros(id, filtros), formato };
    for (const [chave, valor] of Object.entries(corpo)) {
      if (valor === null) {
        delete corpo[chave];
      }
    }
    if (tabela) {
      corpo['tabela'] = tabela;
    }
    return firstValueFrom(this.http.post<ArquivoExportado>(urlApi('bi', id, 'exportar'), corpo));
  }

  // Opções dos filtros ---------------------------------------------------------------------------

  async pessoas(): Promise<readonly PessoaDoFiltro[]> {
    const pagina = await firstValueFrom(
      this.http.get<Pagina<PessoaDoFiltro>>(urlApi('usuarios'), {
        params: parametros({ ativo: true, porPagina: 100 }),
      }),
    ).catch(() => null);
    return pagina?.itens ?? [];
  }

  async lideres(): Promise<readonly LiderDoFiltro[]> {
    const equipes = await firstValueFrom(
      this.http.get<
        readonly {
          readonly lider: {
            readonly usuario: {
              readonly id: string;
              readonly nome: string;
              readonly papel: Papel;
              readonly area: Area | null;
            };
          };
        }[]
      >(urlApi('usuarios', 'equipes')),
    ).catch(() => []);
    return equipes
      .map((equipe) => equipe.lider.usuario)
      .filter((lider) => LIDERES.includes(lider.papel))
      .map(({ id, nome, area }) => ({ id, nome, area }));
  }

  async funis(): Promise<readonly FunilDoFiltro[]> {
    const funis = await firstValueFrom(
      this.http.get<readonly FunilDoFiltro[]>(urlApi('funis')),
    ).catch(() => []);
    return funis.filter((funil) => funil.ativo);
  }

  async canais(): Promise<readonly CanalDoFiltro[]> {
    return firstValueFrom(
      this.http.get<readonly CanalDoFiltro[]>(urlApi('atendimento', 'canais')),
    ).catch(() => []);
  }

  async filas(): Promise<readonly FilaDoFiltro[]> {
    return firstValueFrom(
      this.http.get<readonly FilaDoFiltro[]>(urlApi('atendimento', 'filas')),
    ).catch(() => []);
  }
}
