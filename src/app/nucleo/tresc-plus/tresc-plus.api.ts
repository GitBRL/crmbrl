import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom as primeiro, type Observable } from 'rxjs';

import { parametros, urlApi } from '../api/api';
import { ErroApi, erroDaApi } from '../api/erro-api';
import type {
  CampanhaTresc,
  ConexaoTrescPlus,
  DadosConexaoTrescPlus,
  DadosEnviarAoDiscador,
  DadosLigarTresc,
  DadosQualificar,
  EstadoDoAgenteApi,
  LigacaoTrescCriada,
  ListaTresc,
  ModoDoAgente,
  PausaTresc,
  QualificacaoTresc,
  RelatorioDoDiscador,
  ResultadoDoTeste,
  VinculoDoUsuario,
} from './tresc-plus.tipos';

export const MENSAGEM_ENDERECO_NAO_PERMITIDO =
  'O endereço do 3C+ configurado não é permitido. Fale com o Admin.';

/** Como `firstValueFrom`, trocando o 422 `endereco_nao_permitido` por uma mensagem clara. */
function firstValueFrom<T>(origem: Observable<T>): Promise<T> {
  return primeiro(origem).catch((falha: unknown) => {
    const erro = erroDaApi(falha);
    if (erro.detalhes?.['motivo'] === 'endereco_nao_permitido') {
      throw new ErroApi({
        status: erro.status,
        codigo: erro.codigo,
        mensagemDaApi: MENSAGEM_ENDERECO_NAO_PERMITIDO,
        detalhes: erro.detalhes,
        requisicaoId: erro.requisicaoId,
      });
    }
    throw falha;
  });
}

/** Rotas `/api/v1/tresc-plus` (R34). Toda falha chega como `ErroApi` (`detalhes.motivo`). */
@Injectable({ providedIn: 'root' })
export class TrescPlusApi {
  private readonly http = inject(HttpClient);

  // Admin -----------------------------------------------------------------------------------
  conexao(): Promise<ConexaoTrescPlus> {
    return firstValueFrom(this.http.get<ConexaoTrescPlus>(urlApi('tresc-plus', 'conexao')));
  }

  alterarConexao(dados: DadosConexaoTrescPlus): Promise<ConexaoTrescPlus> {
    return firstValueFrom(
      this.http.patch<ConexaoTrescPlus>(urlApi('tresc-plus', 'conexao'), dados),
    );
  }

  testarConexao(): Promise<ResultadoDoTeste> {
    return firstValueFrom(
      this.http.post<ResultadoDoTeste>(urlApi('tresc-plus', 'conexao', 'testar'), {}),
    );
  }

  reconciliar(): Promise<unknown> {
    return firstValueFrom(this.http.post<unknown>(urlApi('tresc-plus', 'reconciliar'), {}));
  }

  vinculos(): Promise<readonly VinculoDoUsuario[]> {
    return firstValueFrom(this.http.get<VinculoDoUsuario[]>(urlApi('tresc-plus', 'vinculos')));
  }

  desvincular(usuarioId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('tresc-plus', 'vinculos', usuarioId)));
  }

  // Vínculo do vendedor ---------------------------------------------------------------------
  vinculo(): Promise<VinculoDoUsuario> {
    return firstValueFrom(this.http.get<VinculoDoUsuario>(urlApi('tresc-plus', 'vinculo')));
  }

  vincular(usuario: string, senha: string): Promise<VinculoDoUsuario> {
    return firstValueFrom(
      this.http.post<VinculoDoUsuario>(urlApi('tresc-plus', 'vinculo'), { usuario, senha }),
    );
  }

  desconectar(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('tresc-plus', 'vinculo')));
  }

  // Agente ----------------------------------------------------------------------------------
  agente(atualizar = false): Promise<EstadoDoAgenteApi> {
    return firstValueFrom(
      this.http.get<EstadoDoAgenteApi>(urlApi('tresc-plus', 'agente'), {
        params: parametros({ atualizar }),
      }),
    );
  }

  campanhasDoAgente(): Promise<readonly CampanhaTresc[]> {
    return firstValueFrom(
      this.http.get<CampanhaTresc[]>(urlApi('tresc-plus', 'agente', 'campanhas')),
    );
  }

  entrar(campanhaId?: number, modo?: ModoDoAgente): Promise<EstadoDoAgenteApi> {
    return firstValueFrom(
      this.http.post<EstadoDoAgenteApi>(urlApi('tresc-plus', 'agente', 'entrar'), {
        ...(campanhaId ? { campanhaId } : {}),
        ...(modo ? { modo } : {}),
      }),
    );
  }

  sair(): Promise<unknown> {
    return firstValueFrom(this.http.post<unknown>(urlApi('tresc-plus', 'agente', 'sair'), {}));
  }

  pausas(): Promise<readonly PausaTresc[]> {
    return firstValueFrom(this.http.get<PausaTresc[]>(urlApi('tresc-plus', 'agente', 'pausas')));
  }

  entrarNaPausa(intervaloId: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(urlApi('tresc-plus', 'agente', 'pausa'), { intervaloId }),
    );
  }

  sairDaPausa(): Promise<unknown> {
    return firstValueFrom(this.http.delete<unknown>(urlApi('tresc-plus', 'agente', 'pausa')));
  }

  // Ligação ---------------------------------------------------------------------------------
  ligar(dados: DadosLigarTresc): Promise<LigacaoTrescCriada> {
    return firstValueFrom(
      this.http.post<LigacaoTrescCriada>(urlApi('tresc-plus', 'ligacoes'), dados),
    );
  }

  desligar(ligacaoId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(urlApi('tresc-plus', 'ligacoes', ligacaoId, 'desligar'), {}),
    );
  }

  qualificacoes(ligacaoId: string): Promise<readonly QualificacaoTresc[]> {
    return firstValueFrom(
      this.http.get<QualificacaoTresc[]>(
        urlApi('tresc-plus', 'ligacoes', ligacaoId, 'qualificacoes'),
      ),
    );
  }

  qualificar(ligacaoId: string, dados: DadosQualificar): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(urlApi('tresc-plus', 'ligacoes', ligacaoId, 'qualificar'), dados),
    );
  }

  // Discador --------------------------------------------------------------------------------
  campanhas(): Promise<readonly CampanhaTresc[]> {
    return firstValueFrom(this.http.get<CampanhaTresc[]>(urlApi('tresc-plus', 'campanhas')));
  }

  listas(campanhaId: number): Promise<readonly ListaTresc[]> {
    return firstValueFrom(
      this.http.get<ListaTresc[]>(urlApi('tresc-plus', 'campanhas', campanhaId, 'listas')),
    );
  }

  enviarAoDiscador(dados: DadosEnviarAoDiscador): Promise<RelatorioDoDiscador> {
    return firstValueFrom(
      this.http.post<RelatorioDoDiscador>(urlApi('tresc-plus', 'discador', 'enviar'), dados),
    );
  }
}
