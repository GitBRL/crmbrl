import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CARREGADOR_ECHARTS, Grafico, type ConstrutorOpcao, type CliqueNoGrafico } from './grafico';
import { lerPaleta } from './paleta';

@Component({
  imports: [Grafico],
  template: `<app-grafico
    rotulo="Barras: leads por origem. Site 36."
    [opcao]="opcao()"
    (clique)="cliques.push($event)"
  />`,
})
class Hospedeiro {
  readonly opcao = signal<ConstrutorOpcao>((p) => ({ color: [...p.dados], series: [] }));
  readonly cliques: CliqueNoGrafico[] = [];
}

function motor() {
  const estado = {
    opcoes: [] as any[],
    ouvintes: new Map<string, (p: unknown) => void>(),
    descartado: false,
    redimensionou: 0,
  };
  const carregador = () =>
    Promise.resolve({
      echarts: {
        init: () => ({
          on: (nome: string, f: (p: unknown) => void) => void estado.ouvintes.set(nome, f),
          setOption: (opcao: unknown) => void estado.opcoes.push(opcao),
          resize: () => void estado.redimensionou++,
          dispose: () => void (estado.descartado = true),
        }),
      },
    });
  return { estado, carregador };
}

describe('Grafico', () => {
  afterEach(() => document.documentElement.removeAttribute('data-tema'));

  const montar = async (carregador: () => Promise<any>) => {
    TestBed.configureTestingModule({
      providers: [{ provide: CARREGADOR_ECHARTS, useValue: carregador }],
    });
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('descreve o gráfico para leitores de tela e desenha com a paleta dos tokens', async () => {
    document.documentElement.style.setProperty('--dado-4', '#aabbcc');
    const { estado, carregador } = motor();
    const fixture = await montar(carregador);
    const area = (fixture.nativeElement as HTMLElement).querySelector('[role="img"]');
    expect(area?.getAttribute('aria-label')).toBe('Barras: leads por origem. Site 36.');
    expect(estado.opcoes.length).toBe(1);
    expect(estado.opcoes[0].color[3]).toBe('#aabbcc');
    document.documentElement.style.removeProperty('--dado-4');
  });

  it('refaz o desenho quando a opção muda e devolve o clique no ponto', async () => {
    const { estado, carregador } = motor();
    const fixture = await montar(carregador);
    fixture.componentInstance.opcao.set(() => ({ series: [{ type: 'bar' }] }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(estado.opcoes.length).toBe(2);
    estado.ouvintes.get('click')?.({
      name: 'Site',
      seriesName: 'Leads',
      dataIndex: 2,
      data: { id: 'x' },
    });
    expect(fixture.componentInstance.cliques).toEqual([
      { nome: 'Site', serie: 'Leads', indice: 2, dado: { id: 'x' } },
    ]);
  });

  it('descarta o gráfico ao destruir', async () => {
    const { estado, carregador } = motor();
    const fixture = await montar(carregador);
    fixture.destroy();
    expect(estado.descartado).toBe(true);
  });

  it('falha ao carregar: avisa para ver a tabela', async () => {
    const fixture = await montar(() => Promise.reject(new Error('sem rede')));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Veja os números na tabela',
    );
  });

  it('lê as cores dos tokens do tema (com padrão quando faltam)', () => {
    const raiz = document.createElement('div');
    raiz.style.setProperty('--cor-texto', '#123456');
    document.body.append(raiz);
    const paleta = lerPaleta(raiz);
    expect(paleta.texto).toBe('#123456');
    expect(paleta.dados.length).toBe(4);
    raiz.remove();
  });
});
