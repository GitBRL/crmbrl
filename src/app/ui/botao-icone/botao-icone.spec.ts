import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LucideBell } from '@lucide/angular';

import { BotaoIcone, type VarianteBotaoIcone } from './botao-icone';

@Component({
  imports: [BotaoIcone],
  template: `
    <button
      appBotaoIcone
      type="button"
      [icone]="icone"
      rotulo="Notificações"
      [variante]="variante()"
      [tamanho]="tamanho()"
      [ponto]="ponto()"
      [contagem]="contagem()"
    ></button>
  `,
})
class Hospedeiro {
  readonly icone = LucideBell;
  readonly variante = signal<VarianteBotaoIcone>('neutro');
  readonly tamanho = signal<'sm' | 'md' | 'lg'>('md');
  readonly ponto = signal(false);
  readonly contagem = signal<number | null>(null);
}

describe('BotaoIcone', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, hospedeiro: fixture.componentInstance, botao };
  }

  it('usa o rótulo como nome acessível e o ícone como decoração', () => {
    const { botao } = criar();
    expect(botao.getAttribute('aria-label')).toBe('Notificações');
    expect(botao.getAttribute('title')).toBe('Notificações');
    expect(botao.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(botao.classList).toContain('botao-icone--neutro');
  });

  it('aplica variantes e tamanhos', () => {
    const { fixture, hospedeiro, botao } = criar();
    for (const variante of ['contorno', 'invertido', 'destaque', 'marca'] as const) {
      hospedeiro.variante.set(variante);
      fixture.detectChanges();
      expect(botao.classList).toContain(`botao-icone--${variante}`);
    }
    hospedeiro.tamanho.set('sm');
    fixture.detectChanges();
    expect(botao.classList).toContain('botao-icone--sm');
  });

  it('mostra o ponto de notificação', () => {
    const { fixture, hospedeiro, botao } = criar();
    expect(botao.querySelector('.botao-icone__ponto')).toBeNull();
    hospedeiro.ponto.set(true);
    fixture.detectChanges();
    expect(botao.querySelector('.botao-icone__ponto')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('mostra a contagem (no máximo "9+") no lugar do ponto', () => {
    const { fixture, hospedeiro, botao } = criar();
    hospedeiro.ponto.set(true);
    hospedeiro.contagem.set(3);
    fixture.detectChanges();
    expect(botao.querySelector('.botao-icone__contagem')?.textContent).toBe('3');
    expect(botao.querySelector('.botao-icone__ponto')).toBeNull();
    hospedeiro.contagem.set(12);
    fixture.detectChanges();
    expect(botao.querySelector('.botao-icone__contagem')?.textContent).toBe('9+');
    hospedeiro.contagem.set(0);
    fixture.detectChanges();
    expect(botao.querySelector('.botao-icone__contagem')).toBeNull();
  });
});
