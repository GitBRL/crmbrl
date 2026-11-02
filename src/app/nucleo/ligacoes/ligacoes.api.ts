import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi } from '../api/api';
import type {
  CanalDeLigacao,
  ConfiguracaoLigacoes,
  ConfiguracaoWebrtc,
  DadosConfiguracaoLigacoes,
  DadosNovaLigacao,
  DadosPedidoPermissao,
  FiltrosLigacoes,
  Ligacao,
  LigacoesAtivas,
  PaginaLigacoes,
  PermissaoDeLigacao,
} from './ligacoes.tipos';

/**
 * Rotas de ligações da API (`crmbrl-api/src/ligacoes`, regra R29). Toda falha chega como
 * `ErroApi`, com `detalhes.motivo` (`sem_permissao`, `ja_em_ligacao`…) quando a regra explica.
 */
@Injectable({ providedIn: 'root' })
export class LigacoesApi {
  private readonly http = inject(HttpClient);

  configuracaoWebrtc(): Promise<ConfiguracaoWebrtc> {
    return firstValueFrom(
      this.http.get<ConfiguracaoWebrtc>(urlApi('ligacoes', 'configuracao-webrtc')),
    );
  }

  /** Canais com ligações ativas e botão visível (vazio: esconda o botão Ligar). */
  canais(): Promise<readonly CanalDeLigacao[]> {
    return firstValueFrom(this.http.get<CanalDeLigacao[]>(urlApi('ligacoes', 'canais')));
  }

  ativas(): Promise<LigacoesAtivas> {
    return firstValueFrom(this.http.get<LigacoesAtivas>(urlApi('ligacoes', 'ativas')));
  }

  permissao(
    contatoId: string,
    canalId?: string | null,
    atualizar = false,
  ): Promise<PermissaoDeLigacao> {
    return firstValueFrom(
      this.http.get<PermissaoDeLigacao>(urlApi('ligacoes', 'permissoes'), {
        params: parametros({ contatoId, canalId, atualizar }),
      }),
    );
  }

  pedirPermissao(dados: DadosPedidoPermissao): Promise<PermissaoDeLigacao> {
    return firstValueFrom(
      this.http.post<PermissaoDeLigacao>(urlApi('ligacoes', 'permissoes', 'pedir'), dados),
    );
  }

  listar(filtros: FiltrosLigacoes = {}): Promise<PaginaLigacoes> {
    return firstValueFrom(
      this.http.get<PaginaLigacoes>(urlApi('ligacoes'), { params: parametros({ ...filtros }) }),
    );
  }

  detalhar(id: string): Promise<Ligacao> {
    return firstValueFrom(this.http.get<Ligacao>(urlApi('ligacoes', id)));
  }

  ligar(dados: DadosNovaLigacao): Promise<Ligacao> {
    return firstValueFrom(this.http.post<Ligacao>(urlApi('ligacoes'), dados));
  }

  atender(id: string, sdp: string): Promise<Ligacao> {
    return firstValueFrom(this.http.post<Ligacao>(urlApi('ligacoes', id, 'atender'), { sdp }));
  }

  encerrar(id: string): Promise<Ligacao> {
    return firstValueFrom(this.http.post<Ligacao>(urlApi('ligacoes', id, 'encerrar'), {}));
  }

  anotar(id: string, anotacao: string | null): Promise<Ligacao> {
    return firstValueFrom(this.http.patch<Ligacao>(urlApi('ligacoes', id), { anotacao }));
  }

  // ----- Configuração do canal (só Admin) -------------------------------------------------------

  configuracao(canalId: string): Promise<ConfiguracaoLigacoes> {
    return firstValueFrom(
      this.http.get<ConfiguracaoLigacoes>(
        urlApi('whatsapp-oficial', 'canais', canalId, 'ligacoes'),
      ),
    );
  }

  salvarConfiguracao(
    canalId: string,
    dados: DadosConfiguracaoLigacoes,
  ): Promise<ConfiguracaoLigacoes> {
    return firstValueFrom(
      this.http.patch<ConfiguracaoLigacoes>(
        urlApi('whatsapp-oficial', 'canais', canalId, 'ligacoes'),
        dados,
      ),
    );
  }
}
