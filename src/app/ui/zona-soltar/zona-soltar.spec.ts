import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ZonaSoltar } from './zona-soltar';

@Component({
  imports: [ZonaSoltar],
  template: `<app-zona-soltar [ativa]="ativa()" (soltar)="soltos.push($event)" />`,
})
class Hospedeiro {
  readonly ativa = signal(false);
  readonly soltos: string[] = [];
}

/** O jsdom não tem DragEvent: um Event comum com `dataTransfer` falso basta. */
function evento(tipo: string, texto = ''): Event {
  return Object.assign(new Event(tipo, { bubbles: true, cancelable: true }), {
    dataTransfer: { getData: () => texto, dropEffect: 'none' },
  });
}

describe('ZonaSoltar', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const zona = fixture.nativeElement.querySelector('app-zona-soltar') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, zona };
  }

  it('mostra o círculo "+" decorativo e a legenda', () => {
    const { zona } = criar();
    expect(zona.querySelector('.zona__circulo')?.getAttribute('aria-hidden')).toBe('true');
    expect(zona.querySelector('.zona__legenda')?.textContent).toBe('Solte um campo aqui');
  });

  it('fica coral enquanto um item passa por cima e emite o texto ao soltar', () => {
    const { fixture, hospedeiro, zona } = criar();
    zona.dispatchEvent(evento('dragenter'));
    fixture.detectChanges();
    expect(zona.classList).toContain('zona--recebendo');
    const sobrevoo = evento('dragover');
    zona.dispatchEvent(sobrevoo);
    expect(sobrevoo.defaultPrevented).toBe(true);
    zona.dispatchEvent(evento('drop', 'Valor'));
    fixture.detectChanges();
    expect(hospedeiro.soltos).toEqual(['Valor']);
    expect(zona.classList).not.toContain('zona--recebendo');
  });

  it('dragleave dos filhos não apaga o destaque antes da hora', () => {
    const { fixture, zona } = criar();
    zona.dispatchEvent(evento('dragenter'));
    zona.dispatchEvent(evento('dragenter'));
    zona.dispatchEvent(evento('dragleave'));
    fixture.detectChanges();
    expect(zona.classList).toContain('zona--recebendo');
    zona.dispatchEvent(evento('dragleave'));
    fixture.detectChanges();
    expect(zona.classList).not.toContain('zona--recebendo');
  });

  it('`ativa` força o visual de recebendo', () => {
    const { fixture, hospedeiro, zona } = criar();
    hospedeiro.ativa.set(true);
    fixture.detectChanges();
    expect(zona.classList).toContain('zona--recebendo');
  });
});
