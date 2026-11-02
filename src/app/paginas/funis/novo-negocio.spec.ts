import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { ETAPAS, funilDeTeste, negocioDeTeste } from './funis-de-teste';
import type { Contato, Negocio } from './funis.tipos';
import { formatarTelefone, NovoNegocio } from './novo-negocio';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function contato(id: string, nome: string, extra: Partial<Contato> = {}): Contato {
  return {
    id,
    nome,
    email: `${id}@exemplo.com`,
    telefone: null,
    cargo: null,
    empresa: null,
    responsavel: null,
    etiquetas: [],
    ...extra,
  };
}

describe('NovoNegocio', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NovoNegocio>;
  let raiz: HTMLElement;
  let criados: Negocio[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    entrarComo('COMERCIAL', { usuario: { id: 'eu', nome: 'João Batista' } });
    fixture = TestBed.createComponent(NovoNegocio);
    fixture.componentRef.setInput('funil', funilDeTeste());
    criados = [];
    fixture.componentInstance.criado.subscribe((negocio) => criados.push(negocio));
    fixture.componentRef.setInput('aberto', true);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.match(() => true));

  async function digitarNaBusca(texto: string) {
    const campo = raiz.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await esperar(300);
    return campo;
  }

  async function escrever(rotulo: string, texto: string) {
    const campos = [...raiz.querySelectorAll('app-campo-texto')];
    const campo = campos.find((el) =>
      el.querySelector('label')?.textContent?.trim().startsWith(rotulo),
    )!;
    const input = campo.querySelector('input')!;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return input;
  }

  function enviar() {
    raiz
      .querySelector('#form-novo-negocio')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('sem contato, pede para escolher ou criar', async () => {
    enviar();
    expect(raiz.textContent).toContain('Escolha um contato ou crie um novo.');
    expect(http.match((req) => req.method === 'POST')).toHaveLength(0);
  });

  it('busca o contato, sugere o título com a empresa e cria na primeira etapa, comigo como responsável', async () => {
    await digitarNaBusca('vane');
    http
      .expectOne((req) => req.url === '/api/v1/contatos' && req.params.get('busca') === 'vane')
      .flush({
        itens: [contato('c1', 'Vanessa Rocha', { empresa: { id: 'e1', nome: 'Moda Bella' } })],
        total: 1,
        pagina: 1,
        porPagina: 8,
      });
    await microtarefas();
    fixture.detectChanges();
    const opcao = raiz.querySelector<HTMLElement>('[role="option"]')!;
    expect(opcao.textContent).toContain('Vanessa Rocha');
    opcao.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const titulo = [...raiz.querySelectorAll<HTMLInputElement>('app-campo-texto input')][0];
    expect(titulo.value).toBe('Moda Bella — Vanessa Rocha');

    await escrever('Valor', '7200');
    enviar();
    const pedido = http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/negocios');
    expect(pedido.request.body).toEqual({
      contatoId: 'c1',
      funilId: 'funil-comercial',
      titulo: 'Moda Bella — Vanessa Rocha',
      empresaId: 'e1',
      etapaId: 'novo',
      responsavelId: 'eu',
      valor: '7200.00',
    });
    pedido.flush(negocioDeTeste('n1', ETAPAS[0]));
    await microtarefas();
    expect(criados.map((negocio) => negocio.id)).toEqual(['n1']);
  });

  it('cria o contato ali mesmo e avisa do duplicado (R4.2) enquanto digita', async () => {
    await digitarNaBusca('Ana Teste');
    http
      .expectOne((req) => req.url === '/api/v1/contatos')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 8 });
    await microtarefas();
    fixture.detectChanges();
    const criar = raiz.querySelector<HTMLElement>('.opcao--criar')!;
    expect(criar.textContent).toContain('Criar contato “Ana Teste”');
    criar.click();
    fixture.detectChanges();

    const nome = raiz.querySelector<HTMLInputElement>('.novo-contato input')!;
    expect(nome.value).toBe('Ana Teste');
    const email = await escrever('E-mail', 'ana@exemplo.com');
    email.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    http
      .expectOne(
        (req) => req.url === '/api/v1/contatos' && req.params.get('busca') === 'ana@exemplo.com',
      )
      .flush({
        itens: [contato('c9', 'Ana Beatriz Lopes', { email: 'ana@exemplo.com' })],
        total: 1,
        pagina: 1,
        porPagina: 5,
      });
    await microtarefas();
    fixture.detectChanges();
    const aviso = raiz.querySelector('.duplicado')!;
    expect(aviso.textContent).toContain('Já existe um contato com este e-mail ou telefone');
    expect(aviso.textContent).toContain('Ana Beatriz Lopes');

    aviso.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(raiz.querySelector('.novo-contato')).toBeNull();
    expect(raiz.querySelector('.escolhido__nome')?.textContent).toContain('Ana Beatriz Lopes');
  });

  it('contato novo que a API reconverte (já existia) avisa e segue com o existente', async () => {
    await digitarNaBusca('Bruno Novo');
    http
      .expectOne((req) => req.url === '/api/v1/contatos')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 8 });
    await microtarefas();
    fixture.detectChanges();
    raiz.querySelector<HTMLElement>('.opcao--criar')!.click();
    fixture.detectChanges();
    await escrever('Telefone', '(11) 98888-7777');
    enviar();
    const pedidoContato = http.expectOne(
      (req) => req.method === 'POST' && req.url === '/api/v1/contatos',
    );
    expect(pedidoContato.request.body).toMatchObject({
      nome: 'Bruno Novo',
      telefone: '(11) 98888-7777',
      origem: 'MANUAL',
    });
    pedidoContato.flush({ criado: false, contato: contato('c5', 'Bruno Antigo') });
    await microtarefas();
    const pedidoNegocio = http.expectOne(
      (req) => req.method === 'POST' && req.url === '/api/v1/negocios',
    );
    expect(pedidoNegocio.request.body).toMatchObject({ contatoId: 'c5', titulo: 'Bruno Antigo' });
    expect(TestBed.inject(AvisosService).lista().at(-1)?.mensagem).toContain(
      'Já existia um contato',
    );
    pedidoNegocio.flush(negocioDeTeste('n2', ETAPAS[0]));
  });

  it('contato novo sem e-mail nem telefone não sai (R4.1)', async () => {
    await digitarNaBusca('Sem Meio');
    http
      .expectOne((req) => req.url === '/api/v1/contatos')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 8 });
    await microtarefas();
    fixture.detectChanges();
    raiz.querySelector<HTMLElement>('.opcao--criar')!.click();
    fixture.detectChanges();
    enviar();
    expect(raiz.textContent).toContain('Informe o e-mail ou o telefone (pelo menos um).');
    expect(http.match((req) => req.method === 'POST')).toHaveLength(0);
  });

  it('formata telefone brasileiro para leitura', () => {
    expect(formatarTelefone('5511987654321')).toBe('(11) 98765-4321');
    expect(formatarTelefone('551132104321')).toBe('(11) 3210-4321');
    expect(formatarTelefone(null)).toBeNull();
  });
});
