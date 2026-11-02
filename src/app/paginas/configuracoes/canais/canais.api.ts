import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { parametros, urlApi } from '../../../nucleo/api/api';
import type {
  CanalEmail,
  CanalMeta,
  CanalSite,
  DadosCanalEmail,
  DadosCanalMeta,
  DadosCanalSite,
  DadosConexaoEmail,
  DadosNumeroWhatsapp,
  EnviosNoDia,
  EstadoDoNumero,
  FilaDoCanal,
  NumeroWhatsapp,
  TesteDeConexaoEmail,
  TesteDoCanalMeta,
} from './canais.modelos';

/**
 * Configuração dos canais de atendimento (Admin): números de WhatsApp (`/whatsapp/numeros`),
 * chat do site (`/webchat/canais`), e-mail (`/email/canais`) e Instagram/Messenger
 * (`/meta/canais`). Toda falha chega como `ErroApi` (interceptor do núcleo).
 */
@Injectable({ providedIn: 'root' })
export class CanaisApi {
  private readonly http = inject(HttpClient);

  // Filas (para a fila padrão de cada canal) ----------------------------------------------------

  /** As filas ativas do Atendimento. */
  listarFilas(): Promise<readonly FilaDoCanal[]> {
    return firstValueFrom(this.http.get<readonly FilaDoCanal[]>(urlApi('atendimento', 'filas')));
  }

  // WhatsApp ----------------------------------------------------------------------------------

  listarNumeros(): Promise<readonly NumeroWhatsapp[]> {
    return firstValueFrom(this.http.get<readonly NumeroWhatsapp[]>(urlApi('whatsapp', 'numeros')));
  }

  detalharNumero(id: string): Promise<NumeroWhatsapp> {
    return firstValueFrom(this.http.get<NumeroWhatsapp>(urlApi('whatsapp', 'numeros', id)));
  }

  criarNumero(dados: DadosNumeroWhatsapp & { nome: string }): Promise<NumeroWhatsapp> {
    return firstValueFrom(this.http.post<NumeroWhatsapp>(urlApi('whatsapp', 'numeros'), dados));
  }

  atualizarNumero(id: string, dados: DadosNumeroWhatsapp): Promise<NumeroWhatsapp> {
    return firstValueFrom(
      this.http.patch<NumeroWhatsapp>(urlApi('whatsapp', 'numeros', id), dados),
    );
  }

  excluirNumero(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('whatsapp', 'numeros', id)));
  }

  /** Começa a conexão (202): o QR chega pelo evento `whatsapp.conexao`. */
  conectarNumero(id: string): Promise<EstadoDoNumero> {
    return firstValueFrom(
      this.http.post<EstadoDoNumero>(urlApi('whatsapp', 'numeros', id, 'conectar'), {}),
    );
  }

  /** Com `sair`, desvincula o aparelho (para voltar, só lendo o QR de novo). */
  desconectarNumero(id: string, sair = false): Promise<EstadoDoNumero> {
    return firstValueFrom(
      this.http.post<EstadoDoNumero>(urlApi('whatsapp', 'numeros', id, 'desconectar'), { sair }),
    );
  }

  /** Estado ao vivo no gateway, com o QR enquanto espera a leitura. */
  statusDoNumero(id: string): Promise<EstadoDoNumero> {
    return firstValueFrom(
      this.http.get<EstadoDoNumero>(urlApi('whatsapp', 'numeros', id, 'status')),
    );
  }

  pausarNumero(id: string, motivo?: string | null): Promise<NumeroWhatsapp> {
    return firstValueFrom(
      this.http.post<NumeroWhatsapp>(
        urlApi('whatsapp', 'numeros', id, 'pausar'),
        motivo ? { motivo } : {},
      ),
    );
  }

  retomarNumero(id: string): Promise<NumeroWhatsapp> {
    return firstValueFrom(
      this.http.post<NumeroWhatsapp>(urlApi('whatsapp', 'numeros', id, 'retomar'), {}),
    );
  }

  enviosDoNumero(id: string, dias = 14): Promise<readonly EnviosNoDia[]> {
    return firstValueFrom(
      this.http.get<readonly EnviosNoDia[]>(urlApi('whatsapp', 'numeros', id, 'envios'), {
        params: parametros({ dias }),
      }),
    );
  }

  // Chat do site ------------------------------------------------------------------------------

  listarSites(): Promise<readonly CanalSite[]> {
    return firstValueFrom(this.http.get<readonly CanalSite[]>(urlApi('webchat', 'canais')));
  }

  detalharSite(id: string): Promise<CanalSite> {
    return firstValueFrom(this.http.get<CanalSite>(urlApi('webchat', 'canais', id)));
  }

  criarSite(dados: DadosCanalSite & { nome: string }): Promise<CanalSite> {
    return firstValueFrom(this.http.post<CanalSite>(urlApi('webchat', 'canais'), dados));
  }

  atualizarSite(id: string, dados: DadosCanalSite): Promise<CanalSite> {
    return firstValueFrom(this.http.patch<CanalSite>(urlApi('webchat', 'canais', id), dados));
  }

  excluirSite(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('webchat', 'canais', id)));
  }

  // E-mail --------------------------------------------------------------------------------------

  listarEmails(): Promise<readonly CanalEmail[]> {
    return firstValueFrom(this.http.get<readonly CanalEmail[]>(urlApi('email', 'canais')));
  }

  detalharEmail(id: string): Promise<CanalEmail> {
    return firstValueFrom(this.http.get<CanalEmail>(urlApi('email', 'canais', id)));
  }

  criarEmail(dados: DadosCanalEmail): Promise<CanalEmail> {
    return firstValueFrom(this.http.post<CanalEmail>(urlApi('email', 'canais'), dados));
  }

  atualizarEmail(id: string, dados: DadosCanalEmail): Promise<CanalEmail> {
    return firstValueFrom(this.http.patch<CanalEmail>(urlApi('email', 'canais', id), dados));
  }

  excluirEmail(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('email', 'canais', id)));
  }

  /** Testa IMAP e SMTP antes de salvar (nada é gravado). */
  testarEmailNovo(dados: DadosConexaoEmail): Promise<TesteDeConexaoEmail> {
    return firstValueFrom(
      this.http.post<TesteDeConexaoEmail>(urlApi('email', 'canais', 'testar'), dados),
    );
  }

  /** Testa o canal salvo; os campos enviados substituem os gravados só no teste. */
  testarEmail(id: string, dados: DadosConexaoEmail = {}): Promise<TesteDeConexaoEmail> {
    return firstValueFrom(
      this.http.post<TesteDeConexaoEmail>(urlApi('email', 'canais', id, 'testar'), dados),
    );
  }

  // Instagram e Messenger -------------------------------------------------------------------------

  listarMeta(): Promise<readonly CanalMeta[]> {
    return firstValueFrom(this.http.get<readonly CanalMeta[]>(urlApi('meta', 'canais')));
  }

  detalharMeta(id: string): Promise<CanalMeta> {
    return firstValueFrom(this.http.get<CanalMeta>(urlApi('meta', 'canais', id)));
  }

  criarMeta(dados: DadosCanalMeta): Promise<CanalMeta> {
    return firstValueFrom(this.http.post<CanalMeta>(urlApi('meta', 'canais'), dados));
  }

  atualizarMeta(id: string, dados: DadosCanalMeta): Promise<CanalMeta> {
    return firstValueFrom(this.http.patch<CanalMeta>(urlApi('meta', 'canais', id), dados));
  }

  excluirMeta(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(urlApi('meta', 'canais', id)));
  }

  /** Confere o token da página pela Graph API. */
  testarMeta(id: string): Promise<TesteDoCanalMeta> {
    return firstValueFrom(
      this.http.post<TesteDoCanalMeta>(urlApi('meta', 'canais', id, 'testar'), {}),
    );
  }

  /** Gera outro token de verificação do webhook (o antigo deixa de valer). */
  regenerarTokenMeta(id: string): Promise<{ readonly tokenVerificacao: string }> {
    return firstValueFrom(
      this.http.post<{ readonly tokenVerificacao: string }>(
        urlApi('meta', 'canais', id, 'token-verificacao'),
        {},
      ),
    );
  }
}
