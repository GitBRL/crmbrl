import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Avatar, corDoNome, iniciaisDe } from './avatar';

@Component({
  imports: [Avatar],
  template: `<app-avatar
    [nome]="nome()"
    [foto]="foto()"
    [decorativo]="decorativo()"
    tamanho="lg"
  />`,
})
class Hospedeiro {
  readonly nome = signal('Maria da Silva');
  readonly foto = signal<string | null>(null);
  readonly decorativo = signal(false);
}

describe('Avatar', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const avatar = fixture.nativeElement.querySelector('app-avatar') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, avatar };
  }

  it('calcula iniciais e uma cor estável a partir do nome', () => {
    expect(iniciaisDe('Maria da Silva')).toBe('MS');
    expect(iniciaisDe('  ana  ')).toBe('A');
    expect(iniciaisDe('')).toBe('?');
    expect(corDoNome('Maria da Silva')).toBe(corDoNome('Maria da Silva'));
    expect(['ciano', 'menta', 'lima', 'coral']).toContain(corDoNome('João'));
  });

  it('é uma imagem com o nome; mostra as iniciais sem foto', () => {
    const { avatar } = criar();
    expect(avatar.getAttribute('role')).toBe('img');
    expect(avatar.getAttribute('aria-label')).toBe('Maria da Silva');
    expect(avatar.textContent?.trim()).toBe('MS');
    expect(avatar.classList).toContain('avatar--lg');
    expect(avatar.classList).toContain(`avatar--${corDoNome('Maria da Silva')}`);
  });

  it('decorativo sai da árvore de acessibilidade', () => {
    const { fixture, hospedeiro, avatar } = criar();
    hospedeiro.decorativo.set(true);
    fixture.detectChanges();
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(avatar.hasAttribute('role')).toBe(false);
  });

  it('foto que falha volta para as iniciais', () => {
    const { fixture, hospedeiro, avatar } = criar();
    hospedeiro.foto.set('/nao-existe.png');
    fixture.detectChanges();
    const img = avatar.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.textContent?.trim()).toBe('MS');
  });
});
