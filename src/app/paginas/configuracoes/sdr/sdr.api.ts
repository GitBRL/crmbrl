import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { urlApi } from '../../../nucleo/api/api';
import type { Automacao, PassoApi } from '../../automacoes/automacoes.tipos';
import type {
  ArtigoSdr,
  AtualizacaoConfiguracaoSdr,
  AutomacaoQueAvisa,
  CamposDisponiveis,
  CanalSdr,
  CorpoArtigo,
  CorpoCriterio,
  CriterioSdr,
  GeralSdr,
  MensagemSimulador,
  ModoSdr,
  TurnoSimulador,
  UsoSdr,
  ValorSimulador,
  VersaoArtigo,
} from './sdr.tipos';

const EVENTOS_DE_LEAD_NOVO: readonly string[] = ['contato.criado', 'conversa.criada'];
const PASSOS_QUE_ESCREVEM: readonly string[] = ['acao.whatsapp', 'acao.chatbot'];

function temPassoQueEscreve(passos: readonly PassoApi[] | undefined): boolean {
  return (passos ?? []).some(
    (passo) =>
      PASSOS_QUE_ESCREVEM.includes(passo.tipo) ||
      (passo.ramos ?? []).some((ramo) => temPassoQueEscreve(ramo.passos)),
  );
}

/**
 * As automações ligadas que escrevem ao lead logo que ele chega (contato ou conversa criada):
 * a mensagem sai antes da resposta da IA.
 */
export function automacoesQueAvisam(lista: readonly Automacao[]): readonly AutomacaoQueAvisa[] {
  return lista
    .filter(
      (a) =>
        a.ativa &&
        a.tipoGatilho === 'EVENTO' &&
        a.evento !== null &&
        EVENTOS_DE_LEAD_NOVO.includes(a.evento) &&
        temPassoQueEscreve(a.definicao?.passos),
    )
    .map((a) => ({ id: a.id, nome: a.nome }));
}

/** Chamadas de `/sdr` da configuração e do simulador (só Admin). */
@Injectable({ providedIn: 'root' })
export class SdrConfigApi {
  private readonly http = inject(HttpClient);

  geral(): Promise<GeralSdr> {
    return firstValueFrom(this.http.get<GeralSdr>(urlApi('sdr', 'configuracao')));
  }

  salvarGeral(corpo: AtualizacaoConfiguracaoSdr): Promise<GeralSdr['configuracao']> {
    return firstValueFrom(
      this.http.put<GeralSdr['configuracao'] | GeralSdr>(urlApi('sdr', 'configuracao'), corpo),
    ).then((r) => ('configuracao' in r ? r.configuracao : r));
  }

  canais(): Promise<readonly CanalSdr[]> {
    return firstValueFrom(this.http.get<readonly CanalSdr[]>(urlApi('sdr', 'canais')));
  }

  definirModo(canalId: string, modo: ModoSdr): Promise<unknown> {
    return firstValueFrom(this.http.put(urlApi('sdr', 'canais', canalId), { modo }));
  }

  /** Automações ligadas que mandam mensagem a todo lead novo; falha vira lista vazia. */
  async automacoesQueAvisam(): Promise<readonly AutomacaoQueAvisa[]> {
    try {
      const pagina = await firstValueFrom(
        this.http.get<{ itens: readonly Automacao[] }>(urlApi('automacoes'), {
          params: { ativa: true, porPagina: 100 },
        }),
      );
      return automacoesQueAvisam(pagina.itens);
    } catch {
      return [];
    }
  }

  uso(): Promise<UsoSdr> {
    return firstValueFrom(this.http.get<UsoSdr>(urlApi('sdr', 'uso')));
  }

  // Base de conhecimento ----------------------------------------------------------------------

  artigos(): Promise<readonly ArtigoSdr[]> {
    return firstValueFrom(this.http.get<readonly ArtigoSdr[]>(urlApi('sdr', 'artigos')));
  }

  criarArtigo(corpo: CorpoArtigo): Promise<ArtigoSdr> {
    return firstValueFrom(this.http.post<ArtigoSdr>(urlApi('sdr', 'artigos'), corpo));
  }

  atualizarArtigo(id: string, corpo: CorpoArtigo): Promise<ArtigoSdr> {
    return firstValueFrom(this.http.put<ArtigoSdr>(urlApi('sdr', 'artigos', id), corpo));
  }

  excluirArtigo(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('sdr', 'artigos', id)));
  }

  versoes(id: string): Promise<readonly VersaoArtigo[]> {
    return firstValueFrom(
      this.http.get<readonly VersaoArtigo[]>(urlApi('sdr', 'artigos', id, 'versoes')),
    );
  }

  restaurarVersao(id: string, numero: number): Promise<ArtigoSdr> {
    return firstValueFrom(
      this.http.post<ArtigoSdr>(urlApi('sdr', 'artigos', id, 'versoes', numero, 'restaurar'), {}),
    );
  }

  // Critérios ---------------------------------------------------------------------------------

  criterios(): Promise<readonly CriterioSdr[]> {
    return firstValueFrom(this.http.get<readonly CriterioSdr[]>(urlApi('sdr', 'criterios')));
  }

  camposDisponiveis(): Promise<CamposDisponiveis> {
    return firstValueFrom(this.http.get<CamposDisponiveis>(urlApi('sdr', 'campos-disponiveis')));
  }

  criarCriterio(corpo: CorpoCriterio): Promise<CriterioSdr> {
    return firstValueFrom(this.http.post<CriterioSdr>(urlApi('sdr', 'criterios'), corpo));
  }

  atualizarCriterio(id: string, corpo: CorpoCriterio): Promise<CriterioSdr> {
    return firstValueFrom(this.http.put<CriterioSdr>(urlApi('sdr', 'criterios', id), corpo));
  }

  excluirCriterio(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('sdr', 'criterios', id)));
  }

  reordenarCriterios(ids: readonly string[]): Promise<unknown> {
    return firstValueFrom(this.http.put(urlApi('sdr', 'criterios', 'ordem'), { ids }));
  }

  aplicarModelo(): Promise<{ criados: number }> {
    return firstValueFrom(
      this.http.post<{ criados: number }>(urlApi('sdr', 'criterios', 'modelo-captacao'), {}),
    );
  }

  // Simulador ---------------------------------------------------------------------------------

  turnoDoSimulador(
    mensagens: readonly MensagemSimulador[],
    valores: readonly ValorSimulador[],
  ): Promise<TurnoSimulador> {
    return firstValueFrom(
      this.http.post<TurnoSimulador>(urlApi('sdr', 'simulador', 'turno'), { mensagens, valores }),
    );
  }
}
