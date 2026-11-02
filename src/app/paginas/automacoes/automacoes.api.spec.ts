import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AutomacoesApi } from './automacoes.api';

describe('AutomacoesApi (apoio)', () => {
  it('os canais vêm de /automacoes/opcoes (Marketing não lê /atendimento/canais)', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const canais = TestBed.inject(AutomacoesApi).canais();
    http.expectOne('/api/v1/automacoes/opcoes').flush({
      canais: [{ id: 'c1', nome: 'WhatsApp Vendas' }],
      filas: [],
    });
    expect(await canais).toEqual([{ id: 'c1', rotulo: 'WhatsApp Vendas' }]);
    http.verify();
  });
});
