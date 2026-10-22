import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PainelLateral } from './painel-lateral';

@Component({
  imports: [PainelLateral],
  template: `
    <app-painel-lateral
      [(aberto)]="aberto"
      titulo="Escola Horizonte"
      complemento="· Proposta"
      descricao="Maria Souza · R$ 1.500"
      (fechado)="fechamentos = fechamentos + 1"
    >
      <button painel-acoes type="button">Ações</button>
      <p>Detalhe do negócio</p>
      <div painel-rodape><button type="button">Salvar</button></div>
    </app-painel-lateral>
  `,
})
class Hospedeiro {
  readonly aberto = signal(false);
  fechamentos = 0;
}

// O jsdom não implementa showModal(): o painel cai para o atributo `open`.
describe('PainelLateral', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    return { fixture, dialogo, hospedeiro: fixture.componentInstance };
  }

  it('dialog nomeado pelo título (que recebe o foco) e descrito pela linha de apoio', async () => {
    const { dialogo } = await criar();
    const titulo = dialogo.querySelector('h2') as HTMLElement;
    expect(dialogo.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(titulo.textContent?.trim()).toBe('Escola Horizonte · Proposta');
    expect(titulo.hasAttribute('autofocus')).toBe(true);
    expect(titulo.getAttribute('tabindex')).toBe('-1');
    expect(dialogo.querySelector(`#${dialogo.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Maria Souza · R$ 1.500',
    );
    expect(dialogo.querySelector('.painel__acoes button')?.textContent).toBe('Ações');
    expect(dialogo.querySelector('.painel__rodape button')?.textContent).toBe('Salvar');
  });

  it('abre com [(aberto)] e fecha pelo botão, avisando (fechado)', async () => {
    const { fixture, dialogo, hospedeiro } = await criar();
    hospedeiro.aberto.set(true);
    await fixture.whenStable();
    expect(dialogo.hasAttribute('open')).toBe(true);
    (dialogo.querySelector('[aria-label="Fechar painel"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(dialogo.hasAttribute('open')).toBe(false);
    expect(hospedeiro.aberto()).toBe(false);
    expect(hospedeiro.fechamentos).toBe(1);
  });

  it('os overlays do CDK no conteúdo ficam dentro do <dialog> (fora dele tudo é inerte)', async () => {
    const { fixture } = await criar();
    const painel = fixture.debugElement.children[0];
    const container = painel.injector.get(OverlayContainer).getContainerElement();
    expect(container.parentElement?.tagName).toBe('DIALOG');
  });
});
