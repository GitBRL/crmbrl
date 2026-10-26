import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { email, falhaDaApi, microtarefas } from '../dados-de-teste';
import { CanalEmail } from './canal-email';

describe('CanalEmail (caixa de e-mail, R14)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CanalEmail>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  function campo(rotulo: string, dentro: ParentNode = raiz()): HTMLInputElement {
    const label = Array.from(dentro.querySelectorAll('label')).find((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim().startsWith(rotulo),
    );
    if (!label) {
      throw new Error(`Campo "${rotulo}" não encontrado`);
    }
    return raiz().querySelector(`#${CSS.escape(label.getAttribute('for')!)}`)!;
  }

  function digitar(rotulo: string, valor: string): void {
    const elemento = campo(rotulo);
    elemento.value = valor;
    elemento.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  async function novo() {
    fixture = TestBed.createComponent(CanalEmail);
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    await microtarefas();
    fixture.detectChanges();
  }

  it('novo: começa no Gmail com os servidores e a dica da senha de app; trocar de provedor preenche', async () => {
    await novo();
    expect(raiz().textContent).toContain('senha de app');
    expect(campo('Servidor').value).toBe('imap.gmail.com');
    const microsoft = Array.from(
      raiz().querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('Microsoft'))!;
    microsoft.click();
    fixture.detectChanges();
    expect(campo('Servidor').value).toBe('outlook.office365.com');
    expect(raiz().textContent).toContain('SMTP autenticado');
  });

  it('testa antes de salvar (sem a senha, pede a senha) e mostra IMAP e SMTP', async () => {
    await novo();
    digitar('Endereço', 'atendimento@brl.com.br');
    botao('Testar conexão').click();
    fixture.detectChanges();
    http.expectNone('/api/v1/email/canais/testar');
    expect(raiz().textContent).toContain('Digite a senha da caixa para testar.');

    digitar('Senha da caixa', 'abcd efgh ijkl mnop');
    botao('Testar conexão').click();
    const pedido = http.expectOne('/api/v1/email/canais/testar');
    expect(pedido.request.body).toEqual({
      endereco: 'atendimento@brl.com.br',
      imap: {
        host: 'imap.gmail.com',
        porta: 993,
        tls: true,
        usuario: 'atendimento@brl.com.br',
        pasta: 'INBOX',
      },
      smtp: {
        host: 'smtp.gmail.com',
        porta: 465,
        seguranca: 'TLS',
        usuario: 'atendimento@brl.com.br',
      },
      senha: 'abcd efgh ijkl mnop',
      senhaSmtp: null,
      ignorarCertificado: false,
    });
    pedido.flush({
      imap: { ok: true, mensagem: 'Conectado.' },
      smtp: { ok: false, mensagem: 'O servidor recusou a senha.' },
    });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Recebimento (IMAP): funcionou');
    expect(raiz().textContent).toContain('Envio (SMTP): não funcionou');
    expect(raiz().textContent).toContain('O servidor recusou a senha.');
  });

  it('trocar a segurança do SMTP troca a porta padrão', async () => {
    await novo();
    const starttls = Array.from(
      raiz().querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ).find((r) => r.closest('label')?.textContent?.includes('STARTTLS'))!;
    starttls.click();
    fixture.detectChanges();
    const portas = raiz().querySelectorAll<HTMLInputElement>('input[type=number]');
    expect(portas[1].value).toBe('587');
  });

  it('cria e o endereço repetido (409) volta para o campo', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await novo();
    digitar('Endereço', 'atendimento@brl.com.br');
    digitar('Senha da caixa', 'segredo');
    digitar('Nome do canal', 'E-mail do atendimento');
    botao('Criar caixa de e-mail').click();
    const falha = falhaDaApi(409, 'conflito', 'Já existe um canal com esse endereço');
    http.expectOne('/api/v1/email/canais').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Já existe um canal com esse endereço.');

    digitar('Endereço', 'contato@brl.com.br');
    botao('Criar caixa de e-mail').click();
    const pedido = http.expectOne('/api/v1/email/canais');
    expect(pedido.request.body).toMatchObject({
      nome: 'E-mail do atendimento',
      endereco: 'contato@brl.com.br',
      senha: 'segredo',
      ativo: true,
    });
    pedido.flush(email({ id: 'e-9' }));
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'email', 'e-9'], {
      replaceUrl: true,
    });
  });

  it('editar: senha vazia mantém a gravada e a última leitura aparece', async () => {
    fixture = TestBed.createComponent(CanalEmail);
    fixture.componentRef.setInput('id', 'e-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/email/canais/e-1').flush(email());
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Última leitura com sucesso');
    expect(campo('Senha da caixa').getAttribute('placeholder')).toContain('••••••••3f9a');
    botao('Salvar').click();
    const pedido = http.expectOne('/api/v1/email/canais/e-1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body.senha).toBeUndefined();
    expect('senhaSmtp' in pedido.request.body).toBe(false);
    pedido.flush(email());
    await microtarefas();
  });
});
