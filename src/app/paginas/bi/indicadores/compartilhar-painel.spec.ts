import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { alternarItem, CompartilharPainel } from './compartilhar-painel';
import { painel } from './indicadores-de-teste';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('alternarItem', () => {
  it('marca sem repetir e desmarca', () => {
    expect(alternarItem(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(alternarItem(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(alternarItem(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});

describe('CompartilharPainel', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function abrir(diretoria: boolean) {
    entrarComo(diretoria ? 'ADMIN' : 'LIDER_COMERCIAL');
    const f = TestBed.createComponent(CompartilharPainel);
    f.componentRef.setInput(
      'painel',
      painel({ compartilhamento: { setores: [], pessoas: ['u1'], papeis: [] } }),
    );
    f.componentRef.setInput('pessoasDisponiveis', [
      { id: 'u1', nome: 'Ana' },
      { id: 'u2', nome: 'Beto' },
    ]);
    f.componentRef.setInput('diretoria', diretoria);
    f.componentRef.setInput('setorDoLider', 'COMERCIAL');
    f.componentRef.setInput('aberto', true);
    await f.whenStable();
    f.detectChanges();
    http.match('/api/v1/setores').forEach((p) =>
      p.flush([
        {
          chave: 'COMERCIAL',
          nome: 'Comercial',
          ativo: true,
          ordem: 1,
          base: true,
          descricao: null,
          cor: null,
          criadoEm: '',
          atualizadoEm: '',
          lideres: null,
          contagens: null,
        },
      ]),
    );
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  const raizDoModal = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('R33.6 — parte do compartilhamento atual e só Admin e C-level veem os papéis', async () => {
    const admin = await abrir(true);
    expect(texto(raizDoModal(admin))).toContain('Papéis inteiros');
    expect(texto(raizDoModal(admin))).toContain('Ana');
    TestBed.resetTestingModule();
  });

  it('R33.6 — o líder não vê papéis inteiros', async () => {
    const lider = await abrir(false);
    expect(texto(raizDoModal(lider))).not.toContain('Papéis inteiros');
    expect(texto(raizDoModal(lider))).toContain('Setores inteiros');
  });

  it('R33.6 — compartilhar envia setores, pessoas e papéis por PATCH', async () => {
    const f = await abrir(true);
    const raiz = raizDoModal(f);
    const beto = raiz
      .querySelectorAll('.grupo__lista app-caixa-selecao')[1]
      .querySelector('input') as HTMLInputElement;
    beto.click();
    await f.whenStable();
    f.detectChanges();
    (
      Array.from(raiz.querySelectorAll('button')).find(
        (b) => texto(b) === 'Compartilhar',
      ) as HTMLButtonElement
    ).click();
    const pedido = http.expectOne('/api/v1/indicadores/paineis/p1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body.compartilhamento.pessoas.sort()).toEqual(['u1', 'u2']);
    pedido.flush(painel());
  });
});
