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

describe('Importar: página única', () => {
  let http: HttpTestingController;

  const RASCUNHO = {
    id: 'i1',
    tipo: 'CONTATOS',
    status: 'RASCUNHO',
    nome: 'leads.csv',
    formato: 'csv',
    leitura: {},
    colunas: ['Nome', 'Email', 'Cidade'],
    totalLinhas: 3500,
    mapeamento: { Nome: 'nome', Email: 'email' },
    modeloId: null,
    duplicados: 'ATUALIZAR_VAZIOS',
    etiquetas: [],
    estrategiaResponsavel: null,
    responsavelId: null,
    areaRodizio: null,
    origemDetalhe: null,
    filtro: null,
    negocio: null,
  };

  const FUNIS = [
    {
      id: 'f1',
      nome: 'Comercial',
      ativo: true,
      etapas: [
        { id: 'e1', nome: 'Novo lead', tipo: 'ABERTA' },
        { id: 'e2', nome: 'Perdido', tipo: 'PERDIDO' },
      ],
    },
  ];

  async function montar(tipoFixo?: 'PARCELAS', rascunho = true) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSocketFalso().providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: tipoFixo ? { tipo: tipoFixo } : {},
              queryParamMap: new Map(rascunho ? [['importacao', 'i1']] : []),
            },
          },
        },
      ],
    });
    entrarComo('LIDER_CS');
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Importar);
    fixture.detectChanges();
    http.match((r) => r.url === '/api/v1/importacoes').forEach((r) => r.flush({ itens: [] }));
    http.match((r) => r.url === '/api/v1/funis').forEach((r) => r.flush(FUNIS));
    if (rascunho) {
      http
        .expectOne((r) => r.url === '/api/v1/importacoes/i1')
        .flush({
          ...RASCUNHO,
          ...(tipoFixo ? { tipo: tipoFixo } : {}),
        });
      await new Promise((resolver) => setTimeout(resolver));
      http
        .expectOne((r) => r.url === '/api/v1/importacoes/i1/previa')
        .flush({ colunas: RASCUNHO.colunas, linhas: [], totalLinhas: 3500, sugestao: {} });
      await new Promise((resolver) => setTimeout(resolver));
      http.match((r) => r.url === '/api/v1/importacoes/campos').forEach((r) => r.flush([]));
      http.match((r) => r.url === '/api/v1/importacoes/modelos').forEach((r) => r.flush([]));
    }
    await estabilizar(fixture);
    return fixture;
  }

  const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
  const botaoCriar = (fixture: ComponentFixture<unknown>) =>
    Array.from(el(fixture).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Criar importação'),
    ) as HTMLButtonElement;
  const titulos = (fixture: ComponentFixture<unknown>) =>
    Array.from(el(fixture).querySelectorAll('h3')).map((h) => h.textContent?.trim());

  afterEach(() => vi.restoreAllMocks());

  it('mostra os cinco cartões, o filtro, o mapeamento e o rodapé', async () => {
    const fixture = await montar();
    expect(titulos(fixture)).toEqual([
      'Arquivo',
      'Opções do arquivo',
      'Etiquetas para todos',
      'Responsável para todos',
      'Negócio para todos',
      'Filtrar linhas da planilha',
      'Mapeamento de colunas',
    ]);
    expect(el(fixture).textContent).toContain('segundo plano');
  });

  it('rodapé: desabilitado sem planilha, habilitado com nome e e-mail mapeados', async () => {
    const vazio = await montar(undefined, false);
    expect(botaoCriar(vazio).disabled).toBe(true);
    expect(el(vazio).textContent).toContain('Selecione uma planilha');
    TestBed.resetTestingModule();

    const fixture = await montar();
    expect(botaoCriar(fixture).disabled).toBe(false);
    expect(el(fixture).textContent).toContain('3.500 linhas');
    const mapeamento = (
      fixture.componentInstance as unknown as { mapeamento: { set(v: unknown): void } }
    ).mapeamento;
    mapeamento.set({ Nome: 'nome' });
    await estabilizar(fixture);
    expect(botaoCriar(fixture).disabled).toBe(true);
  });

  it('filtro: adicionar e remover regra, e esconder o valor em "está vazio"', async () => {
    const fixture = await montar();
    const adicionar = Array.from(el(fixture).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Adicionar regra'),
    ) as HTMLButtonElement;
    adicionar.click();
    await estabilizar(fixture);
    expect(el(fixture).querySelectorAll('.regra').length).toBe(1);
    expect(
      el(fixture).querySelector('.regra input[type="text"], .regra input:not([type])'),
    ).not.toBeNull();
    // Regra incompleta (sem valor) trava o botão.
    expect(botaoCriar(fixture).disabled).toBe(true);

    const componente = fixture.componentInstance as unknown as {
      regras: { (): { chave: number }[] };
      mudarRegra(chave: number, m: unknown): void;
    };
    const chave = componente.regras()[0].chave;
    componente.mudarRegra(chave, { operador: 'VAZIO' });
    await estabilizar(fixture);
    expect(el(fixture).querySelector('.regra input')).toBeNull();
    expect(botaoCriar(fixture).disabled).toBe(false);

    (el(fixture).querySelector('.regra button') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(el(fixture).querySelectorAll('.regra').length).toBe(0);
  });

  it('negócio: as etapas do funil escolhido não incluem a de perda', async () => {
    const fixture = await montar();
    await estabilizar(fixture);
    const c = fixture.componentInstance as unknown as {
      mudarFunil(id: string): void;
      opcoesEtapa: () => { rotulo: string }[];
      negocioOk: () => boolean;
    };
    expect(c.negocioOk()).toBe(true);
    c.mudarFunil('f1');
    await estabilizar(fixture);
    expect(c.opcoesEtapa().map((o) => o.rotulo)).toEqual(['Novo lead']);
    // Funil sem etapa trava o botão.
    expect(c.negocioOk()).toBe(false);
    expect(botaoCriar(fixture).disabled).toBe(true);
  });

  it('parcelas: sem os cartões de contato (etiquetas, responsável, negócio) nem DDI', async () => {
    const fixture = await montar('PARCELAS');
    expect(titulos(fixture)).toEqual([
      'Arquivo',
      'Opções do arquivo',
      'Filtrar linhas da planilha',
      'Mapeamento de colunas',
    ]);
    expect(el(fixture).textContent).not.toContain('DDI padrão');
    expect(el(fixture).textContent).toContain('Títulos duplicados');
  });
});
