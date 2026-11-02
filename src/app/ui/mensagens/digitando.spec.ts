import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Digitando } from './digitando';

@Component({
  imports: [Digitando],
  template: `<app-digitando [nomes]="nomes()" />`,
})
class Hospedeiro {
  readonly nomes = signal<readonly string[]>([]);
}

describe('Digitando', () => {
  it('a região viva fica sempre no lugar; os pontos e a frase só com alguém digitando', async () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('app-digitando') as HTMLElement;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.textContent?.trim()).toBe('');
    expect(host.querySelector('.digitando__pontos')).toBeNull();

    fixture.componentInstance.nomes.set(['Maria']);
    await fixture.whenStable();
    expect(host.querySelector('.digitando__frase')?.textContent).toBe('Maria está digitando…');
    const pontos = host.querySelector('.digitando__pontos')!;
    expect(pontos.getAttribute('aria-hidden')).toBe('true');

    // Cada mudança recria os pontos (a animação recomeça).
    fixture.componentInstance.nomes.set(['Maria', 'Ana']);
    await fixture.whenStable();
    expect(host.querySelector('.digitando__pontos')).not.toBe(pontos);
    expect(host.querySelector('.digitando__frase')?.textContent).toBe(
      'Maria e Ana estão digitando…',
    );
  });
});
