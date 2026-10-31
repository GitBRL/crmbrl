import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../nucleo/api/api';
import type {
  ArquivoCampanha,
  Campanha,
  CanalCampanha,
  CanalDisponivel,
  ConfiguracaoDisparos,
  ConsultaCampanhas,
  DadosCampanha,
  Destinatario,
  EstimativaEnvio,
  ImportacaoResumo,
  JanelaEnvioApi,
  ModeloMensagem,
  PreviaPublico,
  RelatorioCampanha,
  ResumoCampanha,
  RevisaoCampanha,
  RitmoCampanha,
  SegmentoApi,
  StatusDestinatario,
  TipoPublico,
} from './disparos.tipos';

export interface PedidoPreviaPublico {
  readonly canal: CanalCampanha;
  readonly tipoPublico: TipoPublico;
  readonly segmento?: SegmentoApi | null;
  readonly importacaoId?: string | null;
}

export interface PedidoEstimativa {
  readonly total: number;
  readonly canal: CanalCampanha;
  readonly canalIds?: readonly string[];
  readonly ritmo?: Partial<RitmoCampanha>;
  readonly janelaEnvio?: JanelaEnvioApi | null;
  readonly inicio?: string;
}

export interface ConsultaDestinatarios {
  readonly pagina: number;
  readonly porPagina: number;
  readonly status: readonly StatusDestinatario[];
  readonly busca: string;
  readonly respondeu: boolean | null;
}

export interface DadosModelo {
  nome: string;
  canal?: CanalCampanha | null;
  assunto?: string | null;
  texto: string;
  arquivoId?: string | null;
}

/** Chamadas dos Disparos. Toda falha chega como `ErroApi` (interceptor do núcleo). */
@Injectable({ providedIn: 'root' })
export class DisparosApi {
  private readonly http = inject(HttpClient);

  listar(consulta: ConsultaCampanhas): Promise<Pagina<ResumoCampanha>> {
    return firstValueFrom(
      this.http.get<Pagina<ResumoCampanha>>(urlApi('disparos', 'campanhas'), {
        params: parametros({
          pagina: consulta.pagina,
          porPagina: consulta.porPagina,
          status: consulta.status.join(',') || null,
          canal: consulta.canal,
          busca: consulta.busca.trim() || null,
          minhas: consulta.minhas || null,
        }),
      }),
    );
  }

  detalhar(id: string): Promise<Campanha> {
    return firstValueFrom(this.http.get<Campanha>(urlApi('disparos', 'campanhas', id)));
  }

  criar(dados: DadosCampanha): Promise<Campanha> {
    return firstValueFrom(this.http.post<Campanha>(urlApi('disparos', 'campanhas'), dados));
  }

  atualizar(id: string, dados: DadosCampanha): Promise<Campanha> {
    return firstValueFrom(this.http.patch<Campanha>(urlApi('disparos', 'campanhas', id), dados));
  }

  excluir(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('disparos', 'campanhas', id)));
  }

  duplicar(id: string): Promise<Campanha> {
    return this.acao(id, 'duplicar');
  }

  revisao(id: string): Promise<RevisaoCampanha> {
    return firstValueFrom(
      this.http.get<RevisaoCampanha>(urlApi('disparos', 'campanhas', id, 'revisao')),
    );
  }

  previa(
    id: string,
    contatoId?: string,
  ): Promise<{ texto: string; assunto: string | null; erros: readonly string[] }> {
    return firstValueFrom(
      this.http.post<{ texto: string; assunto: string | null; erros: readonly string[] }>(
        urlApi('disparos', 'campanhas', id, 'previa'),
        contatoId ? { contatoId } : {},
      ),
    );
  }

  enviarTeste(
    id: string,
    destino: { telefone?: string; email?: string } = {},
  ): Promise<{ conversaId: string; mensagemId: string; texto: string }> {
    return firstValueFrom(
      this.http.post<{ conversaId: string; mensagemId: string; texto: string }>(
        urlApi('disparos', 'campanhas', id, 'teste'),
        destino,
      ),
    );
  }

  previaPublico(pedido: PedidoPreviaPublico): Promise<PreviaPublico> {
    return firstValueFrom(
      this.http.post<PreviaPublico>(urlApi('disparos', 'previa-publico'), pedido),
    );
  }

  estimar(pedido: PedidoEstimativa): Promise<EstimativaEnvio> {
    return firstValueFrom(
      this.http.post<EstimativaEnvio>(urlApi('disparos', 'estimativa'), pedido),
    );
  }

  // Ciclo de vida -------------------------------------------------------------------------------

  iniciar(id: string, agendadaPara?: string | null): Promise<Campanha> {
    return this.acao(id, 'iniciar', agendadaPara ? { agendadaPara } : {});
  }

  aprovar(id: string): Promise<Campanha> {
    return this.acao(id, 'aprovar');
  }

  reprovar(id: string, motivo: string): Promise<Campanha> {
    return this.acao(id, 'reprovar', { motivo });
  }

  pausar(id: string, motivo?: string): Promise<Campanha> {
    return this.acao(id, 'pausar', motivo ? { motivo } : {});
  }

  retomar(id: string): Promise<Campanha> {
    return this.acao(id, 'retomar');
  }

  cancelar(id: string): Promise<Campanha> {
    return this.acao(id, 'cancelar');
  }

  reenviarFalhas(id: string): Promise<{ campanha: Campanha; reenfileirados: number }> {
    return firstValueFrom(
      this.http.post<{ campanha: Campanha; reenfileirados: number }>(
        urlApi('disparos', 'campanhas', id, 'reenviar-falhas'),
        {},
      ),
    );
  }

  private acao(id: string, acao: string, corpo: object = {}): Promise<Campanha> {
    return firstValueFrom(
      this.http.post<Campanha>(urlApi('disparos', 'campanhas', id, acao), corpo),
    );
  }

  // Destinatários e relatório -------------------------------------------------------------------

  destinatarios(id: string, consulta: ConsultaDestinatarios): Promise<Pagina<Destinatario>> {
    return firstValueFrom(
      this.http.get<Pagina<Destinatario>>(urlApi('disparos', 'campanhas', id, 'destinatarios'), {
        params: parametros({
          pagina: consulta.pagina,
          porPagina: consulta.porPagina,
          status: consulta.status.join(',') || null,
          busca: consulta.busca.trim() || null,
          respondeu: consulta.respondeu,
        }),
      }),
    );
  }

  relatorio(id: string, agrupar: 'hora' | 'dia'): Promise<RelatorioCampanha> {
    return firstValueFrom(
      this.http.get<RelatorioCampanha>(urlApi('disparos', 'campanhas', id, 'relatorio'), {
        params: parametros({ agrupar }),
      }),
    );
  }

  /** Gera a planilha; o arquivo vem em `url` (baixe com a sessão). */
  exportar(id: string, formato: 'xlsx' | 'csv'): Promise<ArquivoCampanha> {
    return firstValueFrom(
      this.http.post<ArquivoCampanha>(urlApi('disparos', 'campanhas', id, 'exportar'), {
        formato,
      }),
    );
  }

  // Configuração --------------------------------------------------------------------------------

  configuracao(): Promise<ConfiguracaoDisparos> {
    return firstValueFrom(this.http.get<ConfiguracaoDisparos>(urlApi('disparos', 'configuracao')));
  }

  salvarConfiguracao(dados: Partial<ConfiguracaoDisparos>): Promise<ConfiguracaoDisparos> {
    return firstValueFrom(
      this.http.put<ConfiguracaoDisparos>(urlApi('disparos', 'configuracao'), dados),
    );
  }

  // Modelos de mensagem -------------------------------------------------------------------------

  modelos(canal?: CanalCampanha): Promise<Pagina<ModeloMensagem>> {
    return firstValueFrom(
      this.http.get<Pagina<ModeloMensagem>>(urlApi('modelos-mensagem'), {
        params: parametros({ canal, porPagina: 100 }),
      }),
    );
  }

  criarModelo(dados: DadosModelo): Promise<ModeloMensagem> {
    return firstValueFrom(this.http.post<ModeloMensagem>(urlApi('modelos-mensagem'), dados));
  }

  excluirModelo(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('modelos-mensagem', id)));
  }

  /** Variáveis aceitas no texto (`/modelos/variaveis`), com os campos personalizados do contato. */
  async variaveis(): Promise<readonly { id: string; rotulo: string }[]> {
    const r = await firstValueFrom(
      this.http.get<{
        variaveis: { chave: string; rotulo: string }[];
        camposPersonalizados?: { contato?: string[] };
      }>(urlApi('modelos', 'variaveis')),
    );
    return [
      ...r.variaveis.map((v) => ({ id: v.chave, rotulo: v.rotulo })),
      ...(r.camposPersonalizados?.contato ?? []).map((chave) => ({
        id: `contato.campos.${chave}`,
        rotulo: `Campo “${chave}”`,
      })),
    ];
  }

  // Apoio ---------------------------------------------------------------------------------------

  /** Canais de atendimento ativos (o líder não lê `/whatsapp/numeros`; este serve a todos). */
  canais(): Promise<readonly CanalDisponivel[]> {
    return firstValueFrom(this.http.get<CanalDisponivel[]>(urlApi('disparos', 'canais')));
  }

  importacoesConcluidas(): Promise<Pagina<ImportacaoResumo>> {
    return firstValueFrom(
      this.http.get<Pagina<ImportacaoResumo>>(urlApi('importacoes'), {
        params: parametros({ status: 'CONCLUIDA', porPagina: 100 }),
      }),
    );
  }

  /** Sobe a mídia da campanha (`contexto=CAMPANHA`). */
  enviarMidia(arquivo: File): Promise<ArquivoCampanha> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    return firstValueFrom(
      this.http.post<ArquivoCampanha>(urlApi('arquivos'), corpo, {
        params: parametros({ contexto: 'CAMPANHA' }),
      }),
    );
  }
}
