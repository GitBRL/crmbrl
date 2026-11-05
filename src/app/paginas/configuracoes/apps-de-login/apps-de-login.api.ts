import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../../nucleo/api/api';
import type { AplicativoDeLogin, AppDeLogin, DadosDoApp } from './apps-de-login.tipos';

/** Apps de login (Admin): `GET|PUT|DELETE /configuracoes/apps-de-login`. */
@Injectable({ providedIn: 'root' })
export class AppsDeLoginApi {
  private readonly http = inject(HttpClient);

  listar(): Promise<readonly AppDeLogin[]> {
    return firstValueFrom(
      this.http.get<readonly AppDeLogin[]>(urlApi('configuracoes', 'apps-de-login')),
    );
  }

  salvar(aplicativo: AplicativoDeLogin, dados: DadosDoApp): Promise<AppDeLogin> {
    return firstValueFrom(
      this.http.put<AppDeLogin>(urlApi('configuracoes', 'apps-de-login', aplicativo), dados),
    );
  }

  remover(aplicativo: AplicativoDeLogin): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(urlApi('configuracoes', 'apps-de-login', aplicativo)),
    );
  }
}
