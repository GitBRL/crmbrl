import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { Notificacao } from '../nucleo/notificacoes.service';
import { entrarComo } from '../nucleo/sessao/sessao-de-teste';
import { Notificacoes } from './notificacoes';

@Component({ template: '' })
class PaginaFalsa {}

const URL_LISTA = '/api/v1/notificacoes?pagina=1&porPagina=20';
const agora = Date.now();
const haMinutos = (minutos: number) => new Date(agora - minutos * 60_000).toISOString();

const ITENS: Notificacao[] = [
  {
    id: 'lida',
    tipo: 'atividade.atrasada',
    titulo: 'Atividade atrasada',
    texto: 'A ligação venceu.',
    link: '/atividades?atividade=a1',
    dados: null,
    lidaEm: haMinutos(1),
    criadoEm: haMinutos(2),
  },
  {
    id: 'nova',
    tipo: 'negocio.atribuido',
    titulo: 'Negócio atribuído a você',
    texto: 'Helena deixou “Grupo Castro” com você.',
    link: '/funis/comercial',
    dados: null,
    lidaEm: null,
    criadoEm: haMinutos(47),
  },
  {
    id: 'sem-link',
    tipo: 'equipe.sem_lider',
    titulo: 'Equipe sem líder',
    texto: null,
    link: null,
    dados: null,
    lidaEm: null,
    criadoEm: haMinutos(26 * 60),
  },
];

async function microtarefas(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe('Notificacoes (sino)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: PaginaFalsa }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function criar(itens: Notificacao[] = ITENS) {
    const fixture = TestBed.createComponent(Notificacoes);
    entrarComo('COMERCIAL');
    fixture.detectChanges();
    const naoLidas = itens.filter((item) => !item.lidaEm).length;
    http
      .expectOne(URL_LISTA)
      .flush({ itens, total: itens.length, pagina: 1, porPagina: 20, naoLidas });
    await microtarefas();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const sino = raiz.querySelector('button') as HTMLButtonElement;
    const abrir = async () => {
      sino.click();
      fixture.detectChanges();
      // Abrir atualiza na hora.
      http
        .expectOne(URL_LISTA)
        .flush({ itens, total: itens.length, pagina: 1, porPagina: 20, naoLidas });
      await microtarefas();
      fixture.detectChanges();
      return raiz.querySelector('section') as HTMLElement;
    };
    return { fixture, raiz, sino, abrir };
  }

  it('o sino mostra a contagem de não lidas, também no nome acessível', async () => {
    const { sino, raiz } = await criar();
    expect(sino.getAttribute('aria-label')).toBe('Notificações, 2 não lidas');
    expect(sino.getAttribute('aria-expanded')).toBe('false');
    expect(sino.querySelector('.botao-icone__contagem')?.textContent).toBe('2');
    expect(raiz.querySelector('section')).toBeNull();
  });

  it('o painel lista as não lidas primeiro, com tempo relativo e o link do item', async () => {
    const { sino, raiz, abrir } = await criar();
    const painel = await abrir();
    expect(sino.getAttribute('aria-expanded')).toBe('true');
    expect(sino.getAttribute('aria-controls')).toBe(painel.id);
    expect(raiz.querySelector(`#${painel.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Notificações',
    );
    const titulos = [...painel.querySelectorAll('.notificacoes__item-titulo')].map((item) =>
      item.textContent?.trim(),
    );
    expect(titulos).toEqual(['Negócio atribuído a você', 'Equipe sem líder', 'Atividade atrasada']);
    const tempos = [...painel.querySelectorAll('time')].map((tempo) => tempo.textContent?.trim());
    expect(tempos).toEqual(['há 47 min', 'ontem', 'há 2 min']);
    const links = [...painel.querySelectorAll<HTMLAnchorElement>('a.notificacoes__link')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/funis/comercial',
      '/atividades?atividade=a1',
    ]);
    expect(links[0].textContent).toContain('Não lida:');
    expect(links[1].textContent).not.toContain('Não lida:');
  });

  it('clicar no item marca como lida, fecha o painel e segue o link', async () => {
    const { fixture, raiz, abrir } = await criar();
    const painel = await abrir();
    painel.querySelector<HTMLAnchorElement>('a.notificacoes__link')?.click();
    http
      .expectOne('/api/v1/notificacoes/nova/marcar-lida')
      .flush({ ...ITENS[1], lidaEm: haMinutos(0) });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.querySelector('section')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/funis/comercial');
    expect(raiz.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Notificações, 1 não lida',
    );
  });

  it('"Marcar todas como lidas" zera a contagem', async () => {
    const { fixture, sino, abrir } = await criar();
    const painel = await abrir();
    const botao = [...painel.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Marcar todas como lidas'),
    ) as HTMLButtonElement;
    botao.click();
    http.expectOne('/api/v1/notificacoes/marcar-todas-lidas').flush({ marcadas: 2 });
    await microtarefas();
    fixture.detectChanges();
    expect(sino.getAttribute('aria-label')).toBe('Notificações');
    expect(botao.disabled).toBe(true);
  });

  it('sem notificações: frase dizendo o que aparece ali', async () => {
    const { abrir } = await criar([]);
    const painel = await abrir();
    expect(painel.textContent).toContain('Nenhuma notificação por enquanto.');
    expect(painel.querySelector('ul')).toBeNull();
  });

  it('Esc fecha e devolve o foco ao sino', async () => {
    const { fixture, raiz, sino, abrir } = await criar();
    const painel = await abrir();
    painel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(raiz.querySelector('section')).toBeNull();
    expect(document.activeElement).toBe(sino);
  });
});
