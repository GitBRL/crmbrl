import { TestBed } from '@angular/core/testing';

import { Esqueleto } from './esqueleto';

describe('Esqueleto', () => {
  it('é decorativo e desenha as linhas pedidas (a última mais curta)', async () => {
    const fixture = TestBed.createComponent(Esqueleto);
    fixture.componentRef.setInput('linhas', 3);
    fixture.componentRef.setInput('largura', '60%');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList).toContain('esqueleto--texto');
    const linhas = host.querySelectorAll<HTMLElement>('.esqueleto__forma');
    expect(linhas.length).toBe(3);
    expect(linhas[2].style.width).toBe('62%');
    expect(host.style.getPropertyValue('--_largura')).toBe('60%');
  });

  it('formas que não são texto têm um bloco só', async () => {
    const fixture = TestBed.createComponent(Esqueleto);
    fixture.componentRef.setInput('forma', 'circulo');
    fixture.componentRef.setInput('linhas', 3);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList).toContain('esqueleto--circulo');
    expect(host.querySelectorAll('.esqueleto__forma').length).toBe(1);
  });
});
