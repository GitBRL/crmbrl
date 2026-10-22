import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { Usuario } from './configuracoes.modelos';
import { botaoComTexto, campoPeloRotulo, digitar, LUCAS, microtarefas } from './dados-de-teste';
import { SenhaTemporaria } from './senha-temporaria';

@Component({
  imports: [SenhaTemporaria],
  template: `<app-senha-temporaria [usuario]="usuario()" (fechado)="usuario.set(null)" />`,
})
class Hospedeiro {
  readonly usuario = signal<Usuario | null>(null);
}

describe('SenhaTemporaria (R2.8)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.usuario.set(LUCAS);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  it('pede pelo menos 8 caracteres antes de enviar', () => {
    botaoComTexto(raiz(), 'Definir senha').click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Digite a senha ou use “Gerar senha forte”.');
    digitar(raiz(), 'Senha temporária', '1234');
    botaoComTexto(raiz(), 'Definir senha').click();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Use pelo menos 8 caracteres.');
    http.expectNone('/api/v1/usuarios/u-lucas/senha-temporaria');
  });

  it('gera uma senha forte, mostra e envia', async () => {
    botaoComTexto(raiz(), 'Gerar senha forte').click();
    fixture.detectChanges();
    const campo = campoPeloRotulo(raiz(), 'Senha temporária') as HTMLInputElement;
    expect(campo.value).toHaveLength(14);
    expect(campo.type).toBe('text');
    botaoComTexto(raiz(), 'Definir senha').click();
    const pedido = http.expectOne('/api/v1/usuarios/u-lucas/senha-temporaria');
    expect(pedido.request.body).toEqual({ senha: campo.value });
    pedido.flush({ ...LUCAS, deveTrocarSenha: true });
    await microtarefas();
    expect(fixture.componentInstance.usuario()).toBeNull();
  });
});
