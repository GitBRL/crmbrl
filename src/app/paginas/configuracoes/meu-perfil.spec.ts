import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo, perfilDeTeste } from '../../nucleo/sessao/sessao-de-teste';
import {
  botaoComTexto,
  campoPeloRotulo,
  digitar,
  erroDaApiFalso,
  microtarefas,
} from './dados-de-teste';
import { MeuPerfil } from './meu-perfil';

describe('MeuPerfil', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<MeuPerfil>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  function criar(papel: Parameters<typeof entrarComo>[0]) {
    entrarComo(papel, {
      usuario:
        papel === 'COMERCIAL'
          ? { lider: { id: 'u-r', nome: 'Rafael Mendes', papel: 'LIDER' } }
          : {},
    });
    fixture = TestBed.createComponent(MeuPerfil);
    fixture.detectChanges();
  }

  it('membro vê os próprios dados e que nome e e-mail são do Admin', () => {
    criar('COMERCIAL');
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('João Batista');
    expect(texto).toContain('joão@brl.com.br');
    expect(texto).toContain('Comercial');
    expect(texto).toContain('Rafael Mendes');
    expect(texto).toContain('são definidos pelo Admin');
    expect(() => campoPeloRotulo(raiz(), 'Nome')).toThrow();
  });

  it('o Admin muda o próprio nome e o perfil é recarregado', async () => {
    criar('ADMIN');
    const salvar = botaoComTexto(raiz(), 'Salvar nome');
    expect(salvar.disabled).toBe(true);
    digitar(raiz(), 'Nome', 'Ana Ribeiro Lima');
    fixture.detectChanges();
    expect(salvar.disabled).toBe(false);
    salvar.click();
    const pedido = http.expectOne('/api/v1/usuarios/00000000-0000-4000-8000-000000000001');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ nome: 'Ana Ribeiro Lima' });
    pedido.flush({});
    await microtarefas();
    http
      .expectOne('/api/v1/auth/eu')
      .flush(perfilDeTeste('ADMIN', { usuario: { nome: 'Ana Ribeiro Lima' } }));
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.perfil__nome')?.textContent).toBe('Ana Ribeiro Lima');
  });

  it('troca a senha conferindo a confirmação', async () => {
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    criar('CS');
    digitar(raiz(), 'Senha atual', 'Antiga@2026');
    digitar(raiz(), 'Nova senha', 'Nova@Senha2026');
    digitar(raiz(), 'Confirme a nova senha', 'Outra@Senha2026');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Trocar senha').click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('As duas senhas não são iguais.');
    http.expectNone('/api/v1/auth/senha');

    digitar(raiz(), 'Confirme a nova senha', 'Nova@Senha2026');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Trocar senha').click();
    const pedido = http.expectOne('/api/v1/auth/senha');
    expect(pedido.request.body).toEqual({ senhaAtual: 'Antiga@2026', novaSenha: 'Nova@Senha2026' });
    pedido.flush(perfilDeTeste('CS'));
    await microtarefas();
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledWith(
      'Senha trocada. As suas sessões em outros aparelhos foram encerradas.',
    );
    expect((campoPeloRotulo(raiz(), 'Senha atual') as HTMLInputElement).value).toBe('');
  });

  it('senha atual errada aparece no campo da senha atual', async () => {
    criar('CS');
    digitar(raiz(), 'Senha atual', 'Errada@2026');
    digitar(raiz(), 'Nova senha', 'Nova@Senha2026');
    digitar(raiz(), 'Confirme a nova senha', 'Nova@Senha2026');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Trocar senha').click();
    const falha = erroDaApiFalso(400, 'dados_invalidos', 'A senha atual está incorreta.', {
      campos: [{ campo: 'senhaAtual', mensagens: ['está incorreta'] }],
    });
    http.expectOne('/api/v1/auth/senha').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    const atual = campoPeloRotulo(raiz(), 'Senha atual');
    expect(atual.getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('A senha atual está incorreta.');
    expect(document.activeElement).toBe(atual);
  });
});
