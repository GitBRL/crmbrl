import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../../../../nucleo/sessao/sessao-de-teste';
import { falhaDaApi, microtarefas, site } from '../dados-de-teste';
import { CanalSite } from './canal-site';

describe('CanalSite (chat do site, R14)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CanalSite>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('ADMIN');
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  function campo(rotulo: string): HTMLInputElement | HTMLTextAreaElement {
    const label = Array.from(raiz().querySelectorAll('label')).find((item) =>
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

  function enviar(): void {
    raiz().querySelector<HTMLFormElement>('#formulario-site')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  async function novo() {
    fixture = TestBed.createComponent(CanalSite);
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    await microtarefas();
    fixture.detectChanges();
  }

  async function existente(dados = site()) {
    fixture = TestBed.createComponent(CanalSite);
    fixture.componentRef.setInput('id', 's-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/atendimento/filas').flush([]);
    http.expectOne('/api/v1/webchat/canais/s-1').flush(dados);
    await microtarefas();
    fixture.detectChanges();
  }

  it('novo: a prévia acompanha a aparência e o trecho só aparece depois de criar', async () => {
    await novo();
    expect(raiz().querySelector('h2')?.textContent).toContain('Novo chat do site');
    expect(raiz().textContent).toContain('Depois de criar, aparece aqui o trecho');
    digitar('Título', 'Atendimento BRL');
    expect(raiz().querySelector('.w__cabecalho strong')?.textContent).toBe('Atendimento BRL');
    digitar('Cor principal', '#e5f900');
    const previa = raiz().querySelector<HTMLElement>('app-previa-widget .site')!;
    expect(previa.style.getPropertyValue('--w-cor')).toBe('#E5F900');
    // Automática: texto escuro sobre o lima.
    expect(previa.style.getPropertyValue('--w-cor-texto')).toBe('#111827');
  });

  it('domínios: normaliza ao adicionar e recusa o que não é endereço', async () => {
    await novo();
    digitar('Endereços do site', 'www.Loja.com.br/contato, ftp://x');
    const adicionar = Array.from(
      raiz().querySelectorAll<HTMLButtonElement>('.dominios__adicionar'),
    )[0];
    adicionar.click();
    fixture.detectChanges();
    expect(
      Array.from(raiz().querySelectorAll('.dominios__texto')).map((d) => d.textContent),
    ).toEqual(['https://www.loja.com.br']);
    expect(raiz().textContent).toContain('“ftp://x” não é um endereço de site');
  });

  it('cria com tudo e abre a tela do canal com a instalação em destaque', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await novo();
    digitar('Nome', 'Site institucional');
    digitar('Endereços do site', 'brl.com.br');
    raiz().querySelector<HTMLButtonElement>('.dominios__adicionar')!.click();
    fixture.detectChanges();
    enviar();
    const pedido = http.expectOne('/api/v1/webchat/canais');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      nome: 'Site institucional',
      filaPadraoId: null,
      ativo: true,
      dominios: ['https://brl.com.br'],
      aparencia: {
        titulo: 'Fale com a gente',
        subtitulo: 'Respondemos o mais rápido possível.',
        saudacao: 'Olá! Como podemos ajudar?',
        corPrimaria: '#2563EB',
        corTextoPrimaria: null,
        tema: 'automatico',
        posicao: 'direita',
      },
      contato: 'EMAIL_OU_TELEFONE',
      textoConsentimento: null,
      urlPrivacidade: null,
      permitirAnexos: true,
    });
    pedido.flush(site());
    await microtarefas();
    expect(navegar).toHaveBeenCalledWith(['/configuracoes', 'canais', 'site', 's-1'], {
      queryParams: { criado: '1' },
      replaceUrl: true,
    });
  });

  it('editar: mostra o trecho de instalação e envia só o que mudou', async () => {
    await existente();
    expect(raiz().querySelector('app-bloco-codigo')?.textContent).toContain(
      'data-chave="wc_abc123"',
    );
    digitar('Título', 'Fale com a BRL');
    enviar();
    const pedido = http.expectOne('/api/v1/webchat/canais/s-1');
    expect(pedido.request.method).toBe('PATCH');
    expect(Object.keys(pedido.request.body)).toEqual(['aparencia']);
    expect(pedido.request.body.aparencia.titulo).toBe('Fale com a BRL');
    // A cor do texto gravada é a automática para o azul: continua automática.
    expect(pedido.request.body.aparencia.corTextoPrimaria).toBeNull();
    pedido.flush(site({ aparencia: { ...site().aparencia, titulo: 'Fale com a BRL' } }));
    await microtarefas();
  });

  it('erro de domínio da API vai para o campo certo', async () => {
    await existente();
    digitar('Nome', 'Outro nome');
    enviar();
    const falha = falhaDaApi(400, 'dados_invalidos', 'Dados inválidos.', {
      campos: [{ campo: 'dominios.0', mensagens: ['não é um endereço de site válido'] }],
    });
    http.expectOne('/api/v1/webchat/canais/s-1').flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Não é um endereço de site válido.');
    expect(raiz().textContent).toContain('Confira os campos marcados.');
  });

  it('testar o chat abre o widget de verdade num quadro', async () => {
    await existente();
    const testar = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Testar o chat aqui'),
    )!;
    testar.click();
    fixture.detectChanges();
    const quadro = document.querySelector<HTMLIFrameElement>('iframe.teste__quadro');
    expect(quadro).not.toBeNull();
    expect(quadro!.getAttribute('srcdoc') ?? quadro!.srcdoc).toContain('data-chave="wc_abc123"');
  });
});
