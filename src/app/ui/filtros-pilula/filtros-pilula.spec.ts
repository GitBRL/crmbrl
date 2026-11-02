import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FiltrosPilula, type OpcaoFiltro } from './filtros-pilula';

@Component({
  imports: [FiltrosPilula],
  template: `
    <app-filtros-pilula rotulo="Mostrar" [opcoes]="escopos" [(selecionado)]="escopo" />
    <app-filtros-pilula
      rotulo="Etiquetas"
      multipla
      [opcoes]="etiquetas"
      [(selecionados)]="marcadas"
    />
  `,
})
class Hospedeiro {
  readonly escopos: OpcaoFiltro[] = [
    { id: 'meus', rotulo: 'Meus', contagem: 12 },
    { id: 'equipe', rotulo: 'Da equipe' },
    { id: 'todos', rotulo: 'Todos', desabilitada: true, motivo: 'Só para C-level e Admin.' },
  ];
  readonly etiquetas: OpcaoFiltro[] = [
    { id: 'quente', rotulo: 'Quente' },
    { id: 'evento', rotulo: 'Evento' },
  ];
  readonly escopo = signal<string | null>('meus');
  readonly marcadas = signal<readonly string[]>([]);
}

describe('FiltrosPilula', () => {
  async function criar() {
    const fixture = TestBed.createComponent(Hospedeiro);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const [escopos, etiquetas] = [...raiz.querySelectorAll<HTMLElement>('[role="group"]')];
    const botoes = (grupo: HTMLElement) => [...grupo.querySelectorAll('button')];
    return { fixture, raiz, escopos, etiquetas, botoes, hospedeiro: fixture.componentInstance };
  }

  it('grupo nomeado de botões com aria-pressed; um ligado por vez', async () => {
    const { fixture, escopos, botoes, hospedeiro } = await criar();
    expect(escopos.getAttribute('aria-label')).toBe('Mostrar');
    const [meus, equipe] = botoes(escopos);
    expect(meus.getAttribute('aria-pressed')).toBe('true');
    expect(meus.textContent).toContain('12');
    equipe.click();
    await fixture.whenStable();
    expect(hospedeiro.escopo()).toBe('equipe');
    expect(meus.getAttribute('aria-pressed')).toBe('false');
    expect(equipe.getAttribute('aria-pressed')).toBe('true');
  });

  it('desabilitado diz o motivo e não muda nada', async () => {
    const { fixture, raiz, escopos, botoes, hospedeiro } = await criar();
    const todos = botoes(escopos)[2];
    expect(todos.getAttribute('aria-disabled')).toBe('true');
    expect(raiz.querySelector(`#${todos.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Só para C-level e Admin.',
    );
    todos.click();
    await fixture.whenStable();
    expect(hospedeiro.escopo()).toBe('meus');
  });

  it('múltipla: liga e desliga cada um', async () => {
    const { fixture, etiquetas, botoes, hospedeiro } = await criar();
    const [quente, evento] = botoes(etiquetas);
    quente.click();
    evento.click();
    await fixture.whenStable();
    expect(hospedeiro.marcadas()).toEqual(['quente', 'evento']);
    quente.click();
    await fixture.whenStable();
    expect(hospedeiro.marcadas()).toEqual(['evento']);
    expect(quente.getAttribute('aria-pressed')).toBe('false');
  });
});
