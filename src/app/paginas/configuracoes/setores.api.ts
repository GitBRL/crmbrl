import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../nucleo/api/api';
import type { CorDoSetor, Setor } from '../../nucleo/setores/setores';
import type { AcessoFunil, LinhaDeAcesso } from '../funis/funis.tipos';

/** Corpo do `POST /setores`. */
export interface NovoSetor {
  readonly nome: string;
  readonly descricao?: string;
  readonly cor?: CorDoSetor;
  readonly ordem?: number;
  readonly lideres?: readonly string[];
  readonly cLevelResponsavelId?: string;
}

/** Corpo do `PATCH /setores/:chave`. */
export interface AlteracaoSetor {
  readonly nome?: string;
  readonly descricao?: string | null;
  readonly cor?: CorDoSetor;
  readonly ordem?: number;
}

/** Resposta de `GET` e `PUT /setores/:chave/acessos`. */
export interface AcessosDoSetor {
  readonly area: string;
  readonly nomeSetor: string;
  readonly acessos: readonly AcessoFunil[];
}

/** Gestão de setores (R1.6–R1.11) e "quem mais vê o setor" (R5.11). Falhas chegam como `ErroApi`. */
@Injectable({ providedIn: 'root' })
export class SetoresApi {
  private readonly http = inject(HttpClient);

  criar(dados: NovoSetor): Promise<Setor> {
    return firstValueFrom(this.http.post<Setor>(urlApi('setores'), dados));
  }

  alterar(chave: string, alteracao: AlteracaoSetor): Promise<Setor> {
    return firstValueFrom(this.http.patch<Setor>(urlApi('setores', chave), alteracao));
  }

  desativar(chave: string): Promise<Setor> {
    return firstValueFrom(this.http.post<Setor>(urlApi('setores', chave, 'desativar'), {}));
  }

  reativar(chave: string): Promise<Setor> {
    return firstValueFrom(this.http.post<Setor>(urlApi('setores', chave, 'reativar'), {}));
  }

  acessos(chave: string): Promise<AcessosDoSetor> {
    return firstValueFrom(this.http.get<AcessosDoSetor>(urlApi('setores', chave, 'acessos')));
  }

  /** A lista enviada substitui a atual. */
  substituirAcessos(chave: string, acessos: readonly LinhaDeAcesso[]): Promise<AcessosDoSetor> {
    return firstValueFrom(
      this.http.put<AcessosDoSetor>(urlApi('setores', chave, 'acessos'), { acessos }),
    );
  }
}
