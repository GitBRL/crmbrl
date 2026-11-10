import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import type { Funil } from '../../funis/funis.tipos';
import { ConferenciaFunis } from './conferencia-funis';
import type { FunisDaPlanilha } from './importar.tipos';

const FUNIL: Funil = {
  id: 'f1',
  nome: 'Comercial',
  area: 'COMERCIAL',
  base: true,
  ordem: 1,
  ativo: true,
  etapas: [
    { id: 'e1', funilId: 'f1', nome: 'Novo', ordem: 1, tipo: 'ABERTA' },
    { id: 'e2', funilId: 'f1', nome: 'Ganho', ordem: 2, tipo: 'GANHO' },
    { id: 'e3', funilId: 'f1', nome: 'Perdido', ordem: 3, tipo: 'PERDIDO' },
  ],
};

const DADOS: FunisDaPlanilha = {
  semFunil: 0,
  funis: [
    {
      valor: 'SDR',
      linhas: 10,
      porStatus: { ABERTO: 7, GANHO: 1, PERDIDO: 2 },
      funil: null,
      como: null,
      problema: 'NAO_ENCONTRADO',
      etapas: [
        { valor: 'Contato', linhas: 4, etapa: null, como: null, problema: 'NAO_ENCONTRADA' },
        { valor: 'Reunião', linhas: 3, etapa: null, como: null, problema: 'NAO_ENCONTRADA' },
      ],
    },
  ],
};

function montar(papel: 'LIDER_COMERCIAL' | 'COMERCIAL') {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  entrarComo(papel);
  const fixture = TestBed.createComponent(ConferenciaFunis);
  fixture.componentRef.setInput('dados', DADOS);
  fixture.componentRef.setInput('funis', [FUNIL]);
  fixture.detectChanges();
  return fixture;
}

describe('ConferenciaFunis', () => {
  it('mostra o funil não encontrado com o resumo por status e a ação de criar', () => {
    const el = montar('LIDER_COMERCIAL').nativeElement as HTMLElement;
    const texto = el.textContent ?? '';
    expect(texto).toContain('SDR');
    expect(texto).toContain('10 linhas');
    expect(texto).toContain('7 abertas, 1 ganha, 2 perdidas');
    expect(texto).toContain('Não existe um funil com esse nome');
    expect(texto).toContain('Criar funil “SDR”');
    expect(texto).toContain('10 linhas ficarão sem negócio');
  });

  it('esconde a criação de funil de quem não configura funis', () => {
    const el = montar('COMERCIAL').nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Criar funil “SDR”');
  });

  it('cria o funil com as etapas abertas, Ganho e Perdido, e avisa a tela', async () => {
    const fixture = montar('LIDER_COMERCIAL');
    const http = TestBed.inject(HttpTestingController);
    const emitidos: unknown[] = [];
    fixture.componentInstance.funilCriado.subscribe((e) => emitidos.push(e));
    const el = fixture.nativeElement as HTMLElement;
    const abrir = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Criar funil “SDR”'),
    ) as HTMLButtonElement;
    abrir.click();
    fixture.detectChanges();
    const confirmar = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Criar funil',
    ) as HTMLButtonElement;
    confirmar.click();
    const req = http.expectOne('/api/v1/funis');
    expect(req.request.body).toEqual({
      nome: 'SDR',
      area: 'COMERCIAL',
      etapas: [
        { nome: 'Contato', tipo: 'ABERTA' },
        { nome: 'Reunião', tipo: 'ABERTA' },
        { nome: 'Ganho', tipo: 'GANHO' },
        { nome: 'Perdido', tipo: 'PERDIDO' },
      ],
    });
    req.flush({ ...FUNIL, id: 'f9', nome: 'SDR', base: false });
    await fixture.whenStable();
    expect(emitidos).toHaveLength(1);
  });
});
