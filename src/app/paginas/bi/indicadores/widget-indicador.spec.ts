import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { CARREGADOR_ECHARTS } from '../../../ui/grafico/grafico';
import { resultadoNumero } from './indicadores-de-teste';
import { WidgetIndicador } from './widget-indicador';
import type { ResultadoDoWidget } from './indicadores.tipos';

const MOTOR = {
  echarts: {
    init: () => ({
      on: () => undefined,
      setOption: () => undefined,
      resize: () => undefined,
      dispose: () => undefined,
    }),
  },
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function criar(resultado: ResultadoDoWidget) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CARREGADOR_ECHARTS, useValue: () => Promise.resolve(MOTOR) },
    ],
  });
  const fixture = TestBed.createComponent(WidgetIndicador);
  fixture.componentRef.setInput('resultado', resultado);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('WidgetIndicador', () => {
  it('R33.2 — número com o período e a variação sobre o anterior', async () => {
    const f = await criar(resultadoNumero());
    const raiz = f.nativeElement as HTMLElement;
    expect(texto(raiz)).toContain('Leads recebidos');
    expect(texto(raiz)).toContain('42');
    expect(texto(raiz)).toContain('40');
    expect(texto(raiz)).not.toContain('Ver a lista');
  });

  it('R33.2 — taxa sem base aparece como "—", nunca como zero', async () => {
    const f = await criar(resultadoNumero({ unidade: 'PERCENTUAL', valor: null, variacao: null }));
    expect(texto(f.nativeElement)).toContain('—');
  });

  it('R33.5 — a meta mostra o progresso, a barra e "atingida"', async () => {
    const f = await criar(resultadoNumero({ meta: { alvo: 40, progresso: 105, atingida: true } }));
    const raiz = f.nativeElement as HTMLElement;
    const barra = raiz.querySelector('[role="progressbar"]');
    expect(barra).not.toBeNull();
    expect(barra?.getAttribute('aria-valuenow')).toBe('105');
    expect(texto(raiz)).toContain('105%');
    expect(texto(raiz)).toContain('atingida');
    // A barra não passa de 100% da largura.
    expect((raiz.querySelector('.meta__barra') as HTMLElement).style.width).toBe('100%');
  });

  it('R20.8 — "Ver a lista" só aparece quando há lista, e emite o destino', async () => {
    const f = await criar(
      resultadoNumero({
        indicador: 'reunioes_no_show',
        clique: {
          lista: 'ATIVIDADES',
          filtros: { tipo: ['REUNIAO'], resultadoReuniao: ['NAO_COMPARECEU'] },
        },
      }),
    );
    const abrir = vi.fn();
    f.componentInstance.abrir.subscribe(abrir);
    const botao = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => texto(b).includes('Ver a lista'),
    )!;
    botao.click();
    expect(abrir).toHaveBeenCalledWith({
      comandos: ['/atividades'],
      consulta: { escopo: 'TODAS', tipo: 'REUNIAO', resultado: 'NAO_COMPARECEU' },
    });
  });

  it('R33.7 — erro de um indicador mostra a mensagem e "Tentar de novo"', async () => {
    const f = await criar(
      resultadoNumero({
        ok: false,
        erro: { mensagem: 'Funil não encontrado.', status: 404 },
        valor: undefined,
      }),
    );
    const tentar = vi.fn();
    f.componentInstance.tentarDeNovo.subscribe(tentar);
    const raiz = f.nativeElement as HTMLElement;
    expect(texto(raiz)).toContain('Funil não encontrado.');
    Array.from(raiz.querySelectorAll('button'))
      .find((b) => texto(b) === 'Tentar de novo')!
      .click();
    expect(tentar).toHaveBeenCalled();
  });

  it('R33.5 — ranking lista as pessoas na ordem, com a meta de cada uma', async () => {
    const f = await criar(
      resultadoNumero({
        visualizacao: 'RANKING',
        unidade: 'NUMERO',
        linhas: [
          { id: 'u1', rotulo: 'Ana', valor: 6, meta: { alvo: 4, progresso: 150, atingida: true } },
          { id: 'u2', rotulo: 'Beto', valor: 2, meta: { alvo: 4, progresso: 50, atingida: false } },
        ],
      }),
    );
    const itens = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.ranking__item'));
    expect(itens.map((i) => texto(i.querySelector('.ranking__nome')))).toEqual(['Ana', 'Beto']);
    expect(texto(itens[1])).toContain('50%');
  });

  it('R33.2 — série vazia mostra o estado sem dados, em vez de um gráfico zerado', async () => {
    const f = await criar(
      resultadoNumero({
        visualizacao: 'SERIE',
        pontos: [{ chave: '2026-11-01', rotulo: '01/11', valor: 0 }],
      }),
    );
    expect(texto(f.nativeElement)).toContain('Sem dados no período');
  });
});
