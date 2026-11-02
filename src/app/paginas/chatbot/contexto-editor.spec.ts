import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ContextoEditor } from './contexto-editor';

describe('ContextoEditor (apoio do editor)', () => {
  it('canais e filas vêm de /chatbot/opcoes (o líder de Marketing não lê /atendimento)', async () => {
    TestBed.configureTestingModule({
      providers: [ContextoEditor, provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const ctx = TestBed.inject(ContextoEditor);
    const carregando = ctx.carregarApoio();
    http.expectOne('/api/v1/chatbot/opcoes').flush({
      canais: [{ id: 'c1', tipo: 'WEBCHAT', nome: 'Chat do site', ativo: true }],
      filas: [
        { id: 'f1', nome: 'Vendas', area: 'COMERCIAL', ativa: true },
        { id: 'f2', nome: 'Antiga', area: 'COMERCIAL', ativa: false },
      ],
    });
    http.expectOne((r) => r.url === '/api/v1/usuarios').flush({ itens: [] });
    http.expectOne('/api/v1/funis').flush([]);
    await carregando;
    http.verify();
    expect(ctx.canais().map((c) => c.nome)).toEqual(['Chat do site']);
    expect(ctx.filas()).toEqual([{ valor: 'f1', rotulo: 'Vendas' }]);
  });
});
