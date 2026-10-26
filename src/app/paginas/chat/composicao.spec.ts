import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { ChatCanal, ChatMembro, ChatMensagem } from './chat.tipos';
import { Composicao, type EdicaoChat, type EnvioChat, ESPERA_CITAVEL_MS } from './composicao';
import {
  ANA,
  assentar,
  BRUNO,
  canal,
  digitarNoCampo,
  membro,
  mensagem,
  pessoa,
  teclar,
} from './dados-de-teste';

const EU = pessoa('u-eu', 'Lucas Pereira');
const NEGOCIO = '0b7e7f43-6c43-4c9e-b2f4-2f1f0d1e5a10';

@Component({
  imports: [Composicao],
  template: `<app-chat-composicao
    eu="u-eu"
    [canal]="canal()"
    [membros]="membros()"
    [(respondendo)]="respondendo"
    [(editando)]="editando"
    (enviar)="envios.push($event)"
    (salvarEdicao)="edicoes.push($event)"
    (editarUltima)="pedidosDeEdicao = pedidosDeEdicao + 1"
  />`,
})
class Hospedeiro {
  readonly canal = signal<ChatCanal>(canal({ nome: 'Comercial' }));
  readonly membros = signal<readonly ChatMembro[] | null>([
    membro(EU),
    membro(ANA),
    membro(BRUNO),
    membro(pessoa('u-pedro', 'Pedro Santos', { ativo: false })),
  ]);
  readonly respondendo = signal<ChatMensagem | null>(null);
  readonly editando = signal<ChatMensagem | null>(null);
  readonly envios: EnvioChat[] = [];
  readonly edicoes: EdicaoChat[] = [];
  pedidosDeEdicao = 0;
}

describe('Composicao (chat)', () => {
  let http: HttpTestingController;
  let anunciados: string[];

  beforeEach(() => {
    anunciados = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LiveAnnouncer,
          useValue: { announce: (texto: string) => (anunciados.push(texto), Promise.resolve()) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    await assentar();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = () => raiz.querySelector<HTMLTextAreaElement>('textarea')!;
    const opcoes = () =>
      [...raiz.querySelectorAll('.sugestao')].map((opcao) =>
        opcao.textContent?.replace(/\s+/g, ' ').trim(),
      );
    return { fixture, hospedeiro: fixture.componentInstance, raiz, campo, opcoes };
  }

  it('"@" lista as pessoas do canal (sem você e sem desligados), filtrando pelo que vem depois', async () => {
    const { fixture, campo, opcoes } = await criar();
    digitarNoCampo(campo(), 'Oi @');
    await fixture.whenStable();
    expect(opcoes()).toEqual([
      expect.stringContaining('Ana Lima'),
      expect.stringContaining('Bruno Tavares'),
    ]);
    expect(campo().getAttribute('aria-controls')).toMatch(/^sugestoes-/);
    expect(campo().getAttribute('aria-activedescendant')).toMatch(/-0$/);
    expect(anunciados.at(-1)).toContain('2 pessoas');

    digitarNoCampo(campo(), 'Oi @bru');
    await fixture.whenStable();
    expect(opcoes()).toEqual([expect.stringContaining('Bruno Tavares')]);
  });

  it('Enter escolhe (sem enviar) e a menção vai para a API como <@id>', async () => {
    const { fixture, hospedeiro, campo, opcoes } = await criar();
    digitarNoCampo(campo(), '@an');
    await fixture.whenStable();
    const enter = teclar(campo(), 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    await fixture.whenStable();
    await assentar();
    expect(opcoes()).toEqual([]);
    expect(campo().value).toBe('@Ana Lima ');
    expect(hospedeiro.envios).toEqual([]);

    digitarNoCampo(campo(), '@Ana Lima, pode revisar?');
    await fixture.whenStable();
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    expect(hospedeiro.envios).toEqual([
      {
        texto: '<@u-ana>, pode revisar?',
        visivel: '@Ana Lima, pode revisar?',
        anexos: [],
        audio: false,
        respostaA: null,
      },
    ]);
    expect(campo().value).toBe('');
  });

  it('setas mudam a opção ativa e Esc fecha a lista sem mexer no texto', async () => {
    const { fixture, campo, raiz } = await criar();
    digitarNoCampo(campo(), '@');
    await fixture.whenStable();
    teclar(campo(), 'ArrowDown');
    await fixture.whenStable();
    expect(raiz.querySelector('.sugestao--ativa')?.textContent).toContain('Bruno');
    teclar(campo(), 'ArrowDown');
    await fixture.whenStable();
    expect(raiz.querySelector('.sugestao--ativa')?.textContent).toContain('Ana');
    const esc = teclar(campo(), 'Escape');
    await fixture.whenStable();
    expect(esc.defaultPrevented).toBe(true);
    expect(raiz.querySelector('.sugestoes')).toBeNull();
    expect(campo().value).toBe('@');
    expect(campo().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('"#" procura negócios, contatos e empresas e cita o escolhido como <tipo:id>', async () => {
    const { fixture, hospedeiro, campo, opcoes, raiz } = await criar();
    digitarNoCampo(campo(), 'Viu o #a');
    await fixture.whenStable();
    expect(raiz.querySelector('.sugestoes__vazio')?.textContent).toContain(
      'Digite o nome de um negócio',
    );
    digitarNoCampo(campo(), 'Viu o #acme');
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, ESPERA_CITAVEL_MS + 20));
    const negocios = http.expectOne((r) => r.url === '/api/v1/negocios');
    expect(negocios.request.params.get('busca')).toBe('acme');
    negocios.flush({
      itens: [
        {
          id: NEGOCIO,
          titulo: 'ACME — implantação',
          funil: { nome: 'Comercial' },
          etapa: { nome: 'Proposta' },
        },
      ],
      total: 1,
      pagina: 1,
      porPagina: 3,
    });
    http
      .expectOne((r) => r.url === '/api/v1/contatos')
      .flush({
        itens: [{ id: 'ct1', nome: 'Acme Silva', email: null, empresa: null }],
        total: 1,
        pagina: 1,
        porPagina: 3,
      });
    // Um tipo que falha só fica de fora.
    http
      .expectOne((r) => r.url === '/api/v1/empresas')
      .flush(null, { status: 500, statusText: 'Erro' });
    await assentar();
    await fixture.whenStable();
    expect(opcoes()).toEqual([
      'ACME — implantação Negócio · Comercial · Proposta',
      'Acme Silva Contato',
    ]);
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    await assentar();
    expect(campo().value).toBe('Viu o #ACME — implantação ');
    digitarNoCampo(campo(), 'Viu o #ACME — implantação hoje?');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    expect(hospedeiro.envios[0].texto).toBe(`Viu o <negocio:${NEGOCIO}> hoje?`);
  });

  it('↑ com o campo vazio pede para editar a última mensagem própria', async () => {
    const { fixture, hospedeiro, campo } = await criar();
    teclar(campo(), 'ArrowUp');
    expect(hospedeiro.pedidosDeEdicao).toBe(1);
    digitarNoCampo(campo(), 'algo');
    await fixture.whenStable();
    teclar(campo(), 'ArrowUp');
    expect(hospedeiro.pedidosDeEdicao).toBe(1);
  });

  it('editar: o campo traz o texto com as menções visíveis; Enter salva com as marcações', async () => {
    const { fixture, hospedeiro, campo, raiz } = await criar();
    const original = mensagem({
      id: 'm9',
      autor: EU,
      texto: 'Oi <@u-ana>!',
      partes: [
        { tipo: 'texto', texto: 'Oi ' },
        { tipo: 'mencao', texto: '@Ana Lima', usuarioId: 'u-ana' },
        { tipo: 'texto', texto: '!' },
      ],
    });
    digitarNoCampo(campo(), 'Rascunho que eu escrevia');
    await fixture.whenStable();
    hospedeiro.editando.set(original);
    await fixture.whenStable();
    await assentar();
    expect(raiz.querySelector('.faixa')?.textContent).toContain('Editando a mensagem');
    expect(campo().value).toBe('Oi @Ana Lima!');
    digitarNoCampo(campo(), 'Oi @Ana Lima! Tudo certo?');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    expect(hospedeiro.edicoes).toEqual([{ mensagem: original, texto: 'Oi <@u-ana>! Tudo certo?' }]);
    expect(hospedeiro.envios).toEqual([]);
    expect(hospedeiro.editando()).toBeNull();
    // O que estava sendo escrito antes de editar volta ao campo.
    await fixture.whenStable();
    await assentar();
    expect(campo().value).toBe('Rascunho que eu escrevia');
  });

  it('Esc cancela a edição e a resposta', async () => {
    const { fixture, hospedeiro, campo, raiz } = await criar();
    hospedeiro.editando.set(mensagem({ id: 'm9', autor: EU }));
    await fixture.whenStable();
    await assentar();
    teclar(campo(), 'Escape');
    await fixture.whenStable();
    expect(hospedeiro.editando()).toBeNull();
    expect(campo().value).toBe('');

    hospedeiro.respondendo.set(mensagem({ texto: 'Pode mandar a proposta?' }));
    await fixture.whenStable();
    expect(raiz.querySelector('.faixa')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Respondendo a Ana Lima: Pode mandar a proposta?',
    );
    teclar(campo(), 'Escape');
    await fixture.whenStable();
    expect(hospedeiro.respondendo()).toBeNull();
    expect(raiz.querySelector('.faixa')).toBeNull();
  });

  it('responder: o envio leva a mensagem citada e a faixa some', async () => {
    const { fixture, hospedeiro, campo, raiz } = await criar();
    const citada = mensagem({ id: 'm3', texto: 'Pode mandar a proposta?' });
    hospedeiro.respondendo.set(citada);
    await fixture.whenStable();
    digitarNoCampo(campo(), 'Mando já!');
    teclar(campo(), 'Enter');
    await fixture.whenStable();
    expect(hospedeiro.envios[0]).toEqual(
      expect.objectContaining({ texto: 'Mando já!', respostaA: citada }),
    );
    expect(raiz.querySelector('.faixa')).toBeNull();
  });

  it('sem poder enviar: o motivo no lugar do campo e sem a dica do @/#', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    hospedeiro.canal.set(
      canal({ podeEnviar: false, motivoSemEnvio: 'O grupo está arquivado: só leitura.' }),
    );
    await fixture.whenStable();
    expect(raiz.querySelector('textarea')).toBeNull();
    expect(raiz.textContent).toContain('O grupo está arquivado: só leitura.');
    expect(raiz.querySelector('.composicao__dica')).toBeNull();
  });
});
