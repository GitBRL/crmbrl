import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AvisosService } from '../../nucleo/avisos.service';
import type { Passagem } from './configuracoes.modelos';
import { microtarefas } from './dados-de-teste';
import { dicaDoAlternador, execucoes, Passagens, quemRecebe } from './passagens';

const MKT_COM: Passagem = {
  id: 'p1',
  chave: 'marketing_comercial',
  nome: 'Marketing → Comercial',
  funilOrigem: { id: 'f-mkt', nome: 'Marketing', area: 'MARKETING' },
  etapaGatilho: { id: 'e-mql', nome: 'Qualificado (MQL)', tipo: 'GANHO', ordem: 4 },
  funilDestino: { id: 'f-com', nome: 'Comercial', area: 'COMERCIAL' },
  etapaDestino: { id: 'e-novo', nome: 'Novo', tipo: 'ABERTA', ordem: 1 },
  estrategia: 'RODIZIO',
  responsavelFixo: null,
  ativa: true,
  execucoes: 4,
  criadoEm: '2026-10-21T12:00:00.000Z',
  atualizadoEm: '2026-10-21T12:00:00.000Z',
};

describe('Passagens (R5.7)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<Passagens>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Passagens);
    fixture.detectChanges();
    http.expectOne('/api/v1/passagens').flush([MKT_COM]);
    await microtarefas();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const raiz = () => fixture.nativeElement as HTMLElement;

  it('mostra gatilho, destino, quem recebe e quantas vezes rodou', () => {
    const cartao = raiz().querySelector('.passagem')!.textContent ?? '';
    expect(cartao).toContain('Marketing → Comercial');
    expect(cartao).toContain('Qualificado (MQL)');
    expect(cartao).toContain('Funil Marketing');
    expect(cartao).toContain('Novo');
    expect(cartao).toContain('Rodízio de Comercial: a próxima pessoa da fila');
    expect(cartao).toContain('Já rodou 4 vezes');
    expect(cartao).toContain('Ativa');
  });

  it('a dica do alternador começa pela situação que ele mostra', () => {
    expect(dicaDoAlternador(MKT_COM)).toBe(
      'Ligada: cada negócio que entra em Qualificado (MQL) gera um negócio em Comercial. Se desligar, os próximos param de passar.',
    );
    expect(dicaDoAlternador({ ...MKT_COM, ativa: false })).toBe(
      'Desligada: os negócios que entram em Qualificado (MQL) não passam para Comercial. Se ligar, cada um gera um negócio em Comercial.',
    );
    expect(raiz().querySelector('.passagem')!.textContent).toContain('Ligada: cada negócio');
  });

  it('desativa na hora pelo alternador, com "Desfazer"', async () => {
    const sucesso = vi.spyOn(TestBed.inject(AvisosService), 'sucesso');
    raiz().querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    fixture.detectChanges();
    const pedido = http.expectOne('/api/v1/passagens/p1');
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ ativa: false });
    pedido.flush({ ...MKT_COM, ativa: false });
    await microtarefas();
    fixture.detectChanges();
    expect(raiz().querySelector('.passagem')!.textContent).toContain('Desativada');
    expect(sucesso).toHaveBeenCalledWith(
      'Passagem “Marketing → Comercial” desativada: nada passa até você ativar de novo.',
      expect.objectContaining({ acao: expect.objectContaining({ rotulo: 'Desfazer' }) }),
    );
    sucesso.mock.calls[0][1]!.acao!.executar();
    const desfazer = http.expectOne('/api/v1/passagens/p1');
    expect(desfazer.request.body).toEqual({ ativa: true });
    desfazer.flush(MKT_COM);
    await microtarefas();
  });

  it('textos de quem recebe e das execuções', () => {
    expect(quemRecebe({ ...MKT_COM, estrategia: 'LIDER_DA_AREA' })).toBe('O líder de Comercial');
    expect(
      quemRecebe({
        ...MKT_COM,
        estrategia: 'RESPONSAVEL_FIXO',
        responsavelFixo: { id: 'u', nome: 'Ana Souza' },
      }),
    ).toBe('Sempre Ana Souza (responsável fixo)');
    expect(execucoes({ ...MKT_COM, execucoes: 0 })).toBe('Ainda não rodou');
    expect(execucoes({ ...MKT_COM, execucoes: 1 })).toBe('Já rodou 1 vez');
    expect(execucoes({ ...MKT_COM, execucoes: 1600 })).toBe('Já rodou 1.600 vezes');
  });
});
