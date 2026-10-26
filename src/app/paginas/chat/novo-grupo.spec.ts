import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { ChatCanal, ChatPessoa } from './chat.tipos';
import { ANA, assentar, BRUNO, canal, digitarNoCampo, entrarNoChat } from './dados-de-teste';
import { NovaDireta } from './nova-direta';
import { NovoGrupo } from './novo-grupo';

@Component({
  imports: [NovoGrupo, NovaDireta],
  template: `
    <app-chat-novo-grupo [(aberto)]="grupoAberto" (criado)="criados.push($event)" />
    <app-chat-nova-direta [(aberto)]="diretaAberta" (aberta)="abertas.push($event)" />
  `,
})
class Hospedeiro {
  readonly grupoAberto = signal(false);
  readonly diretaAberta = signal(false);
  readonly criados: ChatCanal[] = [];
  readonly abertas: ChatCanal[] = [];
}

describe('Novo grupo e conversa direta (chat)', () => {
  let http: HttpTestingController;
  let eu: ChatPessoa;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    eu = entrarNoChat('COMERCIAL');
  });
  afterEach(() => http.verify());

  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    return {
      fixture,
      hospedeiro: fixture.componentInstance,
      raiz: fixture.nativeElement as HTMLElement,
    };
  }

  async function responderPessoas(fixture: { whenStable(): Promise<unknown> }) {
    await assentar();
    const pedido = http.expectOne((r) => r.url === '/api/v1/chat/pessoas');
    expect(pedido.request.params.get('porPagina')).toBe('100');
    pedido.flush({ itens: [eu, ANA, BRUNO], total: 3, pagina: 1, porPagina: 100 });
    await assentar();
    await fixture.whenStable();
  }

  it('cria o grupo com nome, descrição e as pessoas escolhidas (você não aparece na lista)', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    hospedeiro.grupoAberto.set(true);
    await fixture.whenStable();
    await responderPessoas(fixture);
    const pessoas = [...raiz.querySelectorAll<HTMLButtonElement>('app-chat-novo-grupo .pessoa')];
    expect(pessoas.map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      expect.stringContaining('Ana Lima'),
      expect.stringContaining('Bruno Tavares'),
    ]);
    expect(raiz.querySelector('.grupo__contagem')?.textContent).toBe('só você, por enquanto');

    // Sem nome: não envia e o campo mostra o erro.
    raiz.querySelector<HTMLButtonElement>('app-chat-novo-grupo button[type=submit]')!.click();
    await fixture.whenStable();
    http.expectNone('/api/v1/chat/grupos');
    expect(raiz.querySelector('app-chat-novo-grupo app-campo-texto')?.textContent).toContain(
      'Preencha este campo',
    );

    digitarNoCampo(
      raiz.querySelector<HTMLInputElement>('app-chat-novo-grupo input:not([type=search])')!,
      ' Visita à ACME ',
    );
    digitarNoCampo(
      raiz.querySelector<HTMLTextAreaElement>('app-chat-novo-grupo textarea')!,
      'Preparação',
    );
    await fixture.whenStable();
    // Sem pessoas: pede ao menos uma.
    raiz.querySelector<HTMLButtonElement>('app-chat-novo-grupo button[type=submit]')!.click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Escolha pelo menos uma pessoa');

    pessoas[0].click();
    await fixture.whenStable();
    expect(pessoas[0].getAttribute('aria-pressed')).toBe('true');
    expect(raiz.querySelector('.grupo__contagem')?.textContent).toBe('você e mais 1 pessoa');
    raiz.querySelector<HTMLButtonElement>('app-chat-novo-grupo button[type=submit]')!.click();
    await fixture.whenStable();
    const pedido = http.expectOne('/api/v1/chat/grupos');
    expect(pedido.request.body).toEqual({
      nome: 'Visita à ACME',
      descricao: 'Preparação',
      membrosIds: ['u-ana'],
    });
    const criado = canal({ id: 'g9', nome: 'Visita à ACME' });
    pedido.flush(criado);
    await assentar();
    await fixture.whenStable();
    expect(hospedeiro.criados).toEqual([criado]);
    expect(hospedeiro.grupoAberto()).toBe(false);
  });

  it('pessoa que não está mais ativa (409): a mensagem aparece junto da escolha', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    hospedeiro.grupoAberto.set(true);
    await fixture.whenStable();
    await responderPessoas(fixture);
    digitarNoCampo(
      raiz.querySelector<HTMLInputElement>('app-chat-novo-grupo input:not([type=search])')!,
      'Grupo',
    );
    raiz.querySelector<HTMLButtonElement>('app-chat-novo-grupo .pessoa')!.click();
    await fixture.whenStable();
    raiz.querySelector<HTMLButtonElement>('app-chat-novo-grupo button[type=submit]')!.click();
    await fixture.whenStable();
    http.expectOne('/api/v1/chat/grupos').flush(
      {
        statusCode: 409,
        erro: 'conflito',
        mensagem: 'Ana Lima não está mais ativa.',
        requisicaoId: 'r',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await assentar();
    await fixture.whenStable();
    expect(raiz.querySelector('.grupo__erro')?.textContent).toContain(
      'Ana Lima não está mais ativa.',
    );
    expect(hospedeiro.grupoAberto()).toBe(true);
  });

  it('conversa direta: escolher a pessoa abre (ou cria) a conversa com ela', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    hospedeiro.diretaAberta.set(true);
    await fixture.whenStable();
    await responderPessoas(fixture);
    const bruno = [
      ...raiz.querySelectorAll<HTMLButtonElement>('app-chat-nova-direta .pessoa'),
    ].find((b) => b.textContent?.includes('Bruno'))!;
    expect(bruno.hasAttribute('aria-pressed')).toBe(false);
    bruno.click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Abrindo a conversa com Bruno Tavares');
    const pedido = http.expectOne('/api/v1/chat/diretas');
    expect(pedido.request.body).toEqual({ usuarioId: 'u-bruno' });
    const direta = canal({ id: 'd2', tipo: 'DIRETO', nome: 'Bruno Tavares', outraPessoa: BRUNO });
    pedido.flush({ criada: true, canal: direta });
    await assentar();
    expect(hospedeiro.abertas).toEqual([direta]);
    expect(hospedeiro.diretaAberta()).toBe(false);
  });

  it('a busca filtra a lista sem perguntar de novo quando a primeira resposta trouxe todos', async () => {
    const { fixture, hospedeiro, raiz } = await criar();
    hospedeiro.diretaAberta.set(true);
    await fixture.whenStable();
    await responderPessoas(fixture);
    digitarNoCampo(
      raiz.querySelector<HTMLInputElement>('app-chat-nova-direta app-campo-busca input')!,
      'josé',
    );
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 300));
    http.expectNone((r) => r.url === '/api/v1/chat/pessoas');
    expect(raiz.querySelector('app-chat-nova-direta .seletor__aviso')?.textContent).toContain(
      'Ninguém com “josé”',
    );
  });
});
