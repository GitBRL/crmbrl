import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { EscolherResponsavel } from './escolher-responsavel';
import type { OpcaoResponsavel } from './estado-quadro';

const OPCOES: readonly OpcaoResponsavel[] = [
  { id: 'u1', nome: 'Lucas Prado', detalhe: null, avatarUrl: null, voce: true },
  { id: 'u2', nome: 'José Antunes', detalhe: 'Líder', avatarUrl: null, voce: false },
  { id: 'u3', nome: 'Bia Souza', detalhe: 'Comercial', avatarUrl: null, voce: false },
];

describe('EscolherResponsavel', () => {
  let fixture: ComponentFixture<EscolherResponsavel>;
  let raiz: HTMLElement;
  let escolhas: (OpcaoResponsavel | null)[];

  function montar(extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(EscolherResponsavel);
    fixture.componentRef.setInput('opcoes', OPCOES);
    fixture.componentRef.setInput('aberto', true);
    for (const [nome, valor] of Object.entries(extra)) {
      fixture.componentRef.setInput(nome, valor);
    }
    escolhas = [];
    fixture.componentInstance.escolhido.subscribe((opcao) => escolhas.push(opcao));
    raiz = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const opcoes = () => [...raiz.querySelectorAll<HTMLButtonElement>('.escolher__opcao')];
  const nomes = () =>
    opcoes().map((o) =>
      o.querySelector('.escolher__nome')!.textContent!.replace(/\s+/g, ' ').trim(),
    );

  function digitar(texto: string): void {
    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"], input')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('lista "Sem responsável" e as pessoas, marcando a atual', () => {
    montar({ atualId: 'u2' });
    expect(nomes()[0]).toBe('Sem responsável');
    expect(nomes()).toContain('Lucas Prado (você)');
    const atual = opcoes().find((o) => o.textContent!.includes('José'))!;
    expect(atual.getAttribute('aria-pressed')).toBe('true');
  });

  it('sem permitirVazio, não oferece "Sem responsável"', () => {
    montar({ permitirVazio: false });
    expect(nomes().some((n) => n.startsWith('Sem responsável'))).toBe(false);
  });

  it('a busca ignora acento e caixa ("jose" acha "José")', () => {
    montar();
    digitar('jose');
    expect(nomes()).toEqual(['José Antunes · Líder']);
  });

  it('busca sem resultado avisa; Enter na busca escolhe a primeira opção', () => {
    montar({ permitirVazio: false });
    digitar('zzz');
    expect(raiz.querySelector('.escolher__vazio')?.textContent).toContain('Ninguém encontrado');
    digitar('bia');
    raiz.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(escolhas.map((e) => e?.id)).toEqual(['u3']);
  });

  it('clicar numa pessoa emite a escolha e fecha; "Sem responsável" emite null', () => {
    montar();
    opcoes()
      .find((o) => o.textContent!.includes('Bia'))!
      .click();
    expect(escolhas.map((e) => e?.id)).toEqual(['u3']);
    expect(fixture.componentInstance.aberto()).toBe(false);
    montar();
    opcoes()[0].click();
    expect(escolhas).toEqual([null]);
  });

  it('teclado: seta para baixo vai da busca à lista e as setas percorrem as opções', () => {
    montar();
    const campo = raiz.querySelector<HTMLInputElement>('input')!;
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(opcoes()[0]);
    opcoes()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(opcoes()[1]);
    opcoes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(opcoes()[0]);
  });
});
