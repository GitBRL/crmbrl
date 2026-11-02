import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PilhaAvatares, type PessoaAvatar } from './pilha-avatares';

@Component({
  imports: [PilhaAvatares],
  template: `<app-pilha-avatares [pessoas]="pessoas()" />`,
})
class Hospedeiro {
  readonly pessoas = signal<readonly PessoaAvatar[]>(
    ['Ana Ribeiro', 'Bruno Costa', 'Carla Nogueira', 'Davi Melo', 'Eva Lins'].map((nome) => ({
      nome,
    })),
  );
}

describe('PilhaAvatares', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const pilha = fixture.nativeElement.querySelector('app-pilha-avatares') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, pilha };
  }

  it('mostra até três avatares coloridos e o restante em "+k"', () => {
    const { pilha } = criar();
    const avatares = pilha.querySelectorAll('app-avatar');
    expect(avatares.length).toBe(3);
    expect(avatares[0].classList).toContain('avatar--ciano');
    expect(avatares[1].classList).toContain('avatar--menta');
    expect(avatares[2].classList).toContain('avatar--lima');
    expect(avatares[0].classList).toContain('pilha__avatar');
    expect(pilha.querySelector('.pilha__mais')?.textContent).toBe('+2');
  });

  it('é uma imagem só, com a lista de nomes (também no title, para quem usa mouse)', () => {
    const { pilha } = criar();
    expect(pilha.getAttribute('role')).toBe('img');
    expect(pilha.getAttribute('aria-label')).toBe(
      'Equipe: Ana Ribeiro, Bruno Costa, Carla Nogueira e mais 2 pessoas',
    );
    expect(pilha.getAttribute('title')).toBe(pilha.getAttribute('aria-label'));
  });

  it('sem excedente não mostra o "+k"', () => {
    const { fixture, hospedeiro, pilha } = criar();
    hospedeiro.pessoas.set([{ nome: 'Ana Ribeiro' }, { nome: 'Bruno Costa' }]);
    fixture.detectChanges();
    expect(pilha.querySelector('.pilha__mais')).toBeNull();
    expect(pilha.getAttribute('aria-label')).toBe('Equipe: Ana Ribeiro e Bruno Costa');
  });
});
