import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, POR_PAGINA_MAXIMO, urlApi } from '../../nucleo/api/api';
import type { Papel } from '../../nucleo/papeis';
import type { Area } from '../../nucleo/sessao/perfil';
import type {
  ConviteEnviado,
  DadosEdicaoUsuario,
  DadosNovoUsuario,
  DadosReativacao,
  Equipe,
  FiltrosUsuarios,
  Passagem,
  PreviaDesligamento,
  RegraDistribuicao,
  ResultadoDesligamento,
  Usuario,
  UsuarioCriado,
} from './configuracoes.modelos';

/**
 * Dados de Configurações (TELAS-FASE1 §6): usuários, desligamento, visão de equipe, rodízio e
 * passagens. Toda falha chega como `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracoesApi {
  private readonly http = inject(HttpClient);

  // Usuários ---------------------------------------------------------------------------------

  listarUsuarios(filtros: FiltrosUsuarios = {}): Promise<Pagina<Usuario>> {
    return firstValueFrom(
      this.http.get<Pagina<Usuario>>(urlApi('usuarios'), { params: parametros({ ...filtros }) }),
    );
  }

  /** Quem pode liderar quem tem o papel (R1.2): os ativos com o papel de líder esperado. */
  async listarAtivosDoPapel(papel: Papel): Promise<readonly Usuario[]> {
    const pagina = await this.listarUsuarios({ papel, ativo: true, porPagina: POR_PAGINA_MAXIMO });
    return pagina.itens;
  }

  detalharUsuario(id: string): Promise<Usuario> {
    return firstValueFrom(this.http.get<Usuario>(urlApi('usuarios', id)));
  }

  criarUsuario(dados: DadosNovoUsuario): Promise<UsuarioCriado> {
    return firstValueFrom(this.http.post<UsuarioCriado>(urlApi('usuarios'), dados));
  }

  atualizarUsuario(id: string, dados: DadosEdicaoUsuario): Promise<Usuario> {
    return firstValueFrom(this.http.patch<Usuario>(urlApi('usuarios', id), dados));
  }

  definirSenhaTemporaria(id: string, senha: string): Promise<Usuario> {
    return firstValueFrom(
      this.http.post<Usuario>(urlApi('usuarios', id, 'senha-temporaria'), { senha }),
    );
  }

  reenviarConvite(id: string): Promise<ConviteEnviado> {
    return firstValueFrom(this.http.post<ConviteEnviado>(urlApi('usuarios', id, 'convite'), {}));
  }

  previaDesligamento(id: string, destinatarioId?: string | null): Promise<PreviaDesligamento> {
    return firstValueFrom(
      this.http.get<PreviaDesligamento>(urlApi('usuarios', id, 'desligamento', 'previa'), {
        params: parametros({ destinatarioId }),
      }),
    );
  }

  desligar(id: string, destinatarioId?: string | null): Promise<ResultadoDesligamento> {
    return firstValueFrom(
      this.http.post<ResultadoDesligamento>(
        urlApi('usuarios', id, 'desligar'),
        destinatarioId ? { destinatarioId } : {},
      ),
    );
  }

  reativar(id: string, dados: DadosReativacao): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>(urlApi('usuarios', id, 'reativar'), dados));
  }

  equipes(): Promise<readonly Equipe[]> {
    return firstValueFrom(this.http.get<readonly Equipe[]>(urlApi('usuarios', 'equipes')));
  }

  // Distribuição de leads (R5.8) -------------------------------------------------------------

  regrasDistribuicao(): Promise<readonly RegraDistribuicao[]> {
    return firstValueFrom(
      this.http.get<readonly RegraDistribuicao[]>(urlApi('regras-distribuicao')),
    );
  }

  definirIncluirLideres(area: Area, incluirLideres: boolean): Promise<RegraDistribuicao> {
    return firstValueFrom(
      this.http.patch<RegraDistribuicao>(urlApi('regras-distribuicao', area), { incluirLideres }),
    );
  }

  definirParticipacao(
    area: Area,
    usuarioId: string,
    participa: boolean,
  ): Promise<RegraDistribuicao> {
    return firstValueFrom(
      this.http.put<RegraDistribuicao>(
        urlApi('regras-distribuicao', area, 'participantes', usuarioId),
        { participa },
      ),
    );
  }

  /** Desfaz o ajuste manual: a pessoa volta a seguir a regra. */
  removerAjuste(area: Area, usuarioId: string): Promise<RegraDistribuicao> {
    return firstValueFrom(
      this.http.delete<RegraDistribuicao>(
        urlApi('regras-distribuicao', area, 'participantes', usuarioId),
      ),
    );
  }

  // Passagens entre funis (R5.7) -------------------------------------------------------------

  passagens(): Promise<readonly Passagem[]> {
    return firstValueFrom(this.http.get<readonly Passagem[]>(urlApi('passagens')));
  }

  definirPassagemAtiva(id: string, ativa: boolean): Promise<Passagem> {
    return firstValueFrom(this.http.patch<Passagem>(urlApi('passagens', id), { ativa }));
  }
}
