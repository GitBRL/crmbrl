import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { assentar, digitar, enviar, falhar, provedoresDeAcesso, texto } from './acesso-de-teste';
import { Entrar } from './entrar';
import { EstadoAcesso } from './estado-acesso';

describe('Entrar', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Entrar>;
  let raiz: HTMLElement;

  async function criar(voltar: string | null = null) {
    TestBed.configureTestingModule({ providers: provedoresDeAcesso() });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessaoService).encerrarLocalmente();
    fixture = TestBed.createComponent(Entrar);
    (fixture.componentRef as ComponentRef<Entrar>).setInput('voltar', voltar);
    raiz = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function entrarCom(email: string, senha: string) {
    digitar(raiz, 'email', email);
    digitar(raiz, 'senha', senha);
    enviar(raiz);
    await fixture.whenStable();
    return http.expectOne('/api/v1/auth/entrar');
  }

  const botaoEntrar = () => raiz.querySelector<HTMLButtonElement>('button[type=submit]');

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('mostra o palco da marca, o cartão com e-mail, senha, "Entrar" e "Esqueci minha senha"', async () => {
    await criar();
    expect(texto(raiz.querySelector('h1'))).toBe('Entrar');
    expect(texto(raiz.querySelector('.acesso__slogan'))).toBe(
      'Seu cliente, do primeiro contato ao sucesso.',
    );
    expect(raiz.querySelector('.acesso__ilustracao')?.getAttribute('aria-hidden')).toBe('true');
    const email = raiz.querySelector<HTMLInputElement>('input[name=email]');
    expect(email?.type).toBe('email');
    expect(email?.getAttribute('autocomplete')).toBe('username');
    expect(raiz.querySelector('input[name=senha]')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
    expect(raiz.querySelector('button[aria-label="Mostrar senha"]')).not.toBeNull();
    expect(texto(botaoEntrar())).toBe('Entrar');
    expect(raiz.querySelector('a[href="/esqueci-senha"]')?.textContent).toContain(
      'Esqueci minha senha',
    );
    expect(raiz.querySelector('app-alternador-tema')).not.toBeNull();
  });

  it('não chama a API com campos vazios ou e-mail inválido', async () => {
    await criar();
    enviar(raiz);
    await fixture.whenStable();
    expect(texto(raiz)).toContain('Digite o seu e-mail.');
    expect(texto(raiz)).toContain('Digite a sua senha.');
    digitar(raiz, 'email', 'lucas@');
    await fixture.whenStable();
    expect(texto(raiz)).toContain('Digite um e-mail válido');
    http.expectNone('/api/v1/auth/entrar');
  });

  it('entra e vai para a rota guardada no "voltar"', async () => {
    await criar('/contatos?aba=empresas');
    const requisicao = await entrarCom('  comercial1@demo.local ', 'Demo@2026');
    expect(requisicao.request.body).toEqual({ email: 'comercial1@demo.local', senha: 'Demo@2026' });
    requisicao.flush(perfilDeTeste('COMERCIAL'));
    await assentar(fixture);
    expect(TestBed.inject(Router).url).toBe('/contatos?aba=empresas');
  });

  it('troca obrigatória (R2.7): vai para /trocar-senha e guarda a senha temporária', async () => {
    await criar('/funis/cs');
    const requisicao = await entrarCom('troca.pendente@demo.local', 'Trocar@2026');
    requisicao.flush(
      perfilDeTeste('CS', {
        deveTrocarSenha: true,
        usuario: { email: 'troca.pendente@demo.local' },
      }),
    );
    await assentar(fixture);
    expect(TestBed.inject(Router).url).toBe('/trocar-senha?voltar=%2Ffunis%2Fcs');
    expect(TestBed.inject(EstadoAcesso).tomarSenhaTemporaria('troca.pendente@demo.local')).toBe(
      'Trocar@2026',
    );
  });

  it('credenciais erradas (R2.3): mensagem genérica, mantém o e-mail e limpa a senha', async () => {
    await criar();
    falhar(
      await entrarCom('lucas@demo.local', 'errada123'),
      401,
      'nao_autenticado',
      'E-mail ou senha incorretos.',
    );
    await assentar(fixture);
    const aviso = raiz.querySelector('app-aviso-acesso');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(texto(aviso)).toContain('E-mail ou senha incorretos.');
    expect(texto(aviso)).toContain('Depois de 5 tentativas erradas');
    expect(raiz.querySelector<HTMLInputElement>('input[name=email]')?.value).toBe(
      'lucas@demo.local',
    );
    expect(raiz.querySelector<HTMLInputElement>('input[name=senha]')?.value).toBe('');
    // Sem o "Preencha este campo" de um formulário já enviado.
    expect(texto(raiz)).not.toContain('Digite a sua senha.');
  });

  it('conta desativada (403): diz que o acesso foi desativado', async () => {
    await criar();
    falhar(
      await entrarCom('pedro.santos@demo.local', 'Demo@2026'),
      403,
      'sem_permissao',
      'Acesso desativado. Fale com o administrador.',
    );
    await assentar(fixture);
    const aviso = raiz.querySelector('app-aviso-acesso');
    expect(aviso?.querySelector('.aviso-acesso__titulo')).toBeNull();
    expect(texto(aviso)).toContain('Acesso desativado. Fale com o administrador.');
    expect(raiz.querySelector<HTMLInputElement>('input[name=email]')?.value).toBe(
      'pedro.santos@demo.local',
    );
  });

  it('bloqueio por tentativas (R2.5): diz em quantos minutos, trava o botão e libera sozinho', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-21T18:00:00'));
    await criar();
    falhar(
      await entrarCom('lucas@demo.local', 'errada123'),
      429,
      'muitas_tentativas',
      'Muitas tentativas de login. Tente de novo em 15 minutos.',
      { regra: 'R2.5', motivo: 'BLOQUEADO_EMAIL', ate: '2026-10-21T21:15:00.000Z' },
      { 'Retry-After': '900' },
    );
    await assentar(fixture);
    const aviso = () => texto(raiz.querySelector('app-aviso-acesso'));
    expect(aviso()).toContain('Muitas tentativas com este e-mail');
    expect(aviso()).toContain('Tente de novo em 15 minutos, às 18:15');
    expect(aviso()).toContain('nem a senha certa funciona');
    expect(botaoEntrar()?.disabled).toBe(true);

    // Outro e-mail não está bloqueado; voltar ao mesmo, sim.
    digitar(raiz, 'email', 'juliana@demo.local');
    await fixture.whenStable();
    expect(botaoEntrar()?.disabled).toBe(false);
    digitar(raiz, 'email', 'LUCAS@demo.local');
    await fixture.whenStable();
    expect(botaoEntrar()?.disabled).toBe(true);

    vi.advanceTimersByTime(5 * 60_000);
    await fixture.whenStable();
    expect(aviso()).toContain('Tente de novo em 10 minutos, às 18:15');

    vi.advanceTimersByTime(10 * 60_000);
    await fixture.whenStable();
    expect(aviso()).toContain('você já pode tentar entrar de novo');
    expect(botaoEntrar()?.disabled).toBe(false);
  });

  it('servidor fora do ar: mensagem humana com o código para a TI', async () => {
    await criar();
    falhar(await entrarCom('lucas@demo.local', 'Demo@2026'), 500, 'erro_interno', 'Erro.');
    await assentar(fixture);
    const aviso = texto(raiz.querySelector('app-aviso-acesso'));
    expect(aviso).toContain('Algo deu errado do nosso lado');
    expect(aviso).toContain('Código para o suporte: req-teste-1');
  });

  it('"Esqueci minha senha" leva o e-mail digitado; sem envio de e-mail, vira uma orientação', async () => {
    await criar();
    digitar(raiz, 'email', 'lucas@demo.local');
    raiz.querySelector<HTMLAnchorElement>('a[href="/esqueci-senha"]')?.click();
    const estado = TestBed.inject(EstadoAcesso);
    expect(estado.email()).toBe('lucas@demo.local');

    estado.envioPorEmail.set('indisponivel');
    await fixture.whenStable();
    expect(raiz.querySelector('a[href="/esqueci-senha"]')).toBeNull();
    expect(texto(raiz)).toContain('Peça ao administrador uma senha temporária.');
  });
});
