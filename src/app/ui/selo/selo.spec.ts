import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LucideSparkles } from '@lucide/angular';

import { Selo, type VarianteSelo } from './selo';

@Component({
  imports: [Selo],
  template: `
    <app-selo class="extra" [variante]="variante()" [ponto]="ponto()" [icone]="icone()"
      >4d</app-selo
    >
  `,
})
class Hospedeiro {
  readonly variante = signal<VarianteSelo>('neutro');
  readonly ponto = signal(false);
  readonly icone = signal<typeof LucideSparkles | null>(null);
}

describe('Selo', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const selo = fixture.nativeElement.querySelector('app-selo') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, selo };
  }

  it('renderiza o texto na variante neutra, mantendo as classes de quem usa', () => {
    const { selo } = criar();
    expect(selo.textContent?.trim()).toBe('4d');
    expect(selo.classList).toContain('selo');
    expect(selo.classList).toContain('selo--neutro');
    expect(selo.classList).toContain('extra');
  });

  it('troca de variante sem acumular classes', () => {
    const { fixture, hospedeiro, selo } = criar();
    hospedeiro.variante.set('coral');
    fixture.detectChanges();
    expect(selo.classList).toContain('selo--coral');
    expect(selo.classList).not.toContain('selo--neutro');
    expect(selo.classList).toContain('selo');
  });

  it('tamanho sm (listas densas)', () => {
    const fixture = TestBed.createComponent(Selo);
    fixture.componentRef.setInput('tamanho', 'sm');
    fixture.detectChanges();
    const selo = fixture.nativeElement as HTMLElement;
    expect(selo.classList).toContain('selo--sm');
    expect(selo.classList).toContain('selo--neutro');
    fixture.componentRef.setInput('tamanho', 'md');
    fixture.detectChanges();
    expect(selo.classList).not.toContain('selo--sm');
  });

  it('ponto e ícone são decorativos', () => {
    const { fixture, hospedeiro, selo } = criar();
    hospedeiro.ponto.set(true);
    hospedeiro.icone.set(LucideSparkles);
    fixture.detectChanges();
    expect(selo.querySelector('.selo__ponto')?.getAttribute('aria-hidden')).toBe('true');
    expect(selo.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
