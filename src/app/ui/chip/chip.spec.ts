import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Chip, type TipoChip } from './chip';

@Component({
  imports: [Chip],
  template: `
    <app-chip
      [tipo]="tipo()"
      [selecionado]="selecionado()"
      [arrastando]="arrastando()"
      [arrastavel]="arrastavel()"
      >Origem do lead</app-chip
    >
  `,
})
class Hospedeiro {
  readonly tipo = signal<TipoChip | null>('texto');
  readonly selecionado = signal(false);
  readonly arrastando = signal(false);
  readonly arrastavel = signal(false);
}

describe('Chip', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('app-chip') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, chip };
  }

  it('mostra o rótulo e o selo de tipo (decorativo)', () => {
    const { fixture, hospedeiro, chip } = criar();
    expect(chip.querySelector('.chip__rotulo')?.textContent).toBe('Origem do lead');
    const tipo = () => chip.querySelector('.chip__tipo');
    expect(tipo()?.textContent?.trim()).toBe('A');
    expect(tipo()?.getAttribute('aria-hidden')).toBe('true');
    hospedeiro.tipo.set('numero');
    fixture.detectChanges();
    expect(tipo()?.textContent?.trim()).toBe('#');
    hospedeiro.tipo.set('data');
    fixture.detectChanges();
    expect(tipo()?.querySelector('svg')).not.toBeNull();
    hospedeiro.tipo.set(null);
    fixture.detectChanges();
    expect(tipo()).toBeNull();
    expect(chip.classList).not.toContain('chip--com-tipo');
  });

  it('estados selecionado e arrastando', () => {
    const { fixture, hospedeiro, chip } = criar();
    hospedeiro.selecionado.set(true);
    hospedeiro.arrastando.set(true);
    fixture.detectChanges();
    expect(chip.classList).toContain('chip--selecionado');
    expect(chip.classList).toContain('chip--arrastando');
  });

  it('`multilinha` deixa o rótulo longo quebrar a linha', () => {
    const fixture = TestBed.createComponent(Chip);
    fixture.componentRef.setInput('multilinha', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('chip--multilinha');
  });

  it('`arrastavel` liga o arrastar nativo', () => {
    const { fixture, hospedeiro, chip } = criar();
    expect(chip.hasAttribute('draggable')).toBe(false);
    hospedeiro.arrastavel.set(true);
    fixture.detectChanges();
    expect(chip.getAttribute('draggable')).toBe('true');
  });
});
