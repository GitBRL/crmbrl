import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { falhaDaApi, templateDoCanal } from '../configuracoes/canais/dados-de-teste';
import type { MensagemDaConversa, TemplatesDaConversa } from './atendimento.tipos';
import { assentar, mensagemDto, texto } from './dados-de-teste';
import { SeletorTemplate } from './seletor-template';

const URL = '/api/v1/atendimento/conversas/c1/templates';
const MENSAGENS = '/api/v1/atendimento/conversas/c1/mensagens';

function resposta(ajustes: Partial<TemplatesDaConversa> = {}): TemplatesDaConversa {
  return {
    suportado: true,
    janelaAberta: false,
    janelaAte: null,
    aviso: null,
    sincronizadoEm: null,
    itens: [
      templateDoCanal(),
      templateDoCanal({
        id: 't-2',
        nome: 'contato_recebido',
        categoria: 'MARKETING',
        corpo: { texto: 'Recebemos seu contato.', variaveis: [] },
      }),
      templateDoCanal({
        id: 't-3',
        nome: 'foto_pedido',
        cabecalho: { formato: 'IMAGE', texto: null, variaveis: [] },
        corpo: { texto: 'Veja a foto.', variaveis: [] },
      }),
    ],
    ...ajustes,
  };
}

describe('SeletorTemplate', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SeletorTemplate>;
  const enviados: MensagemDaConversa[] = [];

  beforeEach(() => {
    enviados.length = 0;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function abrir(corpo: TemplatesDaConversa | ReturnType<typeof falhaDaApi> = resposta()) {
    fixture = TestBed.createComponent(SeletorTemplate);
    fixture.componentRef.setInput('conversaId', 'c1');
    fixture.componentInstance.enviado.subscribe((m) => enviados.push(m));
    fixture.detectChanges();
    const pedido = http.expectOne(URL);
    if ('opcoes' in corpo) {
      pedido.flush(corpo.corpo, corpo.opcoes);
    } else {
      pedido.flush(corpo);
    }
    await assentar();
    fixture.detectChanges();
  }

  const itens = () => raiz().querySelectorAll<HTMLButtonElement>('.item');

  it('mostra carregando, depois os templates com a categoria; a busca filtra', async () => {
    fixture = TestBed.createComponent(SeletorTemplate);
    fixture.componentRef.setInput('conversaId', 'c1');
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Carregando os templates');
    http.expectOne(URL).flush(resposta());
    await assentar();
    fixture.detectChanges();
    expect(itens()).toHaveLength(3);
    expect(texto(itens()[1])).toContain('Marketing');
    const busca = raiz().querySelector<HTMLInputElement>('input[type=search]')!;
    busca.value = 'foto';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(itens()).toHaveLength(1);
    busca.value = 'xyz';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Nenhum template com “xyz”');
  });

  it('estados: erro com "Tentar de novo", sem templates e canal sem suporte', async () => {
    await abrir(falhaDaApi(500, 'erro_interno', 'boom'));
    expect(raiz().textContent).toContain('Não conseguimos carregar os templates');
    raiz().querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne(URL).flush(resposta({ itens: [] }));
    await assentar();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Nenhum template aprovado');

    fixture.destroy();
    await abrir(resposta({ suportado: false, itens: [] }));
    expect(raiz().textContent).toContain('Este canal não usa templates');
  });

  it('exige as variáveis antes de enviar e mostra o erro da API ao lado do botão', async () => {
    await abrir();
    itens()[0].click();
    fixture.detectChanges();
    raiz().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    http.expectNone(MENSAGENS);
    expect(raiz().querySelector('[role=alert]')?.textContent).toContain(
      'Falta preencher: corpo {{1}}, corpo {{2}}, corpo {{3}}.',
    );
    raiz()
      .querySelectorAll<HTMLInputElement>('.templates__campos input')
      .forEach((campo) => {
        campo.value = 'x';
        campo.dispatchEvent(new Event('input'));
      });
    fixture.detectChanges();
    raiz().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const falha = falhaDaApi(422, 'regra_de_negocio', 'O contato pediu para não ser contatado.');
    http.expectOne(MENSAGENS).flush(falha.corpo, falha.opcoes);
    await assentar();
    fixture.detectChanges();
    expect(raiz().querySelector('[role=alert]')?.textContent).toContain('não ser contatado');
    expect(enviados).toHaveLength(0);
  });

  it('cabeçalho de imagem: pede o arquivo, sobe como anexo e manda o arquivoId', async () => {
    await abrir();
    itens()[2].click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Imagem no cabeçalho');
    raiz().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Escolha o arquivo do cabeçalho.');
    const entrada = raiz().querySelector<HTMLInputElement>('input[type=file]')!;
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(entrada, 'files', { value: [arquivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    raiz().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await assentar();
    http.expectOne((r) => r.url === '/api/v1/arquivos').flush({ id: 'arq-1' });
    await assentar();
    const envio = http.expectOne(MENSAGENS);
    expect(envio.request.body).toEqual({
      template: { templateId: 't-3', variaveis: {} },
      arquivoId: 'arq-1',
    });
    envio.flush(mensagemDto({ id: 'm-img', direcao: 'SAIDA' }));
    await assentar();
    expect(enviados.map((m) => m.id)).toEqual(['m-img']);
  });
});
