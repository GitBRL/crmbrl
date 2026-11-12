import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ErroApi } from '../api/erro-api';
import { interceptarErros } from '../api/interceptor-erros';
import { RECARREGAR_EM, SessaoService, voltarSeguro } from './sessao.service';
import { PushService } from '../pwa/push.service';
import type { Perfil } from './perfil';
import { perfilDeTeste } from './sessao-de-teste';

describe('SessaoService', () => {
  let http: HttpTestingController;
  let sessao: SessaoService;
  const recarregarEm = vi.fn();
  const desativar = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    recarregarEm.mockReset();
    desativar.mockReset();
    desativar.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([interceptarErros])),
        provideHttpClientTesting(),
        { provide: RECARREGAR_EM, useValue: recarregarEm },
        { provide: PushService, useValue: { desativar } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    sessao = TestBed.inject(SessaoService);
  });
  afterEach(() => http.verify());

  it('carrega o perfil do auth/eu uma vez só, mesmo com chamadas simultâneas', async () => {
    const primeira = sessao.carregar();
    const segunda = sessao.carregar();
    expect(sessao.estado()).toBe('carregando');
    http.expectOne('/api/v1/auth/eu').flush(perfilDeTeste('LIDER_COMERCIAL'));
    expect(await primeira).toEqual(await segunda);

    expect(sessao.estado()).toBe('ativa');
    expect(sessao.usuario()?.nome).toBe('Carla Nogueira');
    expect(sessao.rotuloPapel()).toBe('Líder Comercial');
    expect(sessao.ehLider()).toBe(true);
    expect(sessao.ehAdmin()).toBe(false);
    // Já sabe: não pergunta de novo.
    await sessao.carregar();
    http.expectNone('/api/v1/auth/eu');
  });

  it('401 no auth/eu = sem sessão (sem redirecionar nem lançar)', async () => {
    const carregando = sessao.carregar();
    http.expectOne('/api/v1/auth/eu').flush(
      { statusCode: 401, erro: 'nao_autenticado', mensagem: 'Faça login.' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );
    expect(await carregando).toBeNull();
    expect(sessao.estado()).toBe('ausente');
    expect(sessao.autenticado()).toBe(false);
    expect(sessao.modulosVisiveis()).toEqual([]);
  });

  it('API fora do ar: rejeita com ErroApi e fica em "erro"', async () => {
    const carregando = sessao.carregar();
    http.expectOne('/api/v1/auth/eu').error(new ProgressEvent('error'), { status: 0 });
    await expect(carregando).rejects.toBeInstanceOf(ErroApi);
    expect(sessao.estado()).toBe('erro');
  });

  it('entrar guarda o perfil; credencial errada vira ErroApi com a mensagem da API', async () => {
    const certo = sessao.entrar(' ana@brl.com.br ', 'segredo');
    const req = http.expectOne('/api/v1/auth/entrar');
    expect(req.request.body).toEqual({ email: 'ana@brl.com.br', senha: 'segredo' });
    req.flush(perfilDeTeste('ADMIN'));
    expect(((await certo) as Perfil).usuario.papel).toBe('ADMIN');
    expect(sessao.ehAdmin()).toBe(true);

    const errado = sessao.entrar('x@brl.com.br', 'errada');
    http
      .expectOne('/api/v1/auth/entrar')
      .flush(
        { statusCode: 401, erro: 'nao_autenticado', mensagem: 'E-mail ou senha incorretos.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await expect(errado).rejects.toMatchObject({ mensagem: 'E-mail ou senha incorretos.' });
  });

  it('R2.11 — com verificação em duas etapas, entrar devolve o desafio e não abre sessão; concluirEntrada abre', async () => {
    const primeira = sessao.entrar('ana@brl.com.br', 'segredo');
    http.expectOne('/api/v1/auth/entrar').flush({
      doisFatoresNecessario: true,
      desafio: 'abc',
      expiraEm: '2026-11-12T12:05:00Z',
    });
    const resposta = await primeira;
    expect(resposta).toMatchObject({ doisFatoresNecessario: true, desafio: 'abc' });
    expect(sessao.autenticado()).toBe(false);

    const segunda = sessao.concluirEntrada('abc', ' 123456 ');
    const req = http.expectOne('/api/v1/auth/entrar/dois-fatores');
    expect(req.request.body).toEqual({ desafio: 'abc', codigo: '123456' });
    req.flush(perfilDeTeste('ADMIN'));
    expect((await segunda).usuario.papel).toBe('ADMIN');
    expect(sessao.autenticado()).toBe(true);
  });

  it('sair encerra na API e recarrega em /entrar (mesmo com a sessão já vencida)', async () => {
    sessao.definirPerfil(perfilDeTeste('CS'));
    const saindo = sessao.sair();
    await vi.waitFor(() =>
      http
        .expectOne((req) => req.method === 'POST' && req.url === '/api/v1/auth/sair')
        .flush(null, { status: 401, statusText: 'Unauthorized' }),
    );
    await saindo;
    expect(sessao.autenticado()).toBe(false);
    expect(recarregarEm).toHaveBeenCalledWith('/entrar');
  });

  it('sair remove a inscrição de push deste aparelho antes de encerrar a sessão (R26.1)', async () => {
    sessao.definirPerfil(perfilDeTeste('CS'));
    const saindo = sessao.sair();
    await vi.waitFor(() => http.expectOne('/api/v1/auth/sair').flush(null));
    await saindo;
    expect(desativar).toHaveBeenCalledOnce();
  });

  it('sair sai mesmo se a remoção do push falhar', async () => {
    desativar.mockRejectedValue(new Error('sem push'));
    sessao.definirPerfil(perfilDeTeste('CS'));
    const saindo = sessao.sair();
    await vi.waitFor(() => http.expectOne('/api/v1/auth/sair').flush(null));
    await saindo;
    expect(recarregarEm).toHaveBeenCalledWith('/entrar');
  });

  it('trocar senha atualiza o perfil (sem a troca pendente)', async () => {
    sessao.definirPerfil(perfilDeTeste('CS', { deveTrocarSenha: true }));
    expect(sessao.deveTrocarSenha()).toBe(true);
    const trocando = sessao.trocarSenha('Temporaria@1', 'Nova@2026x');
    const req = http.expectOne('/api/v1/auth/senha');
    expect(req.request.body).toEqual({ senhaAtual: 'Temporaria@1', novaSenha: 'Nova@2026x' });
    req.flush(perfilDeTeste('CS'));
    await trocando;
    expect(sessao.deveTrocarSenha()).toBe(false);
  });

  it('esqueci, consultar token e definir senha pelo link', async () => {
    const pedido = sessao.pedirRedefinicao('ana@brl.com.br');
    http
      .expectOne('/api/v1/auth/senha/esqueci')
      .flush({ mensagem: 'Se o e-mail estiver cadastrado…' });
    expect(await pedido).toBe('Se o e-mail estiver cadastrado…');

    const consulta = sessao.consultarToken('abc');
    http.expectOne('/api/v1/auth/senha/token').flush({ valido: true, tipo: 'CONVITE' });
    expect(await consulta).toEqual({ valido: true, tipo: 'CONVITE' });

    const definindo = sessao.definirSenhaComToken('abc', 'Nova@2026x');
    const req = http.expectOne('/api/v1/auth/senha/redefinir');
    expect(req.request.body).toEqual({ token: 'abc', novaSenha: 'Nova@2026x' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await definindo;
  });

  it('pode() confere papel e permissões reais; permite() testa uma permissão', () => {
    sessao.definirPerfil(perfilDeTeste('MARKETING'));
    expect(sessao.pode('funil-marketing')).toBe(true);
    expect(sessao.pode('/funis/comercial')).toBe(false);
    expect(sessao.pode('configuracoes')).toBe(true);
    expect(sessao.pode('integracoes')).toBe(false);
    expect(sessao.pode('desconhecido')).toBe(false);
    expect(sessao.permite((p) => p.gerenciarUsuarios)).toBe(false);

    // O papel deixa, mas a permissão real não: o funil some.
    sessao.definirPerfil(perfilDeTeste('MARKETING', { permissoes: { areasVisiveis: [] } }));
    expect(sessao.pode('funil-marketing')).toBe(false);
    expect(sessao.modulosVisiveis().map((m) => m.id)).not.toContain('funil-marketing');
  });

  it('rota depois de entrar: troca pendente primeiro; "voltar" só para caminhos internos', () => {
    sessao.definirPerfil(perfilDeTeste('ADMIN'));
    expect(sessao.rotaAposEntrar('/funis/cs?x=1').toString()).toBe('/funis/cs?x=1');
    expect(sessao.rotaAposEntrar(null).toString()).toBe('/inicio');
    sessao.definirPerfil(perfilDeTeste('ADMIN', { deveTrocarSenha: true }));
    expect(sessao.rotaAposEntrar('/contatos').toString()).toBe('/trocar-senha?voltar=%2Fcontatos');
    expect(voltarSeguro('//evil.com')).toBe('/inicio');
    expect(voltarSeguro('https://evil.com')).toBe('/inicio');
    expect(voltarSeguro('/entrar?voltar=/x')).toBe('/inicio');
  });
});
