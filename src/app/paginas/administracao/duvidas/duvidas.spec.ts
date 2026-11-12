import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AjudaApi } from '../../../layout/ajuda/ajuda.api';
import type {
  ChamadoAdmin,
  PerguntaDoHistorico,
  TemaSemResposta,
} from '../../../layout/ajuda/ajuda.tipos';
import { entrarComo } from '../../../nucleo/sessao/sessao-de-teste';
import { BiApi } from '../../bi/bi.api';
import { Duvidas } from './duvidas';
import { consultaDoHistorico, DuvidasApi } from './duvidas.api';

const PERGUNTA: PerguntaDoHistorico = {
  id: 'p1',
  conversaId: 'c1',
  pergunta: 'Quero integração com o Pipedrive',
  tela: '/funis/comercial',
  modulo: 'funis',
  status: 'CONCLUIDA',
  resposta: 'O CRM ainda não tem isso.',
  resolvido: false,
  categoria: 'funcionalidade_inexistente_no_escopo',
  resumoDoPedido: 'Integração Pipedrive',
  erro: null,
  avaliacao: 'NAO_UTIL',
  podeAbrirChamado: true,
  chamado: null,
  criadoEm: '2026-10-31T10:00:00Z',
  tokens: 120,
  usuario: { id: 'u1', nome: 'Lucas Pereira', papel: 'MEMBRO', area: 'COMERCIAL' },
};
const TEMA: TemaSemResposta = {
  resumo: 'Integração Pipedrive',
  modulo: 'funis',
  categoria: 'funcionalidade_inexistente_no_escopo',
  total: 3,
  pessoas: 2,
  ultimaEm: '2026-10-31T10:00:00Z',
  exemploPerguntaId: 'p1',
};
const CHAMADO: ChamadoAdmin = {
  id: 'ch1',
  conversaId: 'c1',
  perguntaId: 'p1',
  titulo: 'Integração Pipedrive',
  descricao: 'x',
  tela: '/funis/comercial',
  categoria: 'funcionalidade_inexistente_no_escopo',
  destino: 'TICKETHUB',
  status: 'FALHOU',
  tentativas: 6,
  proximaTentativaEm: null,
  ultimoErro: 'TicketHub fora do ar',
  numero: null,
  link: null,
  criadoEm: '2026-10-31T10:00:00Z',
  enviadoEm: null,
  usuario: { id: 'u1', nome: 'Lucas Pereira' },
};

const texto = (e: Element | null | undefined) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Dúvidas à IA (Admin)', () => {
  let api: Record<
    'historico' | 'temas' | 'chamados' | 'reenviar' | 'exportar',
    ReturnType<typeof vi.fn>
  >;
  let fixture: ComponentFixture<Duvidas>;
  let raiz: HTMLElement;
  const esperar = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    }
    await fixture.whenStable();
  };
  const aba = (rotulo: string) =>
    Array.from(raiz.querySelectorAll('[role=tab]')).find((t) => texto(t) === rotulo) as HTMLElement;

  beforeEach(async () => {
    api = {
      historico: vi.fn(() =>
        Promise.resolve({ itens: [PERGUNTA], total: 1, pagina: 1, porPagina: 20 }),
      ),
      temas: vi.fn(() => Promise.resolve([TEMA])),
      chamados: vi.fn(() =>
        Promise.resolve({ itens: [CHAMADO], total: 1, pagina: 1, porPagina: 20 }),
      ),
      reenviar: vi.fn(() => Promise.resolve({ ...CHAMADO, status: 'PENDENTE' })),
      exportar: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DuvidasApi, useValue: api },
        { provide: AjudaApi, useValue: { conversa: vi.fn() } },
        { provide: BiApi, useValue: { pessoas: () => Promise.resolve([]) } },
      ],
    });
    entrarComo('ADMIN');
    fixture = TestBed.createComponent(Duvidas);
    raiz = fixture.nativeElement;
    fixture.detectChanges();
    await esperar();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('abre no histórico, com a pergunta, a pessoa, o tipo e a avaliação', () => {
    const t = texto(raiz);
    expect(api.historico).toHaveBeenCalled();
    expect(t).toContain('Quero integração com o Pipedrive');
    expect(t).toContain('Lucas Pereira');
    expect(t).toContain('Pedido de funcionalidade');
    expect(t).toContain('Não útil');
  });

  it('mostra as três abas', () => {
    expect(Array.from(raiz.querySelectorAll('[role=tab]')).map(texto)).toEqual([
      'Histórico',
      'Temas sem resposta',
      'Chamados',
    ]);
  });

  it('"Ver perguntas" de um tema volta ao histórico filtrado por não resolvidas', async () => {
    aba('Temas sem resposta').click();
    await esperar();
    expect(texto(raiz)).toContain('Integração Pipedrive');
    api.historico.mockClear();
    (
      Array.from(raiz.querySelectorAll('button')).find(
        (b) => texto(b) === 'Ver perguntas',
      ) as HTMLElement
    ).click();
    await esperar();
    expect(api.historico).toHaveBeenCalledWith(
      expect.objectContaining({
        resolvido: false,
        modulo: 'funis',
        categoria: 'funcionalidade_inexistente_no_escopo',
      }),
    );
  });

  it('chamado que falhou pode ser reenviado', async () => {
    aba('Chamados').click();
    await esperar();
    expect(texto(raiz)).toContain('TicketHub fora do ar');
    (
      Array.from(raiz.querySelectorAll('button')).find((b) =>
        texto(b).startsWith('Reenviar'),
      ) as HTMLElement
    ).click();
    await esperar();
    expect(api.reenviar).toHaveBeenCalledWith('ch1');
  });

  it('consulta do histórico omite o que está vazio', () => {
    expect(
      consultaDoHistorico({
        de: null,
        ate: '2026-10-31',
        categoria: null,
        area: null,
        usuarioId: null,
        modulo: '  ',
        resolvido: false,
        avaliacao: null,
        comChamado: null,
        busca: ' pipedrive ',
      }),
    ).toEqual({
      de: null,
      ate: '2026-10-31',
      categoria: null,
      area: null,
      usuarioId: null,
      modulo: null,
      resolvido: false,
      avaliacao: null,
      comChamado: null,
      busca: 'pipedrive',
    });
  });
});
