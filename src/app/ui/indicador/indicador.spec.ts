import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Indicador } from './indicador';

@Component({
  imports: [Indicador],
  template: `
    <app-indicador
      [valor]="valor()"
      unidade="%"
      legenda="Conversão total do funil"
      [variacao]="variacao()"
      [quedaEhBoa]="quedaEhBoa()"
      [dica]="dica()"
    />
  `,
})
class Hospedeiro {
  readonly valor = signal<number | string>(1600);
  readonly variacao = signal<number | null>(null);
  readonly quedaEhBoa = signal(false);
  readonly dica = signal<string | null>(null);
}

describe('Indicador', () => {
  function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const indicador = fixture.nativeElement.querySelector('app-indicador') as HTMLElement;
    return { fixture, hospedeiro: fixture.componentInstance, indicador };
  }

  it('formata o número em pt-BR, com unidade e legenda', () => {
    const { fixture, hospedeiro, indicador } = criar();
    expect(indicador.querySelector('.indicador__valor')?.textContent).toBe('1.600');
    expect(indicador.querySelector('.indicador__unidade')?.textContent).toBe('%');
    expect(indicador.querySelector('.indicador__legenda')?.textContent).toBe(
      'Conversão total do funil',
    );
    hospedeiro.valor.set(48.25);
    fixture.detectChanges();
    expect(indicador.querySelector('.indicador__valor')?.textContent).toBe('48,3');
    expect(indicador.querySelector('app-selo')).toBeNull();
  });

  it('prefixo, número e unidade formam um par que nunca quebra (.sem-quebra)', () => {
    const fixture = TestBed.createComponent(Indicador);
    fixture.componentRef.setInput('valor', 42.4);
    fixture.componentRef.setInput('prefixo', 'R$');
    fixture.componentRef.setInput('unidade', 'mil');
    fixture.componentRef.setInput('legenda', 'Receita ganha');
    fixture.componentRef.setInput('variacao', 3.1);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const par = raiz.querySelector('.indicador__par') as HTMLElement;
    expect(par.classList).toContain('sem-quebra');
    expect(par.parentElement?.classList).toContain('indicador__numero');
    expect([...par.children].map((filho) => filho.textContent)).toEqual(['R$', '42,4', 'mil']);
    // O selo de variação fica fora do par: pode descer sem levar a unidade junto.
    expect(par.querySelector('app-selo')).toBeNull();
    expect(raiz.querySelector('.indicador__numero > app-selo')).not.toBeNull();
  });

  it('mede o par e grava a largura dele em "em" para o CSS encolher só o que não cabe', async () => {
    const fixture = TestBed.createComponent(Indicador);
    fixture.componentRef.setInput('valor', 42.4);
    fixture.componentRef.setInput('prefixo', 'R$');
    fixture.componentRef.setInput('unidade', 'mil');
    fixture.componentRef.setInput('legenda', 'Receita ganha');
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const par = raiz.querySelector('.indicador__par') as HTMLElement;
    // Sem layout (jsdom), nada é gravado: vale a largura padrão do CSS (3,9em).
    expect(raiz.style.getPropertyValue('--_numero-em')).toBe('');

    // Com layout: "R$ 42,4 mil" mede 212,3px numa fonte de 56px → 3,79em (+1% de folga).
    par.style.fontSize = '56px';
    vi.spyOn(par, 'getBoundingClientRect').mockReturnValue({ width: 212.3 } as DOMRect);
    fixture.componentRef.setInput('valor', 48.2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(raiz.style.getPropertyValue('--_numero-em')).toBe('3.829');
  });

  it('variação: alta em menta, queda em coral, com texto para leitor de tela', () => {
    const { fixture, hospedeiro, indicador } = criar();
    hospedeiro.variacao.set(4.2);
    fixture.detectChanges();
    const selo = () => indicador.querySelector('app-selo') as HTMLElement;
    expect(selo().classList).toContain('selo--menta');
    expect(selo().textContent).toContain('Alta de');
    expect(selo().textContent).toContain('4,2%');
    hospedeiro.variacao.set(-3);
    fixture.detectChanges();
    expect(selo().classList).toContain('selo--coral');
    expect(selo().textContent).toContain('Queda de');
  });

  it('unidade da variação: %, pontos percentuais ou pontos, por extenso para leitor de tela', () => {
    const fixture = TestBed.createComponent(Indicador);
    fixture.componentRef.setInput('valor', 48.6);
    fixture.componentRef.setInput('legenda', 'Taxa de ganho');
    fixture.componentRef.setInput('variacao', 2.1);
    fixture.detectChanges();
    const selo = () => fixture.nativeElement.querySelector('app-selo') as HTMLElement;
    const visivel = () => selo().querySelector('[aria-hidden="true"]:not(svg)')?.textContent;
    const oculto = () => selo().querySelector('.visualmente-oculto')?.textContent;
    expect(visivel()).toBe('2,1%');
    expect(oculto()).toBe('Alta de 2,1%');

    fixture.componentRef.setInput('unidadeVariacao', 'p.p.');
    fixture.detectChanges();
    expect(visivel()).toBe('2,1 p.p.');
    expect(oculto()).toBe('Alta de 2,1 pontos percentuais');

    fixture.componentRef.setInput('unidadeVariacao', 'pts');
    fixture.componentRef.setInput('variacao', -1);
    fixture.detectChanges();
    expect(visivel()).toBe('1 pt');
    expect(oculto()).toBe('Queda de 1 ponto');
  });

  it('`variacaoAbaixo` leva o selo para uma linha própria', () => {
    const { fixture, hospedeiro, indicador } = criar();
    hospedeiro.variacao.set(8.4);
    fixture.detectChanges();
    expect(indicador.querySelector('.indicador__quebra')).toBeNull();

    const outro = TestBed.createComponent(Indicador);
    outro.componentRef.setInput('valor', 1600);
    outro.componentRef.setInput('legenda', 'Leads no mês');
    outro.componentRef.setInput('variacao', 8.4);
    outro.componentRef.setInput('variacaoAbaixo', true);
    outro.detectChanges();
    const raiz = outro.nativeElement as HTMLElement;
    expect(raiz.classList).toContain('indicador--variacao-abaixo');
    const quebra = raiz.querySelector('.indicador__quebra');
    expect(quebra?.getAttribute('aria-hidden')).toBe('true');
    expect(quebra?.nextElementSibling?.tagName).toBe('APP-SELO');
  });

  it('`quedaEhBoa` inverte as cores', () => {
    const { fixture, hospedeiro, indicador } = criar();
    hospedeiro.variacao.set(-8);
    hospedeiro.quedaEhBoa.set(true);
    fixture.detectChanges();
    expect(indicador.querySelector('app-selo')?.classList).toContain('selo--menta');
  });

  it('mostra a dica ao lado da legenda', () => {
    const { fixture, hospedeiro, indicador } = criar();
    hospedeiro.dica.set('Leads que viraram clientes.');
    fixture.detectChanges();
    expect(indicador.querySelector('app-dica button')?.getAttribute('aria-label')).toBe(
      'Sobre: Conversão total do funil',
    );
  });
});
