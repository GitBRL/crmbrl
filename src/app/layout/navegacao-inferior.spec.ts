import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { entrarComo } from '../nucleo/sessao/sessao-de-teste';
import { EstadoCasca } from './estado-casca';
import { NavegacaoInferior } from './navegacao-inferior';

@Component({ template: '' })
class PaginaFalsa {}

const ROTAS = [
  'inicio',
  'atendimento',
  'atividades',
  'funis/comercial',
  'funis/cs',
  'funis/marketing',
];

describe('NavegacaoInferior', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(ROTAS.map((path) => ({ path, component: PaginaFalsa }))),
        EstadoCasca,
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).match(() => true));

  async function criar(papel: Parameters<typeof entrarComo>[0], url = '/inicio') {
    entrarComo(papel);
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(NavegacaoInferior);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const rotulos = () =>
      [...raiz.querySelectorAll('.nav-inf__rotulo')].map((e) => e.textContent?.trim());
    return { fixture, raiz, rotulos };
  }

  it('Comercial: Início, Atendimento, Atividades, Funis e Notificações', async () => {
    const { rotulos, raiz } = await criar('COMERCIAL');
    expect(rotulos()).toEqual(['Início', 'Atendimento', 'Atividades', 'Funis', 'Notificações']);
    expect(raiz.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegação principal');
    expect(raiz.querySelector('a[href="/funis/comercial"]')?.textContent?.trim()).toBe('Funis');
  });

  it('Marketing não vê o Atendimento (R12) e Funis leva ao funil dele', async () => {
    const { rotulos, raiz } = await criar('MARKETING');
    expect(rotulos()).toEqual(['Início', 'Atividades', 'Funis', 'Notificações']);
    expect(raiz.querySelector('a[href="/funis/marketing"]')).not.toBeNull();
  });

  it('CS: Funis leva ao funil de Customer Success', async () => {
    const { raiz } = await criar('CS');
    expect(raiz.querySelector('a[href="/funis/cs"]')).not.toBeNull();
  });

  it('marca o item da página atual', async () => {
    const { raiz } = await criar('COMERCIAL', '/funis/comercial');
    const ativos = [...raiz.querySelectorAll('.nav-inf__item--ativo')];
    expect(ativos.map((e) => e.getAttribute('aria-current'))).toEqual(['page']);
    expect(ativos[0].textContent).toContain('Funis');
  });

  it('o botão Ações rápidas abre o menu com responder, registrar atividade e mover negócio', async () => {
    const { fixture, raiz } = await criar('COMERCIAL');
    const botao = raiz.querySelector<HTMLButtonElement>('.nav-inf__mais')!;
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    botao.click();
    fixture.detectChanges();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect([...raiz.querySelectorAll('.nav-inf__acao strong')].map((e) => e.textContent)).toEqual([
      'Responder conversa',
      'Registrar atividade',
      'Mover negócio',
    ]);
    raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    raiz
      .querySelector('.nav-inf__acoes')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(raiz.querySelector('.nav-inf__menu')).toBeNull();
  });

  it('sem o Atendimento, "Responder conversa" não aparece', async () => {
    const { fixture, raiz } = await criar('MARKETING');
    raiz.querySelector<HTMLButtonElement>('.nav-inf__mais')!.click();
    fixture.detectChanges();
    expect([...raiz.querySelectorAll('.nav-inf__acao strong')].map((e) => e.textContent)).toEqual([
      'Registrar atividade',
      'Mover negócio',
    ]);
  });

  it('no Atendimento o botão de ações rápidas some (não cobre o campo de mensagem)', async () => {
    const { raiz } = await criar('COMERCIAL', '/atendimento');
    expect(raiz.querySelector('.nav-inf__mais')).toBeNull();
  });

  it('Notificações pede ao sino que abra o painel', async () => {
    const { raiz } = await criar('COMERCIAL');
    const estado = TestBed.inject(EstadoCasca);
    const antes = estado.pedidoNotificacoes();
    const itens = [...raiz.querySelectorAll<HTMLButtonElement>('button.nav-inf__item')];
    itens[itens.length - 1].click();
    expect(estado.pedidoNotificacoes()).toBe(antes + 1);
  });

  it('o toque que acabou de fechar o painel não o reabre', async () => {
    const { raiz } = await criar('COMERCIAL');
    const estado = TestBed.inject(EstadoCasca);
    const antes = estado.pedidoNotificacoes();
    estado.notificacoesFecharam();
    raiz.querySelector<HTMLButtonElement>('button.nav-inf__item')!.click();
    expect(estado.pedidoNotificacoes()).toBe(antes);
  });
});
