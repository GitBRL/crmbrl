import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LucideShare2 } from '@lucide/angular';

import { Botao, type VarianteBotao } from './botao';

@Component({
  imports: [Botao],
  template: `
    <button
      appBotao
      type="button"
      [variante]="variante()"
      [tamanho]="tamanho()"
      [icone]="icone()"
      [ativo]="ativo()"
      [carregando]="carregando()"
      [semCirculo]="semCirculo()"
      (click)="cliques = cliques + 1"
    >
      Compartilhar
    </button>
    <a appBotao href="/inicio">Ir para a visão geral</a>
  `,
})
class Hospedeiro {
  readonly variante = signal<VarianteBotao>('neutro');
  readonly tamanho = signal<'sm' | 'md' | 'lg'>('md');
  readonly icone = signal<typeof LucideShare2 | null>(null);
  readonly ativo = signal(false);
  readonly carregando = signal(false);
  readonly semCirculo = signal(false);
  cliques = 0;
}

describe('Botao', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, hospedeiro: fixture.componentInstance, botao };
  }

  it('renderiza o rótulo no elemento nativo, na variante neutra e tamanho md', () => {
    const { botao } = criar();
    expect(botao.textContent?.trim()).toBe('Compartilhar');
    expect(botao.classList).toContain('botao');
    expect(botao.classList).toContain('botao--neutro');
    expect(botao.classList).not.toContain('botao--sm');
    expect(botao.querySelector('.botao__icone')).toBeNull();
  });

  it('aplica variantes e tamanhos', () => {
    const { fixture, hospedeiro, botao } = criar();
    for (const variante of ['contorno', 'invertido', 'destaque', 'marca'] as const) {
      hospedeiro.variante.set(variante);
      fixture.detectChanges();
      expect(botao.classList).toContain(`botao--${variante}`);
    }
    hospedeiro.tamanho.set('lg');
    fixture.detectChanges();
    expect(botao.classList).toContain('botao--lg');
  });

  it('põe o ícone num círculo decorativo; `ativo` inverte o círculo', () => {
    const { fixture, hospedeiro, botao } = criar();
    hospedeiro.icone.set(LucideShare2);
    hospedeiro.ativo.set(true);
    fixture.detectChanges();
    const icone = botao.querySelector('.botao__icone');
    expect(icone?.getAttribute('aria-hidden')).toBe('true');
    expect(icone?.querySelector('svg')).not.toBeNull();
    expect(botao.classList).toContain('botao--com-circulo');
    expect(botao.classList).toContain('botao--ativo');
  });

  it('`semCirculo` mostra o ícone solto', () => {
    const { fixture, hospedeiro, botao } = criar();
    hospedeiro.icone.set(LucideShare2);
    hospedeiro.semCirculo.set(true);
    fixture.detectChanges();
    expect(botao.classList).toContain('botao--com-icone');
    expect(botao.classList).not.toContain('botao--com-circulo');
  });

  it('carregando: marca aria-busy/aria-disabled e cancela o clique', () => {
    const { fixture, hospedeiro, botao } = criar();
    botao.click();
    expect(hospedeiro.cliques).toBe(1);
    hospedeiro.carregando.set(true);
    fixture.detectChanges();
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.querySelector('.botao__giro')).not.toBeNull();
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    expect(clique.defaultPrevented).toBe(true);
    expect(hospedeiro.cliques).toBe(1);
  });

  it('funciona sobre <a>, mantendo o link', () => {
    const { fixture } = criar();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.classList).toContain('botao');
    expect(link.getAttribute('href')).toBe('/inicio');
    expect(link.hasAttribute('aria-busy')).toBe(false);
  });
});
