import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AvisosService } from '../../../nucleo/avisos.service';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { provideSocketFalso } from '../../../nucleo/tempo-real/tempo-real-de-teste';
import { Importar } from './importar';

const URL_MODELO = '/api/v1/importacoes/planilha-modelo';

async function estabilizar(fixture: ComponentFixture<unknown>) {
  await new Promise((resolver) => setTimeout(resolver));
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('Importar: planilha modelo (R16.10)', () => {
  let http: HttpTestingController;
  let baixados: string[];

  function montar(tipoFixo?: 'PARCELAS') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSocketFalso().providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: tipoFixo ? { tipo: tipoFixo } : {}, queryParamMap: new Map() },
          },
        },
      ],
    });
    entrarComo('LIDER_CS');
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Importar);
    fixture.detectChanges();
    http.match((r) => r.url === '/api/v1/importacoes').forEach((r) => r.flush({ itens: [] }));
    return fixture;
  }

  const botao = (fixture: ComponentFixture<unknown>) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Baixar planilha modelo'),
    ) as HTMLButtonElement;

  beforeEach(() => {
    baixados = [];
    URL.createObjectURL = vi.fn(() => 'blob:teste');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      baixados.push(this.download);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('contatos: pede o modelo de CONTATOS e baixa modelo-contatos.xlsx', async () => {
    const fixture = montar();
    await estabilizar(fixture);
    botao(fixture).click();
    const req = http.expectOne((r) => r.url === URL_MODELO);
    expect(req.request.params.get('tipo')).toBe('CONTATOS');
    req.flush(new Blob(['x']));
    await estabilizar(fixture);
    expect(baixados).toEqual(['modelo-contatos.xlsx']);
  });

  it('empresas: depois de trocar o tipo, baixa modelo-empresas.xlsx', async () => {
    const fixture = montar();
    (fixture.componentInstance as unknown as { tipo: { set(v: string): void } }).tipo.set(
      'EMPRESAS',
    );
    await estabilizar(fixture);
    botao(fixture).click();
    const req = http.expectOne((r) => r.url === URL_MODELO);
    expect(req.request.params.get('tipo')).toBe('EMPRESAS');
    req.flush(new Blob(['x']));
    await estabilizar(fixture);
    expect(baixados).toEqual(['modelo-empresas.xlsx']);
  });

  it('parcelas (tela do Financeiro): baixa modelo-parcelas.xlsx', async () => {
    const fixture = montar('PARCELAS');
    await estabilizar(fixture);
    botao(fixture).click();
    const req = http.expectOne((r) => r.url === URL_MODELO);
    expect(req.request.params.get('tipo')).toBe('PARCELAS');
    req.flush(new Blob(['x']));
    await estabilizar(fixture);
    expect(baixados).toEqual(['modelo-parcelas.xlsx']);
  });

  it('falha: mostra o aviso de erro e não baixa nada', async () => {
    const fixture = montar();
    const erro = vi.spyOn(TestBed.inject(AvisosService), 'erro');
    await estabilizar(fixture);
    botao(fixture).click();
    http
      .expectOne((r) => r.url === URL_MODELO)
      .flush(new Blob(['{}']), { status: 500, statusText: 'Erro' });
    await estabilizar(fixture);
    expect(erro).toHaveBeenCalledTimes(1);
    expect(baixados).toEqual([]);
    expect(botao(fixture).disabled).toBe(false);
  });
});
