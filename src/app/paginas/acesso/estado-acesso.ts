import { Injectable, signal } from '@angular/core';

/** O que a tela sabe sobre o envio de e-mails da API (convite e "esqueci minha senha", R2.8). */
export type EnvioPorEmail = 'desconhecido' | 'disponivel' | 'indisponivel';

/**
 * O que as telas de acesso passam umas para as outras, só na memória (nada vai para a URL nem
 * para o armazenamento do navegador):
 *
 * - o **e-mail** digitado em "Entrar", para "Esqueci minha senha" e para a volta depois de
 *   definir a senha não pedirem de novo;
 * - se o **envio de e-mails** está configurado: a API não diz antes (não há rota pública para
 *   isso); a tela descobre na primeira resposta de `auth/senha/esqueci` (202 ou 422 `R2.8`) e,
 *   sem envio, "Entrar" troca o link por "peça ao administrador uma senha temporária";
 * - a **senha temporária** que acabou de abrir uma sessão com troca obrigatória (R2.7), para a
 *   troca não pedir de novo a senha que a pessoa digitou segundos antes (TELAS §1.2: "senha
 *   atual, se não for primeiro acesso"). É lida uma vez só e só vale para o mesmo e-mail.
 */
@Injectable({ providedIn: 'root' })
export class EstadoAcesso {
  readonly email = signal('');
  readonly envioPorEmail = signal<EnvioPorEmail>('desconhecido');

  private senhaTemporaria: { readonly email: string; readonly senha: string } | null = null;

  guardarSenhaTemporaria(email: string, senha: string): void {
    this.senhaTemporaria = { email: normalizarEmail(email), senha };
  }

  /** Devolve a senha temporária guardada para este e-mail (e a esquece), ou `null`. */
  tomarSenhaTemporaria(email: string | null | undefined): string | null {
    const guardada = this.senhaTemporaria;
    this.senhaTemporaria = null;
    return guardada && email && guardada.email === normalizarEmail(email) ? guardada.senha : null;
  }
}

/** Como a API compara e-mails: sem espaços nas pontas e em minúsculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
