import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AvisosService } from '../avisos.service';
import { SessaoService } from '../sessao/sessao.service';
import { entrarComo } from '../sessao/sessao-de-teste';
import { ErroApi } from './erro-api';
import { interceptarErros, MENSAGEM_SESSAO_EXPIROU } from './interceptor-erros';

@Component({ template: '' })
class Vazia {}

describe('interceptarErros', () => {
  let http: HttpClient;
  let controle: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Vazia }]),
        provideHttpClient(withInterceptors([interceptarErros])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/funis/comercial?busca=x');
  });
  afterEach(() => controle.verify());

  async function falhar(status: number, corpo: object | null, url = '/api/v1/contatos') {
    const pedido = firstValueFrom(http.get(url));
    controle.expectOne(url).flush(corpo, { status, statusText: 'x' });
    return pedido.catch((erro: unknown) => erro);
  }

  it('toda falha de /api/v1 chega como ErroApi', async () => {
    const erro = await falhar(404, {
      statusCode: 404,
      erro: 'nao_encontrado',
      mensagem: 'Contato não encontrado.',
      requisicaoId: 'r1',
    });
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).mensagem).toBe('Contato não encontrado.');
    expect(router.url).toBe('/funis/comercial?busca=x');
  });

  it('401 no meio do uso: esquece a sessão, avisa e vai para /entrar guardando a rota', async () => {
    entrarComo('COMERCIAL');
    await falhar(401, { statusCode: 401, erro: 'nao_autenticado', mensagem: 'Faça login.' });
    await TestBed.inject(Router).navigated;
    await new Promise((fim) => setTimeout(fim));
    expect(TestBed.inject(SessaoService).autenticado()).toBe(false);
    expect(router.url).toBe('/entrar?voltar=%2Ffunis%2Fcomercial%3Fbusca%3Dx');
    expect(
      TestBed.inject(AvisosService)
        .lista()
        .map((aviso) => aviso.mensagem),
    ).toEqual([MENSAGEM_SESSAO_EXPIROU]);
  });

  it('403 da troca de senha pendente leva a /trocar-senha', async () => {
    entrarComo('CS');
    await falhar(403, {
      statusCode: 403,
      erro: 'sem_permissao',
      mensagem: 'Troque a sua senha para continuar.',
      detalhes: { regra: 'R2.7', motivo: 'troca_de_senha_pendente' },
    });
    // Recarrega o perfil para saber da troca pendente.
    controle.expectOne('/api/v1/auth/eu').flush(null, { status: 500, statusText: 'x' });
    await new Promise((fim) => setTimeout(fim));
    expect(router.url).toBe('/trocar-senha');
  });

  it('403 comum e 5xx não redirecionam: quem chamou mostra a mensagem', async () => {
    entrarComo('CS');
    const negado = await falhar(403, {
      statusCode: 403,
      erro: 'sem_permissao',
      mensagem: 'Você não tem permissão para esta ação.',
    });
    expect((negado as ErroApi).ehSemPermissao).toBe(true);
    // As permissões podem ter mudado: o perfil é lido de novo (menu e guardas se atualizam).
    controle.expectOne('/api/v1/auth/eu').flush(null, { status: 500, statusText: 'x' });
    const quebrado = await falhar(500, {
      statusCode: 500,
      erro: 'erro_interno',
      mensagem: 'x',
      requisicaoId: 'abc',
    });
    expect((quebrado as ErroApi).mensagem).toContain('abc');
    expect(router.url).toBe('/funis/comercial?busca=x');
  });

  it('não mexe em requisições fora de /api/v1 (a saúde trata o próprio 503)', async () => {
    const pedido = firstValueFrom(http.get('/api/saude')).catch((erro: unknown) => erro);
    controle
      .expectOne('/api/saude')
      .flush({ status: 'degradado' }, { status: 503, statusText: 'x' });
    expect(await pedido).not.toBeInstanceOf(ErroApi);
  });
});
