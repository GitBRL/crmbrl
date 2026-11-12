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
import { FOTO_MAXIMO_BYTES, MeuPerfil, problemaDaFoto } from './meu-perfil';

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

  describe('foto de perfil (R2.10)', () => {
    /** Escolhe um arquivo no campo de foto, como o seletor do navegador faria. */
    function escolher(arquivo: File) {
      const campo = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(campo, 'files', { value: [arquivo], configurable: true });
      campo.dispatchEvent(new Event('change'));
    }
    const png = () =>
      new File([new Uint8Array([137, 80, 78, 71])], 'eu.png', { type: 'image/png' });

    it('confere tipo e tamanho antes de enviar', () => {
      expect(problemaDaFoto({ type: 'image/png', size: 10 })).toBeNull();
      expect(problemaDaFoto({ type: 'image/webp', size: FOTO_MAXIMO_BYTES })).toBeNull();
      expect(problemaDaFoto({ type: 'image/svg+xml', size: 10 })).toContain(
        'JPG, PNG, GIF ou WebP',
      );
      expect(problemaDaFoto({ type: 'application/pdf', size: 10 })).toContain('imagem');
      expect(problemaDaFoto({ type: 'image/jpeg', size: FOTO_MAXIMO_BYTES + 1 })).toContain('5 MB');
      expect(problemaDaFoto({ type: 'image/gif', size: 0 })).toContain('vazio');
    });

    it('membro adiciona a foto: envia como AVATAR, liga ao perfil e recarrega a sessão', async () => {
      criar('COMERCIAL');
      expect(() => botaoComTexto(raiz(), 'Remover foto')).toThrow();
      const campo = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
      expect(campo.accept).toBe('image/jpeg,image/png,image/gif,image/webp');
      expect(botaoComTexto(raiz(), 'Adicionar foto').getAttribute('aria-describedby')).toBe(
        'perfil-foto-dica',
      );
      escolher(png());
      const envio = http.expectOne((pedido) => pedido.url === '/api/v1/arquivos');
      expect(envio.request.method).toBe('POST');
      expect(envio.request.params.get('contexto')).toBe('AVATAR');
      expect((envio.request.body as FormData).get('arquivo')).toBeInstanceOf(File);
      envio.flush({ id: 'arq-1' });
      await microtarefas();
      const ligar = http.expectOne('/api/v1/usuarios/eu/foto');
      expect(ligar.request.method).toBe('PUT');
      expect(ligar.request.body).toEqual({ arquivoId: 'arq-1' });
      ligar.flush({ avatarUrl: '/api/v1/arquivos/arq-1' });
      await microtarefas();
      http
        .expectOne('/api/v1/auth/eu')
        .flush(perfilDeTeste('COMERCIAL', { usuario: { avatarUrl: '/api/v1/arquivos/arq-1' } }));
      await microtarefas();
      fixture.detectChanges();
      expect(raiz().querySelector('app-avatar img')?.getAttribute('src')).toBe(
        '/api/v1/arquivos/arq-1',
      );
      expect(botaoComTexto(raiz(), 'Trocar foto')).toBeTruthy();
      expect(botaoComTexto(raiz(), 'Remover foto')).toBeTruthy();
    });

    it('arquivo que não é imagem aceita: avisa e não envia nada', () => {
      criar('COMERCIAL');
      escolher(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
      fixture.detectChanges();
      expect(raiz().querySelector('[role="alert"]')?.textContent).toContain(
        'JPG, PNG, GIF ou WebP',
      );
      // http.verify() no afterEach: nenhum pedido.
    });

    it('recusa da API aparece junto da foto', async () => {
      criar('COMERCIAL');
      escolher(png());
      const { corpo, opcoes } = erroDaApiFalso(
        413,
        'muito_grande',
        'O arquivo passa do limite de 5 MB.',
      );
      http.expectOne((pedido) => pedido.url === '/api/v1/arquivos').flush(corpo, opcoes);
      await microtarefas();
      fixture.detectChanges();
      expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('5 MB');
    });

    it('remove a foto e volta às iniciais', async () => {
      entrarComo('LIDER_CS', { usuario: { avatarUrl: '/api/v1/arquivos/arq-1' } });
      fixture = TestBed.createComponent(MeuPerfil);
      fixture.detectChanges();
      botaoComTexto(raiz(), 'Remover foto').click();
      const pedido = http.expectOne('/api/v1/usuarios/eu/foto');
      expect(pedido.request.method).toBe('DELETE');
      pedido.flush({ avatarUrl: null });
      await microtarefas();
      http.expectOne('/api/v1/auth/eu').flush(perfilDeTeste('LIDER_CS'));
      await microtarefas();
      fixture.detectChanges();
      expect(raiz().querySelector('app-avatar img')).toBeNull();
      expect(botaoComTexto(raiz(), 'Adicionar foto')).toBeTruthy();
    });
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
