import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { responderSetores } from '../../nucleo/setores/setores-de-teste';
import type { Setor } from '../../nucleo/setores/setores';
import { botaoComTexto, erroDaApiFalso, microtarefas } from './dados-de-teste';
import { SetoresAcessos } from './setores-acessos';

const CS = { chave: 'CS', nome: 'Customer Success' } as Setor;

@Component({
  imports: [SetoresAcessos],
  template: `<app-setores-acessos [setor]="setor" />`,
})
class Hospedeiro {
  setor: Setor | null = CS;
}

describe('SetoresAcessos (quem mais vê o setor)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    entrarComo('ADMIN');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    responderSetores(http);
    http
      .expectOne((p) => p.url === '/api/v1/usuarios/opcoes')
      .flush([
        {
          id: 'u-rafael',
          nome: 'Rafael Mendes',
          avatarUrl: null,
          papel: 'LIDER',
          rotuloPapel: 'Líder Comercial',
          area: 'COMERCIAL',
          nomeSetor: 'Comercial',
        },
      ]);
    http.expectOne('/api/v1/setores/CS/acessos').flush({
      area: 'CS',
      nomeSetor: 'Customer Success',
      acessos: [
        {
          id: 'a1',
          alvo: 'SETOR',
          area: 'COMERCIAL',
          nomeSetor: 'Comercial',
          setorAtivo: true,
          usuario: null,
          nivel: 'VER',
          atualizadoEm: '2026-11-10T12:00:00.000Z',
        },
      ],
    });
    await microtarefas();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('explica que vale para funis "Todo o setor" e lista os acessos', () => {
    expect(raiz().textContent).toContain('Todo o setor');
    expect(raiz().textContent).toContain('Funis restritos não os usam');
    expect(raiz().querySelector('[data-acesso="setor:COMERCIAL"]')!.textContent).toContain(
      'Comercial',
    );
  });

  it('oferece pessoas de outros setores pela rota de opções, com papel no rótulo', () => {
    const opcoes = [...raiz().querySelectorAll<HTMLSelectElement>('select')].flatMap((sel) =>
      [...sel.options].map((o) => o.textContent?.trim()),
    );
    expect(opcoes).not.toContain('Rafael Mendes · Líder Comercial');
    [...raiz().querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Uma pessoa'))!
      .click();
    fixture.detectChanges();
    const pessoa = [...raiz().querySelectorAll<HTMLSelectElement>('select')].flatMap((sel) =>
      [...sel.options].map((o) => o.textContent?.trim()),
    );
    expect(pessoa).toContain('Rafael Mendes · Líder Comercial');
  });

  it('o setor dono não é alvo possível; salvar manda a lista e 422 R5.11 aparece', async () => {
    // Remove o acesso e salva (lista vazia).
    raiz().querySelector<HTMLButtonElement>('[data-acesso] button')!.click();
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Salvar acessos').click();
    await microtarefas();
    const pedido = http.expectOne('/api/v1/setores/CS/acessos');
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body).toEqual({ acessos: [] });
    const falha = erroDaApiFalso(422, 'regra_violada', 'O setor dono não pode ser alvo.', {
      regra: 'R5.11',
    });
    pedido.flush(falha.corpo, falha.opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.acessos__erro')!.textContent).toContain(
      'O setor dono não pode ser alvo.',
    );
  });
});
