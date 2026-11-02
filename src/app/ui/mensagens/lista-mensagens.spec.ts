import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ListaMensagens } from './lista-mensagens';
import type { MensagemConversa } from './mensagens';

const MARIA = { id: 'c1', nome: 'Maria Souza' };
const ANA = { id: 'u1', nome: 'Ana Ribeiro' };

function conversa(total: number): MensagemConversa[] {
  const inicio = new Date(2026, 9, 23, 9, 0).getTime();
  return Array.from({ length: total }, (_, i) => ({
    id: String(i + 1),
    direcao: i % 2 ? 'SAIDA' : 'ENTRADA',
    tipo: 'TEXTO',
    texto: `Mensagem ${i + 1}`,
    criadaEm: new Date(inicio + i * 60_000),
    autor: i % 2 ? ANA : MARIA,
    status: i % 2 ? 'LIDA' : null,
  }));
}

@Component({
  imports: [ListaMensagens],
  template: `<div style="height: 400px; display: flex; flex-direction: column">
    <app-lista-mensagens
      rotulo="Mensagens com Maria"
      [mensagens]="mensagens()"
      [carregando]="carregando()"
      [temAnteriores]="temAnteriores()"
      [carregandoAnteriores]="carregandoAnteriores()"
      [digitando]="digitando()"
      (carregarAnteriores)="pedidos = pedidos + 1"
      (tentarDeNovo)="tentativas.push($event.id)"
    />
  </div>`,
})
class Hospedeiro {
  readonly mensagens = signal<readonly MensagemConversa[]>([]);
  readonly carregando = signal(false);
  readonly temAnteriores = signal(false);
  readonly carregandoAnteriores = signal(false);
  readonly digitando = signal<readonly string[]>([]);
  readonly lista = viewChild.required(ListaMensagens);
  pedidos = 0;
  readonly tentativas: string[] = [];
}

describe('ListaMensagens', () => {
  let anunciados: string[];

  beforeEach(() => {
    anunciados = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LiveAnnouncer,
          useValue: { announce: (texto: string) => (anunciados.push(texto), Promise.resolve()) },
        },
      ],
    });
  });

  async function criar(ajustes: (hospedeiro: Hospedeiro) => void = () => undefined) {
    const fixture = TestBed.createComponent(Hospedeiro);
    ajustes(fixture.componentInstance);
    await fixture.whenStable();
    // A rolagem virtual mede e renderiza num passo seguinte.
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, raiz };
  }

  it('área que rola nomeada e focável; carregando mostra bolhas-esqueleto e o aviso falado', async () => {
    const { raiz } = await criar((h) => h.carregando.set(true));
    const area = raiz.querySelector('cdk-virtual-scroll-viewport')!;
    expect(area.getAttribute('role')).toBe('region');
    expect(area.getAttribute('aria-label')).toBe('Mensagens com Maria');
    expect(area.getAttribute('tabindex')).toBe('0');
    expect(area.getAttribute('aria-busy')).toBe('true');
    expect(raiz.querySelectorAll('.lista__esqueletos app-esqueleto')).toHaveLength(4);
    expect(raiz.querySelector('[role=status]')?.textContent).toContain('Carregando as mensagens');
  });

  it('vazia mostra a frase; sem rolagem virtual de nada', async () => {
    const { raiz } = await criar();
    expect(raiz.querySelector('.lista__vazia')?.textContent?.trim()).toBe(
      'Nenhuma mensagem ainda.',
    );
    expect(raiz.querySelectorAll('.lista__item')).toHaveLength(0);
  });

  it('virtual: começa no fim e só as mensagens perto dele ficam no DOM', async () => {
    const { raiz } = await criar((h) => h.mensagens.set(conversa(200)));
    const itens = [...raiz.querySelectorAll<HTMLElement>('.lista__item')];
    expect(itens.length).toBeGreaterThan(5);
    expect(itens.length).toBeLessThan(60);
    expect(itens.at(-1)?.dataset['chave']).toBe('m:200');
    expect(itens.at(-1)?.textContent).toContain('Mensagem 200');
    // O começo (topo, separador do dia, primeiras mensagens) fica fora do DOM.
    expect(raiz.querySelector('[data-chave="m:1"]')).toBeNull();
    expect(raiz.querySelector('.lista__topo')).toBeNull();
    expect(raiz.querySelector('.lista__vazia')).toBeNull();
  });

  it('separador a cada dia', async () => {
    const ontem = new Date(Date.now() - 86_400_000);
    const { raiz } = await criar((h) =>
      h.mensagens.set([
        { ...conversa(1)[0], id: 'a', criadaEm: ontem },
        { ...conversa(1)[0], id: 'b', criadaEm: new Date() },
      ]),
    );
    const separadores = [...raiz.querySelectorAll('app-separador-data')].map((s) =>
      s.textContent?.trim(),
    );
    expect(separadores).toEqual(['Ontem', 'Hoje']);
  });

  it('topo: "Carregar mensagens anteriores" emite o pedido; sem mais, "Início da conversa"', async () => {
    const { fixture, hospedeiro, raiz } = await criar((h) => {
      h.mensagens.set(conversa(4));
      h.temAnteriores.set(true);
    });
    const botao = raiz.querySelector<HTMLButtonElement>('.lista__topo button')!;
    expect(botao.textContent?.trim()).toBe('Carregar mensagens anteriores');
    botao.click();
    expect(hospedeiro.pedidos).toBeGreaterThanOrEqual(1);
    const antes = hospedeiro.pedidos;

    hospedeiro.carregandoAnteriores.set(true);
    await fixture.whenStable();
    expect(raiz.querySelector('.lista__topo button')?.textContent?.trim()).toBe(
      'Carregando as anteriores…',
    );
    raiz.querySelector<HTMLButtonElement>('.lista__topo button')!.click();
    expect(hospedeiro.pedidos).toBe(antes); // não pede de novo enquanto carrega

    hospedeiro.carregandoAnteriores.set(false);
    hospedeiro.temAnteriores.set(false);
    await fixture.whenStable();
    expect(raiz.querySelector('.lista__inicio')?.textContent).toBe('Início da conversa');
  });

  it('anuncia ao leitor de tela só as mensagens novas de outra pessoa', async () => {
    const { fixture, hospedeiro } = await criar((h) => h.mensagens.set(conversa(4)));
    expect(anunciados).toEqual([]);
    const base = conversa(4);
    hospedeiro.mensagens.set([
      ...base,
      { ...base[1], id: '5', texto: 'Resposta da equipe' }, // SAIDA: não anuncia
    ]);
    await fixture.whenStable();
    expect(anunciados).toEqual([]);

    hospedeiro.mensagens.update((lista) => [
      ...lista,
      { ...base[0], id: '6', texto: 'Oi de novo' },
      { ...base[0], id: '7', texto: null, tipo: 'AUDIO' },
    ]);
    await fixture.whenStable();
    expect(anunciados).toEqual(['2 mensagens novas. A última de Maria Souza: Áudio']);
  });

  it('"digitando" aparece embaixo da lista', async () => {
    const { raiz } = await criar((h) => {
      h.mensagens.set(conversa(3));
      h.digitando.set(['Maria']);
    });
    expect(raiz.querySelector('.lista__digitando')?.textContent).toContain('Maria está digitando…');
  });

  it('"Tentar de novo" de uma bolha chega a quem usa a lista; rolarAte acha só mensagens carregadas', async () => {
    const { fixture, hospedeiro, raiz } = await criar((h) =>
      h.mensagens.set([
        {
          id: 'f1',
          direcao: 'SAIDA',
          tipo: 'TEXTO',
          texto: 'Falhou',
          status: 'FALHOU',
          criadaEm: new Date(),
          autor: ANA,
        },
      ]),
    );
    raiz.querySelector<HTMLButtonElement>('.bolha__falha button')!.click();
    await fixture.whenStable();
    expect(hospedeiro.tentativas).toEqual(['f1']);
    expect(hospedeiro.lista().rolarAte('f1')).toBe(true);
    expect(hospedeiro.lista().rolarAte('nao-existe')).toBe(false);
  });
});
