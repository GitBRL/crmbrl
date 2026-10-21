import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MODULOS } from '../nucleo/navegacao';
import { PerfilDemoService } from '../nucleo/perfil-demo.service';
import { BarraSuperior, buscarModulo, normalizarBusca } from './barra-superior';
import { EstadoCasca } from './estado-casca';

@Component({ template: '' })
class PaginaFalsa {}

describe('busca de módulos', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizarBusca('  Configurações ')).toBe('configuracoes');
    expect(normalizarBusca('GESTÃO')).toBe('gestao');
  });

  it('prefere o nome que começa com o termo, depois o que contém, depois a descrição', () => {
    expect(buscarModulo('disp', MODULOS)?.id).toBe('disparos');
    expect(buscarModulo('success', MODULOS)?.id).toBe('funil-cs');
    expect(buscarModulo('kanban', MODULOS)?.id).toBe('funil-marketing'); // pelas funcionalidades
    expect(buscarModulo('empresas', MODULOS)?.id).toBe('contatos');
    expect(buscarModulo('relatorios', MODULOS)?.id).toBe('bi');
    expect(buscarModulo('whatsapp', MODULOS)?.id).toBe('atendimento');
    expect(buscarModulo('xyz', MODULOS)).toBeUndefined();
    expect(buscarModulo('   ', MODULOS)).toBeUndefined();
  });
});

describe('BarraSuperior', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        EstadoCasca,
        provideRouter([
          ...MODULOS.map((modulo) => ({ path: modulo.rota.slice(1), component: PaginaFalsa })),
          { path: '**', component: PaginaFalsa },
        ]),
      ],
    });
  });
  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(BarraSuperior);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector('app-campo-busca input') as HTMLInputElement;
    const buscar = async (texto: string) => {
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      raiz
        .querySelector('form[role="search"]')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, raiz, campo, buscar };
  }

  it('é o banner com a marca (link para a visão geral), busca e ações', () => {
    const { raiz, campo } = criar();
    expect(raiz.querySelector('header')).not.toBeNull();
    const marca = raiz.querySelector('a.topo__marca') as HTMLAnchorElement;
    expect(marca.getAttribute('href')).toBe('/inicio');
    expect(marca.getAttribute('aria-label')).toBe('BRL CRM: ir para a visão geral');
    expect(raiz.querySelector(`label[for="${campo.id}"]`)?.textContent).toBe('Buscar no CRM');
    // O campo diz o que a busca encontra nesta etapa.
    expect(campo.getAttribute('placeholder')).toBe('Buscar módulo (ex.: Disparos)…');
    expect(raiz.querySelector('app-alternador-tema button')?.getAttribute('aria-label')).toMatch(
      /^Ativar tema (claro|escuro)$/,
    );
    expect(raiz.querySelector('app-notificacoes button')?.getAttribute('aria-label')).toContain(
      'Notificações',
    );
    expect(raiz.querySelector('app-menu-conta button')?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('a busca leva ao módulo encontrado e limpa o campo', async () => {
    const { campo, buscar } = criar();
    await buscar('disparos');
    expect(TestBed.inject(Router).url).toBe('/disparos');
    expect(campo.value).toBe('');
  });

  it('sem resultado, avisa (live region) e o aviso some ao digitar', async () => {
    const { fixture, raiz, campo, buscar } = criar();
    const aviso = raiz.querySelector('.topo__aviso') as HTMLElement;
    expect(aviso.getAttribute('role')).toBe('status');
    await buscar('xyz');
    expect(aviso.textContent).toContain('Nenhum módulo encontrado para “xyz”.');
    expect(aviso.textContent).toContain(
      'Por enquanto a busca encontra módulos. Pessoas, empresas e negócios entram na Fase 1.',
    );
    expect(aviso.classList).toContain('topo__aviso--visivel');
    campo.value = 'xy';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(aviso.textContent?.trim()).toBe('');
  });

  it('só encontra módulos que a persona acessa', async () => {
    TestBed.inject(PerfilDemoService).verComo('MARKETING');
    const { raiz, buscar } = criar();
    await buscar('integrações');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(raiz.querySelector('.topo__aviso')?.textContent).toContain('Nenhum módulo');
  });

  it('o botão de menu (mobile) abre a gaveta', async () => {
    const { fixture, raiz } = criar();
    const menu = raiz.querySelector('.topo__menu') as HTMLButtonElement;
    expect(menu.getAttribute('aria-label')).toBe('Abrir a navegação');
    expect(menu.getAttribute('aria-controls')).toBe('gaveta-navegacao');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    await fixture.whenStable();
    expect(TestBed.inject(EstadoCasca).gavetaAberta()).toBe(true);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
  });

  it('o círculo da busca (mobile) abre o campo; Esc fecha e devolve o foco', async () => {
    const { fixture, raiz, campo } = criar();
    const abrir = raiz.querySelector('.topo__abrir-busca') as HTMLButtonElement;
    abrir.style.display = 'inline-grid'; // o jsdom aplica o CSS do desktop, onde ele fica oculto
    abrir.click();
    await fixture.whenStable();
    expect(raiz.querySelector('header')?.classList).toContain('topo--busca-aberta');
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(campo);
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(raiz.querySelector('header')?.classList).not.toContain('topo--busca-aberta');
    expect(document.activeElement).toBe(abrir);
  });

  it('o título da seção acompanha a página', async () => {
    const { fixture, raiz } = criar();
    await TestBed.inject(Router).navigateByUrl('/funis/cs');
    await fixture.whenStable();
    expect(raiz.querySelector('.topo__secao')?.textContent?.trim()).toBe('Customer Success');
    await TestBed.inject(Router).navigateByUrl('/nao-existe');
    await fixture.whenStable();
    expect(raiz.querySelector('.topo__secao')?.textContent?.trim()).toBe('Página não encontrada');
  });
});
