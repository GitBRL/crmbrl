import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfiguracaoAssistente } from '../../layout/ajuda/ajuda.tipos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { entrarComo } from '../../nucleo/sessao/sessao-de-teste';
import { DuvidasApi } from '../administracao/duvidas/duvidas.api';
import { AssistenteConfig, inteiroOuNulo } from './assistente-config';
import { SECOES_CONFIGURACOES } from './secoes';

const CONFIG: ConfiguracaoAssistente = {
  perguntasPorDia: 20,
  orcamentoMensalTokens: null,
  destino: 'TICKETHUB',
  ticketHub: {
    url: 'http://tickethub.local',
    urlPublica: null,
    email: 'servico@tickethub.local',
    senhaDefinida: true,
    prioridade: 'media',
    sistemaId: null,
    origem: { url: 'admin', email: 'admin', senha: 'admin' },
  },
  webhook: {
    url: null,
    cabecalhos: [{ nome: 'X-Token', valorMascarado: '••••12' }],
    segredoDefinido: false,
    segredoMascarado: null,
    modeloCorpo: null,
    modeloCorpoPadrao: '{"titulo":"{{titulo}}"}',
  },
  destinoPronto: true,
  motivoDestino: null,
  uso: { tokensNoMes: 5000, orcamentoMensalTokens: null, perguntasHoje: 3, perguntasNoMes: 40 },
  baseDeConhecimento: { artigos: [{ arquivo: 'a.md', titulo: 'Artigo A' }], avisos: [] },
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Configuração do assistente', () => {
  let api: Record<'configuracao' | 'salvarConfiguracao' | 'testar', ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AssistenteConfig>;
  let raiz: HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    api = {
      configuracao: vi.fn(() => Promise.resolve(CONFIG)),
      salvarConfiguracao: vi.fn((c: unknown) =>
        Promise.resolve({
          ...CONFIG,
          perguntasPorDia: (c as { perguntasPorDia: number }).perguntasPorDia,
        }),
      ),
      testar: vi.fn(() => Promise.resolve({ ok: true, mensagem: 'Login feito.' })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: DuvidasApi, useValue: api }] });
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(AssistenteConfig);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('só o Admin tem a seção', () => {
    const secao = SECOES_CONFIGURACOES.find((s) => s.caminho === 'assistente')!;
    const sessao = TestBed.inject(SessaoService);
    expect(sessao.permite(secao.permite)).toBe(true);
    entrarComo('COMERCIAL');
    expect(sessao.permite(secao.permite)).toBe(false);
    entrarComo('C_LEVEL');
    expect(sessao.permite(secao.permite)).toBe(false);
  });

  it('mostra limites, uso, destino pronto e a base de conhecimento; nunca a senha', () => {
    const t = texto(raiz);
    expect(t).toContain('Perguntas por pessoa por dia');
    expect(t).toContain('5.000 tokens no mês');
    expect(t).toContain('pronto');
    expect(t).toContain('Artigo A');
    expect((raiz.querySelector('input[type=password]') as HTMLInputElement).value).toBe('');
  });

  it('salvar manda o parcial: sem senha quando ela não foi digitada', async () => {
    (
      Array.from(raiz.querySelectorAll('button')).find(
        (b) => texto(b) === 'Salvar configuração',
      ) as HTMLElement
    ).click();
    await esperar();
    const corpo = api.salvarConfiguracao.mock.calls[0][0];
    expect(corpo.perguntasPorDia).toBe(20);
    expect(corpo.orcamentoMensalTokens).toBeNull();
    expect(corpo.ticketHub).not.toHaveProperty('senha');
    expect(corpo.webhook).not.toHaveProperty('segredo');
    expect(corpo.webhook).not.toHaveProperty('cabecalhos');
  });

  it('testar o destino mostra o resultado', async () => {
    (
      Array.from(raiz.querySelectorAll('button')).find(
        (b) => texto(b) === 'Testar o destino',
      ) as HTMLElement
    ).click();
    await esperar();
    expect(texto(raiz)).toContain('Deu certo: Login feito.');
  });

  it('inteiroOuNulo', () => {
    expect(inteiroOuNulo('')).toBeNull();
    expect(inteiroOuNulo(' 12 ')).toBe(12);
    expect(inteiroOuNulo('-1')).toBe('invalido');
    expect(inteiroOuNulo('1.5')).toBe('invalido');
  });
});
