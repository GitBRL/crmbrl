import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { TemaService } from '../nucleo/tema.service';
import { ATRASO_PROGRESSO_MS, Casca } from './casca';
import { CHAVE_NAVEGACAO_RECOLHIDA } from './estado-casca';

@Component({ template: '<h1>Página</h1>' })
class PaginaFalsa {}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

const rotas: Routes = [
  {
    path: '',
    component: Casca,
    children: [
      { path: 'inicio', component: PaginaFalsa },
      { path: 'atendimento', component: PaginaFalsa },
      // Página que demora a abrir (rede lenta): a casca mostra o progresso.
      {
        path: 'lenta',
        component: PaginaFalsa,
        canActivate: [() => esperar(ATRASO_PROGRESSO_MS * 3).then(() => true)],
      },
      { path: '**', component: PaginaFalsa },
    ],
  },
];

const FOCAVEIS = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

// O jsdom não implementa showModal(): a gaveta cai para o atributo `open`, com o mesmo
// tratamento de Esc e Tab.
describe('Casca', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(rotas)] });
  });
  afterEach(() => localStorage.clear());

  async function criar(url = '/inicio') {
    const harness = await RouterTestingHarness.create(url);
    const raiz = harness.fixture.nativeElement as HTMLElement;
    const estabilizar = () => harness.fixture.whenStable();
    const gaveta = raiz.querySelector('dialog.gaveta') as HTMLDialogElement;
    const botaoMenu = raiz.querySelector('.topo__menu') as HTMLButtonElement;
    // O jsdom aplica o CSS do desktop, onde o botão de menu fica oculto: simula o mobile.
    botaoMenu.style.display = 'inline-grid';
    const teclar = (alvo: HTMLElement, key: string, shiftKey = false) =>
      alvo.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
      );
    return { harness, raiz, estabilizar, gaveta, botaoMenu, teclar };
  }

  it('o link "Pular para o conteúdo" é o primeiro focável e leva o foco ao <main>', async () => {
    const { raiz } = await criar();
    const primeiro = raiz.querySelector(FOCAVEIS) as HTMLAnchorElement;
    expect(primeiro.classList).toContain('link-pular');
    expect(primeiro.getAttribute('href')).toBe('#conteudo');
    primeiro.click();
    const main = raiz.querySelector('main') as HTMLElement;
    expect(main.id).toBe('conteudo');
    expect(document.activeElement).toBe(main);
  });

  it('tem barra superior, navegação principal e o conteúdo da rota', async () => {
    const { raiz } = await criar();
    expect(raiz.querySelector('header.topo')).not.toBeNull();
    expect(raiz.querySelector('.casca__lateral nav[aria-label="Principal"]')).not.toBeNull();
    expect(raiz.querySelector('main h1')?.textContent).toBe('Página');
    expect(raiz.querySelector('.casca__lateral app-aviso-demo')?.textContent).toContain(
      'Ana Ribeiro',
    );
  });

  it('a lista rola dentro do cartão e o aviso de demonstração fica fora dela, no pé', async () => {
    const { raiz } = await criar();
    const cartao = raiz.querySelector('.casca__cartao') as HTMLElement;
    const rolagem = cartao.querySelector('.casca__rolagem') as HTMLElement;
    expect(rolagem.classList).toContain('rolagem-esmaecida');
    expect(rolagem.querySelector('nav[aria-label="Principal"]')).not.toBeNull();
    expect(rolagem.querySelector('app-aviso-demo')).toBeNull();
    expect(cartao.lastElementChild?.tagName.toLowerCase()).toBe('app-aviso-demo');
  });

  it('recolhe e expande a navegação, com a escolha salva', async () => {
    const { raiz, estabilizar } = await criar();
    const alternar = raiz.querySelector('.casca__recolher') as HTMLButtonElement;
    expect(alternar.getAttribute('aria-label')).toBe('Recolher a navegação');
    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    expect(alternar.getAttribute('aria-controls')).toBe('navegacao-lateral');
    alternar.click();
    await estabilizar();
    expect(raiz.querySelector('.casca')?.classList).toContain('casca--recolhida');
    expect(raiz.querySelector('.casca__lateral nav')?.classList).toContain('menu--recolhido');
    expect(raiz.querySelector('.casca__lateral app-aviso-demo')).toBeNull();
    expect(localStorage.getItem(CHAVE_NAVEGACAO_RECOLHIDA)).toBe('true');
    expect(alternar.getAttribute('aria-label')).toBe('Expandir a navegação');
    expect(alternar.getAttribute('aria-expanded')).toBe('false');
  });

  it('navegação demorada: barra de progresso no topo e <main> ocupado até terminar', async () => {
    const { harness, raiz } = await criar();
    const main = raiz.querySelector('main') as HTMLElement;
    const navegacao = harness.navigateByUrl('/lenta');

    await esperar(ATRASO_PROGRESSO_MS / 3);
    harness.fixture.detectChanges();
    expect(raiz.querySelector('.casca__progresso')).toBeNull(); // rápida demais para aparecer

    await esperar(ATRASO_PROGRESSO_MS);
    harness.fixture.detectChanges();
    const barra = raiz.querySelector('.casca__progresso');
    expect(barra?.getAttribute('aria-hidden')).toBe('true');
    expect(main.getAttribute('aria-busy')).toBe('true');

    await navegacao;
    await harness.fixture.whenStable();
    expect(raiz.querySelector('.casca__progresso')).toBeNull();
    expect(main.hasAttribute('aria-busy')).toBe(false);
  });

  it('a gaveta abre pelo botão de menu, foca "Fechar" e o Esc fecha devolvendo o foco', async () => {
    const { raiz, estabilizar, gaveta, botaoMenu, teclar } = await criar();
    expect(gaveta.getAttribute('aria-label')).toBe('Navegação');
    expect(gaveta.hasAttribute('open')).toBe(false);

    botaoMenu.focus();
    botaoMenu.click();
    await estabilizar();
    expect(gaveta.hasAttribute('open')).toBe(true);
    expect(botaoMenu.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fechar a navegação');
    expect(gaveta.querySelector('nav[aria-label="Principal"]')).not.toBeNull();

    teclar(document.activeElement as HTMLElement, 'Escape');
    await estabilizar();
    expect(gaveta.hasAttribute('open')).toBe(false);
    expect(botaoMenu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botaoMenu);
    expect(raiz.querySelector('.casca')).not.toBeNull();
  });

  it('na gaveta, Tab e Shift+Tab dão a volta (foco preso)', async () => {
    const { estabilizar, gaveta, botaoMenu, teclar } = await criar();
    botaoMenu.click();
    await estabilizar();
    const focaveis = [...gaveta.querySelectorAll<HTMLElement>(FOCAVEIS)];
    const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
    expect(focaveis.length).toBeGreaterThan(4);

    ultimo.focus();
    teclar(ultimo, 'Tab');
    expect(document.activeElement).toBe(primeiro);
    teclar(primeiro, 'Tab', true);
    expect(document.activeElement).toBe(ultimo);
  });

  it('trocar de página fecha a gaveta e leva o foco ao conteúdo', async () => {
    const { harness, raiz, estabilizar, gaveta, botaoMenu } = await criar();
    botaoMenu.click();
    await estabilizar();
    await harness.navigateByUrl('/atendimento');
    await estabilizar();
    expect(gaveta.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(raiz.querySelector('main'));
  });

  it('troca de página leva o foco ao <main>; troca só de âncora, não', async () => {
    const { harness, raiz, estabilizar } = await criar();
    await harness.navigateByUrl('/atendimento');
    await estabilizar();
    const main = raiz.querySelector('main') as HTMLElement;
    expect(document.activeElement).toBe(main);

    main.blur();
    await harness.navigateByUrl('/atendimento#detalhes');
    await estabilizar();
    expect(document.activeElement).not.toBe(main);
  });

  it('o rodapé da gaveta tem o aviso compacto e o tema numa linha que é um botão só', async () => {
    const { raiz, estabilizar, gaveta, botaoMenu } = await criar();
    botaoMenu.click();
    await estabilizar();
    const aviso = gaveta.querySelector('.gaveta__rodape app-aviso-demo') as HTMLElement;
    expect(aviso.textContent).toContain('Ana Ribeiro');
    expect(aviso.querySelector('button')?.getAttribute('aria-label')).toBe('Ver como outro papel');

    const tema = TestBed.inject(TemaService);
    const botaoTema = gaveta.querySelector('button.gaveta__tema') as HTMLButtonElement;
    const antes = tema.tema();
    expect(botaoTema.textContent?.trim()).toBe(
      antes === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro',
    );
    botaoTema.click();
    await estabilizar();
    expect(tema.tema()).not.toBe(antes);
    expect(botaoTema.textContent?.trim()).toBe(
      antes === 'escuro' ? 'Usar tema escuro' : 'Usar tema claro',
    );
    expect(raiz.querySelector('.gaveta__rodape app-alternador-tema')).toBeNull();
  });

  it('"Ver como" no aviso abre o menu da conta', async () => {
    const { raiz, estabilizar } = await criar();
    (raiz.querySelector('.casca__lateral app-aviso-demo button') as HTMLButtonElement).click();
    await estabilizar();
    expect(raiz.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio');
  });

  it('na gaveta, "Ver como" fecha a gaveta antes de abrir o menu', async () => {
    const { raiz, estabilizar, gaveta, botaoMenu } = await criar();
    botaoMenu.click();
    await estabilizar();
    (gaveta.querySelector('app-aviso-demo button') as HTMLButtonElement).click();
    await estabilizar();
    expect(gaveta.hasAttribute('open')).toBe(false);
    expect(raiz.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio');
  });
});
