import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ErroApi } from '../../nucleo/api/erro-api';
import type { ChatCanal } from './chat.tipos';
import { ANA, assentar, canal, digitarNoCampo, mensagem } from './dados-de-teste';
import { ESPERA_BUSCA_MS, ListaCanais } from './lista-canais';

@Component({
  imports: [ListaCanais],
  template: `<app-chat-lista-canais
    eu="u-eu"
    [canais]="canais()"
    [falha]="falha()"
    [ativo]="ativo()"
    (tentarDeNovo)="tentativas = tentativas + 1"
    (novoGrupo)="grupos = grupos + 1"
  />`,
})
class Hospedeiro {
  readonly canais = signal<readonly ChatCanal[] | null>(null);
  readonly falha = signal<ErroApi | null>(null);
  readonly ativo = signal<string | null>(null);
  tentativas = 0;
  grupos = 0;
}

const CANAIS: readonly ChatCanal[] = [
  canal({ id: 'geral', tipo: 'GERAL', nome: 'Geral', naoLidas: 3, mencoesNaoLidas: 1 }),
  canal({
    id: 'g1',
    nome: 'Lançamento',
    silenciado: true,
    naoLidas: 2,
    ultimaMensagemEm: '2026-10-26T12:00:00Z',
    ultimaMensagem: {
      id: 'x',
      autorId: 'u-ana',
      autorNome: 'Ana Lima',
      resumo: 'Peças aprovadas',
      excluida: false,
      criadaEm: '2026-10-26T12:00:00Z',
    },
  }),
  canal({ id: 'd1', tipo: 'DIRETO', nome: 'Ana Lima', outraPessoa: ANA }),
];

describe('ListaCanais (chat)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function criar(ajustes: (h: Hospedeiro) => void = () => undefined) {
    const fixture = TestBed.createComponent(Hospedeiro);
    ajustes(fixture.componentInstance);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const itens = () =>
      [...raiz.querySelectorAll<HTMLAnchorElement>('a.item')].map((a) =>
        a.getAttribute('aria-label'),
      );
    return { fixture, hospedeiro: fixture.componentInstance, raiz, itens };
  }

  it('carregando: esqueletos e o aviso falado; falha: o erro com "Tentar de novo"', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    expect(raiz.querySelectorAll('.lista__esqueleto')).toHaveLength(5);
    expect(raiz.querySelector('[role=status]')?.textContent).toContain('Carregando as conversas');

    hospedeiro.falha.set(new ErroApi({ status: 0, codigo: 'sem_conexao' }));
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Não foi possível abrir as conversas');
    [...raiz.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Tentar de novo'))!
      .click();
    expect(hospedeiro.tentativas).toBe(1);
  });

  it('seções com títulos, não lidas, menções e silenciado no nome de cada item', async () => {
    const { raiz, itens } = await criar((h) => h.canais.set(CANAIS));
    expect(
      [...raiz.querySelectorAll('.lista__secao-titulo')].map((t) => t.textContent?.trim()),
    ).toEqual(['Canais', 'Grupos', 'Conversas diretas']);
    expect(itens()).toEqual([
      'Geral, 3 não lidas, 1 menção a você. Nenhuma mensagem ainda',
      'Lançamento, 2 não lidas, silenciado. Ana: Peças aprovadas',
      'Ana Lima, online. Diga olá!',
    ]);
    const geral = raiz.querySelector('a.item')!;
    expect(geral.getAttribute('href')).toBe('/chat/geral');
    expect(geral.querySelector('.item__contagem')?.textContent).toBe('3');
    expect(geral.querySelector('.item__mencao')).not.toBeNull();
    expect(raiz.querySelector('.item__online')).not.toBeNull();
    expect(raiz.querySelector('.item--silenciado .item__silenciado')).not.toBeNull();
  });

  it('o canal aberto fica marcado e não mostra não lidas', async () => {
    const { raiz, itens } = await criar((h) => {
      h.canais.set(CANAIS);
      h.ativo.set('geral');
    });
    const aberto = raiz.querySelector('a.item--ativo')!;
    expect(aberto.getAttribute('aria-current')).toBe('page');
    expect(aberto.querySelector('.item__contagem')).toBeNull();
    expect(itens()[0]).toBe('Geral. Nenhuma mensagem ainda');
  });

  it('a busca filtra pelo nome e, com duas letras, procura nas mensagens', async () => {
    const { fixture, raiz, itens } = await criar((h) => h.canais.set(CANAIS));
    const campo = raiz.querySelector<HTMLInputElement>('app-campo-busca input')!;
    digitarNoCampo(campo, 'lanc');
    await fixture.whenStable();
    expect(itens()).toEqual(['Lançamento, 2 não lidas, silenciado. Ana: Peças aprovadas']);
    expect(raiz.querySelector('[role=status]')?.textContent).toContain('Buscando nas mensagens');

    await new Promise((resolver) => setTimeout(resolver, ESPERA_BUSCA_MS + 20));
    const busca = http.expectOne((r) => r.url === '/api/v1/chat/mensagens/busca');
    expect(busca.request.params.get('texto')).toBe('lanc');
    busca.flush({
      itens: [
        {
          mensagem: mensagem({ id: 'm7', texto: 'Lançamento na segunda' }),
          canal: { id: 'g1', tipo: 'GRUPO', nome: 'Lançamento' },
        },
      ],
      total: 1,
      pagina: 1,
      porPagina: 20,
    });
    await assentar();
    await fixture.whenStable();
    const resultado = raiz.querySelector<HTMLAnchorElement>('a.resultado')!;
    expect(resultado.getAttribute('href')).toBe('/chat/g1?mensagem=m7');
    expect(resultado.textContent?.replace(/\s+/g, ' ')).toContain(
      'Ana Lima: Lançamento na segunda',
    );
    expect(resultado.querySelector('mark')?.textContent).toBe('Lanç');
    expect(raiz.textContent).toContain('1 mensagem encontrada.');
  });

  it('nome que não existe: estado de busca vazia (sem procurar nas mensagens com uma letra)', async () => {
    const { fixture, raiz } = await criar((h) => h.canais.set(CANAIS));
    digitarNoCampo(raiz.querySelector<HTMLInputElement>('app-campo-busca input')!, 'z');
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Nenhuma conversa com esse nome');
    await new Promise((resolver) => setTimeout(resolver, ESPERA_BUSCA_MS + 20));
    http.expectNone((r) => r.url === '/api/v1/chat/mensagens/busca');
  });
});
