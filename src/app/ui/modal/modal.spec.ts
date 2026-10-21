import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <app-modal
      [(aberto)]="aberto"
      titulo="Análise com IA"
      complemento="· beta"
      (fechado)="fechamentos = fechamentos + 1"
    >
      <p>Corpo</p>
      <div modal-rodape><button type="button">Gerar análise</button></div>
    </app-modal>
  `,
})
class Hospedeiro {
  readonly aberto = signal(false);
  fechamentos = 0;
}

// O jsdom não implementa showModal(): o componente cai para o atributo `open`.
describe('Modal', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    return { fixture, hospedeiro: fixture.componentInstance, dialogo };
  }

  it('usa <dialog> nomeado pelo título em dois tons', () => {
    const { dialogo } = criar();
    const titulo = dialogo.querySelector('h2') as HTMLElement;
    // O "·" fica preso ao título (espaço inseparável) e o complemento desce inteiro.
    expect(titulo.textContent?.trim()).toBe('Análise com IA\u00a0· beta');
    const tons = [...titulo.querySelectorAll('.tom-fraco')].map((tom) => tom.textContent);
    expect(tons).toEqual(['· ', 'beta']);
    expect(dialogo.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(dialogo.querySelector('.modal__rodape button')?.textContent).toBe('Gerar análise');
  });

  it('abre com [(aberto)] e fecha pelo botão "Fechar"', async () => {
    const { fixture, hospedeiro, dialogo } = criar();
    hospedeiro.aberto.set(true);
    await fixture.whenStable();
    expect(dialogo.hasAttribute('open')).toBe(true);
    const fechar = dialogo.querySelector('button[aria-label="Fechar"]') as HTMLButtonElement;
    fechar.click();
    await fixture.whenStable();
    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(hospedeiro.aberto()).toBe(false);
    expect(hospedeiro.fechamentos).toBe(1);
  });

  it('fecha quando o pai muda aberto para false', async () => {
    const { fixture, hospedeiro, dialogo } = criar();
    hospedeiro.aberto.set(true);
    await fixture.whenStable();
    hospedeiro.aberto.set(false);
    await fixture.whenStable();
    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(hospedeiro.fechamentos).toBe(1);
  });
});
