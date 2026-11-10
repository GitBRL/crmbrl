import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AvisosService } from '../../nucleo/avisos.service';
import { responderSetores } from '../../nucleo/setores/setores-de-teste';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import type { Setor } from '../../nucleo/setores/setores';
import {
  botaoComTexto,
  campoPeloRotulo,
  digitar,
  erroDaApiFalso,
  escolher,
  HELENA,
  LUCAS,
  microtarefas,
  pagina,
  RAFAEL,
} from './dados-de-teste';
import { SetoresFormulario, type PedidoFormularioSetor } from './setores-formulario';

@Component({
  imports: [SetoresFormulario],
  template: `<app-setores-formulario
    [pedido]="pedido()"
    (salvo)="salvos.push($event)"
    (fechado)="pedido.set(null)"
  />`,
})
class Hospedeiro {
  readonly pedido = signal<PedidoFormularioSetor | null>(null);
  readonly salvos: Setor[] = [];
}

const COMERCIAL_BASE: Setor = {
  chave: 'COMERCIAL',
  nome: 'Comercial',
  descricao: null,
  cor: 'menta',
  base: true,
  ativo: true,
  ordem: 2,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  lideres: [],
  contagens: { usuariosAtivos: 3, funisAtivos: 1 },
};

describe('SetoresFormulario (criar e editar setor)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Hospedeiro>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    entrarComo('ADMIN');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    responderSetores(http);
    await microtarefas();
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function aguardar() {
    await microtarefas();
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
  }

  async function abrirNovo() {
    fixture.componentInstance.pedido.set({ modo: 'criar' });
    fixture.detectChanges();
    await microtarefas();
    http.expectOne((p) => p.url === '/api/v1/usuarios').flush(pagina([HELENA, RAFAEL, LUCAS]));
    await aguardar();
  }

  function marcar(nome: string) {
    const caixa = Array.from(
      raiz().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((item) => item.closest('.caixa')?.textContent?.includes(nome))!;
    caixa.click();
    fixture.detectChanges();
  }

  const enviar = () => botaoComTexto(raiz(), 'Criar setor').click();

  it('explica o funil próprio e o rodízio, e só oferece pessoas de setor como líderes', async () => {
    await abrirNovo();
    expect(raiz().textContent).toContain('O setor nasce com um funil próprio');
    expect(raiz().textContent).toContain('rodízio');
    const rotulos = Array.from(raiz().querySelectorAll('.formulario__lista .caixa__rotulo')).map(
      (e) => e.textContent?.trim(),
    );
    expect(rotulos).toEqual(['Rafael Mendes · Líder Comercial', 'Lucas Pereira · Comercial']);
  });

  it('com líderes, o C-level responsável é obrigatório e nada é enviado sem ele', async () => {
    await abrirNovo();
    expect(() => campoPeloRotulo(raiz(), 'C-level responsável')).toThrow();
    digitar(raiz(), 'Nome do setor', 'Pós-venda');
    marcar('Lucas Pereira');
    // Só uma C-level possível: já vem escolhida; desfaz para testar a obrigatoriedade.
    escolher(raiz(), 'C-level responsável', 'Escolha o C-level');
    fixture.detectChanges();
    enviar();
    await aguardar();
    http.expectNone('/api/v1/setores');
    expect(campoPeloRotulo(raiz(), 'C-level responsável').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('cria com líderes e C-level, recarrega os setores e fecha', async () => {
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    await abrirNovo();
    digitar(raiz(), 'Nome do setor', 'Pós-venda');
    escolher(raiz(), 'Cor', 'Coral');
    marcar('Lucas Pereira');
    fixture.detectChanges();
    enviar();
    await aguardar();
    const pedido = http.expectOne('/api/v1/setores');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      nome: 'Pós-venda',
      cor: 'coral',
      lideres: ['u-lucas'],
      cLevelResponsavelId: 'u-helena',
    });
    pedido.flush({ ...COMERCIAL_BASE, chave: 'POS_VENDA', nome: 'Pós-venda', base: false });
    await microtarefas();
    expect(responderSetores(http)).toBe(1);
    await aguardar();
    expect(fixture.componentInstance.salvos.map((s) => s.chave)).toEqual(['POS_VENDA']);
    expect(fixture.componentInstance.pedido()).toBeNull();
    expect(sucesso).toHaveBeenCalled();
  });

  it('409 R1.8: nome em uso aparece no campo nome', async () => {
    await abrirNovo();
    digitar(raiz(), 'Nome do setor', 'Comercial');
    enviar();
    await aguardar();
    const falha = erroDaApiFalso(
      409,
      'conflito',
      'Já existe um setor ativo com o nome “Comercial”.',
      {
        regra: 'R1.8',
        campos: ['nome'],
        chave: 'COMERCIAL',
      },
    );
    http.expectOne('/api/v1/setores').flush(falha.corpo, falha.opcoes);
    await aguardar();
    expect(campoPeloRotulo(raiz(), 'Nome do setor').getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('Já existe um setor ativo com o nome');
  });

  it('409 R1.3: mostra cada líder com liderados e quem são', async () => {
    await abrirNovo();
    digitar(raiz(), 'Nome do setor', 'Pós-venda');
    marcar('Rafael Mendes');
    enviar();
    await aguardar();
    const falha = erroDaApiFalso(409, 'conflito', 'Há líderes com liderados.', {
      regra: 'R1.3',
      pendencias: [
        {
          usuario: { id: 'u-rafael', nome: 'Rafael Mendes' },
          liderados: [
            { id: 'u-lucas', nome: 'Lucas Pereira', papel: 'MEMBRO', area: 'COMERCIAL' },
            { id: 'u-bia', nome: 'Bia Lima', papel: 'MEMBRO', area: 'COMERCIAL' },
          ],
        },
      ],
    });
    http.expectOne('/api/v1/setores').flush(falha.corpo, falha.opcoes);
    await aguardar();
    const bloco = raiz().querySelector('.formulario__pendencias')!;
    expect(bloco.textContent).toContain('Rafael Mendes');
    expect(bloco.textContent).toContain('Lucas Pereira, Bia Lima');
    expect(bloco.querySelector('a')!.getAttribute('href')).toBe('/configuracoes/usuarios');
  });

  it('422 R1.2 vai para o C-level; 422 R1.7 e R1.4 para os líderes', async () => {
    await abrirNovo();
    digitar(raiz(), 'Nome do setor', 'Pós-venda');
    marcar('Lucas Pereira');
    enviar();
    await aguardar();
    let falha = erroDaApiFalso(422, 'regra_violada', 'O C-level responsável não é válido.', {
      regra: 'R1.2',
    });
    http.expectOne('/api/v1/setores').flush(falha.corpo, falha.opcoes);
    await aguardar();
    expect(campoPeloRotulo(raiz(), 'C-level responsável').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(raiz().textContent).toContain('O C-level responsável não é válido.');

    enviar();
    await aguardar();
    falha = erroDaApiFalso(422, 'regra_violada', 'Um dos líderes está desligado.', {
      regra: 'R1.7',
    });
    http.expectOne('/api/v1/setores').flush(falha.corpo, falha.opcoes);
    await aguardar();
    expect(raiz().querySelector('.formulario__lideres .formulario__erro')!.textContent).toContain(
      'Um dos líderes está desligado.',
    );
  });

  it('editar manda só o que mudou', async () => {
    fixture.componentInstance.pedido.set({ modo: 'editar', setor: COMERCIAL_BASE });
    fixture.detectChanges();
    await aguardar();
    expect(raiz().textContent).toContain('Editar Comercial');
    escolher(raiz(), 'Cor', 'Coral');
    fixture.detectChanges();
    botaoComTexto(raiz(), 'Salvar alterações').click();
    await aguardar();
    const pedido = http.expectOne('/api/v1/setores/COMERCIAL');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ cor: 'coral' });
    pedido.flush({ ...COMERCIAL_BASE, cor: 'coral' });
    await microtarefas();
    responderSetores(http);
    await aguardar();
    expect(fixture.componentInstance.pedido()).toBeNull();
  });
});
