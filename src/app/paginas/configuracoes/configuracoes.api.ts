import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, POR_PAGINA_MAXIMO, urlApi } from '../../nucleo/api/api';
import type { OpcaoDePessoa } from '../../ui/editor-de-acessos/editor-de-acessos';
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

  /**
   * Quem pode liderar (R1.2): os ativos com o papel de líder esperado — líderes do setor `area`
   * para quem é membro, C-levels para quem é líder.
   */
  async listarAtivosDoPapel(papel: Papel, area: Area | null = null): Promise<readonly Usuario[]> {
    const pagina = await this.listarUsuarios({
      papel,
      ...(area ? { area } : {}),
      ativo: true,
      porPagina: POR_PAGINA_MAXIMO,
    });
    return pagina.itens;
  }

  /**
   * Pessoas ativas de qualquer setor, em ordem de nome, para escolher a quem dar acesso
   * (`GET /usuarios/opcoes`: Admin, C-level e líderes). `busca` procura só no nome.
   */
  opcoesDePessoas(busca = '', limite = 20): Promise<readonly OpcaoDePessoa[]> {
    return firstValueFrom(
      this.http.get<readonly OpcaoDePessoa[]>(urlApi('usuarios', 'opcoes'), {
        params: parametros({ busca: busca.trim() || undefined, limite }),
      }),
    );
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

  /**
   * A própria foto de perfil (R2.10): envia a imagem como `AVATAR` (JPG, PNG, GIF ou WebP, até
   * 5 MB) e liga ao perfil. Devolve o novo endereço da foto.
   */
  async trocarMinhaFoto(arquivo: File): Promise<string | null> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    const enviado = await firstValueFrom(
      this.http.post<{ readonly id: string }>(urlApi('arquivos'), corpo, {
        params: parametros({ contexto: 'AVATAR' }),
      }),
    );
    const foto = await firstValueFrom(
      this.http.put<{ readonly avatarUrl: string | null }>(urlApi('usuarios', 'eu', 'foto'), {
        arquivoId: enviado.id,
      }),
    );
    return foto.avatarUrl;
  }

  /** Remove a própria foto de perfil (R2.10): volta às iniciais. */
  async removerMinhaFoto(): Promise<void> {
    await firstValueFrom(this.http.delete(urlApi('usuarios', 'eu', 'foto')));
  }

  /** Encerra as outras sessões da própria pessoa (outros navegadores e aparelhos); a atual continua (R2.2). */
  async encerrarOutrasSessoes(): Promise<number> {
    const resposta = await firstValueFrom(
      this.http.post<{ readonly encerradas: number }>(
        urlApi('auth', 'sessoes', 'encerrar-outras'),
        {},
      ),
    );
    return resposta.encerradas;
  }

  definirSenhaTemporaria(id: string, senha: string): Promise<Usuario> {
    return firstValueFrom(
      this.http.post<Usuario>(urlApi('usuarios', id, 'senha-temporaria'), { senha }),
    );
  }

  /** Admin: desliga a verificação em duas etapas de quem perdeu o aparelho (R2.11). */
  redefinirDoisFatores(id: string): Promise<Usuario> {
    return firstValueFrom(
      this.http.post<Usuario>(urlApi('usuarios', id, 'dois-fatores', 'redefinir'), {}),
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
