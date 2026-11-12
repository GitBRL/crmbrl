import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EditorPainel, metaParaApi, metaParaTela } from './editor-painel';
import { SEM_OPCOES_INDICADOR } from './filtros-indicador';
import { CATALOGO_DE_TESTE, painel, widget } from './indicadores-de-teste';

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('metas no editor (R33.5)', () => {
  it('duração: minutos na tela, segundos na API', () => {
    expect(metaParaApi('DURACAO', '30')).toBe(1800);
    expect(metaParaTela('DURACAO', 1800)).toBe('30');
  });

  it('número e percentual seguem como digitados; vazio ou negativo é sem meta', () => {
    expect(metaParaApi('NUMERO', '40')).toBe(40);
    expect(metaParaApi('PERCENTUAL', '12,5')).toBe(12.5);
    expect(metaParaApi('NUMERO', '')).toBeNull();
    expect(metaParaApi('NUMERO', '-3')).toBeNull();
    expect(metaParaTela('NUMERO', null)).toBe('');
  });
});

describe('EditorPainel', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function criar(
    existente = painel({
      widgets: [widget({ id: 'a' }), widget({ id: 'b', indicador: 'taxa_no_show', ordem: 1 })],
    }),
  ) {
    const fixture = TestBed.createComponent(EditorPainel);
    fixture.componentRef.setInput('painel', existente);
    fixture.componentRef.setInput('catalogo', CATALOGO_DE_TESTE);
    fixture.componentRef.setInput('opcoes', SEM_OPCOES_INDICADOR);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const botoes = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll('button'));
  const achar = (raiz: HTMLElement, trecho: string) =>
    botoes(raiz).find((b) => (b.getAttribute('aria-label') ?? texto(b)).includes(trecho))!;

  it('R33.8 — o catálogo vem agrupado e a busca filtra por nome e descrição', async () => {
    const f = await criar();
    const raiz = f.nativeElement as HTMLElement;
    expect(Array.from(raiz.querySelectorAll('.catalogo__titulo')).map(texto)).toEqual([
      'Leads',
      'Reuniões',
      'Vendas',
    ]);
    const campo = raiz.querySelector('input[type="search"]') as HTMLInputElement;
    campo.value = 'no-show';
    campo.dispatchEvent(new Event('input'));
    await f.whenStable();
    f.detectChanges();
    expect(Array.from(raiz.querySelectorAll('.catalogo__titulo')).map(texto)).toEqual(['Reuniões']);
  });

  it('R33.8 — adicionar do catálogo põe o indicador no fim e abre a configuração', async () => {
    const f = await criar();
    const raiz = f.nativeElement as HTMLElement;
    achar(raiz, 'Adicionar Conversão entre etapas').click();
    await f.whenStable();
    f.detectChanges();
    expect(raiz.querySelectorAll('.item')).toHaveLength(3);
    expect(texto(raiz.querySelector('.config'))).toContain('Etapa de origem');
  });

  it('R33.8 — reordenar pelo teclado: Subir e Descer movem o indicador e desligam a ponta', async () => {
    const f = await criar();
    const raiz = f.nativeElement as HTMLElement;
    const nomes = () => Array.from(raiz.querySelectorAll('.item__nome')).map(texto);
    expect(nomes()).toEqual(['Leads recebidos', 'Taxa de no-show']);
    expect(achar(raiz, 'Subir Leads recebidos').disabled).toBe(true);
    achar(raiz, 'Descer Leads recebidos').click();
    await f.whenStable();
    f.detectChanges();
    expect(nomes()).toEqual(['Taxa de no-show', 'Leads recebidos']);
  });

  it('R33.8 — remover tira o indicador da lista', async () => {
    const f = await criar();
    const raiz = f.nativeElement as HTMLElement;
    achar(raiz, 'Remover Leads recebidos').click();
    await f.whenStable();
    f.detectChanges();
    expect(Array.from(raiz.querySelectorAll('.item__nome')).map(texto)).toEqual([
      'Taxa de no-show',
    ]);
  });

  it('R33.6 — salvar sem parâmetro obrigatório não chama a API e abre o indicador com o aviso', async () => {
    const f = await criar(
      painel({ widgets: [widget({ id: 'c', indicador: 'conversao_entre_etapas' })] }),
    );
    const raiz = f.nativeElement as HTMLElement;
    achar(raiz, 'Salvar painel').click();
    await f.whenStable();
    f.detectChanges();
    http.expectNone('/api/v1/indicadores/paineis/p1');
    expect(texto(raiz.querySelector('.config__erro'))).toContain('Etapa de origem');
  });

  it('R33.6 — salvar envia o painel inteiro (nome, filtros e indicadores na ordem) por PATCH', async () => {
    const f = await criar();
    const raiz = f.nativeElement as HTMLElement;
    achar(raiz, 'Descer Leads recebidos').click();
    await f.whenStable();
    f.detectChanges();
    let salvo: unknown = null;
    f.componentInstance.salvo.subscribe((p) => (salvo = p));
    achar(raiz, 'Salvar painel').click();
    const pedido = http.expectOne('/api/v1/indicadores/paineis/p1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body.nome).toBe('Time comercial');
    expect(
      pedido.request.body.widgets.map((w: { id: string; ordem: number }) => [w.id, w.ordem]),
    ).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
    pedido.flush(painel());
    await f.whenStable();
    expect(salvo).not.toBeNull();
  });

  it('R33.6 — painel novo exige nome', async () => {
    const fixture = TestBed.createComponent(EditorPainel);
    fixture.componentRef.setInput('catalogo', CATALOGO_DE_TESTE);
    fixture.componentRef.setInput('opcoes', SEM_OPCOES_INDICADOR);
    await fixture.whenStable();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    achar(raiz, 'Salvar painel').click();
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectNone('/api/v1/indicadores/paineis');
    expect(texto(raiz)).toContain('Dê um nome ao painel.');
  });
});
