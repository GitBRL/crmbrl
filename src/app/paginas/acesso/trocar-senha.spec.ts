import { HttpTestingController } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { entrarComo, perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import {
  assentar,
  digitar,
  enviar,
  falhar,
  PaginaDestino,
  provedoresDeAcesso,
  texto,
} from './acesso-de-teste';
import { EstadoAcesso } from './estado-acesso';
import { TrocarSenha } from './trocar-senha';

const PATRICIA = { nome: 'Patrícia Lemos', email: 'troca.pendente@demo.local' };

/** Como a moldura de acesso: outra casca, cuja saída só desenha a tela depois da navegação. */
@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class CascaFalsa {}

describe('TrocarSenha', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TrocarSenha>;
  let raiz: HTMLElement;

  function preparar() {
    TestBed.configureTestingModule({ providers: provedoresDeAcesso() });
    http = TestBed.inject(HttpTestingController);
  }

  async function criar(voltar: string | null = null) {
    fixture = TestBed.createComponent(TrocarSenha);
    fixture.componentRef.setInput('voltar', voltar);
    raiz = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const rotulos = () => [...raiz.querySelectorAll('label')].map((rotulo) => texto(rotulo));
  const regras = () =>
    [...raiz.querySelectorAll('app-regras-senha li')].map((item) => ({
      texto: texto(item),
      ok: item.classList.contains('regra--ok'),
    }));

  afterEach(() => http.verify());

  describe('obrigatória (R2.7)', () => {
    it('explica por que, não pede de novo a senha temporária e troca com ela', async () => {
      preparar();
      TestBed.inject(EstadoAcesso).guardarSenhaTemporaria(PATRICIA.email, 'Trocar@2026');
      entrarComo('CS', { deveTrocarSenha: true, usuario: PATRICIA });
      await criar('/funis/cs');

      expect(texto(raiz.querySelector('h1'))).toBe('Trocar senha');
      expect(texto(raiz)).toContain('Olá, Patrícia! Antes de começar, troque a senha temporária');
      expect(texto(raiz)).toContain('Por que trocar agora?');
      expect(rotulos()).toEqual(['Nova senha', 'Confirmar nova senha']);
      expect(regras().map((regra) => regra.texto)).toEqual([
        'Pelo menos 8 caracteres: falta',
        'Diferente da senha atual: falta',
        'As duas senhas são iguais: falta',
      ]);

      // A mesma senha temporária não serve: a regra e o campo dizem.
      digitar(raiz, 'nova-senha', 'Trocar@2026');
      await fixture.whenStable();
      expect(regras()[1].ok).toBe(false);
      expect(texto(raiz)).toContain('A nova senha precisa ser diferente da atual.');

      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubro');
      await fixture.whenStable();
      expect(regras().every((regra) => regra.ok)).toBe(true);
      expect(texto(raiz)).toContain('A senha atende a todos os requisitos.');

      enviar(raiz);
      await fixture.whenStable();
      const requisicao = http.expectOne('/api/v1/auth/senha');
      expect(requisicao.request.body).toEqual({
        senhaAtual: 'Trocar@2026',
        novaSenha: 'Sol de outubro',
      });
      requisicao.flush(perfilDeTeste('CS', { usuario: PATRICIA }));
      await assentar(fixture);
      expect(TestBed.inject(SessaoService).deveTrocarSenha()).toBe(false);
      expect(TestBed.inject(Router).url).toBe('/funis/cs');
      expect(TestBed.inject(AvisosService).lista()[0]?.mensagem).toBe(
        'Senha criada. Boas-vindas ao BRL CRM!',
      );
    });

    it('se a senha lembrada não servir (400), mostra o campo da temporária com o erro', async () => {
      preparar();
      TestBed.inject(EstadoAcesso).guardarSenhaTemporaria(PATRICIA.email, 'Trocar@2026');
      entrarComo('CS', { deveTrocarSenha: true, usuario: PATRICIA });
      await criar();
      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubro');
      enviar(raiz);
      await fixture.whenStable();
      falhar(
        http.expectOne('/api/v1/auth/senha'),
        400,
        'dados_invalidos',
        'A senha atual está incorreta.',
        { campos: [{ campo: 'senhaAtual', mensagens: ['está incorreta'] }] },
      );
      await assentar(fixture);
      expect(rotulos()).toEqual(['Senha temporária', 'Nova senha', 'Confirmar nova senha']);
      expect(texto(raiz)).toContain('A senha atual está incorreta.');
      expect(document.activeElement).toBe(raiz.querySelector('input[name=senha-atual]'));
    });

    it('depois de recarregar a página, pede a senha temporária; oferece "Sair"', async () => {
      preparar();
      entrarComo('CS', { deveTrocarSenha: true, usuario: PATRICIA });
      await criar();
      expect(rotulos()).toEqual(['Senha temporária', 'Nova senha', 'Confirmar nova senha']);
      expect(texto(raiz)).toContain('Não é Patrícia?');
      const sair = [...raiz.querySelectorAll('button')].find((botao) => texto(botao) === 'Sair');
      expect(sair).toBeDefined();
      sair?.click();
      await vi.waitFor(() => http.expectOne('/api/v1/auth/sair').flush(null));
      await assentar(fixture);
    });
  });

  describe('voluntária', () => {
    it('pede a senha atual, tem "Cancelar" e avisa das outras sessões', async () => {
      preparar();
      entrarComo('COMERCIAL');
      await criar();
      expect(rotulos()).toEqual(['Senha atual', 'Nova senha', 'Confirmar nova senha']);
      expect(texto(raiz)).toContain('Escolha uma senha nova para entrar no BRL CRM.');
      expect(texto(raiz)).not.toContain('Por que trocar agora?');
      expect(raiz.querySelector('a[href="/inicio"]')?.textContent).toContain('Cancelar');
      expect(texto(raiz)).toContain('as suas outras sessões abertas');
    });

    it('vindo do menu da conta, "Cancelar" e a troca voltam para a página anterior', async () => {
      TestBed.configureTestingModule({
        providers: provedoresDeAcesso([
          {
            path: '',
            component: CascaFalsa,
            children: [{ path: 'trocar-senha', component: TrocarSenha }],
          },
          { path: '**', component: PaginaDestino },
        ]),
      });
      http = TestBed.inject(HttpTestingController);
      entrarComo('COMERCIAL');
      const harness = await RouterTestingHarness.create('/contatos?aba=empresas');
      await harness.navigateByUrl('/trocar-senha');
      await harness.fixture.whenStable();
      raiz = harness.fixture.nativeElement as HTMLElement;
      const cancelar = [...raiz.querySelectorAll('a')].find((a) => texto(a) === 'Cancelar');
      expect(cancelar?.getAttribute('href')).toBe('/contatos?aba=empresas');

      digitar(raiz, 'senha-atual', 'Demo@2026');
      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubro');
      enviar(raiz);
      await harness.fixture.whenStable();
      http.expectOne('/api/v1/auth/senha').flush(perfilDeTeste('COMERCIAL'));
      await assentar(harness.fixture);
      expect(TestBed.inject(Router).url).toBe('/contatos?aba=empresas');
      expect(TestBed.inject(AvisosService).lista()[0]?.mensagem).toBe(
        'Senha trocada. As suas outras sessões foram encerradas.',
      );
    });

    it('confirmação diferente não chega à API', async () => {
      preparar();
      entrarComo('COMERCIAL');
      await criar();
      digitar(raiz, 'senha-atual', 'Demo@2026');
      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubra');
      enviar(raiz);
      await fixture.whenStable();
      expect(texto(raiz)).toContain('As duas senhas não são iguais.');
      http.expectNone('/api/v1/auth/senha');
    });

    it('senha atual incorreta (400): o erro fica no campo certo', async () => {
      preparar();
      entrarComo('COMERCIAL');
      await criar();
      digitar(raiz, 'senha-atual', 'errada123');
      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubro');
      enviar(raiz);
      await fixture.whenStable();
      falhar(
        http.expectOne('/api/v1/auth/senha'),
        400,
        'dados_invalidos',
        'A senha atual está incorreta.',
        { campos: [{ campo: 'senhaAtual', mensagens: ['está incorreta'] }] },
      );
      await assentar(fixture);
      const campoAtual = raiz.querySelector<HTMLInputElement>('input[name=senha-atual]');
      expect(campoAtual?.getAttribute('aria-invalid')).toBe('true');
      const idErro = campoAtual?.getAttribute('aria-describedby')?.split(' ')[0] ?? '';
      expect(texto(raiz.querySelector(`[id="${idErro}"]`))).toBe('A senha atual está incorreta.');
      expect(document.activeElement).toBe(campoAtual);
    });

    it('bloqueio por tentativas (429): diz quando tentar de novo', async () => {
      preparar();
      entrarComo('COMERCIAL');
      await criar();
      digitar(raiz, 'senha-atual', 'errada123');
      digitar(raiz, 'nova-senha', 'Sol de outubro');
      digitar(raiz, 'confirmar-senha', 'Sol de outubro');
      enviar(raiz);
      await fixture.whenStable();
      falhar(
        http.expectOne('/api/v1/auth/senha'),
        429,
        'muitas_tentativas',
        'Muitas tentativas de login. Tente de novo em 15 minutos.',
        { regra: 'R2.5' },
        { 'Retry-After': '900' },
      );
      await assentar(fixture);
      const aviso = raiz.querySelector('app-aviso-acesso');
      expect(aviso?.getAttribute('role')).toBe('alert');
      expect(texto(aviso)).toContain('Tente de novo em 15 minutos.');
    });
  });
});
