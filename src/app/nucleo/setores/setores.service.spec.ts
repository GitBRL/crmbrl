import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { entrarComo, setoresDeTeste } from '../sessao/sessao-de-teste';
import { areaDoSlug, nomeDoSetor, ordemDoSetor, rotuloDaPessoa, slugDaArea } from './setores';
import { SetoresService } from './setores.service';

describe('SetoresService', () => {
  let http: HttpTestingController;
  let servico: SetoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servico = TestBed.inject(SetoresService);
  });
  afterEach(() => {
    servico.limpar();
    http.verify();
  });

  const lista = () =>
    setoresDeTeste([
      { chave: 'POS_VENDA', nome: 'Pós-venda' },
      { chave: 'ANTIGO', nome: 'Antigo', ativo: false },
    ]);

  it('Admin pede os inativos; carrega uma vez e usa o cache', async () => {
    entrarComo('ADMIN');
    const pronto = servico.carregar();
    const req = http.expectOne((r) => r.url === '/api/v1/setores');
    expect(req.request.params.get('incluirInativos')).toBe('true');
    req.flush(lista());
    await pronto;
    await servico.carregar();
    expect(servico.carregado()).toBe(true);
    expect(servico.todos()).toHaveLength(5);
    expect(servico.ativos().map((s) => s.chave)).toEqual([
      'MARKETING',
      'COMERCIAL',
      'CS',
      'POS_VENDA',
    ]);
  });

  it('Líder não pede inativos; Atendimento exclui o Marketing', async () => {
    entrarComo('LIDER_CS');
    const pronto = servico.carregar();
    const req = http.expectOne((r) => r.url === '/api/v1/setores');
    expect(req.request.params.has('incluirInativos')).toBe(false);
    req.flush(lista().filter((s) => s.ativo));
    await pronto;
    expect(servico.atendem().map((s) => s.chave)).toEqual(['COMERCIAL', 'CS', 'POS_VENDA']);
  });

  it('nomes, opções e setor inativo de registro antigo', async () => {
    entrarComo('ADMIN');
    const pronto = servico.carregar();
    http.expectOne((r) => r.url === '/api/v1/setores').flush(lista());
    await pronto;
    expect(servico.nome('POS_VENDA')).toBe('Pós-venda');
    expect(servico.estaAtivo('ANTIGO')).toBe(false);
    expect(servico.opcoes().map((o) => o.rotulo)).not.toContain('Antigo');
    expect(servico.opcoesCom('ANTIGO').at(-1)).toEqual({
      valor: 'ANTIGO',
      rotulo: 'Antigo (inativo)',
    });
    expect(rotuloDaPessoa({ papel: 'LIDER', area: 'POS_VENDA' })).toBe('Líder Pós-venda');
  });

  it('falha de rede marca erro sem derrubar', async () => {
    entrarComo('ADMIN');
    const pronto = servico.carregar();
    http
      .expectOne((r) => r.url === '/api/v1/setores')
      .flush('x', { status: 500, statusText: 'Erro' });
    await pronto;
    expect(servico.erro()).toBe(true);
    expect(servico.carregado()).toBe(false);
  });
});

describe('funções de setor', () => {
  it('slug e chave', () => {
    expect(slugDaArea('POS_VENDA')).toBe('pos_venda');
    expect(areaDoSlug('pos_venda')).toBe('POS_VENDA');
    expect(areaDoSlug('../x')).toBeNull();
    expect(nomeDoSetor('CS')).toBe('Customer Success');
    expect(nomeDoSetor('SEM_REGISTRO')).toBe('Sem registro');
    expect(ordemDoSetor('COMERCIAL')).toBeLessThan(ordemDoSetor('POS_VENDA'));
  });
});
