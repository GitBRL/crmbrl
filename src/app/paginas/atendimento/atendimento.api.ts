import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map, type Observable } from 'rxjs';

import { type Pagina, parametros, POR_PAGINA_MAXIMO, urlApi } from '../../nucleo/api/api';
import type {
  AlteracaoConversa,
  Arquivo,
  Atendente,
  AtividadeDoContato,
  Atribuicao,
  CanalDoAtendimento,
  ContatoDoPainel,
  ConversaDetalhe,
  EnvioDeTemplate,
  Fila,
  FiltrosConversas,
  MensagemDaConversa,
  NegocioDoContato,
  NovoNegocioDaConversa,
  PaginaConversas,
  PaginaMensagens,
  RespostaRapida,
  TemplatesDaConversa,
  Transferencia,
} from './atendimento.tipos';

/** Conversas por página da lista (a API aceita até 100). */
export const CONVERSAS_POR_PAGINA = 30;
/** Mensagens por página (as mais novas primeiro, por cursor). */
export const MENSAGENS_POR_PAGINA = 40;

/**
 * Dados da caixa de entrada (`crmbrl-api`, ConversasController e os controllers de
 * configuração do Atendimento) e as leituras do painel do contato (contatos, negócios e
 * atividades). Leituras devolvem `Observable`; gravações, `Promise`. As falhas chegam como
 * `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class AtendimentoApi {
  private readonly http = inject(HttpClient);

  // ----- Conversas ---------------------------------------------------------------------------

  conversas(filtros: FiltrosConversas): Observable<PaginaConversas> {
    return this.http.get<PaginaConversas>(urlApi('atendimento', 'conversas'), {
      params: parametros({ ...filtros }),
    });
  }

  conversa(id: string): Observable<ConversaDetalhe> {
    return this.http.get<ConversaDetalhe>(urlApi('atendimento', 'conversas', id));
  }

  etiquetas(): Observable<readonly string[]> {
    return this.http.get<string[]>(urlApi('atendimento', 'etiquetas'));
  }

  atendentes(): Observable<readonly Atendente[]> {
    return this.http.get<Atendente[]>(urlApi('atendimento', 'atendentes'));
  }

  filas(): Observable<readonly Fila[]> {
    return this.http.get<Fila[]>(urlApi('atendimento', 'filas'));
  }

  canais(): Observable<readonly CanalDoAtendimento[]> {
    return this.http.get<CanalDoAtendimento[]>(urlApi('atendimento', 'canais'));
  }

  respostasRapidas(): Observable<readonly RespostaRapida[]> {
    return this.http.get<RespostaRapida[]>(urlApi('atendimento', 'respostas-rapidas'));
  }

  atribuicoes(id: string): Observable<readonly Atribuicao[]> {
    return this.http.get<Atribuicao[]>(urlApi('atendimento', 'conversas', id, 'atribuicoes'));
  }

  atualizar(id: string, alteracao: AlteracaoConversa): Promise<ConversaDetalhe> {
    return firstValueFrom(
      this.http.patch<ConversaDetalhe>(urlApi('atendimento', 'conversas', id), alteracao),
    );
  }

  assumir(id: string): Promise<ConversaDetalhe> {
    return this.acao(id, 'assumir', {});
  }

  transferir(id: string, transferencia: Transferencia): Promise<ConversaDetalhe> {
    return this.acao(id, 'transferir', transferencia);
  }

  resolver(id: string, enviarPesquisa: boolean): Promise<ConversaDetalhe> {
    return this.acao(id, 'resolver', { enviarPesquisa });
  }

  reabrir(id: string): Promise<ConversaDetalhe> {
    return this.acao(id, 'reabrir', {});
  }

  marcarLida(id: string): Promise<ConversaDetalhe> {
    return this.acao(id, 'lida', {});
  }

  criarNegocio(id: string, dados: NovoNegocioDaConversa): Promise<{ readonly id: string }> {
    return firstValueFrom(
      this.http.post<{ id: string }>(urlApi('atendimento', 'conversas', id, 'negocio'), dados),
    );
  }

  // ----- Mensagens ---------------------------------------------------------------------------

  mensagens(id: string, cursor: string | null = null): Observable<PaginaMensagens> {
    return this.http.get<PaginaMensagens>(urlApi('atendimento', 'conversas', id, 'mensagens'), {
      params: parametros({ cursor, limite: MENSAGENS_POR_PAGINA }),
    });
  }

  enviar(
    id: string,
    dados: {
      readonly texto?: string;
      readonly arquivoId?: string;
      /** Template aprovado (WhatsApp oficial); não vai junto com `texto`. */
      readonly template?: EnvioDeTemplate;
    },
  ): Promise<MensagemDaConversa> {
    return firstValueFrom(
      this.http.post<MensagemDaConversa>(
        urlApi('atendimento', 'conversas', id, 'mensagens'),
        dados,
      ),
    );
  }

  /** Templates aprovados que a conversa pode usar (`suportado: false` nos canais sem templates). */
  templates(id: string): Observable<TemplatesDaConversa> {
    return this.http.get<TemplatesDaConversa>(urlApi('atendimento', 'conversas', id, 'templates'));
  }

  nota(id: string, texto: string): Promise<MensagemDaConversa> {
    return firstValueFrom(
      this.http.post<MensagemDaConversa>(urlApi('atendimento', 'conversas', id, 'notas'), {
        texto,
      }),
    );
  }

  reenviar(id: string, mensagemId: string): Promise<MensagemDaConversa> {
    return firstValueFrom(
      this.http.post<MensagemDaConversa>(
        urlApi('atendimento', 'conversas', id, 'mensagens', mensagemId, 'reenviar'),
        {},
      ),
    );
  }

  /** Envia um anexo (contexto `MENSAGEM`, R11) para depois mandá-lo como `arquivoId`. */
  enviarArquivo(arquivo: File, nome = arquivo.name): Promise<Arquivo> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, nome);
    return firstValueFrom(
      this.http.post<Arquivo>(urlApi('arquivos'), corpo, {
        params: parametros({ contexto: 'MENSAGEM' }),
      }),
    );
  }

  // ----- Painel do contato -------------------------------------------------------------------

  contato(id: string): Observable<ContatoDoPainel> {
    return this.http.get<ContatoDoPainel>(urlApi('contatos', id));
  }

  /** Negócios do contato em todos os funis que quem pede vê (R5.9). */
  negocios(contatoId: string): Observable<readonly NegocioDoContato[]> {
    return this.http
      .get<Pagina<NegocioDoContato>>(urlApi('negocios'), {
        params: parametros({
          contatoId,
          visao: 'TODOS',
          ordenarPor: 'criadoEm',
          direcao: 'desc',
          porPagina: POR_PAGINA_MAXIMO,
        }),
      })
      .pipe(map((pagina) => pagina.itens));
  }

  /** Atividades pendentes do contato que quem pede vê (R6.4). */
  atividades(contatoId: string): Observable<readonly AtividadeDoContato[]> {
    return this.http
      .get<Pagina<AtividadeDoContato>>(urlApi('atividades'), {
        params: parametros({
          contatoId,
          escopo: 'TODAS',
          status: ['PENDENTE'],
          ordem: 'DATA',
          porPagina: 10,
        }),
      })
      .pipe(map((pagina) => pagina.itens));
  }

  private acao(id: string, acao: string, corpo: object): Promise<ConversaDetalhe> {
    return firstValueFrom(
      this.http.post<ConversaDetalhe>(urlApi('atendimento', 'conversas', id, acao), corpo),
    );
  }
}
