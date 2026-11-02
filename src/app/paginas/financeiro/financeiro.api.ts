import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../nucleo/api/api';
import type {
  ConfiguracaoRegua,
  ConsultaContratos,
  ClienteEmRisco,
  ConsultaParcelas,
  Contrato,
  ContratoDetalhe,
  DadosBaixa,
  DadosContrato,
  DadosEtapa,
  DadosParcela,
  EnvioRegua,
  EtapaRegua,
  ExecucaoRegua,
  FiltrosParcelas,
  IndicadoresInadimplencia,
  IndicadoresMrr,
  IndicadoresPrevistoRealizado,
  LigacaoPendente,
  LinhaDoTempoParcela,
  Parcela,
  ResultadoLigacao,
  ResumoIndicadores,
  ResumoRegua,
  RiscoChurn,
  SugestaoContrato,
  TotaisParcelas,
} from './financeiro.tipos';

export interface ArquivoExportado {
  readonly id?: string;
  readonly nome: string;
  readonly url: string;
}

function filtrosDeParcelas(f: FiltrosParcelas) {
  return {
    status: f.status.join(',') || null,
    faixa: f.faixa,
    contratoId: f.contratoId,
    vencimentoDe: f.vencimentoDe,
    vencimentoAte: f.vencimentoAte,
    comPromessa: f.comPromessa || null,
    busca: f.busca.trim() || null,
  };
}

/** Chamadas do Financeiro. Toda falha chega como `ErroApi` (interceptor do núcleo). */
@Injectable({ providedIn: 'root' })
export class FinanceiroApi {
  private readonly http = inject(HttpClient);

  // ----- Contratos
  contratos(c: ConsultaContratos): Promise<Pagina<Contrato>> {
    return firstValueFrom(
      this.http.get<Pagina<Contrato>>(urlApi('financeiro', 'contratos'), {
        params: parametros({
          pagina: c.pagina,
          porPagina: c.porPagina,
          status: c.status.join(',') || null,
          busca: c.busca.trim() || null,
        }),
      }),
    );
  }

  contrato(id: string): Promise<ContratoDetalhe> {
    return firstValueFrom(this.http.get<ContratoDetalhe>(urlApi('financeiro', 'contratos', id)));
  }

  criarContrato(dados: DadosContrato): Promise<Contrato> {
    return firstValueFrom(this.http.post<Contrato>(urlApi('financeiro', 'contratos'), dados));
  }

  alterarContrato(id: string, dados: Record<string, unknown>): Promise<Contrato> {
    return firstValueFrom(this.http.patch<Contrato>(urlApi('financeiro', 'contratos', id), dados));
  }

  acaoContrato(
    id: string,
    acao: 'suspender' | 'reativar' | 'cancelar',
    corpo: Record<string, unknown> = {},
  ): Promise<Contrato> {
    return firstValueFrom(
      this.http.post<Contrato>(urlApi('financeiro', 'contratos', id, acao), corpo),
    );
  }

  maisParcelas(id: string, quantidade: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post(urlApi('financeiro', 'contratos', id, 'parcelas'), { quantidade }),
    );
  }

  sugestaoDeContrato(negocioId: string): Promise<SugestaoContrato> {
    return firstValueFrom(
      this.http.get<SugestaoContrato>(
        urlApi('financeiro', 'negocios', negocioId, 'sugestao-de-contrato'),
      ),
    );
  }

  // ----- Parcelas
  parcelas(c: ConsultaParcelas): Promise<Pagina<Parcela>> {
    return firstValueFrom(
      this.http.get<Pagina<Parcela>>(urlApi('financeiro', 'parcelas'), {
        params: parametros({ ...filtrosDeParcelas(c), pagina: c.pagina, porPagina: c.porPagina }),
      }),
    );
  }

  totaisDeParcelas(f: FiltrosParcelas): Promise<TotaisParcelas> {
    return firstValueFrom(
      this.http.get<TotaisParcelas>(urlApi('financeiro', 'parcelas', 'totais'), {
        params: parametros({ ...filtrosDeParcelas({ ...f, status: [] }) }),
      }),
    );
  }

  parcela(id: string): Promise<Parcela> {
    return firstValueFrom(this.http.get<Parcela>(urlApi('financeiro', 'parcelas', id)));
  }

  criarParcela(dados: DadosParcela): Promise<Parcela> {
    return firstValueFrom(this.http.post<Parcela>(urlApi('financeiro', 'parcelas'), dados));
  }

  alterarParcela(id: string, dados: Record<string, unknown>): Promise<Parcela> {
    return firstValueFrom(this.http.patch<Parcela>(urlApi('financeiro', 'parcelas', id), dados));
  }

  baixar(id: string, dados: DadosBaixa): Promise<Parcela> {
    return firstValueFrom(
      this.http.post<Parcela>(urlApi('financeiro', 'parcelas', id, 'baixa'), dados),
    );
  }

  cancelarParcela(id: string): Promise<Parcela> {
    return firstValueFrom(
      this.http.post<Parcela>(urlApi('financeiro', 'parcelas', id, 'cancelar'), {}),
    );
  }

  renegociar(id: string, dados: { vencimento: string; valor?: string }): Promise<Parcela> {
    return firstValueFrom(
      this.http.post<Parcela>(urlApi('financeiro', 'parcelas', id, 'renegociar'), dados),
    );
  }

  linhaDoTempo(id: string): Promise<LinhaDoTempoParcela> {
    return firstValueFrom(
      this.http.get<LinhaDoTempoParcela>(urlApi('financeiro', 'parcelas', id, 'linha-do-tempo')),
    );
  }

  exportarParcelas(formato: 'xlsx' | 'csv', f: FiltrosParcelas): Promise<ArquivoExportado> {
    return firstValueFrom(
      this.http.post<ArquivoExportado>(
        urlApi('financeiro', 'parcelas', 'exportar'),
        {},
        { params: parametros({ formato, ...filtrosDeParcelas(f) }) },
      ),
    );
  }

  // ----- Indicadores e risco
  resumoIndicadores(): Promise<ResumoIndicadores> {
    return firstValueFrom(
      this.http.get<ResumoIndicadores>(urlApi('financeiro', 'indicadores', 'resumo')),
    );
  }

  clientesEmRisco(limite = 10): Promise<readonly ClienteEmRisco[]> {
    return firstValueFrom(
      this.http.get<readonly ClienteEmRisco[]>(urlApi('financeiro', 'risco-churn'), {
        params: parametros({ nivelMinimo: 'MEDIO', limite }),
      }),
    );
  }

  mrr(): Promise<IndicadoresMrr> {
    return firstValueFrom(
      this.http.get<IndicadoresMrr>(urlApi('financeiro', 'indicadores', 'mrr')),
    );
  }

  inadimplencia(): Promise<IndicadoresInadimplencia> {
    return firstValueFrom(
      this.http.get<IndicadoresInadimplencia>(urlApi('financeiro', 'indicadores', 'inadimplencia')),
    );
  }

  previstoRealizado(): Promise<IndicadoresPrevistoRealizado> {
    return firstValueFrom(
      this.http.get<IndicadoresPrevistoRealizado>(
        urlApi('financeiro', 'indicadores', 'previsto-realizado'),
      ),
    );
  }

  async riscoDoContato(id: string): Promise<RiscoChurn | null> {
    const r = await firstValueFrom(
      this.http.get<{ risco: RiscoChurn | null }>(
        urlApi('financeiro', 'risco-churn', 'contatos', id),
      ),
    );
    return r.risco;
  }

  async riscoDoNegocio(id: string): Promise<RiscoChurn | null> {
    const r = await firstValueFrom(
      this.http.get<{ risco: RiscoChurn | null }>(
        urlApi('financeiro', 'risco-churn', 'negocios', id),
      ),
    );
    return r.risco;
  }

  // ----- Régua
  configuracaoRegua(): Promise<ConfiguracaoRegua> {
    return firstValueFrom(
      this.http.get<ConfiguracaoRegua>(urlApi('financeiro', 'regua', 'configuracao')),
    );
  }

  alterarConfiguracaoRegua(dados: Record<string, unknown>): Promise<ConfiguracaoRegua> {
    return firstValueFrom(
      this.http.patch<ConfiguracaoRegua>(urlApi('financeiro', 'regua', 'configuracao'), dados),
    );
  }

  pausarOuRetomar(acao: 'pausar' | 'retomar'): Promise<unknown> {
    return firstValueFrom(this.http.post(urlApi('financeiro', 'regua', acao), {}));
  }

  etapas(): Promise<readonly EtapaRegua[]> {
    return firstValueFrom(
      this.http.get<readonly EtapaRegua[]>(urlApi('financeiro', 'regua', 'etapas')),
    );
  }

  criarEtapa(dados: DadosEtapa): Promise<EtapaRegua> {
    return firstValueFrom(
      this.http.post<EtapaRegua>(urlApi('financeiro', 'regua', 'etapas'), dados),
    );
  }

  salvarEtapa(id: string, dados: DadosEtapa): Promise<EtapaRegua> {
    return firstValueFrom(
      this.http.put<EtapaRegua>(urlApi('financeiro', 'regua', 'etapas', id), dados),
    );
  }

  async excluirEtapa(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(urlApi('financeiro', 'regua', 'etapas', id)));
  }

  previa(texto: string): Promise<{ texto: string; erros: readonly string[] }> {
    return firstValueFrom(
      this.http.post<{ texto: string; erros: readonly string[] }>(
        urlApi('financeiro', 'regua', 'previa'),
        { texto },
      ),
    );
  }

  executarRegua(): Promise<ExecucaoRegua> {
    return firstValueFrom(
      this.http.post<ExecucaoRegua>(urlApi('financeiro', 'regua', 'executar'), {}),
    );
  }

  resumoRegua(dia?: string): Promise<ResumoRegua> {
    return firstValueFrom(
      this.http.get<ResumoRegua>(urlApi('financeiro', 'regua', 'resumo'), {
        params: parametros({ dia }),
      }),
    );
  }

  enviosRegua(f: {
    dia?: string;
    canal?: string | null;
    situacao?: string | null;
    pagina: number;
    porPagina?: number;
  }): Promise<Pagina<EnvioRegua>> {
    return firstValueFrom(
      this.http.get<Pagina<EnvioRegua>>(urlApi('financeiro', 'regua', 'envios'), {
        params: parametros({ ...f }),
      }),
    );
  }

  reenviar(dados: { canal?: string; dia?: string }): Promise<{ reenviados: number }> {
    return firstValueFrom(
      this.http.post<{ reenviados: number }>(urlApi('financeiro', 'regua', 'reenviar'), dados),
    );
  }

  ligacoes(pendentes: boolean): Promise<Pagina<LigacaoPendente> | readonly LigacaoPendente[]> {
    return firstValueFrom(
      this.http.get<Pagina<LigacaoPendente> | readonly LigacaoPendente[]>(
        urlApi('financeiro', 'regua', 'ligacoes'),
        { params: parametros({ pendentes }) },
      ),
    );
  }

  registrarLigacao(
    id: string,
    dados: { resultado: ResultadoLigacao; promessaAte?: string; observacao?: string },
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.post(urlApi('financeiro', 'regua', 'ligacoes', id, 'resultado'), dados),
    );
  }
}
