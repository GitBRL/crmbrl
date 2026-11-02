import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { assentar, digitar, enviar, falhar, provedoresDeAcesso, texto } from './acesso-de-teste';
import { EsqueciSenha } from './esqueci-senha';
import { EstadoAcesso } from './estado-acesso';

const RESPOSTA = {
  mensagem: 'Se o e-mail estiver cadastrado e ativo, enviaremos um link para redefinir a senha.',
};

describe('EsqueciSenha', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<EsqueciSenha>;
  let raiz: HTMLElement;

  async function criar(antes?: (estado: EstadoAcesso) => void) {
    TestBed.configureTestingModule({ providers: provedoresDeAcesso() });
    http = TestBed.inject(HttpTestingController);
    antes?.(TestBed.inject(EstadoAcesso));
    fixture = TestBed.createComponent(EsqueciSenha);
    raiz = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const botao = (rotulo: string) =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      texto(item).startsWith(rotulo),
    );

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('traz o e-mail digitado em "Entrar" e responde sempre igual ("Confira o seu e-mail")', async () => {
    await criar((estado) => estado.email.set('lucas@demo.local'));
    expect(texto(raiz.querySelector('h1'))).toBe('Esqueci minha senha');
    expect(raiz.querySelector<HTMLInputElement>('input[name=email]')?.value).toBe(
      'lucas@demo.local',
    );
    enviar(raiz);
    await fixture.whenStable();
    const requisicao = http.expectOne('/api/v1/auth/senha/esqueci');
    expect(requisicao.request.body).toEqual({ email: 'lucas@demo.local' });
    requisicao.flush(RESPOSTA, { status: 202, statusText: 'Accepted' });
    await assentar(fixture);

    const titulo = raiz.querySelector('h1');
    expect(texto(titulo)).toBe('Confira o seu e-mail');
    expect(document.activeElement).toBe(titulo);
    expect(texto(raiz)).toContain('Pedido para: lucas@demo.local');
    expect(texto(raiz)).toContain('O link vale por 24 horas');
    expect(raiz.querySelector('a[href="/entrar"]')?.textContent).toContain('Voltar para entrar');
    expect(botao('Enviar de novo')?.disabled).toBe(true);
    expect(texto(botao('Enviar de novo'))).toBe('Enviar de novo em 2:00');
    expect(TestBed.inject(EstadoAcesso).envioPorEmail()).toBe('disponivel');
  });

  it('"Enviar de novo" só depois de 2 minutos (o intervalo da API)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    await criar();
    digitar(raiz, 'email', 'lucas@demo.local');
    enviar(raiz);
    await fixture.whenStable();
    http.expectOne('/api/v1/auth/senha/esqueci').flush(RESPOSTA);
    await assentar(fixture);

    vi.advanceTimersByTime(75_000);
    await fixture.whenStable();
    expect(texto(botao('Enviar de novo'))).toBe('Enviar de novo em 0:45');
    vi.advanceTimersByTime(45_000);
    await fixture.whenStable();
    expect(botao('Enviar de novo')?.disabled).toBe(false);

    botao('Enviar de novo')?.click();
    await fixture.whenStable();
    http.expectOne('/api/v1/auth/senha/esqueci').flush(RESPOSTA);
    await assentar(fixture);
    expect(TestBed.inject(AvisosService).lista()[0]?.mensagem).toBe(
      'Pedimos um novo link. Confira o seu e-mail.',
    );
    expect(botao('Enviar de novo')?.disabled).toBe(true);
  });

  it('sem envio de e-mail (422 R2.8): orienta a pedir uma senha temporária', async () => {
    await criar();
    digitar(raiz, 'email', 'lucas@demo.local');
    enviar(raiz);
    await fixture.whenStable();
    falhar(
      http.expectOne('/api/v1/auth/senha/esqueci'),
      422,
      'regra_violada',
      'O envio de e-mails não está configurado. Peça ao administrador uma senha temporária.',
      { regra: 'R2.8' },
    );
    await assentar(fixture);
    expect(texto(raiz.querySelector('h1'))).toBe('Peça uma senha temporária');
    expect(texto(raiz)).toContain('ele define uma senha temporária para você');
    expect(TestBed.inject(EstadoAcesso).envioPorEmail()).toBe('indisponivel');
    expect(raiz.querySelector('form')).toBeNull();
  });

  it('quando já se sabe que não há envio de e-mail, abre direto na orientação', async () => {
    await criar((estado) => estado.envioPorEmail.set('indisponivel'));
    expect(texto(raiz.querySelector('h1'))).toBe('Peça uma senha temporária');
  });

  it('e-mail inválido não chega à API; falha do servidor mostra o código', async () => {
    await criar();
    digitar(raiz, 'email', 'lucas');
    enviar(raiz);
    await fixture.whenStable();
    http.expectNone('/api/v1/auth/senha/esqueci');
    expect(texto(raiz)).toContain('Digite um e-mail válido');

    digitar(raiz, 'email', 'lucas@demo.local');
    enviar(raiz);
    await fixture.whenStable();
    falhar(http.expectOne('/api/v1/auth/senha/esqueci'), 503, 'indisponivel', 'Fora do ar.');
    await assentar(fixture);
    expect(texto(raiz.querySelector('app-aviso-acesso'))).toContain(
      'Código para o suporte: req-teste-1',
    );
  });
});
