import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AvisosService } from '../avisos.service';
import { SEM_REDIRECIONAR, SessaoService, voltarSeguro } from '../sessao/sessao.service';
import { API } from './api';
import { erroDaApi } from './erro-api';

/** Aviso quando a sessão acaba no meio do uso. */
export const MENSAGEM_SESSAO_EXPIROU = 'Sua sessão terminou. Entre de novo para continuar.';

/**
 * Interceptor das chamadas à API (`/api/v1/…`), registrado em `app.config.ts`:
 *
 * - toda falha vira `ErroApi` (`nucleo/api/erro-api.ts`), com `mensagem` humana em
 *   português — inclusive sem resposta (rede) e 5xx (com o id da requisição para a TI);
 * - **401** no meio do uso: esquece o perfil, avisa e leva para `/entrar?voltar=<rota atual>`;
 * - **403 da troca de senha pendente** (R2.7): leva para `/trocar-senha`;
 * - **outro 403** (as permissões mudaram no meio da sessão, por exemplo): pergunta de novo
 *   `auth/eu`, para o menu e as guardas refletirem as permissões de agora. A tela mostra "sem
 *   acesso" (`app-estado-vazio [falha]`).
 *
 * Os outros erros (403, 404, 409, 422, 429, 5xx) chegam a quem chamou, que mostra a mensagem
 * no lugar certo (campo, ação, estado de erro da tela). Requisições com o contexto
 * `SEM_REDIRECIONAR` (login, `auth/eu`, `auth/sair`) não são redirecionadas.
 */
export const interceptarErros: HttpInterceptorFn = (requisicao, proximo) => {
  if (!requisicao.url.startsWith(`${API}/`)) {
    return proximo(requisicao);
  }
  const sessao = inject(SessaoService);
  const router = inject(Router);
  const avisos = inject(AvisosService);

  return proximo(requisicao).pipe(
    catchError((falha: unknown) => {
      const erro = erroDaApi(falha);
      if (!requisicao.context.get(SEM_REDIRECIONAR)) {
        if (erro.ehSemSessao) {
          const estavaLogado = sessao.autenticado();
          sessao.encerrarLocalmente();
          const atual = router.url;
          if (!atual.startsWith('/entrar')) {
            if (estavaLogado) {
              avisos.info(MENSAGEM_SESSAO_EXPIROU, { chave: 'sessao-expirou' });
            }
            const voltar = voltarSeguro(atual);
            void router.navigate(['/entrar'], {
              queryParams: voltar === '/inicio' ? {} : { voltar },
            });
          }
        } else if (erro.ehTrocaDeSenhaPendente && !router.url.startsWith('/trocar-senha')) {
          void sessao.carregar(true).catch(() => undefined);
          void router.navigate(['/trocar-senha']);
        } else if (erro.ehSemPermissao && sessao.autenticado()) {
          void sessao.carregar(true).catch(() => undefined);
        }
      }
      return throwError(() => erro);
    }),
  );
};
