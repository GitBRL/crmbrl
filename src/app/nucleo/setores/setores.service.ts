import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../api/api';
import { SessaoService } from '../sessao/sessao.service';
import type { OpcaoSeletor } from '../../ui/seletor/seletor';
import { corDoSetor, definirRegistroDeSetores, nomeDoSetor, type Setor } from './setores';

/**
 * Setores dinâmicos (`GET /setores`), em cache e recarregáveis. Admin e C-level carregam também
 * os inativos (o nome deles continua valendo para os registros antigos); `ativos` é o que as
 * listas de escolha mostram.
 */
@Injectable({ providedIn: 'root' })
export class SetoresService {
  private readonly http = inject(HttpClient);
  private readonly sessao = inject(SessaoService);

  private readonly _todos = signal<readonly Setor[]>([]);
  private readonly _carregado = signal(false);
  private readonly _erro = signal(false);
  private carregamento: Promise<void> | null = null;

  /** Todos os que a API devolveu (com inativos para Admin e C-level). */
  readonly todos = this._todos.asReadonly();
  /** Setores ativos, na ordem da API: as escolhas de setor. */
  readonly ativos = computed(() => this._todos().filter((setor) => setor.ativo));
  /** Setores que usam o Atendimento: todos os ativos, menos o Marketing (R12). */
  readonly atendem = computed(() => this.ativos().filter((setor) => setor.chave !== 'MARKETING'));
  readonly carregado = this._carregado.asReadonly();
  readonly erro = this._erro.asReadonly();
  /** Opções prontas para o `app-seletor` (só ativos). */
  readonly opcoes = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.ativos().map((setor) => ({ valor: setor.chave, rotulo: setor.nome })),
  );

  /** Carrega uma vez; depois devolve o cache (use `forcar` ou `recarregar`). */
  carregar(forcar = false): Promise<void> {
    if (this.carregamento) {
      return this.carregamento;
    }
    if (this._carregado() && !forcar) {
      return Promise.resolve();
    }
    const incluirInativos = this.sessao.ehDiretoria();
    this.carregamento = firstValueFrom(
      this.http.get<readonly Setor[]>(urlApi('setores'), {
        params: incluirInativos ? { incluirInativos: 'true' } : {},
      }),
    )
      .then((lista) => {
        this._todos.set(lista);
        definirRegistroDeSetores(lista);
        this._carregado.set(true);
        this._erro.set(false);
      })
      .catch(() => {
        this._erro.set(true);
      })
      .finally(() => {
        this.carregamento = null;
      });
    return this.carregamento;
  }

  recarregar(): Promise<void> {
    return this.carregar(true);
  }

  /** Esquece o cache (ao sair). */
  limpar(): void {
    this._todos.set([]);
    this._carregado.set(false);
    definirRegistroDeSetores([]);
  }

  nome(chave: string | null | undefined): string {
    return nomeDoSetor(chave);
  }

  cor(chave: string | null | undefined): string | null {
    return corDoSetor(chave);
  }

  /** O setor existe e está ativo? */
  estaAtivo(chave: string | null | undefined): boolean {
    return !!chave && this.ativos().some((setor) => setor.chave === chave);
  }

  /** Escolhas de setor mais o setor atual de um registro antigo, mesmo inativo. */
  opcoesCom(chaveAtual: string | null | undefined): readonly OpcaoSeletor<string>[] {
    const base = this.opcoes();
    if (!chaveAtual || base.some((opcao) => opcao.valor === chaveAtual)) {
      return base;
    }
    return [...base, { valor: chaveAtual, rotulo: `${nomeDoSetor(chaveAtual)} (inativo)` }];
  }
}
