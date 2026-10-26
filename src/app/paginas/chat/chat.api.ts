import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { type Pagina, parametros, urlApi } from '../../nucleo/api/api';
import type {
  ArquivoChat,
  ChatCanal,
  ChatMembro,
  ChatMensagem,
  ChatPessoa,
  PaginaMensagensChat,
  ResultadoBuscaChat,
  ResultadoDireta,
  TipoReferencia,
} from './chat.tipos';

/** Onde começar a página de mensagens (só um dos três). */
export interface CursorMensagens {
  readonly antesDe?: string;
  readonly depoisDe?: string;
  readonly aoRedorDe?: string;
  readonly limite?: number;
}

export interface NovaMensagemChat {
  readonly texto?: string | null;
  readonly arquivoId?: string;
  readonly respostaAId?: string;
}

export interface NovoGrupo {
  readonly nome: string;
  readonly descricao?: string | null;
  readonly membrosIds: readonly string[];
}

/** Um negócio, contato ou empresa para citar numa mensagem (`#`). */
export interface ItemCitavel {
  readonly tipo: TipoReferencia;
  readonly id: string;
  readonly titulo: string;
  readonly detalhe: string | null;
}

interface ContatoDaBusca {
  readonly id: string;
  readonly nome: string;
  readonly email: string | null;
  readonly empresa: { readonly nome: string } | null;
}

interface EmpresaDaBusca {
  readonly id: string;
  readonly nome: string;
  readonly cidade: string | null;
  readonly uf: string | null;
}

interface NegocioDaBusca {
  readonly id: string;
  readonly titulo: string;
  readonly funil: { readonly nome: string };
  readonly etapa: { readonly nome: string };
}

/** Quantos itens de cada tipo a busca do `#` traz. */
export const CITAVEIS_POR_TIPO = 3;

/**
 * Chamadas do Chat da equipe (`/api/v1/chat`, R15) e do envio de anexos
 * (`POST /api/v1/arquivos?contexto=CHAT`). Cada pessoa só enxerga os canais de que é membro:
 * os outros respondem 404 (as conversas diretas são privadas, nem o Admin lê).
 */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);

  canais(): Promise<readonly ChatCanal[]> {
    return firstValueFrom(this.http.get<ChatCanal[]>(urlApi('chat', 'canais')));
  }

  canal(id: string): Promise<ChatCanal> {
    return firstValueFrom(this.http.get<ChatCanal>(urlApi('chat', 'canais', id)));
  }

  mensagens(canalId: string, cursor: CursorMensagens = {}): Promise<PaginaMensagensChat> {
    return firstValueFrom(
      this.http.get<PaginaMensagensChat>(urlApi('chat', 'canais', canalId, 'mensagens'), {
        params: parametros({ ...cursor }),
      }),
    );
  }

  enviar(canalId: string, mensagem: NovaMensagemChat): Promise<ChatMensagem> {
    return firstValueFrom(
      this.http.post<ChatMensagem>(urlApi('chat', 'canais', canalId, 'mensagens'), mensagem),
    );
  }

  editar(mensagemId: string, texto: string): Promise<ChatMensagem> {
    return firstValueFrom(
      this.http.patch<ChatMensagem>(urlApi('chat', 'mensagens', mensagemId), { texto }),
    );
  }

  excluir(mensagemId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('chat', 'mensagens', mensagemId)));
  }

  /** Lido até `mensagemId` (sem ela, até a última). Nunca volta atrás. */
  marcarLeitura(canalId: string, mensagemId?: string): Promise<ChatCanal> {
    return firstValueFrom(
      this.http.post<ChatCanal>(
        urlApi('chat', 'canais', canalId, 'leitura'),
        mensagemId ? { mensagemId } : {},
      ),
    );
  }

  silenciar(canalId: string, silenciado: boolean): Promise<ChatCanal> {
    return firstValueFrom(
      this.http.put<ChatCanal>(urlApi('chat', 'canais', canalId, 'preferencias'), { silenciado }),
    );
  }

  atualizarGrupo(
    canalId: string,
    alteracao: { readonly nome?: string; readonly descricao?: string | null },
  ): Promise<ChatCanal> {
    return firstValueFrom(this.http.patch<ChatCanal>(urlApi('chat', 'canais', canalId), alteracao));
  }

  arquivar(canalId: string, arquivar: boolean): Promise<ChatCanal> {
    return firstValueFrom(
      this.http.post<ChatCanal>(
        urlApi('chat', 'canais', canalId, arquivar ? 'arquivar' : 'desarquivar'),
        {},
      ),
    );
  }

  sair(canalId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(urlApi('chat', 'canais', canalId, 'sair'), {}));
  }

  membros(canalId: string): Promise<readonly ChatMembro[]> {
    return firstValueFrom(
      this.http.get<ChatMembro[]>(urlApi('chat', 'canais', canalId, 'membros')),
    );
  }

  adicionarMembros(
    canalId: string,
    usuariosIds: readonly string[],
  ): Promise<readonly ChatMembro[]> {
    return firstValueFrom(
      this.http.post<ChatMembro[]>(urlApi('chat', 'canais', canalId, 'membros'), { usuariosIds }),
    );
  }

  definirAdministrador(
    canalId: string,
    usuarioId: string,
    administrador: boolean,
  ): Promise<ChatMembro> {
    return firstValueFrom(
      this.http.patch<ChatMembro>(urlApi('chat', 'canais', canalId, 'membros', usuarioId), {
        administrador,
      }),
    );
  }

  removerMembro(canalId: string, usuarioId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(urlApi('chat', 'canais', canalId, 'membros', usuarioId)),
    );
  }

  criarGrupo(grupo: NovoGrupo): Promise<ChatCanal> {
    return firstValueFrom(this.http.post<ChatCanal>(urlApi('chat', 'grupos'), grupo));
  }

  iniciarDireta(usuarioId: string): Promise<ResultadoDireta> {
    return firstValueFrom(
      this.http.post<ResultadoDireta>(urlApi('chat', 'diretas'), { usuarioId }),
    );
  }

  /** Pessoas ativas do CRM (criar grupo, iniciar direta, adicionar ao grupo). */
  pessoas(busca = '', porPagina = 100): Promise<Pagina<ChatPessoa>> {
    return firstValueFrom(
      this.http.get<Pagina<ChatPessoa>>(urlApi('chat', 'pessoas'), {
        params: parametros({ busca, porPagina }),
      }),
    );
  }

  buscarMensagens(texto: string, porPagina = 20): Promise<Pagina<ResultadoBuscaChat>> {
    return firstValueFrom(
      this.http.get<Pagina<ResultadoBuscaChat>>(urlApi('chat', 'mensagens', 'busca'), {
        params: parametros({ texto, porPagina }),
      }),
    );
  }

  /** Envia um anexo (o id vai na mensagem em seguida). */
  enviarArquivo(arquivo: File): Promise<ArquivoChat> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo, arquivo.name);
    return firstValueFrom(
      this.http.post<ArquivoChat>(urlApi('arquivos'), corpo, {
        params: parametros({ contexto: 'CHAT' }),
      }),
    );
  }

  /**
   * Negócios, contatos e empresas que batem com o texto (os que a pessoa vê). Um tipo que a
   * pessoa não pode ver (403) ou que falhou só fica de fora.
   */
  async citaveis(texto: string): Promise<readonly ItemCitavel[]> {
    const params = parametros({ busca: texto, porPagina: CITAVEIS_POR_TIPO });
    const buscar = <T>(rota: string) =>
      firstValueFrom(this.http.get<Pagina<T>>(urlApi(rota), { params })).then(
        (pagina) => pagina.itens,
        () => [] as readonly T[],
      );
    const [negocios, contatos, empresas] = await Promise.all([
      buscar<NegocioDaBusca>('negocios'),
      buscar<ContatoDaBusca>('contatos'),
      buscar<EmpresaDaBusca>('empresas'),
    ]);
    return [
      ...negocios.map<ItemCitavel>((negocio) => ({
        tipo: 'negocio',
        id: negocio.id,
        titulo: negocio.titulo,
        detalhe: `${negocio.funil.nome} · ${negocio.etapa.nome}`,
      })),
      ...contatos.map<ItemCitavel>((contato) => ({
        tipo: 'contato',
        id: contato.id,
        titulo: contato.nome,
        detalhe: contato.empresa?.nome ?? contato.email ?? null,
      })),
      ...empresas.map<ItemCitavel>((empresa) => ({
        tipo: 'empresa',
        id: empresa.id,
        titulo: empresa.nome,
        detalhe: [empresa.cidade, empresa.uf].filter(Boolean).join(' · ') || null,
      })),
    ];
  }
}
