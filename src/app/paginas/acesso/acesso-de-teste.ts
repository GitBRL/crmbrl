import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { Component, type Provider, type EnvironmentProviders } from '@angular/core';
import { provideRouter, withComponentInputBinding, type Routes } from '@angular/router';

import { interceptarErros } from '../../nucleo/api/interceptor-erros';
import { RECARREGAR_EM } from '../../nucleo/sessao/sessao.service';

/**
 * **Só para testes (specs) das telas de acesso.** Nenhum código do app importa isto.
 */

@Component({ template: '<p>destino</p>' })
export class PaginaDestino {}

/**
 * Roteador (por padrão, qualquer rota abre uma página vazia), HTTP de teste com o interceptor
 * do app e o recarregar falso.
 */
export function provedoresDeAcesso(
  rotas: Routes = [{ path: '**', component: PaginaDestino }],
): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter(rotas, withComponentInputBinding()),
    provideHttpClient(withInterceptors([interceptarErros])),
    provideHttpClientTesting(),
    { provide: RECARREGAR_EM, useValue: () => undefined },
  ];
}

/** Digita num campo (pelo `name`) e sai dele, como a pessoa. */
export function digitar(raiz: HTMLElement, nome: string, valor: string): HTMLInputElement {
  const campo = raiz.querySelector<HTMLInputElement>(`input[name="${nome}"]`);
  if (!campo) {
    throw new Error(`Campo "${nome}" não encontrado`);
  }
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  campo.dispatchEvent(new Event('blur'));
  return campo;
}

/** Envia o formulário da tela (Enter ou clique no botão principal). */
export function enviar(raiz: HTMLElement): void {
  const formulario = raiz.querySelector('form');
  if (!formulario) {
    throw new Error('Formulário não encontrado');
  }
  formulario.dispatchEvent(new Event('submit', { cancelable: true }));
}

/**
 * Espera a tela assentar depois de uma resposta HTTP de teste: as continuações (`await`) da
 * tela rodam em microtarefas que o `whenStable` não enxerga (o HTTP de teste não conta como
 * tarefa pendente).
 */
export async function assentar(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }
}

/** Texto visível, com os espaços normalizados. */
export function texto(elemento: Element | null | undefined): string {
  return (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Responde com o erro padrão da API. */
export function falhar(
  requisicao: TestRequest,
  status: number,
  erro: string,
  mensagem: string,
  detalhes?: Record<string, unknown>,
  cabecalhos?: Record<string, string>,
): void {
  requisicao.flush(
    { statusCode: status, erro, mensagem, detalhes, requisicaoId: 'req-teste-1' },
    { status, statusText: 'Erro', headers: cabecalhos },
  );
}
