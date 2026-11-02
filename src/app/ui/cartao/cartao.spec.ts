import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Cartao, type VarianteCartao } from './cartao';

@Component({
  imports: [Cartao],
  template: `
    <app-cartao
      [variante]="variante()"
      [titulo]="titulo()"
      complemento="· outubro"
      [nivel]="nivel()"
      [dica]="dica()"
      [regiao]="regiao()"
    >
      <button cartao-acoes type="button">Ver tudo</button>
      <p class="corpo">Conteúdo</p>
    </app-cartao>
  `,
})
class Hospedeiro {
  readonly variante = signal<VarianteCartao>('padrao');
  readonly titulo = signal<string | null>('Atividades recentes');
  readonly nivel = signal<2 | 3 | 4>(2);
  readonly dica = signal<string | null>(null);
  readonly regiao = signal(false);
}

describe('Cartao', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const cartao = fixture.nativeElement.querySelector('app-cartao') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, cartao };
  }

  it('renderiza título em dois tons, ações e conteúdo', () => {
    const { cartao } = criar();
    const titulo = cartao.querySelector('h2');
    // O "·" fica preso ao título (espaço inseparável) e o complemento desce inteiro.
    expect(titulo?.textContent?.trim()).toBe('Atividades recentes\u00a0· outubro');
    const tons = [...(titulo?.querySelectorAll('.tom-fraco') ?? [])];
    expect(tons.map((tom) => tom.textContent)).toEqual(['· ', 'outubro']);
    expect(tons[1].classList).toContain('sem-quebra');
    expect(cartao.querySelector('.cartao__acoes button')?.textContent).toBe('Ver tudo');
    expect(cartao.querySelector('.corpo')).not.toBeNull();
  });

  it('respeita o nível do título e esconde o cabeçalho sem título', () => {
    const { fixture, hospedeiro, cartao } = criar();
    hospedeiro.nivel.set(3);
    fixture.detectChanges();
    expect(cartao.querySelector('h3')).not.toBeNull();
    hospedeiro.titulo.set(null);
    fixture.detectChanges();
    expect(cartao.querySelector('header')).toBeNull();
    expect(cartao.querySelector('.corpo')).not.toBeNull();
  });

  it('variantes palco e destaque', () => {
    const { fixture, hospedeiro, cartao } = criar();
    hospedeiro.variante.set('palco');
    fixture.detectChanges();
    expect(cartao.classList).toContain('cartao--palco');
    hospedeiro.variante.set('destaque');
    fixture.detectChanges();
    expect(cartao.classList).toContain('cartao--destaque');
    expect(cartao.classList).not.toContain('cartao--palco');
  });

  it('dica ao lado do título e região nomeada pelo título', () => {
    const { fixture, hospedeiro, cartao } = criar();
    hospedeiro.dica.set('Tudo o que a equipe fez.');
    hospedeiro.regiao.set(true);
    fixture.detectChanges();
    expect(cartao.querySelector('app-dica')).not.toBeNull();
    expect(cartao.getAttribute('role')).toBe('region');
    expect(cartao.getAttribute('aria-labelledby')).toBe(cartao.querySelector('h2')?.id);
  });
});
