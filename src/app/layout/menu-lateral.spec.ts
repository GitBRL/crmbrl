import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MODULOS } from '../nucleo/navegacao';
import { SessaoService } from '../nucleo/sessao/sessao.service';
import { entrarComo, setoresDeTeste } from '../nucleo/sessao/sessao-de-teste';
import { definirRegistroDeSetores } from '../nucleo/setores/setores';
import { TempoRealService } from '../nucleo/tempo-real/tempo-real.service';
import { provideSocketFalso } from '../nucleo/tempo-real/tempo-real-de-teste';
import { descreverNaoLidas, MenuLateral } from './menu-lateral';

@Component({ template: '' })
class PaginaFalsa {}

// A navegação fica dentro de uma área que rola, como o cartão lateral da casca.
@Component({
  imports: [MenuLateral],
  template: `<div class="area" style="overflow-y: auto">
    <app-menu-lateral [recolhida]="recolhida()" />
  </div>`,
})
class Hospedeiro {
  readonly recolhida = signal(false);
}

/** Retângulo para simular o layout (o jsdom não calcula posições). */
const retangulo = (top: number, bottom: number) =>
  ({ top, bottom, left: 0, right: 40, width: 40, height: bottom - top, x: 0, y: top }) as DOMRect;

describe('MenuLateral', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...MODULOS.map((modulo) => ({ path: modulo.rota.slice(1), component: PaginaFalsa })),
          { path: 'empresas/:id', component: PaginaFalsa },
        ]),
      ],
    });
    entrarComo('ADMIN');
  });
  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const itens = () => [...raiz.querySelectorAll<HTMLAnchorElement>('a.menu__item')];
    return { fixture, raiz, itens };
  }

  it('Admin vê todos os módulos, em grupos nomeados', () => {
    const { raiz, itens } = criar();
    expect(raiz.querySelector('nav')?.getAttribute('aria-label')).toBe('Principal');
    expect(itens().map((item) => item.getAttribute('href'))).toEqual(MODULOS.map((m) => m.rota));
    const grupos = [...raiz.querySelectorAll('.menu__grupo')].map((g) => g.textContent?.trim());
    expect(grupos).toEqual(['Funis', 'Relacionamento', 'Gestão', 'Sistema']);
    for (const lista of raiz.querySelectorAll('ul[aria-labelledby]')) {
      const rotulo = raiz.querySelector(`#${lista.getAttribute('aria-labelledby')}`);
      expect(rotulo?.classList).toContain('menu__grupo');
    }
  });

  it('a página atual entra na área que rola ajustando o scrollTop, sem scrollIntoView', async () => {
    // scrollIntoView move o ponto de partida do Tab no Chrome (o 1º Tab pularia o link
    // "Pular para o conteúdo"): a navegação não pode usá-lo.
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    try {
      const { fixture, raiz, itens } = criar();
      const area = raiz.querySelector('.area') as HTMLElement;
      let rolagem = 0;
      Object.defineProperties(area, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 300 },
        scrollTop: {
          configurable: true,
          get: () => rolagem,
          set: (valor: number) => {
            rolagem = valor;
          },
        },
      });
      area.getBoundingClientRect = () => retangulo(100, 400);
      const administracao = itens().find((item) => item.getAttribute('href') === '/administracao')!;
      administracao.getBoundingClientRect = () => retangulo(600 - rolagem, 640 - rolagem);

      await TestBed.inject(Router).navigateByUrl('/administracao');
      await fixture.whenStable();

      expect(administracao.classList).toContain('menu__item--ativo');
      expect(scrollIntoView).not.toHaveBeenCalled();
      // A base do item (640) fica 8px acima da base da área (400): rola 640 - 392 = 248.
      expect(rolagem).toBe(248);
    } finally {
      if (original) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      } else {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
      }
    }
  });

  it('módulos "em breve" têm selo; os prontos, não', () => {
    const { itens } = criar();
    const emBreve = MODULOS.filter((modulo) => modulo.status === 'em-breve').length;
    expect(itens().filter((item) => item.querySelector('app-selo')).length).toBe(emBreve);
    const inicio = itens().find((item) => item.getAttribute('href') === '/inicio');
    expect(inicio?.querySelector('app-selo')).toBeNull();
    expect(inicio?.getAttribute('aria-label')).toBeNull();
    expect(inicio?.textContent?.trim()).toBe('Visão geral');
    // O Financeiro (Onda C) está pronto: sem selo e sem "(em breve)" no nome.
    const financeiro = itens().find((item) => item.getAttribute('href') === '/financeiro');
    expect(financeiro?.getAttribute('aria-label')).toBeNull();
    expect(financeiro?.querySelector('app-selo')).toBeNull();
    // Os módulos da Fase 1 e os da Onda A (Atendimento, Chat da equipe) estão prontos.
    for (const rota of [
      '/funis/marketing',
      '/contatos',
      '/atividades',
      '/configuracoes',
      '/atendimento',
      '/chat',
    ]) {
      const item = itens().find((link) => link.getAttribute('href') === rota);
      expect(item?.querySelector('app-selo'), rota).toBeNull();
    }
  });

  it('filtra pelo papel e pelas permissões reais (Marketing não vê Atendimento; em Gestão vê só o BI)', () => {
    entrarComo('MARKETING');
    const { raiz, itens } = criar();
    const rotas = itens().map((item) => item.getAttribute('href'));
    expect(rotas).toContain('/funis/marketing');
    expect(rotas).toContain('/contatos');
    expect(rotas).toContain('/configuracoes');
    expect(rotas).not.toContain('/administracao');
    expect(rotas).not.toContain('/atendimento');
    expect(rotas).not.toContain('/funis/comercial');
    expect(rotas).not.toContain('/integracoes');
    const grupos = [...raiz.querySelectorAll('.menu__grupo')].map((g) => g.textContent?.trim());
    // Todo papel tem o BI (as abas do painel seguem a área); o resto de Gestão é de líderes e direção.
    expect(grupos).toContain('Gestão');
    expect(rotas).toContain('/bi');
    expect(rotas).not.toContain('/automacoes');
    expect(rotas).not.toContain('/financeiro');
  });

  it('setor criado depois aparece em Funis (Admin), com o nome dele; desativado, some', () => {
    const { fixture, itens } = criar();
    const funis = () =>
      itens()
        .map((item) => item.getAttribute('href'))
        .filter((rota) => rota?.startsWith('/funis/'));
    expect(funis()).toEqual(['/funis/marketing', '/funis/comercial', '/funis/cs']);
    // O formulário de setores recarrega a lista ao criar: o menu acompanha sem recarregar a sessão.
    definirRegistroDeSetores(setoresDeTeste([{ chave: 'POS_VENDA', nome: 'Pós-venda' }]));
    fixture.detectChanges();
    expect(funis()).toEqual([
      '/funis/marketing',
      '/funis/comercial',
      '/funis/cs',
      '/funis/pos_venda',
    ]);
    const novo = itens().find((item) => item.getAttribute('href') === '/funis/pos_venda');
    expect(novo?.querySelector('.menu__rotulo')?.textContent?.trim()).toBe('Pós-venda');
    definirRegistroDeSetores(
      setoresDeTeste([{ chave: 'POS_VENDA', nome: 'Pós-venda', ativo: false }]),
    );
    fixture.detectChanges();
    expect(funis()).not.toContain('/funis/pos_venda');
  });

  it('membro de um setor criado depois vê só o funil do próprio setor', () => {
    entrarComo('MEMBRO', {
      usuario: { area: 'POS_VENDA' },
      permissoes: { areasVisiveis: ['POS_VENDA'] },
    });
    definirRegistroDeSetores(setoresDeTeste([{ chave: 'POS_VENDA', nome: 'Pós-venda' }]));
    const { itens } = criar();
    const rotas = itens().map((item) => item.getAttribute('href'));
    expect(rotas.filter((rota) => rota?.startsWith('/funis/'))).toEqual(['/funis/pos_venda']);
  });

  it('marca a página atual com aria-current e o círculo invertido', async () => {
    const { fixture, itens } = criar();
    await TestBed.inject(Router).navigateByUrl('/funis/cs');
    await fixture.whenStable();
    const atual = itens().filter((item) => item.getAttribute('aria-current') === 'page');
    expect(atual.length).toBe(1);
    expect(atual[0].getAttribute('href')).toBe('/funis/cs');
    expect(atual[0].classList).toContain('menu__item--ativo');
  });

  it('rotas relacionadas marcam o módulo dono (empresa → Contatos e empresas)', async () => {
    const { fixture, itens } = criar();
    await TestBed.inject(Router).navigateByUrl('/empresas/123');
    await fixture.whenStable();
    const atual = itens().filter((item) => item.getAttribute('aria-current') === 'page');
    expect(atual.map((item) => item.getAttribute('href'))).toEqual(['/contatos']);
  });

  it('recolhida: rótulos só para leitores de tela e dica ao passar o mouse', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();

    expect(raiz.querySelector('nav')?.classList).toContain('menu--recolhido');
    const marketing = itens().find((item) => item.getAttribute('href') === '/financeiro')!;
    expect(marketing.querySelector('.menu__rotulo')?.classList).toContain('visualmente-oculto');
    expect(marketing.querySelector('app-selo')).toBeNull();

    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    expect(dica.getAttribute('aria-hidden')).toBe('true');
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.textContent?.trim()).toBe('Financeiro');
    expect(dica.classList).toContain('menu__dica--visivel');

    marketing.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');

    // No toque não há dica (o toque já navega).
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('recolhida: Esc fecha a dica, com o foco no item ou só com o mouse em cima (WCAG 1.4.13)', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();
    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    const marketing = itens().find((item) => item.getAttribute('href') === '/funis/marketing')!;

    // Pelo mouse: o foco está em outro lugar e o Esc chega ao documento.
    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');

    // Pelo teclado: foco no item, Esc no próprio item.
    marketing.focus();
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');
    marketing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('recolhida: a dica fica aberta enquanto o ponteiro vai do item até ela', async () => {
    const { fixture, raiz, itens } = criar();
    fixture.componentInstance.recolhida.set(true);
    await fixture.whenStable();
    const dica = raiz.querySelector('.menu__dica') as HTMLElement;
    const marketing = itens().find((item) => item.getAttribute('href') === '/funis/marketing')!;
    const sair = (de: HTMLElement, para: Element) =>
      de.dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'mouse', relatedTarget: para }),
      );

    marketing.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    sair(marketing, dica);
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');

    sair(dica, marketing.querySelector('.menu__circulo')!);
    await fixture.whenStable();
    expect(dica.classList).toContain('menu__dica--visivel');

    // Clicar no balão é clicar no item.
    dica.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/funis/marketing');

    sair(dica, document.body);
    await fixture.whenStable();
    expect(dica.classList).not.toContain('menu__dica--visivel');
  });

  it('expandida não mostra dica', async () => {
    const { fixture, raiz, itens } = criar();
    itens()[1].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(raiz.querySelector('.menu__dica')?.classList).not.toContain('menu__dica--visivel');
  });
});

describe('MenuLateral — não lidas do tempo real', () => {
  let falso: ReturnType<typeof provideSocketFalso>;

  beforeEach(() => {
    localStorage.clear();
    falso = provideSocketFalso();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          MODULOS.map((modulo) => ({ path: modulo.rota.slice(1), component: PaginaFalsa })),
        ),
        falso.providers,
      ],
    });
    entrarComo('ADMIN');
  });
  afterEach(() => localStorage.clear());

  /** Cria a navegação e conecta o socket falso do tempo real. */
  async function criarConectado() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    TestBed.tick();
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    falso.ultimo().simularConexao();
    const raiz = fixture.nativeElement as HTMLElement;
    const item = (rota: string) =>
      raiz.querySelector<HTMLAnchorElement>(`a.menu__item[href="${rota}"]`)!;
    return { fixture, raiz, item, socket: falso.ultimo() };
  }

  it('Atendimento e Chat da equipe mostram as contagens do evento "nao-lidas" (99+ acima de 99)', async () => {
    const { fixture, item, socket } = await criarConectado();
    expect(item('/atendimento').querySelector('.menu__contagem')).toBeNull();

    socket.receber('nao-lidas', { atendimento: 3, chat: 120, notificacoes: 7 });
    await fixture.whenStable();
    expect(item('/atendimento').querySelector('.menu__contagem')?.textContent?.trim()).toBe('3');
    expect(item('/chat').querySelector('.menu__contagem')?.textContent?.trim()).toBe('99+');
    // O número é visual; o nome acessível do item diz quantas.
    expect(item('/atendimento').querySelector('.menu__contagem')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(item('/atendimento').getAttribute('aria-label')).toBe('Atendimento, 3 não lidas');
    expect(item('/chat').getAttribute('aria-label')).toBe('Chat da equipe, 120 não lidas');
    // Os outros módulos não têm contador.
    expect(item('/contatos').querySelector('.menu__contagem')).toBeNull();

    // Cada evento traz só o que mudou: zerar o chat não mexe no Atendimento.
    socket.receber('nao-lidas', { chat: 0 });
    await fixture.whenStable();
    expect(item('/chat').querySelector('.menu__contagem')).toBeNull();
    expect(item('/chat').getAttribute('aria-label')).toBeNull();
    expect(item('/atendimento').querySelector('.menu__contagem')?.textContent?.trim()).toBe('3');
  });

  it('recolhida: a contagem vai para o canto do círculo e entra na dica', async () => {
    const { fixture, raiz, item, socket } = await criarConectado();
    fixture.componentInstance.recolhida.set(true);
    socket.receber('nao-lidas', { atendimento: 1 });
    await fixture.whenStable();

    const atendimento = item('/atendimento');
    expect(
      atendimento.querySelector('.menu__circulo .menu__contagem--canto')?.textContent?.trim(),
    ).toBe('1');
    expect(atendimento.getAttribute('aria-label')).toBe('Atendimento, 1 não lida');
    atendimento.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(raiz.querySelector('.menu__dica')?.textContent?.trim()).toBe('Atendimento · 1 não lida');
  });

  it('a sessão acaba: as contagens zeram', async () => {
    const { fixture, item, socket } = await criarConectado();
    socket.receber('nao-lidas', { atendimento: 5, chat: 2 });
    await fixture.whenStable();
    expect(item('/chat').querySelector('.menu__contagem')).not.toBeNull();
    TestBed.inject(SessaoService).encerrarLocalmente();
    TestBed.tick();
    await fixture.whenStable();
    expect(socket.desconectado).toBe(true);
    expect(TestBed.inject(TempoRealService).naoLidas()).toEqual({ atendimento: 0, chat: 0 });
  });

  it('descreverNaoLidas: singular e plural', () => {
    expect(descreverNaoLidas(1)).toBe('1 não lida');
    expect(descreverNaoLidas(12)).toBe('12 não lidas');
  });
});
