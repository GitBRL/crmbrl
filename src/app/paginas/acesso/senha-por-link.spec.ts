import { HttpTestingController } from '@angular/common/http/testing';
import { type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import { assentar, digitar, enviar, falhar, provedoresDeAcesso, texto } from './acesso-de-teste';
import { DefinirSenha } from './definir-senha';
import { EstadoAcesso } from './estado-acesso';
import { RedefinirSenha } from './redefinir-senha';

const CONVITE = {
  valido: true,
  tipo: 'CONVITE',
  nome: 'Rodrigo Nunes',
  email: 'convidado@demo.local',
  expiraEm: '2026-10-22T15:00:00.000Z',
};

describe('Senha pelo link (definir e redefinir)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<DefinirSenha | RedefinirSenha>;
  let raiz: HTMLElement;

  async function criar(tela: Type<DefinirSenha | RedefinirSenha>, token: string | null) {
    TestBed.configureTestingModule({ providers: provedoresDeAcesso() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(tela);
    fixture.componentRef.setInput('token', token);
    raiz = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function responderConsulta(resposta: object) {
    const consulta = http.expectOne('/api/v1/auth/senha/token');
    expect(consulta.request.body).toEqual({ token: 'tok-123' });
    consulta.flush(resposta);
    await assentar(fixture);
  }

  async function preencherEEnviar(senha = 'Sol de outubro') {
    digitar(raiz, 'nova-senha', senha);
    digitar(raiz, 'confirmar-senha', senha);
    enviar(raiz);
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  it('confere o link com o esqueleto do formulário e mostra o convite de quem foi convidado', async () => {
    await criar(DefinirSenha, 'tok-123');
    expect(raiz.querySelector('[aria-busy="true"] app-esqueleto')).not.toBeNull();
    expect(texto(raiz.querySelector('[role=status]'))).toBe('Conferindo o link…');

    await responderConsulta(CONVITE);
    expect(texto(raiz.querySelector('h1'))).toBe('Crie a sua senha');
    expect(texto(raiz)).toContain('Olá, Rodrigo! Você foi convidado para o BRL CRM.');
    expect(texto(raiz)).toContain('Conta: convidado@demo.local');
    expect(texto(raiz)).toContain('Este convite vale até 22/10/2026');
    expect(raiz.querySelector<HTMLInputElement>('input[autocomplete=username]')?.value).toBe(
      'convidado@demo.local',
    );
    expect([...raiz.querySelectorAll('app-regras-senha li')].map((item) => texto(item))).toEqual([
      'Pelo menos 8 caracteres: falta',
      'As duas senhas são iguais: falta',
    ]);
  });

  it('define a senha e já entra com ela', async () => {
    await criar(DefinirSenha, 'tok-123');
    await responderConsulta(CONVITE);
    await preencherEEnviar();

    const definir = http.expectOne('/api/v1/auth/senha/redefinir');
    expect(definir.request.body).toEqual({ token: 'tok-123', novaSenha: 'Sol de outubro' });
    definir.flush(null, { status: 204, statusText: 'No Content' });
    await assentar(fixture);

    const entrar = http.expectOne('/api/v1/auth/entrar');
    expect(entrar.request.body).toEqual({ email: 'convidado@demo.local', senha: 'Sol de outubro' });
    entrar.flush(perfilDeTeste('MARKETING'));
    await assentar(fixture);
    expect(TestBed.inject(Router).url).toBe('/inicio');
    expect(TestBed.inject(AvisosService).lista()[0]?.mensagem).toBe(
      'Senha criada. Boas-vindas ao BRL CRM!',
    );
  });

  it('se o login automático falhar, vai para "Entrar" com o e-mail preenchido', async () => {
    await criar(RedefinirSenha, 'tok-123');
    await responderConsulta({ ...CONVITE, tipo: 'REDEFINICAO', nome: 'Fernanda Ribeiro' });
    expect(texto(raiz.querySelector('h1'))).toBe('Redefinir senha');
    await preencherEEnviar();
    http.expectOne('/api/v1/auth/senha/redefinir').flush(null);
    await assentar(fixture);
    falhar(
      http.expectOne('/api/v1/auth/entrar'),
      429,
      'muitas_tentativas',
      'Muitas tentativas de login. Tente de novo em 3 minutos.',
    );
    await assentar(fixture);
    expect(TestBed.inject(Router).url).toBe('/entrar');
    expect(TestBed.inject(EstadoAcesso).email()).toBe('convidado@demo.local');
    expect(TestBed.inject(AvisosService).lista()[0]?.mensagem).toBe(
      'Senha redefinida. Entre com a senha nova.',
    );
  });

  it('convite vencido ou já usado: diz isso e o que fazer', async () => {
    await criar(DefinirSenha, 'tok-123');
    await responderConsulta({ valido: false });
    expect(texto(raiz.querySelector('h1'))).toBe('Este convite não vale mais');
    expect(texto(raiz)).toContain('Convites valem por 24 horas');
    expect(texto(raiz)).toContain('peça ao administrador do CRM um convite novo');
    expect(raiz.querySelector('a[href="/entrar"]')?.textContent).toContain('Ir para entrar');
    expect(raiz.querySelector('form')).toBeNull();
  });

  it('link de redefinição vencido: oferece pedir um link novo', async () => {
    await criar(RedefinirSenha, 'tok-123');
    await responderConsulta({ valido: false });
    expect(texto(raiz.querySelector('h1'))).toBe('Este link não vale mais');
    expect(raiz.querySelector('a[href="/esqueci-senha"]')?.textContent).toContain(
      'Pedir um link novo',
    );
  });

  it('sem token no endereço: nem consulta a API', async () => {
    await criar(RedefinirSenha, null);
    http.expectNone('/api/v1/auth/senha/token');
    expect(texto(raiz.querySelector('h1'))).toBe('Este link não vale mais');
    expect(texto(raiz)).toContain('O endereço está incompleto.');
  });

  it('o link deixa de valer entre a consulta e o envio (422 R2.8)', async () => {
    await criar(DefinirSenha, 'tok-123');
    await responderConsulta(CONVITE);
    await preencherEEnviar();
    falhar(
      http.expectOne('/api/v1/auth/senha/redefinir'),
      422,
      'regra_violada',
      'Este link já foi usado. Peça um novo.',
      { regra: 'R2.8' },
    );
    await assentar(fixture);
    const titulo = raiz.querySelector('h1');
    expect(texto(titulo)).toBe('Este convite não vale mais');
    expect(texto(raiz)).toContain('Este link já foi usado. Peça um novo.');
    expect(document.activeElement).toBe(titulo);
  });

  it('API fora do ar na consulta: "Tentar de novo" consulta outra vez', async () => {
    await criar(DefinirSenha, 'tok-123');
    http.expectOne('/api/v1/auth/senha/token').error(new ProgressEvent('error'), { status: 0 });
    await assentar(fixture);
    expect(texto(raiz.querySelector('app-aviso-acesso'))).toContain(
      'Não foi possível falar com o servidor do CRM',
    );
    [...raiz.querySelectorAll('button')]
      .find((botao) => texto(botao) === 'Tentar de novo')
      ?.click();
    await fixture.whenStable();
    await responderConsulta(CONVITE);
    expect(texto(raiz.querySelector('h1'))).toBe('Crie a sua senha');
  });
});
