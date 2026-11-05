import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi } from '../../../nucleo/api/api';
import type {
  AplicativoDeConexao,
  ConexaoAplicativo,
  LoginIniciado,
  PedidoDeLoginDeAplicativo,
} from './login.tipos';

/** Conexões de aplicativo por login (Typeform e RD Station; Admin): R32.25 e R32.26. */
@Injectable({ providedIn: 'root' })
export class ConexoesAplicativoApi {
  private readonly http = inject(HttpClient);

  listar(aplicativo?: AplicativoDeConexao): Promise<readonly ConexaoAplicativo[]> {
    return firstValueFrom(
      this.http.get<readonly ConexaoAplicativo[]>(urlApi('conexoes-aplicativo'), {
        params: parametros({ aplicativo }),
      }),
    );
  }

  obter(id: string): Promise<ConexaoAplicativo> {
    return firstValueFrom(this.http.get<ConexaoAplicativo>(urlApi('conexoes-aplicativo', id)));
  }

  iniciarLogin(pedido: PedidoDeLoginDeAplicativo): Promise<LoginIniciado> {
    return firstValueFrom(
      this.http.post<LoginIniciado>(urlApi('conexoes-aplicativo', 'oauth', 'iniciar'), pedido),
    );
  }

  excluir(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('conexoes-aplicativo', id)));
  }
}
