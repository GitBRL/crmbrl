import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CampoEmpresa, type EmpresaEscolhida } from './campo-empresa';
import { CampoEtiquetas, juntarEtiquetas } from './campo-etiquetas';
import { empresaDeTeste } from './dados-de-teste';

@Component({
  imports: [ReactiveFormsModule, CampoEtiquetas],
  template: `<app-campo-etiquetas
    rotulo="Etiquetas"
    [sugestoes]="['VIP']"
    [formControl]="controle"
  />`,
})
class HospedeiroEtiquetas {
  readonly controle = new FormControl<readonly string[]>(['Cliente'], { nonNullable: true });
}

@Component({
  imports: [ReactiveFormsModule, CampoEmpresa],
  template: `<app-campo-empresa rotulo="Empresa" [formControl]="controle" />`,
})
class HospedeiroEmpresa {
  readonly controle = new FormControl<EmpresaEscolhida | null>(null);
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

describe('Campos próprios da tela de contatos', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('junta etiquetas sem repetir (sem diferenciar maiúsculas) e apara os espaços', () => {
    expect(juntarEtiquetas(['VIP'], ['  vip ', 'Evento   2026', '', 'Novo'])).toEqual([
      'VIP',
      'Evento 2026',
      'Novo',
    ]);
  });

  it('etiquetas: Enter e vírgula acrescentam; Backspace no vazio tira a última; × remove', () => {
    const fixture = TestBed.createComponent(HospedeiroEtiquetas);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const entrada = raiz.querySelector('input') as HTMLInputElement;
    const controle = fixture.componentInstance.controle;

    entrada.value = 'Evento';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(controle.value).toEqual(['Cliente', 'Evento']);

    entrada.value = 'Agro, Varejo,';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(controle.value).toEqual(['Cliente', 'Evento', 'Agro', 'Varejo']);

    entrada.value = '';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    fixture.detectChanges();
    expect(controle.value).toEqual(['Cliente', 'Evento', 'Agro']);

    (
      raiz.querySelector('button[aria-label="Remover a etiqueta Cliente"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(controle.value).toEqual(['Evento', 'Agro']);
    expect(raiz.querySelectorAll('.etiquetas__item').length).toBe(2);
  });

  it('empresa: liga à cadastrada quando o nome bate com uma sugestão; senão, é empresa nova', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HospedeiroEmpresa);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const entrada = raiz.querySelector('input') as HTMLInputElement;
    const controle = fixture.componentInstance.controle;

    entrada.value = 'clínica vida plena';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(controle.value).toEqual({ id: null, nome: 'clínica vida plena' });

    await esperar(350);
    fixture.detectChanges();
    http
      .expectOne(
        (req) => req.url === '/api/v1/empresas' && req.params.get('busca') === 'clínica vida plena',
      )
      .flush({ itens: [empresaDeTeste()], total: 1, pagina: 1, porPagina: 8 });
    await esperar(0);
    fixture.detectChanges();
    expect(controle.value).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'clínica vida plena',
    });
    expect(raiz.textContent).toContain('Empresa cadastrada.');

    entrada.value = 'Empresa Nova Ltda';
    entrada.dispatchEvent(new Event('input'));
    await esperar(350);
    fixture.detectChanges();
    http
      .expectOne((req) => req.url === '/api/v1/empresas')
      .flush({ itens: [], total: 0, pagina: 1, porPagina: 8 });
    await esperar(0);
    fixture.detectChanges();
    expect(controle.value).toEqual({ id: null, nome: 'Empresa Nova Ltda' });
    expect(raiz.textContent).toContain('Empresa nova: será cadastrada ao salvar.');
    http.verify();
  });
});
