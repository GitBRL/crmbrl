import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Paginacao } from './paginacao';

@Component({
  imports: [Paginacao],
  template: `<app-paginacao
    rotulo="Paginação dos contatos"
    [total]="total()"
    [opcoesPorPagina]="[20, 50]"
    [(pagina)]="pagina"
    [(porPagina)]="porPagina"
  />`,
})
class Hospedeiro {
  readonly total = signal(234);
  readonly pagina = signal(1);
  readonly porPagina = signal(20);
}

describe('Paginacao', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const paginas = () =>
      [...raiz.querySelectorAll('.paginacao__paginas li')].map((li) => li.textContent?.trim());
    return { fixture, raiz, paginas, hospedeiro: fixture.componentInstance };
  }

  it('marco nomeado com resumo e páginas com reticências', async () => {
    const { raiz, paginas } = await criar();
    expect(raiz.querySelector('nav')?.getAttribute('aria-label')).toBe('Paginação dos contatos');
    expect(raiz.querySelector('.paginacao__resumo')?.textContent).toBe('1–20 de 234');
    expect(paginas()).toEqual(['1', '2', '3', '4', '5', '…', '12']);
    expect(raiz.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');
    expect(
      raiz.querySelector('[aria-label="Página anterior"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('próxima, uma página do meio e as reticências dos dois lados', async () => {
    const { fixture, raiz, paginas, hospedeiro } = await criar();
    (raiz.querySelector('[aria-label="Próxima página"]') as HTMLButtonElement).click();
    expect(hospedeiro.pagina()).toBe(2);
    hospedeiro.pagina.set(6);
    await fixture.whenStable();
    expect(paginas()).toEqual(['1', '…', '5', '6', '7', '…', '12']);
    expect(raiz.querySelector('.paginacao__resumo')?.textContent).toBe('101–120 de 234');
    expect(raiz.querySelector('.paginacao__compacto')?.textContent).toBe('Página 6 de 12');
    (raiz.querySelector('[aria-label="Página 12"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(hospedeiro.pagina()).toBe(12);
    (raiz.querySelector('[aria-label="Próxima página"]') as HTMLButtonElement).click();
    expect(hospedeiro.pagina()).toBe(12);
  });

  it('por página volta para a primeira; uma página só não mostra controles', async () => {
    const { fixture, raiz, hospedeiro } = await criar();
    hospedeiro.pagina.set(3);
    await fixture.whenStable();
    const seletor = raiz.querySelector('select') as HTMLSelectElement;
    seletor.value = '50';
    seletor.dispatchEvent(new Event('change'));
    expect(hospedeiro.porPagina()).toBe(50);
    expect(hospedeiro.pagina()).toBe(1);

    hospedeiro.total.set(8);
    await fixture.whenStable();
    expect(raiz.querySelector('.paginacao__controles')).toBeNull();
    expect(raiz.querySelector('.paginacao__resumo')?.textContent).toBe('1–8 de 8');
  });
});
