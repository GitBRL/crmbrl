import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AvisosService } from '../../../nucleo/avisos.service';
import { type PapelDeTeste, entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { responderSetores } from '../../../nucleo/setores/setores-de-teste';
import {
  botaoComTexto,
  campoPeloRotulo,
  digitar,
  erroDaApiFalso,
  escolher,
  microtarefas,
  opcoesDe,
} from '../dados-de-teste';
import {
  etapasDoRascunho,
  FormularioNovoFunil,
  type RascunhoDeFunil,
  temErrosDeFunil,
  validarRascunhoDeFunil,
} from './novo-funil';

const RASCUNHO: RascunhoDeFunil = {
  nome: 'Parcerias',
  area: 'COMERCIAL',
  descricao: '',
  abertas: ['Novo', 'Em andamento'],
  ganho: 'Ganho',
  perda: 'Perdido',
};

describe('validação do novo funil (R5.1, R5.2)', () => {
  it('o rascunho padrão é válido', () => {
    expect(temErrosDeFunil(validarRascunhoDeFunil(RASCUNHO))).toBe(false);
  });

  it('exige nome e setor, e limita o tamanho do nome e da descrição', () => {
    const erros = validarRascunhoDeFunil({ ...RASCUNHO, nome: '  ', area: null });
    expect(erros.nome).toBe('Dê um nome ao funil.');
    expect(erros.area).toBe('Escolha o setor do funil.');
    expect(validarRascunhoDeFunil({ ...RASCUNHO, nome: 'x'.repeat(101) }).nome).toContain('100');
    expect(validarRascunhoDeFunil({ ...RASCUNHO, descricao: 'x'.repeat(501) }).descricao).toContain(
      '500',
    );
  });

  it('exige ao menos uma etapa aberta, nomes preenchidos e sem repetição', () => {
    expect(validarRascunhoDeFunil({ ...RASCUNHO, abertas: [] }).etapas).toContain('ao menos uma');
    const vazia = validarRascunhoDeFunil({ ...RASCUNHO, abertas: ['Novo', ''] });
    expect(vazia.abertas).toEqual([null, 'Dê um nome à etapa.']);
    const igual = validarRascunhoDeFunil({ ...RASCUNHO, abertas: ['Novo', ' novo '] });
    expect(igual.abertas).toEqual([
      'Já existe uma etapa com este nome.',
      'Já existe uma etapa com este nome.',
    ]);
    // O nome do ganho também não pode repetir o de uma aberta.
    expect(validarRascunhoDeFunil({ ...RASCUNHO, ganho: 'Novo' }).ganho).toContain('Já existe');
  });

  it('no máximo 30 etapas', () => {
    const abertas = Array.from({ length: 29 }, (_, i) => `Etapa ${i}`);
    expect(validarRascunhoDeFunil({ ...RASCUNHO, abertas }).etapas).toContain('no máximo 30');
  });

  it('monta as etapas: abertas na ordem, depois uma de ganho e uma de perda', () => {
    expect(etapasDoRascunho({ ...RASCUNHO, abertas: [' Novo ', 'Proposta'] })).toEqual([
      { nome: 'Novo', tipo: 'ABERTA' },
      { nome: 'Proposta', tipo: 'ABERTA' },
      { nome: 'Ganho', tipo: 'GANHO' },
      { nome: 'Perdido', tipo: 'PERDIDO' },
    ]);
  });
});

describe('FormularioNovoFunil', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<FormularioNovoFunil>;
  let avisos: AvisosService;

  async function abrir(papel: PapelDeTeste) {
    entrarComo(papel);
    fixture = TestBed.createComponent(FormularioNovoFunil);
    fixture.detectChanges();
    responderSetores(http, [
      { chave: 'SUPORTE', nome: 'Suporte' },
      { chave: 'ANTIGO', nome: 'Antigo', ativo: false },
    ]);
    await microtarefas();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    avisos = TestBed.inject(AvisosService);
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  async function enviar() {
    raiz()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await microtarefas();
    fixture.detectChanges();
  }

  it('Admin e C-level escolhem o setor entre os ativos', async () => {
    await abrir('ADMIN');
    expect(opcoesDe(raiz(), 'Setor')).toEqual([
      'Marketing',
      'Comercial',
      'Customer Success',
      'Suporte',
    ]);
    await abrir('C_LEVEL');
    expect(opcoesDe(raiz(), 'Setor')).toContain('Suporte');
  });

  it('o líder fica com o próprio setor, sem escolha', async () => {
    await abrir('LIDER_COMERCIAL');
    expect(() => campoPeloRotulo(raiz(), 'Setor')).toThrow();
    expect(raiz().querySelector('.setor-fixo')?.textContent).toContain('Comercial');

    digitar(raiz(), 'Nome do funil', 'Parcerias');
    fixture.detectChanges();
    await enviar();
    const pedido = http.expectOne('/api/v1/funis');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      nome: 'Parcerias',
      area: 'COMERCIAL',
      descricao: null,
      visibilidade: 'SETOR',
      etapas: [
        { nome: 'Novo', tipo: 'ABERTA' },
        { nome: 'Em andamento', tipo: 'ABERTA' },
        { nome: 'Ganho', tipo: 'GANHO' },
        { nome: 'Perdido', tipo: 'PERDIDO' },
      ],
    });
    pedido.flush(
      { id: 'f1', nome: 'Parcerias', area: 'COMERCIAL', etapas: [] },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sem preencher, mostra os erros e não chama a API', async () => {
    await abrir('ADMIN');
    await enviar();
    expect(raiz().textContent).toContain('Dê um nome ao funil.');
    expect(raiz().textContent).toContain('Escolha o setor do funil.');
    http.expectNone('/api/v1/funis');
  });

  it('adiciona, reordena e remove etapas abertas; sempre sobra uma', async () => {
    await abrir('LIDER_COMERCIAL');
    const nomes = () =>
      [...raiz().querySelectorAll<HTMLInputElement>('.etapa input')].map((i) => i.value);
    expect(nomes()).toEqual(['Novo', 'Em andamento']);
    botaoComTexto(raiz(), 'Adicionar etapa').click();
    fixture.detectChanges();
    expect(nomes()).toEqual(['Novo', 'Em andamento', '']);
    raiz().querySelector<HTMLButtonElement>('[aria-label="Subir a etapa 2"]')!.click();
    fixture.detectChanges();
    expect(nomes().slice(0, 2)).toEqual(['Em andamento', 'Novo']);
    raiz().querySelector<HTMLButtonElement>('[aria-label="Remover a etapa 3"]')!.click();
    raiz().querySelector<HTMLButtonElement>('[aria-label="Remover a etapa 2"]')!.click();
    fixture.detectChanges();
    expect(nomes()).toEqual(['Em andamento']);
    expect(
      raiz().querySelector<HTMLButtonElement>('[aria-label="Remover a etapa 1"]')!.disabled,
    ).toBe(true);
  });

  it('nome repetido (409) aparece no campo Nome', async () => {
    await abrir('LIDER_COMERCIAL');
    digitar(raiz(), 'Nome do funil', 'Comercial');
    await enviar();
    const { corpo, opcoes } = erroDaApiFalso(
      409,
      'conflito',
      'Já existe um funil chamado "Comercial" na área Comercial.',
    );
    http.expectOne('/api/v1/funis').flush(corpo, opcoes);
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Já existe um funil chamado');
  });

  it('setor inválido (422 R1.9) aparece no campo Setor', async () => {
    await abrir('ADMIN');
    escolher(raiz(), 'Setor', 'Suporte');
    digitar(raiz(), 'Nome do funil', 'Suporte N2');
    await enviar();
    const { corpo, opcoes } = erroDaApiFalso(
      422,
      'regra_violada',
      'O setor SUPORTE não existe ou está desativado.',
      {
        regra: 'R1.9',
        campo: 'area',
        area: 'SUPORTE',
      },
    );
    http.expectOne('/api/v1/funis').flush(corpo, opcoes);
    await microtarefas();
    fixture.detectChanges();
    const erro = [...raiz().querySelectorAll('app-seletor')].find((e) =>
      e.textContent?.includes('Setor'),
    )!;
    expect(erro.textContent).toContain('não existe ou está desativado');
  });

  it('criou: abre o quadro do funil novo e avisa', async () => {
    await abrir('LIDER_COMERCIAL');
    const sucesso = vi.spyOn(avisos, 'sucesso');
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    digitar(raiz(), 'Nome do funil', 'Parcerias');
    await enviar();
    http
      .expectOne('/api/v1/funis')
      .flush(
        { id: 'f-novo', nome: 'Parcerias', area: 'COMERCIAL', etapas: [] },
        { status: 201, statusText: 'Created' },
      );
    await microtarefas();
    expect(sucesso).toHaveBeenCalledWith('Funil “Parcerias” criado.');
    expect(ir).toHaveBeenCalledWith(['/funis', 'comercial'], { queryParams: { funil: 'f-novo' } });
  });
});
