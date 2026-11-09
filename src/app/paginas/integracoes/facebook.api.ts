import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi } from '../../nucleo/api/api';
import type { CampoDeIntegracao } from './tipos';
import type {
  ConexaoFacebook,
  ConfiguracaoFacebook,
  FormularioFacebook,
  LoginIniciado,
  PaginaFacebook,
  PedidoDeLogin,
  PedidoDeTokenDePagina,
} from './facebook.tipos';

/** Dados do assistente do Facebook Lead Ads (Admin): conexões, páginas, formulários e perguntas. */
@Injectable({ providedIn: 'root' })
export class FacebookApi {
  private readonly http = inject(HttpClient);

  configuracao(): Promise<ConfiguracaoFacebook> {
    return firstValueFrom(
      this.http.get<ConfiguracaoFacebook>(urlApi('webhooks', 'facebook', 'configuracao')),
    );
  }

  conexoes(): Promise<readonly ConexaoFacebook[]> {
    return firstValueFrom(
      this.http.get<readonly ConexaoFacebook[]>(urlApi('webhooks', 'facebook', 'conexoes')),
    );
  }

  conexao(id: string): Promise<ConexaoFacebook> {
    return firstValueFrom(
      this.http.get<ConexaoFacebook>(urlApi('webhooks', 'facebook', 'conexoes', id)),
    );
  }

  iniciarLogin(pedido: PedidoDeLogin): Promise<LoginIniciado> {
    return firstValueFrom(
      this.http.post<LoginIniciado>(urlApi('webhooks', 'facebook', 'oauth', 'iniciar'), pedido),
    );
  }

  conectarComTokenDePagina(pedido: PedidoDeTokenDePagina): Promise<ConexaoFacebook> {
    return firstValueFrom(
      this.http.post<ConexaoFacebook>(
        urlApi('webhooks', 'facebook', 'conexoes', 'token-de-pagina'),
        pedido,
      ),
    );
  }

  excluirConexao(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('webhooks', 'facebook', 'conexoes', id)));
  }

  atualizarPaginas(id: string): Promise<ConexaoFacebook> {
    return firstValueFrom(
      this.http.post<ConexaoFacebook>(
        urlApi('webhooks', 'facebook', 'conexoes', id, 'atualizar-paginas'),
        {},
      ),
    );
  }

  paginas(conexaoId: string, atualizar = false): Promise<readonly PaginaFacebook[]> {
    return firstValueFrom(
      this.http.get<readonly PaginaFacebook[]>(
        urlApi('webhooks', 'facebook', 'conexoes', conexaoId, 'paginas'),
        { params: parametros({ atualizar: atualizar || undefined }) },
      ),
    );
  }

  formularios(
    conexaoId: string,
    paginaId: string,
    busca?: string,
  ): Promise<readonly FormularioFacebook[]> {
    return firstValueFrom(
      this.http.get<readonly FormularioFacebook[]>(
        urlApi('webhooks', 'facebook', 'conexoes', conexaoId, 'paginas', paginaId, 'formularios'),
        { params: parametros({ busca }) },
      ),
    );
  }

  perguntas(
    conexaoId: string,
    paginaId: string,
    formularioId: string,
  ): Promise<readonly CampoDeIntegracao[]> {
    return firstValueFrom(
      this.http.get<readonly CampoDeIntegracao[]>(
        urlApi(
          'webhooks',
          'facebook',
          'conexoes',
          conexaoId,
          'paginas',
          paginaId,
          'formularios',
          formularioId,
          'perguntas',
        ),
      ),
    );
  }
}
